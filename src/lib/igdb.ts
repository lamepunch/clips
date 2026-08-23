// Minimal IGDB client (native fetch — see plan: npm clients drag axios/Node
// deps for what is two requests). Auth is Twitch client-credentials.

import { env } from "cloudflare:workers";

type TokenResponse = {
  access_token: string;
  expires_in: number;
};

export type IgdbGame = {
  igdbId: number;
  title: string;
  slug: string;
  image: string | null;
};

type IgdbResponse = {
  id: number;
  name: string;
  slug: string;
  cover?: { url?: string };
  rating_count?: number;
};

// We can store the token in memory since a worker instance runs in an isolate
// that is shared across requests.
let cached: { token: string; expiresAt: number } | undefined;

async function getToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const url = new URL("https://id.twitch.tv/oauth2/token");
  url.searchParams.set("client_id", env.TWITCH_CLIENT_ID);
  url.searchParams.set("client_secret", env.TWITCH_CLIENT_SECRET);
  url.searchParams.set("grant_type", "client_credentials");

  const res = await fetch(url, { method: "POST" });
  if (!res.ok) throw new Error(`Twitch token failed (${res.status})`);

  const data = (await res.json()) as TokenResponse;

  cached = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000, // refresh a minute early
  };

  return cached.token;
}

/** POST an Apicalypse body to /v4/games. */
async function igdbQuery(body: string): Promise<IgdbResponse[]> {
  const token = await getToken();

  const res = await fetch("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: {
      "Client-ID": env.TWITCH_CLIENT_ID,
      Authorization: `Bearer ${token}`,
    },
    body,
  });
  if (!res.ok) throw new Error(`IGDB search failed (${res.status})`);

  return (await res.json()) as IgdbResponse[];
}

/** Convert an IGDB response to our internal game format. */
const toGame = (g: IgdbResponse): IgdbGame => ({
  igdbId: g.id,
  title: g.name,
  slug: g.slug,
  // cover.url is `//images.igdb.com/.../t_thumb/<id>.jpg`
  image: g.cover?.url
    ? `https:${g.cover.url.replace("t_thumb", "t_cover_big")}`
    : null,
});

/** Search IGDB games by name. Returns up to 10 mapped results. */
export async function searchGames(q: string): Promise<IgdbGame[]> {
  const term = q.trim();

  // Fail fast if the query is empty
  if (!term) return [];

  // Escape so user input can't break out of the Apicalypse string literal.
  const safe = term.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  // Exclude the following game types:
  // Game type 1 = DLC, 2 = expansion, 3 = bundle, 13 = pack, 14 = patch notes.
  // Most of these results are worthless, like "Team Fortress 2: War Update" or
  // "The Witcher 3: Wild Hunt - Blood and Wine"
  // ponytail: there are a handful of games IGDB only has as a bundle (Kirby
  // Super Star, Sonic 3 & Knuckles); allowlist those by id if anyone asks.
  const games = await igdbQuery(
    `search "${safe}"; fields name, slug, cover.url, rating_count; where game_type != (1,2,3,13,14); limit 50;`,
  );

  // Sort by rating count (highest first), then take the top 10 since
  // most non-popular games are usually not what we're looking for.
  return games
    .sort((a, b) => (b.rating_count ?? 0) - (a.rating_count ?? 0))
    .slice(0, 10)
    .map(toGame);
}

/** One game by IGDB id, or null. Used to create a local row from a trusted source. */
export async function getGame(igdbId: number): Promise<IgdbGame | null> {
  if (!Number.isSafeInteger(igdbId) || igdbId <= 0) return null;
  const [g] = await igdbQuery(
    `fields name, slug, cover.url; where id = ${igdbId}; limit 1;`,
  );
  return g ? toGame(g) : null;
}

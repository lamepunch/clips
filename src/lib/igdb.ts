// Minimal IGDB client (native fetch — see plan: npm clients drag axios/Node
// deps for what is two requests). Auth is Twitch client-credentials.

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
};

// Per-isolate token cache; a cold isolate just re-auths once.
let cached: { token: string; expiresAt: number } | undefined;

async function getToken(env: Env): Promise<string> {
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

/** Search IGDB games by name. Returns up to 10 mapped results. */
export async function searchGames(env: Env, q: string): Promise<IgdbGame[]> {
  const term = q.trim();
  if (!term) return [];

  const token = await getToken(env);
  // Escape so user input can't break out of the Apicalypse string literal.
  const safe = term.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  const res = await fetch("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: {
      "Client-ID": env.TWITCH_CLIENT_ID,
      Authorization: `Bearer ${token}`,
    },
    body: `search "${safe}"; fields name, slug, cover.url; limit 10;`,
  });
  if (!res.ok) throw new Error(`IGDB search failed (${res.status})`);

  const games = (await res.json()) as IgdbResponse[];
  return games.map((g) => ({
    igdbId: g.id,
    title: g.name,
    slug: g.slug,
    // cover.url is `//images.igdb.com/.../t_thumb/<id>.jpg`
    image: g.cover?.url
      ? `https:${g.cover.url.replace("t_thumb", "t_cover_big")}`
      : null,
  }));
}

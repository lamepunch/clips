import type { APIRoute } from "astro";
import { sql } from "@/db/d1";
import { searchGames } from "@/lib/igdb";

type Row = {
  igdbId: number;
  title: string;
  slug: string | null;
  image: string | null;
};

// GET /api/games/search?q=  — games already in the local table first, then
// IGDB for anything not added yet. Authenticated (middleware requires a session
// for /api/*) but not admin-gated, so non-admin flows (e.g. the clip game
// picker) can reuse it.
export const GET: APIRoute = async ({ url }) => {
  const q = url.searchParams.get("q")?.trim() ?? "";

  // A blank query gives `%%`, which lists everything already added.
  const { results } = await sql`
    select igdb_id as igdbId, title, slug, image from games
    where title like ${`%${q}%`}
    order by title limit 10
  `.all<Row>();

  const games = results.map((g) => ({ ...g, slug: g.slug ?? "", saved: true }));

  // Empty query returns only games already in the database
  if (!q) return Response.json(games);

  try {
    const seen = new Set(games.map((g) => g.igdbId));
    for (const g of await searchGames(q)) {
      if (!seen.has(g.igdbId)) games.push({ ...g, saved: false });
    }
  } catch (err) {
    // An IGDB outage shouldn't block picking a game you already have.
    console.error("IGDB search failed", err);
  }

  return Response.json(games);
};

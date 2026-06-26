import type { APIRoute } from "astro";
import { searchGames } from "@/lib/igdb";

// GET /api/games/search?q=  — proxies IGDB search. Authenticated (middleware
// requires a session for /api/*) but not admin-gated, so non-admin flows
// (e.g. the upload game picker) can reuse it.
export const GET: APIRoute = async ({ url, locals }) => {
  const q = url.searchParams.get("q") ?? "";
  try {
    return Response.json(await searchGames(locals.env, q));
  } catch (err) {
    console.error("IGDB search failed", err);
    return new Response("Search failed", { status: 502 });
  }
};

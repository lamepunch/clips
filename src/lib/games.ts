import { getGame } from "@/lib/igdb";
import { first, sql } from "@/db/d1";

/**
 * Get an existing game ID from the database, or create a new one from IGDB.
 */
export async function resolveGameId(igdbId: number): Promise<string | null> {
  // First, check if the game already exists in our database
  const existing = await first<{ id: string }>(
    sql`select id from games where igdb_id = ${igdbId}`,
  );

  // Found it, return the ID
  if (existing) return existing.id;

  // Not found, fetch from IGDB
  const game = await getGame(igdbId);

  // Can't find it in IGDB either, give up
  if (!game) return null;

  // If we found it, create a new record in our database
  const id = crypto.randomUUID();
  await sql`
    insert into games (id, igdb_id, title, slug, image)
    values (${id}, ${game.igdbId}, ${game.title}, ${game.slug}, ${game.image})
  `.run();

  return id;
}

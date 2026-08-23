import { env } from "cloudflare:workers";
import { createD1SqlTag, type SqlQueryFragment } from "d1-sql-tag";

/** D1 database binding. */
export const d1 = () => env.DB;

/**
 * Tagged template that runs against D1.
 */
export const sql = createD1SqlTag(env.DB);

/** Get the first row from a query, or null if none. */
export async function first<T extends object>(
  q: SqlQueryFragment,
): Promise<T | null> {
  const { results } = await q.all<T>();
  return results[0] ?? null;
}

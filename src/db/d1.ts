import { env } from "cloudflare:workers";
import {
  createD1SqlTag,
  type SqlQueryFragment,
  type SqlTag,
} from "d1-sql-tag";

/** D1 database binding. */
export const d1 = () => env.DB;

/**
 * Tagged template that runs against D1.
 * The wrapper resolves env.DB when called so the binding is not captured
 * during module initialization, outside a Worker request context.
 */
export const sql = ((...args: Parameters<SqlTag>) =>
  createD1SqlTag(env.DB)(...args)) as SqlTag;
sql.batch = (...args) => createD1SqlTag(env.DB).batch(...args);
sql.join = (...args) => createD1SqlTag(env.DB).join(...args);

/** Get the first row from a query, or null if none. */
export async function first<T extends object>(
  q: SqlQueryFragment,
): Promise<T | null> {
  const { results } = await q.all<T>();
  return results[0] ?? null;
}

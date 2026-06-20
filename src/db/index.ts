import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export type DB = ReturnType<typeof getDb>;

/** Per-request Drizzle client over the D1 binding. */
export function getDb(env: Env) {
  return drizzle(env.DB, { schema, logger: import.meta.env.DEV });
}

export { schema };

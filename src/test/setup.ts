import type { D1Migration } from "@cloudflare/vitest-pool-workers";
import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

// Schema for the test D1 binding, from the same migrations wrangler applies.
// TEST_MIGRATIONS is a test-only binding (vitest.config.ts), so it isn't part
// of the generated `Env` — cast rather than pollute it.
const { TEST_MIGRATIONS } = env as unknown as {
  TEST_MIGRATIONS: D1Migration[];
};

await applyD1Migrations(env.DB, TEST_MIGRATIONS);

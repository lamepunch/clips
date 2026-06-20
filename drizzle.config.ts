import { defineConfig } from "drizzle-kit";

// We only use drizzle-kit to *generate* SQL migrations from the schema.
// Migrations are applied to D1 with `wrangler d1 migrations apply` (see
// the package.json scripts), so no DB credentials are needed here.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./migrations",
});

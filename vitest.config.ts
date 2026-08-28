import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// Migrations are read here (Node side) and applied to the test D1 in
// src/test/setup.ts, which runs inside workerd.
const migrations = await readD1Migrations("./migrations");

// Tests run in workerd, so keep these compatibility settings in step with
// wrangler.jsonc.
export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        compatibilityDate: "2025-06-01",
        compatibilityFlags: ["nodejs_compat"],
        images: { binding: "IMAGES" },
        r2Buckets: ["CLIPS"],
        d1Databases: ["DB"],
        // Vars that modules read via `env` from `cloudflare:workers`.
        bindings: {
          TEST_MIGRATIONS: migrations,
          TWITCH_CLIENT_ID: "cid",
          TWITCH_CLIENT_SECRET: "secret",
        },
      },
    }),
  ],
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  test: {
    include: ["src/**/*.{test,spec}.ts"],
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "istanbul",
      reporter: ["text", "html"],
      include: [
        "src/features/**/*.ts",
        "src/services/**/*.ts",
        "src/utils/**/*.ts",
      ],
      exclude: [
        "src/features/auth/server.ts",
        "src/features/auth/client.ts",
      ],
    },
  },
});

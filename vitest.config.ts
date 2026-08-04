import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

// Tests run inside the Workers (workerd) runtime via @cloudflare/vitest-pool-workers,
// matching production. compatibility settings mirror wrangler.jsonc.
export default defineWorkersConfig({
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  test: {
    include: ["src/**/*.{test,spec}.ts"],
    poolOptions: {
      workers: {
        miniflare: {
          compatibilityDate: "2025-06-01",
          compatibilityFlags: ["nodejs_compat"],
        },
      },
    },
    coverage: {
      provider: "istanbul",
      reporter: ["text", "html"],
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/auth.ts", "src/lib/authClient.ts"],
    },
  },
});

import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

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
    coverage: {
      provider: "istanbul",
      reporter: ["text", "html"],
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/auth.ts", "src/lib/authClient.ts"],
    },
  },
});

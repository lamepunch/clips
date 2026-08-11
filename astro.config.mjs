// @ts-check
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import { cacheCloudflare } from "@astrojs/cloudflare/cache";

// SSR on Cloudflare Workers. The adapter (v13+, built on @cloudflare/vite-plugin)
// wires Worker bindings (D1, vars, secrets from .dev.vars) automatically during
// `astro dev`; access them at runtime via `import { env } from "cloudflare:workers"`.
export default defineConfig({
  output: "server",
  adapter: cloudflare({ remoteBindings: true }),
  vite: {
    plugins: [tailwindcss()],
    server: {
      allowedHosts: [".corgi-spica.ts.net"],
    },
  },
  cache: {
    provider: cacheCloudflare(),
  },
  // Right now we can only cache the welcome page since it's
  // the only one that doesn't depend on the user's session
  routeRules: {
    "/welcome": { maxAge: 300, swr: 3600 },
  },
});

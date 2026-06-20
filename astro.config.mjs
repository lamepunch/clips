// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

// SSR on Cloudflare Workers. The adapter (v13+, built on @cloudflare/vite-plugin)
// wires Worker bindings (D1, vars, secrets from .dev.vars) automatically during
// `astro dev`; access them at runtime via `import { env } from "cloudflare:workers"`.
export default defineConfig({
  output: "server",
  adapter: cloudflare({ remoteBindings: true }),
  vite: {
    server: {
      allowedHosts: [".corgi-spica.ts.net"],
    },
  },
});

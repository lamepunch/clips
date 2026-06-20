/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

import type { Auth } from "./lib/auth";
import type { DB } from "./db";

declare global {
  // Worker bindings + vars/secrets. `import { env } from "cloudflare:workers"`
  // is typed as `Cloudflare.Env`, and the adapter's handler uses the global
  // `Env`; we keep both in sync via `Env extends Cloudflare.Env`.
  // `wrangler types` can regenerate a richer version into worker-configuration.d.ts.
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      ASSETS: Fetcher;

      // vars (wrangler.jsonc)
      BETTER_AUTH_URL: string;
      DISCORD_CLIENT_ID: string;
      TWITCH_CLIENT_ID: string;
      ALLOWED_GUILD_IDS: string;
      // Still needed for the REST tus direct-creator upload relay.
      CF_ACCOUNT_ID: string;
      // Stream subdomain code: customer-<CODE>.cloudflarestream.com
      STREAM_CODE: string;

      // secrets
      BETTER_AUTH_SECRET: string;
      DISCORD_CLIENT_SECRET: string;
      TWITCH_CLIENT_SECRET: string;
      STREAM_API_TOKEN: string;
      STREAM_WEBHOOK_SECRET: string;
    }
  }

  interface Env extends Cloudflare.Env {}

  namespace App {
    // The Cloudflare adapter already declares `Locals extends Runtime`
    // (providing `cfContext`); we merge in our per-request additions.
    interface Locals {
      env: Env;
      db: DB;
      auth: Auth;
      session: Auth["$Infer"]["Session"]["session"] | null;
      user: Auth["$Infer"]["Session"]["user"] | null;
    }
  }
}

export {};

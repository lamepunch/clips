/// <reference types="astro/client" />

import type { Auth } from "./lib/auth";
import type { DB } from "./db";

// `Env` / `Cloudflare.Env` (bindings, vars, secrets) and the Workers runtime
// types are generated from wrangler.jsonc into worker-configuration.d.ts by
// `npm run cf-typegen`. Don't redeclare them here — a second declaration merges
// with the generated one and produces conflicting property types.
declare global {
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

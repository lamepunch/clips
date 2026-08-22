# AGENTS.md

Astro 7 SSR on Cloudflare Workers. Users sign in with Discord (the only social
provider) and upload game clips (Cloudflare Stream via tus) and screenshots
(R2). See README.md for what the product is.

## Commands

    npm run dev              # astro dev, bindings wired by the adapter
    npm test                 # vitest, runs in workerd
    npm run typecheck        # tsc --noEmit
    npm run db:generate      # schema.ts -> migrations/
    npm run db:migrate:local # apply to local D1
    npm run cf-typegen       # regenerate worker-configuration.d.ts

## Layout

- `src/middleware.ts` — puts `env`, `db`, `auth`, `session`, `user` on `locals`;
  runs authorization. Use `Astro.locals`, don't re-create a db or auth client.
- `src/lib/access.ts` — route policy table, the source of truth for who can
  reach what. Object-level checks (clip ownership) stay in the route.
- `src/lib/auth.ts` — Better Auth, built per request (bindings aren't available
  at module scope). Discord guild membership decides the role: `admin`, `user`
  (can upload), `viewer` (read-only). Refreshed on every sign-in.
- `src/lib/http.ts` — `badRequest`/`notFound`/`unauthorized`/`forbidden`.
- `src/db/schema.ts` — Drizzle schema. Better Auth tables must match its
  expectations; regenerate with `npm run auth:generate` after auth config changes.
- `src/pages/api/**` — endpoints. `src/pages/image/[id]/[size]` serves R2 images
  and is skipped by auth middleware.

## Rules

- `@/*` maps to `src/*`.
- Don't hand-edit `worker-configuration.d.ts` (generated) or
  `src/components/starwind/**` (vendored by the Starwind CLI).
- Schema change = `db:generate` + `db:migrate:local`, never hand-written SQL.
- `vitest.config.ts` compat date/flags must stay in step with `wrangler.jsonc`.
- Comments only where the code would confuse a year later.
- Astro Actions: evaluate per feature, don't convert existing endpoints wholesale.

## Traps

- `@cloudflare/vite-plugin` is pinned to 1.51.1 and `wrangler` to 4.120.0.
  Bumping either breaks `astro dev` (`Missing field moduleType`). See the
  `comment:overrides` note in package.json before touching versions.
- The `STREAM` binding exists but is unused — uploads go through the REST API
  because the binding has no tus support.
- `TWITCH_CLIENT_ID`/`_SECRET` are not user auth. They're client-credentials
  for IGDB game search (`src/lib/igdb.ts`).
- Secrets live in `.dev.vars` (see `.dev.vars.example`), not `wrangler.jsonc`.

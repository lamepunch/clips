import { env } from "cloudflare:workers";
import { defineMiddleware } from "astro:middleware";
import { getDb } from "./db";
import { getAuth } from "./lib/auth";

// Expose env, db, auth, and the resolved session on `locals` so pages and API
// routes don't each re-import them.
export const onRequest = defineMiddleware(async (context, next) => {
  const db = getDb(env);
  const auth = getAuth(env, db);

  const data = await auth.api.getSession({ headers: context.request.headers });

  context.locals.env = env;
  context.locals.db = db;
  context.locals.auth = auth;
  context.locals.session = data?.session ?? null;
  context.locals.user = data?.user ?? null;

  // Single auth gate. Public: home, Better Auth routes, the Stream webhook.
  // Everything else needs a session. (Page-level ownership checks still live
  // on the pages that need them, e.g. clip edit.)
  const { pathname } = context.url;
  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/webhooks");

  if (!context.locals.session && !isPublic) {
    return pathname.startsWith("/api/")
      ? new Response("Unauthorized", { status: 401 })
      : context.redirect("/");
  }

  return next();
});

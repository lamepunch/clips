import { env } from "cloudflare:workers";
import { defineMiddleware } from "astro:middleware";
import { getDb } from "./db";
import { getAuth } from "./lib/auth";

// Expose env, db, auth, and the resolved session on `locals` so pages and API
// routes don't each re-import them.
export const onRequest = defineMiddleware(async (context, next) => {
  // Make all of the fun stuff available to each request
  const { locals, url, request, redirect } = context;

  // Cloudflare Workers
  locals.env = env;

  // Drizzle
  const db = getDb(env);
  locals.db = db;

  // Authentication
  const auth = getAuth(env, db);
  const data = await auth.api.getSession({ headers: request.headers });
  locals.auth = auth;
  locals.session = data?.session ?? null;
  locals.user = data?.user ?? null;

  // Single auth gate. Public: home, Better Auth routes, the Stream webhook.
  // Everything else needs a session. (Page-level ownership checks still live
  // on the pages that need them, e.g. clip edit.)
  const { pathname } = url;
  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/webhooks");

  if (!locals.session && !isPublic) {
    return pathname.startsWith("/api/")
      ? new Response("Unauthorized", { status: 401 })
      : redirect("/");
  }

  // /admin requires the admin role.
  if (pathname.startsWith("/admin") && locals.user?.role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  return next();
});

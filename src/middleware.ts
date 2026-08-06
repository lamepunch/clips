import { env } from "cloudflare:workers";
import { defineMiddleware } from "astro:middleware";
import { getDb } from "./db";
import { getAuth } from "./lib/auth";
import { isDiscordBot } from "./lib/discord";
import { forbidden, unauthorized } from "./lib/http";

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
  const auth = getAuth(env, db, locals.cfContext);
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

  // Discord's crawler has no session, so let it read clip pages for link embed
  // OpenGraph tags. Narrow on purpose: GET /watch/* only. The edit page keeps
  // its own `if (!user)` guard, so this can't reach it.
  const isEmbedCrawler =
    request.method === "GET" &&
    pathname.startsWith("/watch/") &&
    isDiscordBot(request);

  if (!locals.session && !isPublic && !isEmbedCrawler) {
    return pathname.startsWith("/api/") ? unauthorized() : redirect("/");
  }

  // /admin requires the admin role.
  if (pathname.startsWith("/admin") && locals.user?.role !== "admin") {
    return forbidden();
  }

  // Viewers are read-only: no uploads.
  if (
    (pathname === "/upload" || pathname === "/api/upload") &&
    locals.user?.role === "viewer"
  ) {
    return pathname.startsWith("/api/") ? forbidden() : redirect("/");
  }

  return next();
});

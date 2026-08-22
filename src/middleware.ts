import { env } from "cloudflare:workers";
import { defineMiddleware } from "astro:middleware";
import { getDb } from "./db";
import { getAccessDenial } from "./lib/access";
import { getAuth } from "./lib/auth";

/**
 * Middleware that exposes env, db, auth, and the resolved Better Auth session
 * on `locals`.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  // Make all of the fun stuff available to each request
  const { locals, request, redirect, url } = context;

  // Cloudflare Workers
  locals.env = env;

  // For the image route, skip any additional middleware processing
  if (url.pathname.startsWith("/image/")) {
    return next();
  }

  // ponytail: IP-derived, so a VPN gets the wrong zone; miniflare doesn't
  // populate `cf` at all, hence the fallback.
  const cf = request.cf as IncomingRequestCfProperties | undefined;
  locals.timezone = cf?.timezone ?? "America/New_York";

  // Drizzle
  const db = getDb(env);
  locals.db = db;

  // Authentication
  const auth = getAuth(env, db, locals.cfContext);
  const data = await auth.api.getSession({ headers: request.headers });
  locals.auth = auth;
  locals.session = data?.session ?? null;
  locals.user = data?.user ?? null;

  // Authorization
  const denial = getAccessDenial({
    request,
    session: locals.session,
    user: locals.user,
    redirect,
  });

  // Deny access if needed
  if (denial) {
    return denial;
  }

  return next();
});

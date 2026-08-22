import { env } from "cloudflare:workers";
import { defineMiddleware } from "astro:middleware";
import { getDb } from "./db";
import { getAccessDenial } from "./lib/access";
import { getAuth } from "./lib/auth";

/**
 * Exposes env, db, auth, and the resolved Better Auth session on `locals`, runs
 * the route access policy, and renews the session cookie cache on the way out.
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
  const { headers: authHeaders, response: data } = await auth.api.getSession({
    headers: request.headers,
    returnHeaders: true,
  });
  // `authHeaders` carries a renewed session cookie whenever Better Auth had to
  // read the session from D1 instead of the cookie cache.
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

  const response = await next();

  // Never on a routeRules-cached response: Cloudflare stores one copy and
  // serves it to every visitor, so one user's session cookie would go out to
  // all of them.
  if (!response.headers.has("cloudflare-cdn-cache-control")) {
    for (const cookie of authHeaders.getSetCookie()) {
      response.headers.append("set-cookie", cookie);
    }
  }

  return response;
});

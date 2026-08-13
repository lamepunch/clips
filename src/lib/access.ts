import { isDiscordBot } from "./discord";
import { forbidden, unauthorized } from "./http";

type AccessLevel = "public" | "authenticated" | "admin" | "upload";
type PolicyUser = { id?: string; role?: string | null } | null;

type RoutePolicy = {
  name: string;
  access: AccessLevel;
  paths?: string[];
  prefixes?: string[];
  matches?: (request: Request, pathname: string) => boolean;
};

/**
 * Match a route prefix without treating similarly named paths as children.
 *
 * @example hasPathPrefix("/api/upload/shot", "/api/upload") // true
 * @example hasPathPrefix("/api/uploads", "/api/upload") // false
 */
const hasPathPrefix = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

/**
 * Match only a watch detail URL, excluding nested routes such as /edit.
 *
 * @example isWatchDetail("/watch/clip-1") // true
 * @example isWatchDetail("/watch/clip-1/edit") // false
 */
const isWatchDetail = (pathname: string) => /^\/watch\/[^/]+$/.test(pathname);

/**
 * Ordered route policy source of truth. Object-level checks, such as clip
 * ownership, remain with the route that loads the object.
 */
export const routePolicies: readonly RoutePolicy[] = [
  {
    name: "public",
    access: "public",
    paths: ["/", "/welcome"],
    prefixes: ["/api/auth", "/api/webhooks"],
  },
  {
    name: "discord-watch-embed",
    access: "public",
    matches: (request, pathname) =>
      request.method === "GET" &&
      isWatchDetail(pathname) &&
      isDiscordBot(request),
  },
  {
    name: "admin",
    access: "admin",
    prefixes: ["/admin"],
  },
  {
    name: "upload",
    access: "upload",
    prefixes: ["/upload", "/api/upload"],
  },
  {
    name: "authenticated-default",
    access: "authenticated",
    matches: () => true,
  },
];

type RouteAccessContext = {
  request: Request;
  session: unknown | null;
  user: PolicyUser;
  redirect: (location: string) => Response;
};

/** Return a denial response, or nothing when this request may continue. */
export function getAccessDenial({
  request,
  session,
  user,
  redirect,
}: RouteAccessContext): Response | undefined {
  const pathname = new URL(request.url).pathname;

  /**
   * Match one exact route path.
   *
   * @example path("/upload") // true when pathname is "/upload"
   * @example path("/upload") // false when pathname is "/upload/image"
   */
  const path = (url: string) => pathname === url;

  /**
   * Find the policy that matches this request.
   */
  const policy = routePolicies.find(
    (rule) =>
      rule.paths?.some(path) ||
      rule.prefixes?.some((prefix) => hasPathPrefix(pathname, prefix)) ||
      rule.matches?.(request, pathname),
  );

  // No policy matched or public route - allow access
  if (!policy || policy.access === "public") return;

  // Redirect to welcome page if not signed in
  // API routes return 401 instead of redirecting
  const isApi = hasPathPrefix(pathname, "/api");
  if (!session || !user) {
    return isApi ? unauthorized() : redirect("/welcome");
  }

  // Only admins can access admin routes
  if (policy.access === "admin" && user.role !== "admin") {
    return forbidden();
  }

  // Viewers cannot upload
  if (policy.access === "upload" && user.role === "viewer") {
    return isApi ? forbidden() : redirect("/");
  }
}

/**
 * Authorize a clip after the route has loaded it. This intentionally belongs
 * outside middleware so the clip is queried only once.
 */
export function requireClipOwner(
  user: { id: string } | null,
  clip: { userId: string },
): Response | undefined {
  return !user || clip.userId !== user.id ? forbidden() : undefined;
}

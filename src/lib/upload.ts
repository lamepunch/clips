import { forbidden, unauthorized } from "./http";

/** Return an upload-capable user, or the appropriate API error response. */
export function requireUploadUser<T extends { role?: string | null }>(
  session: unknown,
  user: T | null,
): T | Response {
  if (!session || !user) return unauthorized();
  return user.role === "viewer" ? forbidden() : user;
}

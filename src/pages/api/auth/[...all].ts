import type { APIRoute } from "astro";

// Hands all /api/auth/* requests to Better Auth (sign-in, callbacks, session,
// sign-out, etc.). The instance is built per-request in middleware.
export const ALL: APIRoute = ({ request, locals }) => {
  return locals.auth.handler(request);
};

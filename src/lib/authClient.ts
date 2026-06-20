import { createAuthClient } from "better-auth/client";

// Browser auth client. baseURL defaults to the current origin, which matches
// the /api/auth/* handler.
export const authClient = createAuthClient();

import { APIError } from "better-auth/api";

type Guild = { id: string; name: string };

/**
 * Resolve the signed-in Discord user's role from their guild memberships:
 * member guilds grant "user" (full access), viewer guilds grant "viewer"
 * (read-only). Member guilds win when someone is in both. Throws an APIError
 * (aborting the Better Auth flow) when they're in neither.
 *
 * Called from the account create/update database hooks, where the freshly
 * issued Discord access token is available.
 */
export async function getGuildRole(
  accessToken: string,
  memberGuildIds: string[],
  viewerGuildIds: string[],
): Promise<"user" | "viewer"> {
  const res = await fetch("https://discord.com/api/v10/users/@me/guilds", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new APIError("FORBIDDEN", {
      message: "Could not verify your Discord server membership.",
    });
  }

  const guilds = (await res.json()) as Guild[];
  const ids = new Set(guilds.map((g) => g.id));

  if (memberGuildIds.some((id) => ids.has(id))) return "user";
  if (viewerGuildIds.some((id) => ids.has(id))) return "viewer";

  throw new APIError("FORBIDDEN", {
    message: "You must be a member of an approved Discord server to sign in.",
  });
}

export function parseGuildIds(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

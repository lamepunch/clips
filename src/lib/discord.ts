import { APIError } from "better-auth/api";

type Guild = { id: string; name: string };

/**
 * Verify the signed-in Discord user belongs to at least one allowed guild.
 * Throws an APIError (which aborts the Better Auth flow) otherwise.
 *
 * Called from the account create/update database hooks, where the freshly
 * issued Discord access token is available.
 */
export async function assertGuildMembership(
  accessToken: string,
  allowedGuildIds: string[],
): Promise<void> {
  if (allowedGuildIds.length === 0) {
    throw new APIError("FORBIDDEN", {
      message: "No allowed Discord guilds are configured.",
    });
  }

  const res = await fetch("https://discord.com/api/v10/users/@me/guilds", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new APIError("FORBIDDEN", {
      message: "Could not verify your Discord server membership.",
    });
  }

  const guilds = (await res.json()) as Guild[];
  const allowed = new Set(allowedGuildIds);
  const isMember = guilds.some((g) => allowed.has(g.id));

  if (!isMember) {
    throw new APIError("FORBIDDEN", {
      message: "You must be a member of an approved Discord server to sign in.",
    });
  }
}

export function parseAllowedGuildIds(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

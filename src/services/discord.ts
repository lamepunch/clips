import { APIError } from "better-auth/api";

type Guild = { id: string; name: string };

/** The guild IDs the token's owner belongs to. */
async function fetchGuildIds(accessToken: string): Promise<Set<string>> {
  // Not paginating: Discord returns up to 200 guilds per page. If someone
  // signs up while in more than 200 guilds, their member/viewer guild could be
  // missing from this response and they'd be mis-roled or rejected. We'll deal
  // with pagination if/when that actually becomes a problem.
  const res = await fetch("https://discord.com/api/v10/users/@me/guilds", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new APIError("FORBIDDEN", {
      message: "Could not verify your Discord server membership.",
    });
  }

  const guilds = (await res.json()) as Guild[];
  return new Set(guilds.map((g) => g.id));
}

/**
 * Door policy for a *new* sign-in. Member guilds win over viewer guilds, and
 * being in neither throws, which aborts the sign-in.
 */
export async function getGuildRole(
  accessToken: string,
  memberGuildIds: string[],
  viewerGuildIds: string[],
): Promise<"user" | "viewer"> {
  const ids = await fetchGuildIds(accessToken);

  if (memberGuildIds.some((id) => ids.has(id))) return "user";
  if (viewerGuildIds.some((id) => ids.has(id))) return "viewer";

  throw new APIError("FORBIDDEN", {
    message: "You must be a member of an approved Discord server to sign in.",
  });
}

/**
 * Re-check for an *existing* user. Asymmetric with {@link getGuildRole} on
 * purpose: never rejects, just downgrades to read-only.
 */
export async function refreshGuildRole(
  accessToken: string,
  memberGuildIds: string[],
): Promise<"user" | "viewer"> {
  const ids = await fetchGuildIds(accessToken);
  return memberGuildIds.some((id) => ids.has(id)) ? "user" : "viewer";
}

export function parseGuildIds(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Discord's link-preview crawler.
 *
 * Trivially spoofable, so only use it to expose things that are already public.
 */
export function isDiscordBot(request: Request): boolean {
  return (request.headers.get("user-agent") ?? "").includes("Discordbot");
}

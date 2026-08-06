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

/**
 * Whether a request came from Discord's link-preview crawler, which sends
 * "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordbot.com)".
 *
 * ponytail: user agents are trivially spoofable. This only unlocks reading a
 * clip's title + public Stream thumbnail on /watch/*, so a spoofed UA gains
 * nothing it couldn't already get from the (unsigned) Stream URLs. Don't reuse
 * this to gate anything that actually matters.
 */
export function isDiscordBot(request: Request): boolean {
  return (request.headers.get("user-agent") ?? "").includes("Discordbot");
}

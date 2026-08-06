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
 * Door policy for a *new* sign-in: member guilds grant "user" (full access),
 * viewer guilds grant "viewer" (read-only), member wins when both. Throws an
 * APIError (aborting the Better Auth flow) when they're in neither, so
 * strangers can't create an account.
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
 * Re-check for an *existing* user on every sign-in. Deliberately never rejects:
 * someone who leaves the member guilds is downgraded to read-only rather than
 * locked out of clips they can already see. Asymmetric with
 * {@link getGuildRole} on purpose — don't let strangers in, don't evict friends.
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

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { type DB, schema } from "@/db";
import { assertGuildMembership, parseAllowedGuildIds } from "./discord";

export type Auth = ReturnType<typeof getAuth>;

/**
 * Per-request Better Auth factory. Worker secrets/bindings aren't available at
 * module scope, so the instance is built from `env` + `db` inside each request
 * (see src/middleware.ts).
 */
export function getAuth(env: Env, db: DB) {
  const allowedGuildIds = parseAllowedGuildIds(env.ALLOWED_GUILD_IDS);

  // Gate every Discord sign-in (first link and subsequent token refreshes) on
  // guild membership, using the access token Better Auth is about to persist.
  const gate = async (account: {
    providerId?: string | null;
    accessToken?: string | null;
  }) => {
    if (account.providerId !== "discord" || !account.accessToken) return;
    await assertGuildMembership(account.accessToken, allowedGuildIds);
  };

  return betterAuth({
    appName: "Lamepunch Clips",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    // Use UUIDs for all generated IDs
    advanced: { database: { generateId: () => crypto.randomUUID() } },
    logger: { level: import.meta.env.DEV ? "debug" : "error" },
    socialProviders: {
      discord: {
        clientId: env.DISCORD_CLIENT_ID,
        clientSecret: env.DISCORD_CLIENT_SECRET,
        // Merged with Discord's default scopes; `guilds` lets us read
        // /users/@me/guilds for the allowlist check.
        scope: ["identify", "guilds"],
        // Use the Discord username as the profile slug for /[slug].
        mapProfileToUser: (profile) => ({
          slug: profile.username,
        }),
      },
    },
    user: {
      additionalFields: {
        slug: { type: "string", required: true, input: false },
      },
    },
    databaseHooks: {
      account: {
        create: {
          before: async (account) => {
            await gate(account);
            return { data: account };
          },
        },
        update: {
          before: async (account) => {
            await gate(account);
            return { data: account };
          },
        },
      },
    },
  });
}

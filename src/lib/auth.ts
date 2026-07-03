import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { and, eq, isNull, ne, or } from "drizzle-orm";
import { type DB, schema } from "@/db";
import { getGuildRole, parseGuildIds } from "./discord";

export type Auth = ReturnType<typeof getAuth>;

/**
 * Per-request Better Auth factory. Worker secrets/bindings aren't available at
 * module scope, so the instance is built from `env` + `db` inside each request
 * (see src/middleware.ts).
 */
export function getAuth(env: Env, db: DB) {
  const memberGuildIds = parseGuildIds(env.ALLOWED_GUILD_IDS);
  const viewerGuildIds = parseGuildIds(env.VIEWER_GUILD_IDS);

  // Gate every Discord sign-in (first link and subsequent token refreshes) on
  // guild membership, using the access token Better Auth is about to persist.
  // Member guilds -> "user", viewer guilds -> "viewer" (read-only), neither ->
  // sign-in rejected. The resolved role is stamped on the user row so it stays
  // current with guild changes; admins are never downgraded.
  const gate = async (account: {
    providerId?: string | null;
    accessToken?: string | null;
    userId?: string | null;
  }) => {
    if (account.providerId !== "discord" || !account.accessToken) return;
    const role = await getGuildRole(
      account.accessToken,
      memberGuildIds,
      viewerGuildIds,
    );
    if (account.userId) {
      await db
        .update(schema.user)
        .set({ role })
        .where(
          and(
            eq(schema.user.id, account.userId),
            // NULL role (fresh user) must match too; NULL != 'admin' is NULL in SQL.
            or(isNull(schema.user.role), ne(schema.user.role, "admin")),
          ),
        );
    }
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
    // Roles: "user" (default) and "admin". Promote a user by setting
    // user.role = "admin" (SQL, or admin.setRole once an admin exists).
    plugins: [admin()],
  });
}

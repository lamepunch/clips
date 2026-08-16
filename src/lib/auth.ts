import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { admin } from "better-auth/plugins";
import { and, eq } from "drizzle-orm";
import { type DB, schema } from "@/db";
import { epochSeconds, sendToCio } from "./cio";
import { getGuildRole, parseGuildIds, refreshGuildRole } from "./discord";

export type Auth = ReturnType<typeof getAuth>;

/**
 * Per-request Better Auth factory. Worker secrets/bindings aren't available at
 * module scope, so the instance is built from `env` + `db` inside each request
 * (see src/middleware.ts). `ctx` is the Workers ExecutionContext, used to send
 * analytics after the response.
 */
export function getAuth(env: Env, db: DB, ctx?: ExecutionContext) {
  const memberGuildIds = parseGuildIds(env.ALLOWED_GUILD_IDS);
  const viewerGuildIds = parseGuildIds(env.VIEWER_GUILD_IDS);

  // Rejects non-members before a user row exists. Only fires on account
  // creation; returning sign-ins are handled in `hooks.after` below.
  const gate = async (account: {
    providerId?: string | null;
    accessToken?: string | null;
  }) => {
    if (account.providerId !== "discord" || !account.accessToken) return;
    await getGuildRole(account.accessToken, memberGuildIds, viewerGuildIds);
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
        slug: { type: "string", required: true, input: true },
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
      },
    },
    hooks: {
      // Anything that must run on *every* sign-in belongs here, not in the
      // account databaseHooks — those never fire for returning users (Better
      // Auth's updateAccount on a returning sign-in carries only token fields,
      // no providerId/userId, so a guard on either always returns early).
      after: createAuthMiddleware(async (c) => {
        if (!c.path.startsWith("/callback/")) return;

        const session = c.context.newSession;
        if (!session) return;
        const { id: userId, email, name, slug } = session.user;

        // Admins are exempt so they can't be downgraded by guild changes.
        let role = session.user.role;
        if (role !== "admin") {
          const account = await db.query.account.findFirst({
            where: and(
              eq(schema.account.userId, userId),
              eq(schema.account.providerId, "discord"),
            ),
          });

          if (account?.accessToken) {
            try {
              role = await refreshGuildRole(
                account.accessToken,
                memberGuildIds,
              );
              await db
                .update(schema.user)
                .set({ role })
                .where(eq(schema.user.id, userId));
            } catch (err) {
              // Keep the previous role rather than failing a valid sign-in.
              console.error("guild role refresh failed", err);
            }
          }
        }

        sendToCio(env, ctx, (cio) =>
          cio.identify({
            userId,
            traits: {
              email,
              name,
              slug,
              role,
              created_at: epochSeconds(session.user.createdAt),
            },
          }),
        );
      }),
    },
    // Roles: "user" (default) and "admin". Promote a user by setting
    // user.role = "admin" (SQL, or admin.setRole once an admin exists).
    plugins: [admin()],
  });
}

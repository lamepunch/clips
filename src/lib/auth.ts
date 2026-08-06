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

  // Door policy for brand-new accounts: reject anyone who isn't in an allowed
  // guild, before a user row exists. Throwing here aborts the sign-in.
  //
  // This only fires on account *creation* — a returning sign-in updates the
  // account with token fields only (no providerId/userId), so it can't be
  // gated here. Ongoing membership is re-checked in the `hooks.after` below,
  // which also owns role stamping.
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
      },
    },
    hooks: {
      // Everything that must happen on *every* sign-in lives here, not in the
      // account databaseHooks: a returning sign-in only updates token fields,
      // so hooks keyed on providerId/userId never fire (see PAPERCUTS.md).
      after: createAuthMiddleware(async (c) => {
        if (!c.path.startsWith("/callback/")) return;

        const session = c.context.newSession;
        if (!session) return;
        const { id: userId, email, name, slug } = session.user;

        // Keep the role in step with Discord. Losing member access downgrades
        // to read-only rather than locking someone out; admins are exempt.
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

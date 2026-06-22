import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Better Auth core tables
// Keep these field names in sync with Better Auth's expectations.
// egenerate with `npm run auth:generate` if you change the auth config.

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** User defined name that is used on user profile page */
  slug: text("slug").notNull().unique(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  /** Avatar URL */
  image: text("image"),
  role: text("role"),
  banned: integer("banned", { mode: "boolean" }),
  banReason: text("ban_reason"),
  banExpires: integer("ban_expires", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  impersonatedBy: text("impersonated_by"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", {
    mode: "timestamp",
  }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", {
    mode: "timestamp",
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/**
 * A video game that exists in the IGDB. Used for categorization of clips.
 */
export const games = sqliteTable("games", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  /** Pretty URL that is used for routing to the game detail page */
  slug: text("slug").unique(),
  /** IGDB game ID */
  igdbId: integer("igdb_id").notNull().unique(),
  /** Cover art displayed on game detail page */
  image: text("image"),
});

/**
 * Video status, should be the same in Cloudflare Stream.
 *
 * {@link https://developers.cloudflare.com/api/resources/stream/methods/get Cloudflare Docs}
 */
export const ClipStatus = {
  IN_PROGRESS: 0,
  READY: 1,
  ERROR: 2,
} as const;

/**
 * A short video hosted on Cloudflare Stream of a game.
 */
export const clips = sqliteTable("clips", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  /** Uploader of the clip */
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  /** Game that this clip is from */
  gameId: text("game_id").references(() => games.id, { onDelete: "set null" }),
  /** Upload ID in Cloudflare Stream */
  uid: text("uid").notNull().unique(),
  /** Something hilarious and witty */
  title: text("title").notNull().default(""),
  /** Insightful commentary of what happens in the clip */
  description: text("description").notNull().default(""),
  /** Controls whether clip is visible whenever clips are listed */
  status: integer("status").notNull().default(ClipStatus.IN_PROGRESS),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  /** Time when this clip occurred or was originally uploaded */
  occurredAt: integer("occurred_at", { mode: "timestamp" }),
});

export type Clip = typeof clips.$inferSelect;
export type User = typeof user.$inferSelect;
export type Game = typeof games.$inferSelect;

import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  /** Sees how everyone uses the app. Set from the command line, never from the app. */
  isAdmin: boolean("is_admin").notNull().default(false),
});

/**
 * Refresh sessions. Only the sha256 of the token is stored, never the token.
 * A login is a family: each renewal replaces its token with a new one, and
 * the one replaced is kept (rotated) only to notice it coming back.
 */
export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  /** The login this token belongs to: every token of one login, renewal after renewal. */
  family: text("family").notNull().default(sql`gen_random_uuid()::text`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  /** Thirty days from its renewal: a session lasts as long as it is used. */
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  /** When a newer token took its place; null for the one in use. */
  rotatedAt: timestamp("rotated_at", { withTimezone: true }),
}, (table) => [index("sessions_family").on(table.family)]);

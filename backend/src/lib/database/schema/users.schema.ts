import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  /** Sees how everyone uses the app. Set from the command line, never from the app. */
  isAdmin: boolean("is_admin").notNull().default(false),
});

/** Refresh sessions. Only the sha256 of the token is stored, never the token. */
export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  /** Moved thirty days on at each renewal: a session lasts as long as it is used. */
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

import { sql } from "drizzle-orm";
import { integer, pgTable, serial, text, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./users.schema";

/** Each user's own exercises: a name is used once per user, whatever the case. */
export const exercises = pgTable("exercises", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  muscleGroup: text("muscle_group"),
  notes: text("notes"),
}, (table) => [uniqueIndex("exercises_user_name").on(table.userId, sql`lower(${table.name})`)]);

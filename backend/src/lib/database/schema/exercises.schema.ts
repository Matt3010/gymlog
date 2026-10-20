import { sql } from "drizzle-orm";
import { boolean, integer, pgTable, serial, text, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./users.schema";

/** Each user's own exercises: a name is used once per user, whatever the case. */
export const exercises = pgTable("exercises", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  muscleGroup: text("muscle_group"),
  notes: text("notes"),
  /** Done without weights (pull-ups, push-ups): its sets count reps, a weight only as ballast. */
  bodyweight: boolean("bodyweight").notNull().default(false),
}, (table) => [uniqueIndex("exercises_user_name").on(table.userId, sql`lower(${table.name})`)]);

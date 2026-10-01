import { boolean, index, integer, pgTable, serial, text } from "drizzle-orm/pg-core";
import { exercises } from "./exercises.schema";
import { users } from "./users.schema";

/** A training plan ("scheda"), split into days. */
export const plans = pgTable("plans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  notes: text("notes"),
  archived: boolean("archived").notNull().default(false),
}, (table) => [index("plans_user").on(table.userId)]);

export const planDays = pgTable("plan_days", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull().references(() => plans.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: integer("position").notNull(),
}, (table) => [index("plan_days_plan").on(table.planId)]);

/** What a day asks for: an exercise, how many sets and reps. An exercise in a plan cannot be deleted. */
export const planExercises = pgTable("plan_exercises", {
  id: serial("id").primaryKey(),
  planDayId: integer("plan_day_id").notNull().references(() => planDays.id, { onDelete: "cascade" }),
  exerciseId: integer("exercise_id").notNull().references(() => exercises.id, { onDelete: "restrict" }),
  position: integer("position").notNull(),
  sets: integer("sets").notNull(),
  reps: text("reps").notNull(),
  restSeconds: integer("rest_seconds"),
  notes: text("notes"),
}, (table) => [index("plan_exercises_day").on(table.planDayId), index("plan_exercises_exercise").on(table.exerciseId)]);

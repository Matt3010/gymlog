import { boolean, date, index, integer, pgTable, serial, text } from "drizzle-orm/pg-core";
import { exercises } from "./exercises.schema";
import { users } from "./users.schema";

/** A training plan ("scheda"), split into days. */
export const plans = pgTable("plans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  notes: text("notes"),
  /** The days it is followed: plans written before dates start on the day they got them. */
  startsOn: date("starts_on").notNull().defaultNow(),
  /** None while it is still in use. */
  endsOn: date("ends_on"),
  archived: boolean("archived").notNull().default(false),
}, (table) => [index("plans_user").on(table.userId)]);

export const planDays = pgTable("plan_days", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull().references(() => plans.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: integer("position").notNull(),
}, (table) => [index("plan_days_plan").on(table.planId)]);

/**
 * What a day asks for: an exercise and its sets, each with its own reps
 * ("12", "8-10", "max"): as many sets as entries. An exercise in a plan cannot be deleted.
 */
export const planExercises = pgTable("plan_exercises", {
  id: serial("id").primaryKey(),
  planDayId: integer("plan_day_id").notNull().references(() => planDays.id, { onDelete: "cascade" }),
  exerciseId: integer("exercise_id").notNull().references(() => exercises.id, { onDelete: "restrict" }),
  position: integer("position").notNull(),
  reps: text("reps").array().notNull(),
  restSeconds: integer("rest_seconds"),
  notes: text("notes"),
}, (table) => [index("plan_exercises_day").on(table.planDayId), index("plan_exercises_exercise").on(table.exerciseId)]);

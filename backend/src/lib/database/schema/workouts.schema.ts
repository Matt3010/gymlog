import { index, integer, numeric, pgTable, primaryKey, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { exercises } from "./exercises.schema";
import { planDays } from "./plans.schema";
import { users } from "./users.schema";

/**
 * A session at the gym. Saving or deleting a plan replaces its days, so the
 * plan's and the day's names are copied here when the workout starts: the
 * history keeps them, while the link to the day may go.
 */
export const workouts = pgTable("workouts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  planDayId: integer("plan_day_id").references(() => planDays.id, { onDelete: "set null" }),
  planName: text("plan_name"),
  dayName: text("day_name"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  notes: text("notes"),
}, (table) => [index("workouts_user_started").on(table.userId, table.startedAt.desc())]);

/** One set done: the weight lifted and how many times. An exercise with sets cannot be deleted. */
export const workoutSets = pgTable("workout_sets", {
  id: serial("id").primaryKey(),
  workoutId: integer("workout_id").notNull().references(() => workouts.id, { onDelete: "cascade" }),
  exerciseId: integer("exercise_id").notNull().references(() => exercises.id, { onDelete: "restrict" }),
  reps: integer("reps").notNull(),
  weightKg: numeric("weight_kg", { precision: 6, scale: 2, mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  /**
   * The app's own name for the set, when it has one: the app may send a set
   * twice (the answer lost on a flaky network), and it is logged once.
   */
  clientKey: text("client_key"),
}, (table) => [
  index("workout_sets_workout").on(table.workoutId),
  index("workout_sets_exercise").on(table.exerciseId),
  // nulls are all different to Postgres: sets without a key are never one another
  uniqueIndex("workout_sets_client_key").on(table.workoutId, table.clientKey),
]);

/** What the user wrote about one exercise in one workout: "spalla fastidiosa, scendere di peso". */
export const workoutExerciseNotes = pgTable("workout_exercise_notes", {
  workoutId: integer("workout_id").notNull().references(() => workouts.id, { onDelete: "cascade" }),
  exerciseId: integer("exercise_id").notNull().references(() => exercises.id, { onDelete: "cascade" }),
  note: text("note").notNull(),
}, (table) => [primaryKey({ columns: [table.workoutId, table.exerciseId] })]);

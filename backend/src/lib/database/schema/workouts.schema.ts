import { sql } from "drizzle-orm";
import { boolean, check, index, integer, numeric, pgTable, primaryKey, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { exercises } from "./exercises.schema";
import { plans } from "./plans.schema";
import { users } from "./users.schema";

/**
 * A session at the gym. A plan may be deleted, so its name is copied here
 * when the workout starts: the history keeps it, while the link to the plan may go.
 */
export const workouts = pgTable("workouts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  planId: integer("plan_id").references(() => plans.id, { onDelete: "set null" }),
  planName: text("plan_name"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  notes: text("notes"),
}, (table) => [index("workouts_user_started").on(table.userId, table.startedAt.desc())]);

/**
 * One set done: how many times, and the weight lifted. No weight is a set
 * without one (pull-ups); a set to failure ("max") may not say how many reps.
 * An exercise with sets cannot be deleted.
 */
export const workoutSets = pgTable("workout_sets", {
  id: serial("id").primaryKey(),
  workoutId: integer("workout_id").notNull().references(() => workouts.id, { onDelete: "cascade" }),
  exerciseId: integer("exercise_id").notNull().references(() => exercises.id, { onDelete: "restrict" }),
  reps: integer("reps"),
  weightKg: numeric("weight_kg", { precision: 6, scale: 2, mode: "number" }),
  /** To failure: as many reps as could be done. */
  toFailure: boolean("to_failure").notNull().default(false),
  /** A word about this set alone: "SX", "con riposo". */
  note: text("note"),
  /**
   * A part of the set before it, of the same exercise in the same workout:
   * a drop set, the left arm after both. Counted with it as one set.
   */
  continues: boolean("continues").notNull().default(false),
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
  // reps may be left out only of a set to failure
  check("workout_sets_reps_or_failure", sql`${table.reps} is not null or ${table.toFailure}`),
]);

/** What the user wrote about one exercise in one workout: "spalla fastidiosa, scendere di peso". */
export const workoutExerciseNotes = pgTable("workout_exercise_notes", {
  workoutId: integer("workout_id").notNull().references(() => workouts.id, { onDelete: "cascade" }),
  exerciseId: integer("exercise_id").notNull().references(() => exercises.id, { onDelete: "cascade" }),
  note: text("note").notNull(),
}, (table) => [primaryKey({ columns: [table.workoutId, table.exerciseId] })]);

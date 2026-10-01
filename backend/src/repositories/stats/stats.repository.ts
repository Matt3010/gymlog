import { and, asc, eq } from "drizzle-orm";
import { type Executor, exercises, workoutSets, workouts } from "../../lib";

/** A set with its exercise and workout, as the statistics read it. */
export interface StatSet {
  readonly exerciseId: number;
  readonly exerciseName: string;
  readonly workoutId: number;
  readonly startedAt: string;
  readonly reps: number;
  readonly weightKg: number;
}

/** What the statistics are made from: every set done. */
export interface StatsRepository {
  /** The user's sets, of one exercise or all, oldest first. */
  sets(userId: number, exerciseId?: number): Promise<StatSet[]>;
}

export function createStatsRepository(db: Executor): StatsRepository {
  return {
    async sets(userId, exerciseId) {
      const rows = await db
        .select({
          exerciseId: workoutSets.exerciseId,
          exerciseName: exercises.name,
          workoutId: workouts.id,
          startedAt: workouts.startedAt,
          reps: workoutSets.reps,
          weightKg: workoutSets.weightKg,
        })
        .from(workoutSets)
        .innerJoin(workouts, eq(workouts.id, workoutSets.workoutId))
        .innerJoin(exercises, eq(exercises.id, workoutSets.exerciseId))
        .where(and(eq(workouts.userId, userId), exerciseId === undefined ? undefined : eq(workoutSets.exerciseId, exerciseId)))
        .orderBy(asc(workouts.startedAt), asc(workoutSets.id));
      return rows.map((row) => ({ ...row, startedAt: row.startedAt.toISOString() }));
    },  };
}

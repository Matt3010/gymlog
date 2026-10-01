import type { Executor } from "../../lib";
import { createStatsRepository, type StatSet } from "../../repositories";
import { type ExerciseHistory, exerciseStats, type ExerciseSummary, exerciseSummaries, type SessionSets } from "./stats.rules";

export interface StatsService {
  /** Each exercise done, at a glance. */
  exercises(userId: number): Promise<ExerciseSummary[]>;
  /** Session by session; whether the exercise is the user's is the stats manager's to check. */
  history(userId: number, exerciseId: number): Promise<ExerciseHistory>;
}

/** Each workout's sets, in the order the workouts started. */
function bySession(sets: readonly StatSet[]): SessionSets[] {
  const sessions = new Map<number, { workoutId: number; startedAt: string; sets: { reps: number; weightKg: number }[] }>();
  for (const set of sets) {
    const session = sessions.get(set.workoutId) ?? { workoutId: set.workoutId, startedAt: set.startedAt, sets: [] };
    session.sets.push({ reps: set.reps, weightKg: set.weightKg });
    sessions.set(set.workoutId, session);
  }
  return [...sessions.values()];
}

export function createStatsService(db: Executor): StatsService {
  const stats = createStatsRepository(db);
  return {
    async exercises(userId) {
      return exerciseSummaries(await stats.sets(userId));
    },
    async history(userId, exerciseId) {
      return exerciseStats(bySession(await stats.sets(userId, exerciseId)));
    },
  };
}

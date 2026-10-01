import type { Database } from "../../lib";
import type { Exercise } from "../../repositories";
import { createExercisesService, createStatsService, type ExerciseHistory } from "../../services";

export interface ExerciseStats extends ExerciseHistory {
  readonly exercise: Exercise;
}

/** An exercise's statistics: the exercise must be the user's, and is read with them. */
export interface StatsManager {
  exercise(userId: number, exerciseId: number): Promise<ExerciseStats>;
}

export function createStatsManager(db: Database): StatsManager {
  return {
    exercise(userId, exerciseId) {
      return db.transaction(async (tx) => {
        const exercise = await createExercisesService(tx).get(userId, exerciseId);
        return { exercise, ...(await createStatsService(tx).history(userId, exerciseId)) };
      });
    },
  };
}

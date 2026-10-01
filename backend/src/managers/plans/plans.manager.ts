import type { Database } from "../../lib";
import type { Plan, PlanInput } from "../../repositories";
import { createExercisesService, createPlansService } from "../../services";

/** Saving a plan: its exercises must be the user's, checked in the same transaction that writes it. */
export interface PlansManager {
  create(userId: number, input: PlanInput): Promise<Plan>;
  replace(userId: number, id: number, input: PlanInput): Promise<Plan>;
}

const exercisesOf = (input: PlanInput) => input.days.flatMap((day) => day.exercises.map((exercise) => exercise.exerciseId));

export function createPlansManager(db: Database): PlansManager {
  return {
    create(userId, input) {
      return db.transaction(async (tx) => {
        await createExercisesService(tx).requireOwned(userId, exercisesOf(input));
        return createPlansService(tx).create(userId, input);
      });
    },

    replace(userId, id, input) {
      return db.transaction(async (tx) => {
        await createExercisesService(tx).requireOwned(userId, exercisesOf(input));
        return createPlansService(tx).replace(userId, id, input);
      });
    },
  };
}

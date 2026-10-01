import type { Database, Executor } from "../../lib";
import type { PlanExercise, PreviousSets, SetInput, Workout, WorkoutChange, WorkoutSet } from "../../repositories";
import { createExercisesService, createPlansService, createWorkoutsService } from "../../services";
import { InputError } from "../../validators";

/** A workout as the app shows it: what the plan day asks for, the sets done, and the last time. */
export interface WorkoutDetail extends Workout {
  /** Empty for a free workout, or once the plan day is gone. */
  readonly plan: PlanExercise[];
  readonly sets: WorkoutSet[];
  readonly previous: Record<string, PreviousSets>;
}

/** Workouts together with plans and exercises; each method one transaction. */
export interface WorkoutsManager {
  start(userId: number, planDayId: number | null): Promise<WorkoutDetail>;
  get(userId: number, id: number): Promise<WorkoutDetail>;
  update(userId: number, id: number, change: WorkoutChange): Promise<WorkoutDetail>;
  /** Into the user's own workout, of the user's own exercise. */
  addSet(userId: number, workoutId: number, input: SetInput): Promise<WorkoutSet>;
}

async function detail(tx: Executor, userId: number, workout: Workout): Promise<WorkoutDetail> {
  const workouts = createWorkoutsService(tx);
  // Stryker disable next-line ConditionalExpression: no plan day finds no day either; this only saves a query
  const day = workout.planDayId === null ? undefined : await createPlansService(tx).findDay(userId, workout.planDayId);
  return {
    ...workout,
    plan: day?.day.exercises ?? [],
    sets: await workouts.sets(workout.id),
    previous: await workouts.previous(userId, workout.id),
  };
}

export function createWorkoutsManager(db: Database): WorkoutsManager {
  return {
    start(userId, planDayId) {
      return db.transaction(async (tx) => {
        const workouts = createWorkoutsService(tx);
        if (planDayId === null) return detail(tx, userId, await workouts.start(userId, null));
        const day = await createPlansService(tx).findDay(userId, planDayId);
        if (day === undefined) throw new InputError("Il giorno della scheda non esiste più. Ricarica la pagina.");
        return detail(tx, userId, await workouts.start(userId, { planDayId, planName: day.planName, dayName: day.day.name }));
      });
    },

    get(userId, id) {
      return db.transaction(async (tx) => detail(tx, userId, await createWorkoutsService(tx).get(userId, id)));
    },

    update(userId, id, change) {
      return db.transaction(async (tx) => detail(tx, userId, await createWorkoutsService(tx).update(userId, id, change)));
    },

    addSet(userId, workoutId, input) {
      return db.transaction(async (tx) => {
        const workouts = createWorkoutsService(tx);
        const workout = await workouts.get(userId, workoutId);
        await createExercisesService(tx).requireOwned(userId, [input.exerciseId]);
        return workouts.addSet(workout.id, input);
      });
    },
  };
}

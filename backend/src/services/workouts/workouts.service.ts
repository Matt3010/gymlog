import { ConflictError, found, foundIf } from "../../errors";
import type { Executor } from "../../lib";
import { InputError } from "../../validators";
import {
  createWorkoutsRepository, type PreviousNote, type PreviousSets, type SetInput, type Workout, type WorkoutChange, type WorkoutSet, type WorkoutStart,
  type WorkoutSummary,
} from "../../repositories";

/** Workouts and their sets on their own. Plans and exercises come in through the workouts manager. */
export interface WorkoutsService {
  list(userId: number, limit: number, offset: number): Promise<WorkoutSummary[]>;
  get(userId: number, id: number): Promise<Workout>;
  start(userId: number, start: WorkoutStart | null): Promise<Workout>;
  update(userId: number, id: number, change: WorkoutChange): Promise<Workout>;
  delete(userId: number, id: number): Promise<void>;
  sets(workoutId: number): Promise<WorkoutSet[]>;
  /** By exercise id: the sets of the last earlier workout with it. */
  previous(userId: number, workoutId: number): Promise<Record<string, PreviousSets>>;
  /** Into a workout already found as the user's, of an exercise already checked as theirs. */
  addSet(workoutId: number, input: SetInput): Promise<WorkoutSet>;
  /** Same checks as addSet, by the caller. Null takes the note away. */
  setExerciseNote(workoutId: number, exerciseId: number, note: string | null): Promise<void>;
  /** By exercise id. */
  exerciseNotes(workoutId: number): Promise<Record<string, string>>;
  /** The note of the last earlier workout of the same plan day. */
  previousNote(userId: number, workoutId: number): Promise<PreviousNote | null>;
  updateSet(userId: number, setId: number, change: { reps: number; weightKg: number }): Promise<WorkoutSet>;
  deleteSet(userId: number, setId: number): Promise<void>;
}

/** The most sets one workout holds. */
const MAX_SETS = 200;

export function createWorkoutsService(db: Executor): WorkoutsService {
  const workouts = createWorkoutsRepository(db);
  return {
    list: (userId, limit, offset) => workouts.list(userId, limit, offset),
    get: async (userId, id) => found(await workouts.find(userId, id)),
    // One workout in progress at a time: the user is held while checking, so two starts at once can't both pass.
    start: async (userId, start) => {
      await workouts.lockUser(userId);
      if (await workouts.openOther(userId) !== undefined) {
        throw new ConflictError("Hai già un allenamento in corso: terminalo prima di iniziarne un altro.");
      }
      return workouts.create(userId, start);
    },
    update: async (userId, id, change) => {
      if (change.finished === false) {
        await workouts.lockUser(userId);
        if (await workouts.openOther(userId, id) !== undefined) {
          throw new ConflictError("C’è già un altro allenamento in corso: terminalo prima di riaprire questo.");
        }
      }
      return found(await workouts.update(userId, id, change));
    },
    delete: async (userId, id) => foundIf(await workouts.delete(userId, id)),
    sets: (workoutId) => workouts.sets(workoutId),
    previous: async (userId, workoutId) => Object.fromEntries(await workouts.previous(userId, workoutId)),
    addSet: async (workoutId, input) => {
      // a cap no real session reaches: with open sign-ups, the server's card cannot be filled
      if (await workouts.countSets(workoutId) >= MAX_SETS) {
        const again = input.key === undefined ? undefined : await workouts.findSetByKey(workoutId, input.key);
        if (again === undefined) throw new InputError(`Al più ${MAX_SETS} serie in un allenamento.`);
      }
      const set = await workouts.addSet(workoutId, input);
      // a key already used: the same set sent again, unless it says something else
      if (input.key !== undefined && (set.exerciseId !== input.exerciseId || set.reps !== input.reps || set.weightKg !== input.weightKg)) {
        throw new ConflictError("Questa serie è già segnata con altri numeri. Ricarica la pagina.");
      }
      return set;
    },
    setExerciseNote: (workoutId, exerciseId, note) => workouts.setExerciseNote(workoutId, exerciseId, note),
    exerciseNotes: async (workoutId) => Object.fromEntries(await workouts.exerciseNotes(workoutId)),
    previousNote: (userId, workoutId) => workouts.previousNote(userId, workoutId),
    updateSet: async (userId, setId, change) => found(await workouts.updateSet(userId, setId, change)),
    deleteSet: async (userId, setId) => foundIf(await workouts.deleteSet(userId, setId)),
  };
}

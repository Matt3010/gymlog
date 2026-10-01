import { ConflictError, found, foundIf } from "../../errors";
import type { Executor } from "../../lib";
import { createExercisesRepository, type Exercise, type ExerciseInput } from "../../repositories";
import { InputError } from "../../validators";

export interface ExercisesService {
  list(userId: number): Promise<Exercise[]>;
  get(userId: number, id: number): Promise<Exercise>;
  create(userId: number, input: ExerciseInput): Promise<Exercise>;
  update(userId: number, id: number, input: ExerciseInput): Promise<Exercise>;
  /** Rejects while a plan or a set uses the exercise. */
  delete(userId: number, id: number): Promise<void>;
  /** Every exercise named must be the user's: one deleted in another tab, or someone else's id, is refused. */
  requireOwned(userId: number, ids: readonly number[]): Promise<void>;
}

/** The unique index on the name, said in the app's words. */
async function named<T>(write: Promise<T>): Promise<T> {
  try {
    return await write;
  } catch (error) {
    // Stryker disable next-line OptionalChaining: Drizzle always wraps a failed query, with the driver's error as its cause
    if ((error as { cause?: { code?: unknown } }).cause?.code === "23505") throw new ConflictError("Esiste già un esercizio con questo nome.");
    throw error;
  }
}

export function createExercisesService(db: Executor): ExercisesService {
  const exercises = createExercisesRepository(db);
  return {
    list: (userId) => exercises.list(userId),
    get: async (userId, id) => found(await exercises.find(userId, id)),
    create: (userId, input) => named(exercises.create(userId, input)),
    update: async (userId, id, input) => found(await named(exercises.update(userId, id, input))),
    delete: async (userId, id) => foundIf(await exercises.delete(userId, id)),
    async requireOwned(userId, ids) {
      if (!(await exercises.ownsAll(userId, ids))) throw new InputError("Uno degli esercizi non esiste più. Ricarica la pagina.");
    },
  };
}

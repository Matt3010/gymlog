import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { type Executor, exercises } from "../../lib";

export interface ExerciseInput {
  readonly name: string;
  readonly muscleGroup: string | null;
  readonly notes: string | null;
}

export interface Exercise extends ExerciseInput {
  readonly id: number;
}

/** Each user's exercises. Every call is scoped to a user: another's id finds nothing. */
export interface ExercisesRepository {
  /** By name, whatever the case. */
  list(userId: number): Promise<Exercise[]>;
  find(userId: number, id: number): Promise<Exercise | undefined>;
  create(userId: number, input: ExerciseInput): Promise<Exercise>;
  update(userId: number, id: number, input: ExerciseInput): Promise<Exercise | undefined>;
  /** False when the user has no such exercise. Rejects while a plan or a set uses it. */
  delete(userId: number, id: number): Promise<boolean>;
  /** Whether every one of these ids is the user's. */
  ownsAll(userId: number, ids: readonly number[]): Promise<boolean>;
}

const exercise = { id: exercises.id, name: exercises.name, muscleGroup: exercises.muscleGroup, notes: exercises.notes };

export function createExercisesRepository(db: Executor): ExercisesRepository {
  const mine = (userId: number, id: number) => and(eq(exercises.userId, userId), eq(exercises.id, id));

  return {
    list(userId) {
      return db.select(exercise).from(exercises).where(eq(exercises.userId, userId)).orderBy(asc(sql`lower(${exercises.name})`));
    },

    async find(userId, id) {
      const [row] = await db.select(exercise).from(exercises).where(mine(userId, id));
      return row;
    },

    async create(userId, input) {
      const [row] = await db.insert(exercises).values({ userId, ...input }).returning(exercise);
      return row!;
    },

    async update(userId, id, input) {
      const [row] = await db.update(exercises).set(input).where(mine(userId, id)).returning(exercise);
      return row;
    },

    async delete(userId, id) {
      const deleted = await db.delete(exercises).where(mine(userId, id)).returning({ id: exercises.id });
      return deleted.length > 0;
    },

    async ownsAll(userId, ids) {
      const wanted = [...new Set(ids)];
      // Stryker disable next-line ConditionalExpression: with no ids the count is 0 = 0 anyway; this only saves a query
      if (wanted.length === 0) return true;
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(exercises)
        .where(and(eq(exercises.userId, userId), inArray(exercises.id, wanted)));
      return row!.count === wanted.length;
    },
  };
}

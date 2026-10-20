import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { type Executor, exercises, planExercises, plans } from "../../lib";

export interface PlanExerciseInput {
  readonly exerciseId: number;
  /** One entry per set: the reps it asks for. */
  readonly reps: string[];
  readonly restSeconds: number | null;
  readonly notes: string | null;
}

export interface PlanInput {
  readonly name: string;
  readonly notes: string | null;
  readonly exercises: readonly PlanExerciseInput[];
}

export interface PlanExercise extends PlanExerciseInput {
  readonly id: number;
  readonly exerciseName: string;
  readonly position: number;
}

export interface Plan {
  readonly id: number;
  readonly name: string;
  readonly notes: string | null;
  readonly exercises: PlanExercise[];
}

/**
 * Plans with their exercises, saved whole. Every call is scoped to a user.
 * The exercise ids must be checked as the user's before saving.
 */
export interface PlansRepository {
  /** By name. */
  list(userId: number): Promise<Plan[]>;
  find(userId: number, id: number): Promise<Plan | undefined>;
  create(userId: number, input: PlanInput): Promise<Plan>;
  /** Replaces the plan's exercises. Undefined when the user has no such plan. */
  replace(userId: number, id: number, input: PlanInput): Promise<Plan | undefined>;
  delete(userId: number, id: number): Promise<boolean>;
}

const plan = { id: plans.id, name: plans.name, notes: plans.notes };

/** The exercises of these plans, in order. */
async function exercisesOf(db: Executor, planIds: readonly number[]): Promise<Map<number, PlanExercise[]>> {
  const byPlan = new Map<number, PlanExercise[]>(planIds.map((id) => [id, []]));
  // Stryker disable next-line ConditionalExpression: no plans find no exercises either; this only saves a query
  if (planIds.length === 0) return byPlan;
  const rows = await db
    .select({
      id: planExercises.id,
      planId: planExercises.planId,
      exerciseId: planExercises.exerciseId,
      exerciseName: exercises.name,
      position: planExercises.position,
      reps: planExercises.reps,
      restSeconds: planExercises.restSeconds,
      notes: planExercises.notes,
    })
    .from(planExercises)
    .innerJoin(exercises, eq(exercises.id, planExercises.exerciseId))
    .where(inArray(planExercises.planId, [...planIds]))
    .orderBy(asc(planExercises.position));
  for (const { planId, ...row } of rows) byPlan.get(planId)!.push(row);
  return byPlan;
}

async function writeExercises(db: Executor, planId: number, input: PlanInput): Promise<void> {
  if (input.exercises.length === 0) return;
  await db.insert(planExercises).values(input.exercises.map((exercise, index) => ({ ...exercise, planId, position: index })));
}

export function createPlansRepository(db: Executor): PlansRepository {
  const mine = (userId: number, id: number) => and(eq(plans.userId, userId), eq(plans.id, id));

  async function load(userId: number, id: number): Promise<Plan | undefined> {
    const [row] = await db.select(plan).from(plans).where(mine(userId, id));
    if (row === undefined) return undefined;
    return { ...row, exercises: (await exercisesOf(db, [row.id])).get(row.id)! };
  }

  return {
    async list(userId) {
      const rows = await db.select(plan).from(plans).where(eq(plans.userId, userId))
        .orderBy(asc(sql`lower(${plans.name})`), asc(plans.id));
      const byPlan = await exercisesOf(db, rows.map((row) => row.id));
      return rows.map((row) => ({ ...row, exercises: byPlan.get(row.id)! }));
    },

    find(userId, id) {
      return load(userId, id);
    },

    async create(userId, input) {
      const [row] = await db.insert(plans).values({ userId, name: input.name, notes: input.notes }).returning({ id: plans.id });
      await writeExercises(db, row!.id, input);
      return (await load(userId, row!.id))!;
    },

    async replace(userId, id, input) {
      const [row] = await db.update(plans).set({ name: input.name, notes: input.notes })
        .where(mine(userId, id)).returning({ id: plans.id });
      if (row === undefined) return undefined;
      await db.delete(planExercises).where(eq(planExercises.planId, id));
      await writeExercises(db, id, input);
      // Workouts show the plan's name as it is now.
      await db.execute(sql`update workouts set plan_name = ${input.name} where plan_id = ${id} and user_id = ${userId}`);
      return load(userId, id);
    },

    async delete(userId, id) {
      const deleted = await db.delete(plans).where(mine(userId, id)).returning({ id: plans.id });
      return deleted.length > 0;
    },
  };
}

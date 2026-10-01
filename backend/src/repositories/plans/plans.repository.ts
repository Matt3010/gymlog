import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { type Executor, exercises, planDays, planExercises, plans } from "../../lib";

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
  readonly archived: boolean;
  readonly days: readonly { readonly name: string; readonly exercises: readonly PlanExerciseInput[] }[];
}

export interface PlanExercise extends PlanExerciseInput {
  readonly id: number;
  readonly exerciseName: string;
  readonly position: number;
}

export interface PlanDay {
  readonly id: number;
  readonly name: string;
  readonly position: number;
  readonly exercises: PlanExercise[];
}

export interface Plan {
  readonly id: number;
  readonly name: string;
  readonly notes: string | null;
  readonly archived: boolean;
  readonly days: PlanDay[];
}

/** A day of a plan, with the plan's name: what a workout follows. */
export interface PlanDayDetail {
  readonly planName: string;
  readonly day: PlanDay;
}

/**
 * Plans with their days and exercises, saved whole. Every call is scoped to
 * a user. The exercise ids must be checked as the user's before saving.
 */
export interface PlansRepository {
  /** Active plans first, then by name. */
  list(userId: number): Promise<Plan[]>;
  find(userId: number, id: number): Promise<Plan | undefined>;
  create(userId: number, input: PlanInput): Promise<Plan>;
  /** Replaces the plan's days and exercises. Undefined when the user has no such plan. */
  replace(userId: number, id: number, input: PlanInput): Promise<Plan | undefined>;
  delete(userId: number, id: number): Promise<boolean>;
  findDay(userId: number, dayId: number): Promise<PlanDayDetail | undefined>;
}

const plan = { id: plans.id, name: plans.name, notes: plans.notes, archived: plans.archived };

/** The days of these plans, each with its exercises, in order. */
async function daysOf(db: Executor, planIds: readonly number[]): Promise<Map<number, PlanDay[]>> {
  const byPlan = new Map<number, PlanDay[]>(planIds.map((id) => [id, []]));
  // Stryker disable next-line ConditionalExpression: no plans find no days either; this only saves a query
  if (planIds.length === 0) return byPlan;
  const days = await db
    .select({ id: planDays.id, planId: planDays.planId, name: planDays.name, position: planDays.position })
    .from(planDays)
    .where(inArray(planDays.planId, [...planIds]))
    .orderBy(asc(planDays.position));
  // Stryker disable next-line ConditionalExpression,ArrayDeclaration: no days have no exercises either; this only saves a query
  const rows = days.length === 0 ? [] : await db
    .select({
      id: planExercises.id,
      dayId: planExercises.planDayId,
      exerciseId: planExercises.exerciseId,
      exerciseName: exercises.name,
      position: planExercises.position,
      reps: planExercises.reps,
      restSeconds: planExercises.restSeconds,
      notes: planExercises.notes,
    })
    .from(planExercises)
    .innerJoin(exercises, eq(exercises.id, planExercises.exerciseId))
    .where(inArray(planExercises.planDayId, days.map((day) => day.id)))
    .orderBy(asc(planExercises.position));

  for (const { planId, ...day } of days) {
    byPlan.get(planId)!.push({ ...day, exercises: rows.filter((row) => row.dayId === day.id).map(({ dayId: _, ...row }) => row) });
  }
  return byPlan;
}

async function insertDays(db: Executor, planId: number, input: PlanInput): Promise<void> {
  for (const [position, day] of input.days.entries()) {
    const [row] = await db.insert(planDays).values({ planId, name: day.name, position }).returning({ id: planDays.id });
    if (day.exercises.length === 0) continue;
    await db.insert(planExercises).values(day.exercises.map((exercise, index) => ({ ...exercise, planDayId: row!.id, position: index })));
  }
}

export function createPlansRepository(db: Executor): PlansRepository {
  const mine = (userId: number, id: number) => and(eq(plans.userId, userId), eq(plans.id, id));

  async function load(executor: Executor, userId: number, id: number): Promise<Plan | undefined> {
    const [row] = await executor.select(plan).from(plans).where(mine(userId, id));
    if (row === undefined) return undefined;
    return { ...row, days: (await daysOf(executor, [row.id])).get(row.id)! };
  }

  return {
    async list(userId) {
      const rows = await db.select(plan).from(plans).where(eq(plans.userId, userId))
        .orderBy(asc(plans.archived), asc(sql`lower(${plans.name})`));
      const days = await daysOf(db, rows.map((row) => row.id));
      return rows.map((row) => ({ ...row, days: days.get(row.id)! }));
    },

    find(userId, id) {
      return load(db, userId, id);
    },

    async create(userId, input) {
      const [row] = await db.insert(plans).values({ userId, name: input.name, notes: input.notes, archived: input.archived }).returning({ id: plans.id });
      await insertDays(db, row!.id, input);
      return (await load(db, userId, row!.id))!;
    },

    async replace(userId, id, input) {
      const [row] = await db.update(plans).set({ name: input.name, notes: input.notes, archived: input.archived })
        .where(mine(userId, id)).returning({ id: plans.id });
      if (row === undefined) return undefined;
      // Days go with their exercises; workouts that followed them keep their sets, without a plan.
      await db.delete(planDays).where(eq(planDays.planId, id));
      await insertDays(db, id, input);
      return load(db, userId, id);
    },

    async delete(userId, id) {
      const deleted = await db.delete(plans).where(mine(userId, id)).returning({ id: plans.id });
      return deleted.length > 0;
    },

    async findDay(userId, dayId) {
      const [row] = await db
        .select({ planId: plans.id, planName: plans.name })
        .from(planDays)
        .innerJoin(plans, eq(plans.id, planDays.planId))
        .where(and(eq(planDays.id, dayId), eq(plans.userId, userId)));
      if (row === undefined) return undefined;
      const day = (await daysOf(db, [row.planId])).get(row.planId)!.find((candidate) => candidate.id === dayId)!;
      return { planName: row.planName, day };
    },
  };
}

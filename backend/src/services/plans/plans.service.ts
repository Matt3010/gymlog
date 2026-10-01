import { found, foundIf } from "../../errors";
import type { Executor } from "../../lib";
import { createPlansRepository, type Plan, type PlanDayDetail, type PlanInput } from "../../repositories";

/** Plans on their own. Whether the exercises in them are the user's is the plans manager's to check. */
export interface PlansService {
  list(userId: number): Promise<Plan[]>;
  get(userId: number, id: number): Promise<Plan>;
  create(userId: number, input: PlanInput): Promise<Plan>;
  /** Replaces days and exercises, whole. */
  replace(userId: number, id: number, input: PlanInput): Promise<Plan>;
  delete(userId: number, id: number): Promise<void>;
  /** A day of one of the user's plans, if it is still there. */
  findDay(userId: number, dayId: number): Promise<PlanDayDetail | undefined>;
}

export function createPlansService(db: Executor): PlansService {
  const plans = createPlansRepository(db);
  return {
    list: (userId) => plans.list(userId),
    get: async (userId, id) => found(await plans.find(userId, id)),
    // A plan, its days and their exercises are written together or not at all.
    create: (userId, input) => db.transaction((tx) => createPlansRepository(tx).create(userId, input)),
    replace: async (userId, id, input) => found(await db.transaction((tx) => createPlansRepository(tx).replace(userId, id, input))),
    delete: async (userId, id) => foundIf(await plans.delete(userId, id)),
    findDay: (userId, dayId) => plans.findDay(userId, dayId),
  };
}

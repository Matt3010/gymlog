import { found, foundIf } from "../../errors";
import type { Executor } from "../../lib";
import { createPlansRepository, type Plan, type PlanInput } from "../../repositories";

/** Plans on their own. Whether the exercises in them are the user's is the plans manager's to check. */
export interface PlansService {
  list(userId: number): Promise<Plan[]>;
  get(userId: number, id: number): Promise<Plan>;
  /** A plan and its exercises are written together or not at all. */
  create(userId: number, input: PlanInput): Promise<Plan>;
  /** Replaces the exercises, whole. */
  replace(userId: number, id: number, input: PlanInput): Promise<Plan>;
  delete(userId: number, id: number): Promise<void>;
  /** One of the user's plans, if it is still there. */
  find(userId: number, id: number): Promise<Plan | undefined>;
}

export function createPlansService(db: Executor): PlansService {
  const plans = createPlansRepository(db);
  return {
    list: (userId) => plans.list(userId),
    get: async (userId, id) => found(await plans.find(userId, id)),
    create: (userId, input) => db.transaction((tx) => createPlansRepository(tx).create(userId, input)),
    replace: async (userId, id, input) => found(await db.transaction((tx) => createPlansRepository(tx).replace(userId, id, input))),
    delete: async (userId, id) => foundIf(await plans.delete(userId, id)),
    find: (userId, id) => plans.find(userId, id),
  };
}

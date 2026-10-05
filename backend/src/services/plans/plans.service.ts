import { found, foundIf } from "../../errors";
import type { Executor } from "../../lib";
import { InputError } from "../../validators";
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

/** Today as a calendar writes it, in Italy, where the gym is. */
const todayInItaly = (): string => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());

export function createPlansService(db: Executor): PlansService {
  const plans = createPlansRepository(db);
  return {
    list: (userId) => plans.list(userId),
    get: async (userId, id) => found(await plans.find(userId, id)),
    // A plan, its days and their exercises are written together or not at all.
    // A new plan takes over from the ones in use before it, which end the day before; one
    // written down already over, or archived, is not the one in use and takes over nothing.
    create: (userId, input) => db.transaction(async (tx) => {
      // a new plan has new days only: a day id here is someone else's day, or a stale one
      if (input.days.some((day) => day.id !== undefined)) {
        throw new InputError("Uno degli allenamenti della scheda non esiste più. Ricarica la pagina.");
      }
      const plans = createPlansRepository(tx);
      const inUse = !input.archived && (input.endsOn === null || input.endsOn >= todayInItaly());
      if (inUse) await plans.closeBefore(userId, input.startsOn);
      return plans.create(userId, input);
    }),
    replace: async (userId, id, input) => found(await db.transaction(async (tx) => {
      const plans = createPlansRepository(tx);
      const current = await plans.find(userId, id);
      if (current === undefined) return undefined;
      // A day id must be one of this plan's: another plan's day is not taken over.
      const own = new Set(current.days.map((day) => day.id));
      if (input.days.some((day) => day.id !== undefined && !own.has(day.id))) {
        throw new InputError("Uno degli allenamenti della scheda non esiste più. Ricarica la pagina.");
      }
      return plans.replace(userId, id, input);
    })),
    delete: async (userId, id) => foundIf(await plans.delete(userId, id)),
    findDay: (userId, dayId) => plans.findDay(userId, dayId),
  };
}

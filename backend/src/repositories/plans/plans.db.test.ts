import { describe, expect, it } from "vitest";
import { SERVER, testDatabase } from "../../lib/database/test-database";
import { createExercisesRepository } from "../exercises/exercises.repository";
import { createUsersRepository } from "../users/users.repository";
import { createPlansRepository, type PlanInput } from "./plans.repository";

describe.skipIf(SERVER === undefined)("the plans repository", () => {
  const handle = testDatabase();
  const repo = () => createPlansRepository(handle.db);

  /** A user with two exercises, and a two-day plan input using them. */
  async function setup() {
    const user = await createUsersRepository(handle.db).create(`u${Math.random().toString(36).slice(2)}`, "x");
    const exercises = createExercisesRepository(handle.db);
    const bench = await exercises.create(user.id, { name: "Panca piana", muscleGroup: "Petto", notes: null });
    const row = await exercises.create(user.id, { name: "Rematore", muscleGroup: "Dorso", notes: null });
    const input: PlanInput = {
      name: "Scheda autunno",
      notes: "3 volte a settimana",
      archived: false,
      days: [
        {
          name: "A",
          exercises: [
            { exerciseId: bench.id, sets: 4, reps: "8-10", restSeconds: 90, notes: "fermo al petto" },
            { exerciseId: row.id, sets: 3, reps: "12", restSeconds: null, notes: null },
          ],
        },
        { name: "B", exercises: [{ exerciseId: row.id, sets: 5, reps: "5", restSeconds: 120, notes: null }] },
      ],
    };
    return { user, bench, row, input };
  }

  it("creates a plan with its days and exercises, in order", async () => {
    const { user, bench, row, input } = await setup();
    const plan = await repo().create(user.id, input);
    expect(plan).toEqual({
      id: expect.any(Number),
      name: "Scheda autunno",
      notes: "3 volte a settimana",
      archived: false,
      days: [
        {
          id: expect.any(Number), name: "A", position: 0,
          exercises: [
            { id: expect.any(Number), exerciseId: bench.id, exerciseName: "Panca piana", position: 0, sets: 4, reps: "8-10", restSeconds: 90, notes: "fermo al petto" },
            { id: expect.any(Number), exerciseId: row.id, exerciseName: "Rematore", position: 1, sets: 3, reps: "12", restSeconds: null, notes: null },
          ],
        },
        {
          id: expect.any(Number), name: "B", position: 1,
          exercises: [{ id: expect.any(Number), exerciseId: row.id, exerciseName: "Rematore", position: 0, sets: 5, reps: "5", restSeconds: 120, notes: null }],
        },
      ],
    });
    expect(await repo().find(user.id, plan.id)).toEqual(plan);
  });

  it("keeps a plan without days, and a day without exercises", async () => {
    const { user, input } = await setup();
    const plan = await repo().create(user.id, { ...input, days: [] });
    expect((await repo().find(user.id, plan.id))?.days).toEqual([]);
    const rest = await repo().create(user.id, { ...input, days: [{ name: "Riposo", exercises: [] }] });
    expect(rest.days).toEqual([{ id: expect.any(Number), name: "Riposo", position: 0, exercises: [] }]);
  });

  it("lists nothing for a user without plans", async () => {
    const { user } = await setup();
    expect(await repo().list(user.id)).toEqual([]);
  });

  it("lists the user's plans, the active ones first, then by name", async () => {
    const { user, input } = await setup();
    const other = await setup();
    await repo().create(user.id, { ...input, name: "zeta" });
    await repo().create(user.id, { ...input, name: "Alfa", archived: true });
    await repo().create(user.id, { ...input, name: "beta" });
    await repo().create(other.user.id, other.input);
    const plans = await repo().list(user.id);
    expect(plans.map((plan) => plan.name)).toEqual(["beta", "zeta", "Alfa"]);
    expect(plans[0]?.days.map((day) => day.exercises.length)).toEqual([2, 1]);
  });

  it("replaces a plan whole", async () => {
    const { user, bench, input } = await setup();
    const plan = await repo().create(user.id, input);
    const next: PlanInput = {
      name: "Scheda inverno", notes: null, archived: true,
      days: [{ name: "Unico", exercises: [{ exerciseId: bench.id, sets: 2, reps: "max", restSeconds: 60, notes: null }] }],
    };
    const replaced = await repo().replace(user.id, plan.id, next);
    expect(replaced).toMatchObject({ id: plan.id, name: "Scheda inverno", notes: null, archived: true });
    expect(replaced?.days).toEqual([
      {
        id: expect.any(Number), name: "Unico", position: 0,
        exercises: [{ id: expect.any(Number), exerciseId: bench.id, exerciseName: "Panca piana", position: 0, sets: 2, reps: "max", restSeconds: 60, notes: null }],
      },
    ]);
    expect(await repo().find(user.id, plan.id)).toEqual(replaced);
  });

  it("neither finds, replaces nor deletes another user's plan", async () => {
    const { user, input } = await setup();
    const other = await setup();
    const plan = await repo().create(user.id, input);
    expect(await repo().find(other.user.id, plan.id)).toBeUndefined();
    expect(await repo().replace(other.user.id, plan.id, { ...input, name: "presa", days: [] })).toBeUndefined();
    expect(await repo().delete(other.user.id, plan.id)).toBe(false);
    // Untouched, days included.
    expect(await repo().find(user.id, plan.id)).toEqual(plan);
  });

  it("deletes a plan", async () => {
    const { user, input } = await setup();
    const plan = await repo().create(user.id, input);
    expect(await repo().delete(user.id, plan.id)).toBe(true);
    expect(await repo().find(user.id, plan.id)).toBeUndefined();
  });

  it("finds a day of the user's plan, with the plan's name", async () => {
    const { user, input } = await setup();
    const other = await setup();
    const plan = await repo().create(user.id, input);
    const day = plan.days[1]!;
    expect(await repo().findDay(user.id, day.id)).toEqual({ planName: "Scheda autunno", day });
    expect(await repo().findDay(other.user.id, day.id)).toBeUndefined();
    expect(await repo().findDay(user.id, 999_999)).toBeUndefined();
  });
});

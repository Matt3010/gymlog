import { describe, expect, it } from "vitest";
import { SERVER, testDatabase } from "../../lib/database/test-database";
import { createExercisesRepository } from "../exercises/exercises.repository";
import { createWorkoutsRepository } from "../workouts/workouts.repository";
import { createUsersRepository } from "../users/users.repository";
import { createPlansRepository, type PlanInput } from "./plans.repository";

describe.skipIf(SERVER === undefined)("the plans repository", () => {
  const handle = testDatabase();
  const repo = () => createPlansRepository(handle.db);

  /** A user with two exercises, and a plan input using them. */
  async function setup() {
    const user = await createUsersRepository(handle.db).create(`u${Math.random().toString(36).slice(2)}`, "x");
    const exercises = createExercisesRepository(handle.db);
    const bench = await exercises.create(user.id, { name: "Panca piana", muscleGroup: "Petto", notes: null });
    const row = await exercises.create(user.id, { name: "Rematore", muscleGroup: "Dorso", notes: null });
    const input: PlanInput = {
      name: "Spinta",
      notes: "lunedì e giovedì",
      exercises: [
        { exerciseId: bench.id, reps: ["8-10", "8-10", "8-10", "8-10"], restSeconds: 90, notes: "fermo al petto" },
        { exerciseId: row.id, reps: ["12", "12", "12"], restSeconds: null, notes: null },
      ],
    };
    return { user, bench, row, input };
  }

  it("creates a plan with its exercises, in order", async () => {
    const { user, bench, row, input } = await setup();
    const plan = await repo().create(user.id, input);
    expect(plan).toEqual({
      id: expect.any(Number),
      name: "Spinta",
      notes: "lunedì e giovedì",
      exercises: [
        { id: expect.any(Number), exerciseId: bench.id, exerciseName: "Panca piana", position: 0, reps: ["8-10", "8-10", "8-10", "8-10"], restSeconds: 90, notes: "fermo al petto" },
        { id: expect.any(Number), exerciseId: row.id, exerciseName: "Rematore", position: 1, reps: ["12", "12", "12"], restSeconds: null, notes: null },
      ],
    });
    expect(await repo().find(user.id, plan.id)).toEqual(plan);
  });

  it("keeps different reps for each set, in order", async () => {
    const { user, bench, input } = await setup();
    const plan = await repo().create(user.id, {
      ...input, exercises: [{ exerciseId: bench.id, reps: ["12", "10", "8", "max"], restSeconds: 90, notes: null }],
    });
    expect(plan.exercises[0]?.reps).toEqual(["12", "10", "8", "max"]);
    expect((await repo().find(user.id, plan.id))?.exercises[0]?.reps).toEqual(["12", "10", "8", "max"]);
  });

  it("keeps a plan without exercises", async () => {
    const { user, input } = await setup();
    const plan = await repo().create(user.id, { ...input, exercises: [] });
    expect((await repo().find(user.id, plan.id))?.exercises).toEqual([]);
  });

  it("lists nothing for a user without plans", async () => {
    const { user } = await setup();
    expect(await repo().list(user.id)).toEqual([]);
  });

  it("lists the user's plans by name, whatever the case", async () => {
    const { user, input } = await setup();
    const other = await setup();
    await repo().create(user.id, { ...input, name: "zeta" });
    await repo().create(user.id, { ...input, name: "Alfa", exercises: [] });
    await repo().create(user.id, { ...input, name: "beta" });
    await repo().create(other.user.id, other.input);
    const plans = await repo().list(user.id);
    expect(plans.map((plan) => plan.name)).toEqual(["Alfa", "beta", "zeta"]);
    expect(plans.map((plan) => plan.exercises.length)).toEqual([0, 2, 2]);
  });

  it("replaces a plan whole", async () => {
    const { user, bench, input } = await setup();
    const plan = await repo().create(user.id, input);
    const replaced = await repo().replace(user.id, plan.id, {
      name: "Spinta pesante", notes: null,
      exercises: [{ exerciseId: bench.id, reps: ["max", "max"], restSeconds: 60, notes: null }],
    });
    expect(replaced).toEqual({
      id: plan.id, name: "Spinta pesante", notes: null,
      exercises: [{ id: expect.any(Number), exerciseId: bench.id, exerciseName: "Panca piana", position: 0, reps: ["max", "max"], restSeconds: 60, notes: null }],
    });
    expect(await repo().find(user.id, plan.id)).toEqual(replaced);
  });

  it("renames the plan in the workouts that followed it, and only in those", async () => {
    const { user, input } = await setup();
    const plan = await repo().create(user.id, input);
    const kept = await repo().create(user.id, { ...input, name: "Tirata" });
    const workouts = createWorkoutsRepository(handle.db);
    const onPlan = await workouts.create(user.id, { planId: plan.id, planName: plan.name });
    const onKept = await workouts.create(user.id, { planId: kept.id, planName: kept.name });
    await repo().replace(user.id, plan.id, { ...input, name: "Spinta 2" });
    expect(await workouts.find(user.id, onPlan.id)).toMatchObject({ planId: plan.id, planName: "Spinta 2" });
    expect(await workouts.find(user.id, onKept.id)).toMatchObject({ planId: kept.id, planName: "Tirata" });
  });

  it("deleted, leaves the workouts that followed it their name, without the link", async () => {
    const { user, input } = await setup();
    const plan = await repo().create(user.id, input);
    const workouts = createWorkoutsRepository(handle.db);
    const done = await workouts.create(user.id, { planId: plan.id, planName: plan.name });
    await repo().delete(user.id, plan.id);
    expect(await workouts.find(user.id, done.id)).toMatchObject({ planId: null, planName: "Spinta" });
  });

  it("neither finds, replaces nor deletes another user's plan", async () => {
    const { user, input } = await setup();
    const other = await setup();
    const plan = await repo().create(user.id, input);
    expect(await repo().find(other.user.id, plan.id)).toBeUndefined();
    expect(await repo().replace(other.user.id, plan.id, { ...input, name: "presa", exercises: [] })).toBeUndefined();
    expect(await repo().delete(other.user.id, plan.id)).toBe(false);
    // Untouched, exercises included.
    expect(await repo().find(user.id, plan.id)).toEqual(plan);
  });

  it("deletes a plan", async () => {
    const { user, input } = await setup();
    const plan = await repo().create(user.id, input);
    expect(await repo().delete(user.id, plan.id)).toBe(true);
    expect(await repo().find(user.id, plan.id)).toBeUndefined();
  });
});

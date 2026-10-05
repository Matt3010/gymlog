import { describe, expect, it } from "vitest";
import { SERVER, testDatabase } from "../../lib/database/test-database";
import { createExercisesRepository } from "../exercises/exercises.repository";
import { createWorkoutsRepository } from "../workouts/workouts.repository";
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
      startsOn: "2026-10-05",
      endsOn: "2026-11-15",
      archived: false,
      days: [
        {
          name: "A",
          exercises: [
            { exerciseId: bench.id, reps: ["8-10", "8-10", "8-10", "8-10"], restSeconds: 90, notes: "fermo al petto" },
            { exerciseId: row.id, reps: ["12", "12", "12"], restSeconds: null, notes: null },
          ],
        },
        { name: "B", exercises: [{ exerciseId: row.id, reps: ["5", "5", "5", "5", "5"], restSeconds: 120, notes: null }] },
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
      startsOn: "2026-10-05",
      endsOn: "2026-11-15",
      archived: false,
      days: [
        {
          id: expect.any(Number), name: "A", position: 0,
          exercises: [
            { id: expect.any(Number), exerciseId: bench.id, exerciseName: "Panca piana", position: 0, reps: ["8-10", "8-10", "8-10", "8-10"], restSeconds: 90, notes: "fermo al petto" },
            { id: expect.any(Number), exerciseId: row.id, exerciseName: "Rematore", position: 1, reps: ["12", "12", "12"], restSeconds: null, notes: null },
          ],
        },
        {
          id: expect.any(Number), name: "B", position: 1,
          exercises: [{ id: expect.any(Number), exerciseId: row.id, exerciseName: "Rematore", position: 0, reps: ["5", "5", "5", "5", "5"], restSeconds: 120, notes: null }],
        },
      ],
    });
    expect(await repo().find(user.id, plan.id)).toEqual(plan);
  });

  it("keeps different reps for each set, in order", async () => {
    const { user, bench, input } = await setup();
    const plan = await repo().create(user.id, {
      ...input, days: [{ name: "A", exercises: [{ exerciseId: bench.id, reps: ["12", "10", "8", "max"], restSeconds: 90, notes: null }] }],
    });
    expect(plan.days[0]?.exercises[0]?.reps).toEqual(["12", "10", "8", "max"]);
    expect((await repo().find(user.id, plan.id))?.days[0]?.exercises[0]?.reps).toEqual(["12", "10", "8", "max"]);
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

  it("lists the user's plans, the active ones first, then the latest to start, then by name", async () => {
    const { user, input } = await setup();
    const other = await setup();
    await repo().create(user.id, { ...input, name: "zeta" });
    await repo().create(user.id, { ...input, name: "Alfa", archived: true });
    await repo().create(user.id, { ...input, name: "beta" });
    await repo().create(user.id, { ...input, name: "Aprile", startsOn: "2026-04-01" });
    await repo().create(user.id, { ...input, name: "Dicembre", startsOn: "2026-12-01", endsOn: null });
    await repo().create(other.user.id, other.input);
    const plans = await repo().list(user.id);
    expect(plans.map((plan) => plan.name)).toEqual(["Dicembre", "beta", "zeta", "Aprile", "Alfa"]);
    expect(plans[0]?.days.map((day) => day.exercises.length)).toEqual([2, 1]);
  });

  it("replaces a plan whole", async () => {
    const { user, bench, input } = await setup();
    const plan = await repo().create(user.id, input);
    const next: PlanInput = {
      name: "Scheda inverno", notes: null, startsOn: "2026-12-01", endsOn: null, archived: true,
      days: [{ name: "Unico", exercises: [{ exerciseId: bench.id, reps: ["max", "max"], restSeconds: 60, notes: null }] }],
    };
    const replaced = await repo().replace(user.id, plan.id, next);
    expect(replaced).toMatchObject({ id: plan.id, name: "Scheda inverno", notes: null, startsOn: "2026-12-01", endsOn: null, archived: true });
    expect(replaced?.days).toEqual([
      {
        id: expect.any(Number), name: "Unico", position: 0,
        exercises: [{ id: expect.any(Number), exerciseId: bench.id, exerciseName: "Panca piana", position: 0, reps: ["max", "max"], restSeconds: 60, notes: null }],
      },
    ]);
    expect(await repo().find(user.id, plan.id)).toEqual(replaced);
  });

  it("keeps the days sent with their id, changing them in place; adds and removes the others", async () => {
    const { user, bench, row, input } = await setup();
    const plan = await repo().create(user.id, input);
    const [a, b] = plan.days;
    const replaced = await repo().replace(user.id, plan.id, {
      ...input,
      days: [
        { id: b!.id, name: "B2", exercises: [{ exerciseId: bench.id, reps: ["6"], restSeconds: null, notes: null }] },
        { name: "C", exercises: [{ exerciseId: row.id, reps: ["12"], restSeconds: null, notes: null }] },
      ],
    });
    expect(replaced?.days.map((day) => [day.name, day.position])).toEqual([["B2", 0], ["C", 1]]);
    expect(replaced?.days[0]?.id).toBe(b!.id);
    expect(replaced?.days[1]?.id).not.toBe(a!.id);
    expect(replaced?.days[0]?.exercises.map((exercise) => [exercise.exerciseName, exercise.reps])).toEqual([["Panca piana", ["6"]]]);
    const { rows } = await handle.db.$client.query("select id from plan_days where id = $1", [a!.id]);
    expect(rows).toEqual([]);
  });

  it("renames, in the workouts that followed them, the plan and the days kept", async () => {
    const { user, input } = await setup();
    const plan = await repo().create(user.id, input);
    const [a, b] = plan.days;
    const onA = await createWorkoutsRepository(handle.db).create(user.id, { planDayId: a!.id, planName: plan.name, dayName: a!.name });
    const onB = await createWorkoutsRepository(handle.db).create(user.id, { planDayId: b!.id, planName: plan.name, dayName: b!.name });
    await repo().replace(user.id, plan.id, { ...input, name: "Forza 2", days: [{ id: a!.id, name: "Spinta", exercises: [] }] });
    expect(await createWorkoutsRepository(handle.db).find(user.id, onA.id)).toMatchObject({ planDayId: a!.id, planName: "Forza 2", dayName: "Spinta" });
    // B is gone: its workout keeps the names it had, without the link.
    expect(await createWorkoutsRepository(handle.db).find(user.id, onB.id)).toMatchObject({ planDayId: null, planName: "Scheda autunno", dayName: "B" });
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

  it("closes the user's plans in use that started before a day, on the day before, archived", async () => {
    const { user, input } = await setup();
    const other = await setup();
    const open = await repo().create(user.id, { ...input, startsOn: "2026-09-01", endsOn: null });
    const later = await repo().create(user.id, { ...input, startsOn: "2026-10-05", endsOn: null });
    const ending = await repo().create(user.id, { ...input, startsOn: "2026-09-01", endsOn: "2026-12-31" });
    const shelved = await repo().create(user.id, { ...input, startsOn: "2026-09-01", endsOn: null, archived: true });
    const theirs = await repo().create(other.user.id, { ...other.input, startsOn: "2026-09-01", endsOn: null });
    await repo().closeBefore(user.id, "2026-10-05");
    expect(await repo().find(user.id, open.id)).toEqual({ ...open, endsOn: "2026-10-04", archived: true });
    // starting that same day, already given an end, already archived, or someone else's: as they were
    expect(await repo().find(user.id, later.id)).toEqual(later);
    expect(await repo().find(user.id, ending.id)).toEqual(ending);
    expect(await repo().find(user.id, shelved.id)).toEqual(shelved);
    expect(await repo().find(other.user.id, theirs.id)).toEqual(theirs);
  });

  it("closes a plan begun on the first of a month on the last day of the one before", async () => {
    const { user, input } = await setup();
    const open = await repo().create(user.id, { ...input, startsOn: "2024-01-15", endsOn: null });
    await repo().closeBefore(user.id, "2024-03-01");
    expect((await repo().find(user.id, open.id))?.endsOn).toBe("2024-02-29");
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

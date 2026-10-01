import { describe, expect, it } from "vitest";
import { SERVER, testDatabase } from "../../lib/database/test-database";
import { createExercisesRepository } from "../exercises/exercises.repository";
import { createPlansRepository } from "../plans/plans.repository";
import { createUsersRepository } from "../users/users.repository";
import { createWorkoutsRepository } from "./workouts.repository";

const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;

describe.skipIf(SERVER === undefined)("the workouts repository", () => {
  const handle = testDatabase();
  const repo = () => createWorkoutsRepository(handle.db);

  async function setup() {
    const user = await createUsersRepository(handle.db).create(`u${Math.random().toString(36).slice(2)}`, "x");
    const exercises = createExercisesRepository(handle.db);
    const squat = await exercises.create(user.id, { name: "Squat", muscleGroup: null, notes: null });
    const bench = await exercises.create(user.id, { name: "Panca", muscleGroup: null, notes: null });
    const plan = await createPlansRepository(handle.db).create(user.id, {
      name: "Forza", notes: null, archived: false,
      days: [{ name: "A", exercises: [{ exerciseId: squat.id, sets: 5, reps: "5", restSeconds: 180, notes: null }] }],
    });
    const day = plan.days[0]!;
    return { user, squat, bench, plan, day, start: { planDayId: day.id, planName: plan.name, dayName: day.name } };
  }

  it("starts a free workout, now", async () => {
    const { user } = await setup();
    const workout = await repo().create(user.id, null);
    expect(workout).toEqual({
      id: expect.any(Number), planDayId: null, planName: null, dayName: null,
      startedAt: expect.stringMatching(ISO), finishedAt: null, notes: null,
    });
    // The database's clock: Docker's may differ from this machine's by a second or two.
    const { rows } = await handle.db.$client.query<{ ms: number }>("select extract(epoch from now()) * 1000 as ms");
    expect(Math.abs(Number(rows[0]!.ms) - Date.parse(workout.startedAt))).toBeLessThan(5000);
    expect(await repo().find(user.id, workout.id)).toEqual(workout);
  });

  it("starts a workout from a plan day, keeping the names", async () => {
    const { user, start } = await setup();
    const workout = await repo().create(user.id, start, new Date("2026-09-01T17:00:00Z"));
    expect(workout).toMatchObject({ ...start, startedAt: "2026-09-01T17:00:00.000Z" });
  });

  it("keeps the names when the plan goes", async () => {
    const { user, plan, start } = await setup();
    const workout = await repo().create(user.id, start);
    await createPlansRepository(handle.db).delete(user.id, plan.id);
    expect(await repo().find(user.id, workout.id)).toMatchObject({ planDayId: null, planName: "Forza", dayName: "A" });
  });

  it("logs sets in order, with the exercise's name", async () => {
    const { user, squat, bench } = await setup();
    const workout = await repo().create(user.id, null);
    const first = await repo().addSet(workout.id, { exerciseId: squat.id, reps: 5, weightKg: 100 });
    await repo().addSet(workout.id, { exerciseId: bench.id, reps: 8, weightKg: 62.5 });
    expect(first).toEqual({ id: expect.any(Number), exerciseId: squat.id, exerciseName: "Squat", reps: 5, weightKg: 100, createdAt: expect.stringMatching(ISO) });
    expect((await repo().sets(workout.id)).map((set) => [set.exerciseName, set.reps, set.weightKg])).toEqual([["Squat", 5, 100], ["Panca", 8, 62.5]]);
  });

  it("changes and deletes a set of the user only", async () => {
    const { user, squat } = await setup();
    const other = await setup();
    const workout = await repo().create(user.id, null);
    const set = await repo().addSet(workout.id, { exerciseId: squat.id, reps: 5, weightKg: 100 });
    expect(await repo().updateSet(other.user.id, set.id, { reps: 1, weightKg: 1 })).toBeUndefined();
    expect(await repo().deleteSet(other.user.id, set.id)).toBe(false);
    expect(await repo().updateSet(user.id, set.id, { reps: 6, weightKg: 102.5 })).toEqual({ ...set, reps: 6, weightKg: 102.5 });
    expect(await repo().deleteSet(user.id, set.id)).toBe(true);
    expect(await repo().sets(workout.id)).toEqual([]);
  });

  it("sets and takes back the end, and the notes", async () => {
    const { user } = await setup();
    const workout = await repo().create(user.id, null);
    const finished = await repo().update(user.id, workout.id, { finished: true, notes: "ottima" });
    expect(finished).toMatchObject({ notes: "ottima", finishedAt: expect.stringMatching(ISO) });
    // Finishing again keeps the first end.
    expect((await repo().update(user.id, workout.id, { finished: true }))?.finishedAt).toBe(finished?.finishedAt);
    // Only what is given changes.
    expect((await repo().update(user.id, workout.id, { notes: "ancora" }))?.finishedAt).toBe(finished?.finishedAt);
    expect(await repo().update(user.id, workout.id, { finished: false })).toMatchObject({ notes: "ancora", finishedAt: null });
    expect(await repo().update(user.id, workout.id, { notes: null })).toMatchObject({ notes: null, finishedAt: null });
    expect(await repo().update(user.id, workout.id, {})).toMatchObject({ id: workout.id });
    expect(await repo().update(user.id, 999_999, {})).toBeUndefined();
  });

  it("neither finds, changes nor deletes another user's workout", async () => {
    const { user } = await setup();
    const other = await setup();
    const workout = await repo().create(user.id, null);
    expect(await repo().find(other.user.id, workout.id)).toBeUndefined();
    expect(await repo().update(other.user.id, workout.id, { notes: "presa" })).toBeUndefined();
    expect(await repo().delete(other.user.id, workout.id)).toBe(false);
    expect(await repo().find(user.id, workout.id)).toEqual(workout);
  });

  it("deletes a workout with its sets", async () => {
    const { user, squat } = await setup();
    const workout = await repo().create(user.id, null);
    await repo().addSet(workout.id, { exerciseId: squat.id, reps: 5, weightKg: 100 });
    expect(await repo().delete(user.id, workout.id)).toBe(true);
    expect(await repo().find(user.id, workout.id)).toBeUndefined();
    expect(await repo().sets(workout.id)).toEqual([]);
  });

  it("lists the user's workouts, the most recent first, summed up", async () => {
    const { user, squat, bench, start } = await setup();
    const other = await setup();
    const older = await repo().create(user.id, start, new Date("2026-09-01T17:00:00Z"));
    const newer = await repo().create(user.id, null, new Date("2026-09-03T17:00:00Z"));
    await repo().create(other.user.id, null, new Date("2026-09-02T17:00:00Z"));
    await repo().addSet(older.id, { exerciseId: squat.id, reps: 5, weightKg: 100 });
    await repo().addSet(older.id, { exerciseId: squat.id, reps: 5, weightKg: 100 });
    await repo().addSet(older.id, { exerciseId: bench.id, reps: 10, weightKg: 60.5 });

    expect(await repo().list(user.id, 10, 0)).toEqual([
      { ...newer, exercises: 0, sets: 0, volume: 0 },
      { ...older, exercises: 2, sets: 3, volume: 1605 },
    ]);
    expect((await repo().list(user.id, 1, 1)).map((workout) => workout.id)).toEqual([older.id]);
  });

  it("finds, for each exercise, the last earlier workout with it", async () => {
    const { user, squat, bench } = await setup();
    const other = await setup();
    const first = await repo().create(user.id, null, new Date("2026-09-01T17:00:00Z"));
    const second = await repo().create(user.id, null, new Date("2026-09-03T17:00:00Z"));
    const current = await repo().create(user.id, null, new Date("2026-09-05T17:00:00Z"));
    const later = await repo().create(user.id, null, new Date("2026-09-07T17:00:00Z"));
    const theirs = await repo().create(other.user.id, null, new Date("2026-09-04T17:00:00Z"));

    await repo().addSet(first.id, { exerciseId: squat.id, reps: 5, weightKg: 90 });
    await repo().addSet(first.id, { exerciseId: bench.id, reps: 8, weightKg: 60 });
    await repo().addSet(first.id, { exerciseId: bench.id, reps: 6, weightKg: 65 });
    await repo().addSet(second.id, { exerciseId: squat.id, reps: 5, weightKg: 95 });
    await repo().addSet(second.id, { exerciseId: squat.id, reps: 4, weightKg: 97.5 });
    await repo().addSet(current.id, { exerciseId: squat.id, reps: 5, weightKg: 100 });
    await repo().addSet(later.id, { exerciseId: bench.id, reps: 1, weightKg: 200 });
    await repo().addSet(theirs.id, { exerciseId: other.squat.id, reps: 1, weightKg: 300 });

    expect(await repo().previous(user.id, current.id)).toEqual(new Map([
      [squat.id, { workoutId: second.id, startedAt: "2026-09-03T17:00:00.000Z", sets: [{ reps: 5, weightKg: 95 }, { reps: 4, weightKg: 97.5 }] }],
      [bench.id, { workoutId: first.id, startedAt: "2026-09-01T17:00:00.000Z", sets: [{ reps: 8, weightKg: 60 }, { reps: 6, weightKg: 65 }] }],
    ]));
    expect(await repo().previous(user.id, first.id)).toEqual(new Map());
    expect(await repo().previous(other.user.id, current.id)).toEqual(new Map());
  });
});

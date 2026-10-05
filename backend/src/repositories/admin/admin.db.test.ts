import { describe, expect, it } from "vitest";
import { SERVER, testDatabase } from "../../lib/database/test-database";
import { createExercisesRepository } from "../exercises/exercises.repository";
import { createPlansRepository } from "../plans/plans.repository";
import { createUsersRepository } from "../users/users.repository";
import { createWorkoutsRepository } from "../workouts/workouts.repository";
import { createAdminRepository } from "./admin.repository";

describe.skipIf(SERVER === undefined)("the admin repository", () => {
  const handle = testDatabase();
  const repo = () => createAdminRepository(handle.db);
  const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

  it("says who is an admin, and makes one", async () => {
    const users = createUsersRepository(handle.db);
    const anna = await users.create(`a${Math.random().toString(36).slice(2)}`, "x");
    expect(await repo().isAdmin(anna.id)).toBe(false);
    expect(await repo().setAdmin(anna.username, true)).toBe(true);
    expect(await repo().isAdmin(anna.id)).toBe(true);
    expect(await repo().setAdmin(anna.username, false)).toBe(true);
    expect(await repo().isAdmin(anna.id)).toBe(false);
    expect(await repo().setAdmin("nobody-at-all", true)).toBe(false);
    expect(await repo().isAdmin(999_999)).toBe(false);
  });

  it("counts what each user has and does, the latest active first", async () => {
    const users = createUsersRepository(handle.db);
    const idle = await users.create(`i${Math.random().toString(36).slice(2)}`, "x");
    const busy = await users.create(`b${Math.random().toString(36).slice(2)}`, "x");
    const squat = await createExercisesRepository(handle.db).create(busy.id, { name: "Squat", muscleGroup: null, notes: null });
    await createExercisesRepository(handle.db).create(busy.id, { name: "Panca", muscleGroup: null, notes: null });
    await createPlansRepository(handle.db).create(busy.id, { name: "P", notes: null, startsOn: "2026-10-05", endsOn: null, archived: false, days: [] });
    const workouts = createWorkoutsRepository(handle.db);
    const old = await workouts.create(busy.id, null, daysAgo(40));
    await workouts.addSet(old.id, { exerciseId: squat.id, reps: 5, weightKg: 100 });
    const recent = await workouts.create(busy.id, null, daysAgo(2));
    await workouts.addSet(recent.id, { exerciseId: squat.id, reps: 5, weightKg: 100 });
    await workouts.addSet(recent.id, { exerciseId: squat.id, reps: 5, weightKg: 105 });
    await users.createSession(`t${Math.random()}`, busy.id, 30);

    const usage = await repo().usage();
    const row = (id: number) => usage.find((one) => one.id === id);
    expect(row(busy.id)).toEqual({
      id: busy.id, username: busy.username, isAdmin: false, createdAt: expect.any(String),
      lastWorkoutAt: recent.startedAt, lastSeenAt: expect.any(String),
      workouts: 2, workoutsLast30Days: 1, sets: 3, exercises: 2, plans: 1,
    });
    // a session renewed now: seen just now
    expect(Date.now() - Date.parse(row(busy.id)!.lastSeenAt!)).toBeLessThan(60_000);
    expect(row(idle.id)).toMatchObject({ lastWorkoutAt: null, lastSeenAt: null, workouts: 0, workoutsLast30Days: 0, sets: 0, exercises: 0, plans: 0 });
    // the latest active first, the never active at the end
    expect(usage.findIndex((one) => one.id === busy.id)).toBeLessThan(usage.findIndex((one) => one.id === idle.id));
  });
});

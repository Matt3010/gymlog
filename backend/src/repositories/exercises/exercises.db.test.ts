import { describe, expect, it } from "vitest";
import { workoutSets, workouts } from "../../lib";
import { SERVER, testDatabase } from "../../lib/database/test-database";
import { createUsersRepository } from "../users/users.repository";
import { createExercisesRepository } from "./exercises.repository";

const squat = { name: "Squat", muscleGroup: "Gambe", notes: "bilanciere alto" };

describe.skipIf(SERVER === undefined)("the exercises repository", () => {
  const handle = testDatabase();
  const repo = () => createExercisesRepository(handle.db);
  const newUser = () => createUsersRepository(handle.db).create(`u${Math.random().toString(36).slice(2)}`, "x");

  it("creates an exercise and finds it", async () => {
    const user = await newUser();
    const created = await repo().create(user.id, squat);
    expect(created).toEqual({ id: expect.any(Number), ...squat });
    expect(await repo().find(user.id, created.id)).toEqual(created);
  });

  it("lists a user's own exercises by name, whatever the case", async () => {
    const [user, other] = [await newUser(), await newUser()];
    await repo().create(user.id, { name: "panca", muscleGroup: null, notes: null });
    await repo().create(user.id, { name: "Affondi", muscleGroup: null, notes: null });
    await repo().create(user.id, { name: "Curl", muscleGroup: null, notes: null });
    await repo().create(other.id, { name: "Bench", muscleGroup: null, notes: null });
    expect((await repo().list(user.id)).map((exercise) => exercise.name)).toEqual(["Affondi", "Curl", "panca"]);
  });

  it("finds nothing of another user", async () => {
    const [user, other] = [await newUser(), await newUser()];
    const created = await repo().create(user.id, squat);
    expect(await repo().find(other.id, created.id)).toBeUndefined();
  });

  it("updates an exercise of the user only", async () => {
    const [user, other] = [await newUser(), await newUser()];
    const created = await repo().create(user.id, squat);
    const changed = { name: "Squat frontale", muscleGroup: null, notes: null };
    expect(await repo().update(other.id, created.id, changed)).toBeUndefined();
    expect(await repo().find(user.id, created.id)).toEqual(created);
    expect(await repo().update(user.id, created.id, changed)).toEqual({ id: created.id, ...changed });
    expect(await repo().find(user.id, created.id)).toEqual({ id: created.id, ...changed });
  });

  it("deletes an exercise of the user only", async () => {
    const [user, other] = [await newUser(), await newUser()];
    const created = await repo().create(user.id, squat);
    expect(await repo().delete(other.id, created.id)).toBe(false);
    expect(await repo().find(user.id, created.id)).toBeDefined();
    expect(await repo().delete(user.id, created.id)).toBe(true);
    expect(await repo().find(user.id, created.id)).toBeUndefined();
  });

  it("does not delete an exercise with sets done", async () => {
    const user = await newUser();
    const created = await repo().create(user.id, squat);
    const [workout] = await handle.db.insert(workouts).values({ userId: user.id }).returning();
    await handle.db.insert(workoutSets).values({ workoutId: workout!.id, exerciseId: created.id, reps: 5, weightKg: 100 });
    await expect(repo().delete(user.id, created.id)).rejects.toMatchObject({ cause: { code: "23503" } });
  });

  it("takes a name once per user, whatever the case", async () => {
    const [user, other] = [await newUser(), await newUser()];
    await repo().create(user.id, squat);
    await expect(repo().create(user.id, { ...squat, name: "SQUAT" })).rejects.toMatchObject({ cause: { code: "23505" } });
    await expect(repo().create(other.id, squat)).resolves.toBeDefined();
  });

  it("tells whether every id is the user's", async () => {
    const [user, other] = [await newUser(), await newUser()];
    const mine = await repo().create(user.id, squat);
    const theirs = await repo().create(other.id, squat);
    expect(await repo().ownsAll(user.id, [mine.id])).toBe(true);
    expect(await repo().ownsAll(user.id, [mine.id, mine.id])).toBe(true);
    expect(await repo().ownsAll(user.id, [mine.id, theirs.id])).toBe(false);
    expect(await repo().ownsAll(user.id, [mine.id, 999_999])).toBe(false);
    expect(await repo().ownsAll(user.id, [])).toBe(true);
  });
});

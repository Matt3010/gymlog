import { describe, expect, it } from "vitest";
import { SERVER, testDatabase } from "../../lib/database/test-database";
import { createExercisesRepository } from "../exercises/exercises.repository";
import { createUsersRepository } from "../users/users.repository";
import { createWorkoutsRepository } from "../workouts/workouts.repository";
import { createStatsRepository } from "./stats.repository";

describe.skipIf(SERVER === undefined)("the stats repository", () => {
  const handle = testDatabase();
  const repo = () => createStatsRepository(handle.db);

  async function setup() {
    const user = await createUsersRepository(handle.db).create(`u${Math.random().toString(36).slice(2)}`, "x");
    const exercises = createExercisesRepository(handle.db);
    const squat = await exercises.create(user.id, { name: "Squat", muscleGroup: null, notes: null });
    const bench = await exercises.create(user.id, { name: "Panca", muscleGroup: null, notes: null });
    return { user, squat, bench };
  }

  it("reads the user's sets, oldest first, with exercise and workout", async () => {
    const { user, squat, bench } = await setup();
    const other = await setup();
    const workouts = createWorkoutsRepository(handle.db);
    const later = await workouts.create(user.id, null, new Date("2026-09-03T17:00:00Z"));
    const earlier = await workouts.create(user.id, null, new Date("2026-09-01T17:00:00Z"));
    await workouts.addSet(later.id, { exerciseId: squat.id, reps: 5, weightKg: 100 });
    await workouts.addSet(earlier.id, { exerciseId: bench.id, reps: 8, weightKg: 60 });
    await workouts.addSet(earlier.id, { exerciseId: squat.id, reps: 5, weightKg: 92.5 });
    const theirs = await workouts.create(other.user.id, null);
    await workouts.addSet(theirs.id, { exerciseId: other.squat.id, reps: 1, weightKg: 300 });

    expect(await repo().sets(user.id)).toEqual([
      { exerciseId: bench.id, exerciseName: "Panca", workoutId: earlier.id, startedAt: "2026-09-01T17:00:00.000Z", reps: 8, weightKg: 60 },
      { exerciseId: squat.id, exerciseName: "Squat", workoutId: earlier.id, startedAt: "2026-09-01T17:00:00.000Z", reps: 5, weightKg: 92.5 },
      { exerciseId: squat.id, exerciseName: "Squat", workoutId: later.id, startedAt: "2026-09-03T17:00:00.000Z", reps: 5, weightKg: 100 },
    ]);
    expect((await repo().sets(user.id, squat.id)).map((set) => set.weightKg)).toEqual([92.5, 100]);
    expect(await repo().sets(other.user.id, squat.id)).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { SERVER, testDatabase } from "../lib/database/test-database";
import { NotFoundError } from "../errors";
import { createUsersRepository, createWorkoutsRepository, type PlanInput } from "../repositories";
import { createExercisesService, createPlansService, createStatsService, createWorkoutsService } from "../services";
import { InputError } from "../validators";
import { createPlansManager } from "./plans/plans.manager";
import { createStatsManager } from "./stats/stats.manager";
import { createWorkoutsManager } from "./workouts/workouts.manager";

describe.skipIf(SERVER === undefined)("the training services and managers", () => {
  const handle = testDatabase();
  const NOW = new Date("2026-10-01T12:00:00.000Z");

  /** What the controllers call: each context's service, with its manager's methods where one joins services. */
  function services() {
    const db = handle.db;
    return {
      workoutsRepo: createWorkoutsRepository(db),
      exercises: createExercisesService(db),
      plans: { ...createPlansService(db), ...createPlansManager(db) },
      workouts: { ...createWorkoutsService(db), ...createWorkoutsManager(db) },
      stats: { ...createStatsService(db, () => NOW), ...createStatsManager(db) },
    };
  }

  async function setup() {
    const user = await createUsersRepository(handle.db).create(`u${Math.random().toString(36).slice(2)}`, "x");
    const s = services();
    const squat = await s.exercises.create(user.id, { name: "Squat", muscleGroup: "Gambe", notes: null });
    const bench = await s.exercises.create(user.id, { name: "Panca", muscleGroup: "Petto", notes: null });
    const input: PlanInput = {
      name: "Forza", notes: null, archived: false,
      days: [{ name: "A", exercises: [{ exerciseId: squat.id, sets: 5, reps: "5", restSeconds: 180, notes: null }] }],
    };
    return { user, squat, bench, input, ...s };
  }

  describe("exercises", () => {
    it("are listed, changed and deleted", async () => {
      const { user, squat, bench, exercises } = await setup();
      expect((await exercises.list(user.id)).map((exercise) => exercise.name)).toEqual(["Panca", "Squat"]);
      expect(await exercises.update(user.id, squat.id, { name: "Squat basso", muscleGroup: null, notes: null }))
        .toEqual({ id: squat.id, name: "Squat basso", muscleGroup: null, notes: null });
      await exercises.delete(user.id, bench.id);
      expect((await exercises.list(user.id)).map((exercise) => exercise.id)).toEqual([squat.id]);
    });

    it("of another user are not found", async () => {
      const { squat, exercises } = await setup();
      const other = await setup();
      await expect(exercises.update(other.user.id, squat.id, { name: "x", muscleGroup: null, notes: null })).rejects.toThrow(NotFoundError);
      await expect(exercises.delete(other.user.id, squat.id)).rejects.toThrow(NotFoundError);
    });
  });

  describe("plans", () => {
    it("are created, read, replaced, listed and deleted", async () => {
      const { user, bench, input, plans } = await setup();
      const plan = await plans.create(user.id, input);
      expect(await plans.get(user.id, plan.id)).toEqual(plan);
      const replaced = await plans.replace(user.id, plan.id, { ...input, name: "Ipertrofia", days: [{ name: "B", exercises: [{ ...input.days[0]!.exercises[0]!, exerciseId: bench.id }] }] });
      expect(replaced).toMatchObject({ name: "Ipertrofia", days: [{ name: "B", exercises: [{ exerciseName: "Panca" }] }] });
      expect(await plans.list(user.id)).toEqual([replaced]);
      await plans.delete(user.id, plan.id);
      await expect(plans.get(user.id, plan.id)).rejects.toThrow(NotFoundError);
    });

    it("of another user are not found", async () => {
      const { user, input, plans } = await setup();
      const other = await setup();
      const plan = await plans.create(user.id, input);
      await expect(plans.get(other.user.id, plan.id)).rejects.toThrow(NotFoundError);
      await expect(plans.replace(other.user.id, plan.id, other.input)).rejects.toThrow(NotFoundError);
      await expect(plans.delete(other.user.id, plan.id)).rejects.toThrow(NotFoundError);
    });

    it("take only the user's own exercises", async () => {
      const { user, input, plans } = await setup();
      const other = await setup();
      const plan = await plans.create(user.id, input);
      const theirs: PlanInput = { ...input, days: [{ name: "A", exercises: [{ ...input.days[0]!.exercises[0]!, exerciseId: other.squat.id }] }] };
      await expect(plans.create(user.id, theirs)).rejects.toThrow(new InputError("Uno degli esercizi non esiste più. Ricarica la pagina."));
      await expect(plans.replace(user.id, plan.id, theirs)).rejects.toThrow(InputError);
      expect(await plans.list(user.id)).toEqual([plan]);
    });
  });

  describe("workouts", () => {
    it("start free, with what was done before", async () => {
      const { user, squat, workouts, workoutsRepo } = await setup();
      const earlier = await workoutsRepo.create(user.id, null, new Date("2026-09-01T17:00:00Z"));
      await workoutsRepo.addSet(earlier.id, { exerciseId: squat.id, reps: 5, weightKg: 90 });
      const workout = await workouts.start(user.id, null);
      expect(workout).toMatchObject({ planDayId: null, planName: null, dayName: null, plan: [], sets: [] });
      expect(workout.previous).toEqual({
        [squat.id]: { workoutId: earlier.id, startedAt: "2026-09-01T17:00:00.000Z", sets: [{ reps: 5, weightKg: 90 }] },
      });
    });

    it("start from a plan day, with what it asks for", async () => {
      const { user, input, plans, workouts } = await setup();
      const plan = await plans.create(user.id, input);
      const day = plan.days[0]!;
      const workout = await workouts.start(user.id, day.id);
      expect(workout).toMatchObject({ planDayId: day.id, planName: "Forza", dayName: "A", plan: day.exercises });
      expect(await workouts.get(user.id, workout.id)).toEqual(workout);
    });

    it("do not start from another user's plan day", async () => {
      const { workouts } = await setup();
      const other = await setup();
      const plan = await other.plans.create(other.user.id, other.input);
      const { user } = await setup();
      await expect(workouts.start(user.id, plan.days[0]!.id)).rejects.toThrow(new InputError("Il giorno della scheda non esiste più. Ricarica la pagina."));
    });

    it("log, change and delete sets", async () => {
      const { user, squat, workouts } = await setup();
      const workout = await workouts.start(user.id, null);
      const set = await workouts.addSet(user.id, workout.id, { exerciseId: squat.id, reps: 5, weightKg: 100 });
      expect(set).toMatchObject({ exerciseId: squat.id, exerciseName: "Squat", reps: 5, weightKg: 100 });
      expect(await workouts.updateSet(user.id, set.id, { reps: 4, weightKg: 105 })).toMatchObject({ id: set.id, reps: 4, weightKg: 105 });
      expect((await workouts.get(user.id, workout.id)).sets).toEqual([{ ...set, reps: 4, weightKg: 105 }]);
      await workouts.deleteSet(user.id, set.id);
      expect((await workouts.get(user.id, workout.id)).sets).toEqual([]);
    });

    it("take sets of the user's own exercises, in the user's own workouts", async () => {
      const { user, squat, workouts } = await setup();
      const other = await setup();
      const workout = await workouts.start(user.id, null);
      const theirs = await workouts.start(other.user.id, null);
      await expect(workouts.addSet(user.id, workout.id, { exerciseId: other.squat.id, reps: 5, weightKg: 1 }))
        .rejects.toThrow(new InputError("Uno degli esercizi non esiste più. Ricarica la pagina."));
      await expect(workouts.addSet(user.id, theirs.id, { exerciseId: squat.id, reps: 5, weightKg: 1 })).rejects.toThrow(NotFoundError);
      const set = await workouts.addSet(user.id, workout.id, { exerciseId: squat.id, reps: 5, weightKg: 100 });
      await expect(workouts.updateSet(other.user.id, set.id, { reps: 1, weightKg: 1 })).rejects.toThrow(NotFoundError);
      await expect(workouts.deleteSet(other.user.id, set.id)).rejects.toThrow(NotFoundError);
    });

    it("are finished, noted, listed and deleted", async () => {
      const { user, squat, workouts } = await setup();
      const workout = await workouts.start(user.id, null);
      await workouts.addSet(user.id, workout.id, { exerciseId: squat.id, reps: 5, weightKg: 100 });
      const finished = await workouts.update(user.id, workout.id, { finished: true, notes: "bene" });
      expect(finished).toMatchObject({ notes: "bene", finishedAt: expect.any(String), sets: [{ reps: 5 }] });
      expect(await workouts.list(user.id, 20, 0)).toEqual([
        { id: workout.id, planDayId: null, planName: null, dayName: null, startedAt: workout.startedAt, finishedAt: finished.finishedAt, notes: "bene", exercises: 1, sets: 1, volume: 500 },
      ]);
      await workouts.delete(user.id, workout.id);
      await expect(workouts.get(user.id, workout.id)).rejects.toThrow(NotFoundError);
    });

    it("of another user are not found", async () => {
      const { user, workouts } = await setup();
      const other = await setup();
      const workout = await workouts.start(user.id, null);
      await expect(workouts.get(other.user.id, workout.id)).rejects.toThrow(NotFoundError);
      await expect(workouts.update(other.user.id, workout.id, { notes: "x" })).rejects.toThrow(NotFoundError);
      await expect(workouts.delete(other.user.id, workout.id)).rejects.toThrow(NotFoundError);
    });
  });

  describe("stats", () => {
    it("sum up an exercise session by session", async () => {
      const { user, squat, stats, workoutsRepo } = await setup();
      const first = await workoutsRepo.create(user.id, null, new Date("2026-09-01T17:00:00Z"));
      const second = await workoutsRepo.create(user.id, null, new Date("2026-09-03T17:00:00Z"));
      await workoutsRepo.addSet(first.id, { exerciseId: squat.id, reps: 5, weightKg: 90 });
      await workoutsRepo.addSet(first.id, { exerciseId: squat.id, reps: 5, weightKg: 100 });
      await workoutsRepo.addSet(second.id, { exerciseId: squat.id, reps: 3, weightKg: 110 });

      const result = await stats.exercise(user.id, squat.id);
      expect(result.exercise).toEqual(squat);
      expect(result.sessions).toEqual([
        { workoutId: second.id, startedAt: "2026-09-03T17:00:00.000Z", sets: 1, reps: 3, volume: 330, avgWeight: 110, maxWeight: 110, bestE1rm: 121 },
        { workoutId: first.id, startedAt: "2026-09-01T17:00:00.000Z", sets: 2, reps: 10, volume: 950, avgWeight: 95, maxWeight: 100, bestE1rm: 116.67 },
      ]);
      expect(result.overall).toMatchObject({ sessions: 2, sets: 3, avgWeight: 100, maxWeight: 110 });
    });

    it("are not found for another user's exercise", async () => {
      const { squat } = await setup();
      const other = await setup();
      await expect(other.stats.exercise(other.user.id, squat.id)).rejects.toThrow(NotFoundError);
    });

    it("count the last thirty days up to the real clock by default", async () => {
      const { user, squat, workoutsRepo } = await setup();
      const today = await workoutsRepo.create(user.id, null);
      await workoutsRepo.addSet(today.id, { exerciseId: squat.id, reps: 2, weightKg: 50 });
      expect(await createStatsService(handle.db).overview(user.id)).toMatchObject({ workoutsLast30Days: 1, volumeLast30Days: 100 });
    });

    it("give an overview as of now", async () => {
      const { user, squat, stats, workoutsRepo } = await setup();
      const old = await workoutsRepo.create(user.id, null, new Date("2026-08-01T17:00:00Z"));
      const recent = await workoutsRepo.create(user.id, null, new Date("2026-09-20T17:00:00Z"));
      await workoutsRepo.addSet(old.id, { exerciseId: squat.id, reps: 5, weightKg: 80 });
      await workoutsRepo.addSet(recent.id, { exerciseId: squat.id, reps: 5, weightKg: 100 });
      expect(await stats.overview(user.id)).toEqual({
        workouts: 2, workoutsLast30Days: 1, volumeLast30Days: 500,
        exercises: [{ exerciseId: squat.id, name: "Squat", sessions: 2, avgWeight: 90, maxWeight: 100, lastAt: "2026-09-20T17:00:00.000Z" }],
      });
    });
  });
});

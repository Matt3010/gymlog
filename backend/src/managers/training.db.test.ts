import { describe, expect, it } from "vitest";
import { SERVER, testDatabase } from "../lib/database/test-database";
import { ConflictError, NotFoundError } from "../errors";
import { createDb } from "../lib";
import { createUsersRepository, createWorkoutsRepository, type PlanInput } from "../repositories";
import { createExercisesService, createPlansService, createStatsService, createWorkoutsService } from "../services";
import { InputError } from "../validators";
import { createPlansManager } from "./plans/plans.manager";
import { createStatsManager } from "./stats/stats.manager";
import { createWorkoutsManager } from "./workouts/workouts.manager";

describe.skipIf(SERVER === undefined)("the training services and managers", () => {
  const handle = testDatabase();
  
  /** What the controllers call: each context's service, with its manager's methods where one joins services. */
  function services() {
    const db = handle.db;
    return {
      workoutsRepo: createWorkoutsRepository(db),
      exercises: createExercisesService(db),
      plans: { ...createPlansService(db), ...createPlansManager(db) },
      workouts: { ...createWorkoutsService(db), ...createWorkoutsManager(db) },
      stats: { ...createStatsService(db), ...createStatsManager(db) },
    };
  }

  async function setup() {
    const user = await createUsersRepository(handle.db).create(`u${Math.random().toString(36).slice(2)}`, "x");
    const s = services();
    const squat = await s.exercises.create(user.id, { name: "Squat", muscleGroup: "Gambe", notes: null });
    const bench = await s.exercises.create(user.id, { name: "Panca", muscleGroup: "Petto", notes: null });
    const input: PlanInput = {
      name: "Forza", notes: null, startsOn: "2026-10-05", endsOn: null, archived: false,
      days: [{ name: "A", exercises: [{ exerciseId: squat.id, reps: ["5", "5", "5", "5", "5"], restSeconds: 180, notes: null }] }],
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

    it("say a taken name in the app's words, and let any other failure through", async () => {
      const { user, exercises } = await setup();
      await expect(exercises.create(user.id, { name: "squat", muscleGroup: null, notes: null })).rejects.toThrow(new ConflictError("Esiste già un esercizio con questo nome."));
      const down = createDb("postgres://nobody:x@127.0.0.1:1/none");
      try {
        const failure = createExercisesService(down).create(user.id, { name: "Stacco", muscleGroup: null, notes: null });
        await expect(failure).rejects.toThrow(/Failed query/);
        await expect(failure).rejects.not.toBeInstanceOf(ConflictError);
      } finally {
        await down.$client.end();
      }
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

    it("close, once created, the one in use that started before", async () => {
      const { user, input, plans } = await setup();
      const summer = await plans.create(user.id, { ...input, name: "Estate", startsOn: "2026-06-01" });
      const autumn = await plans.create(user.id, { ...input, name: "Autunno", startsOn: "2026-10-05" });
      expect(await plans.list(user.id)).toEqual([autumn, { ...summer, endsOn: "2026-10-04", archived: true }]);
      const winter = await plans.create(user.id, { ...input, name: "Inverno", startsOn: "2026-12-01", endsOn: "2026-12-31" });
      expect((await plans.get(user.id, autumn.id)).endsOn).toBe("2026-11-30");
      // saving one again closes nothing: only a new plan takes over
      const reopened = await plans.replace(user.id, summer.id, { ...input, name: "Estate", startsOn: "2026-06-01" });
      await plans.replace(user.id, winter.id, { ...input, name: "Inverno", startsOn: "2026-12-01" });
      expect(await plans.get(user.id, summer.id)).toEqual(reopened);
      expect(reopened).toMatchObject({ endsOn: null, archived: false });
    });

    it("close nothing when the new one is not the one in use: over already, or archived", async () => {
      const { user, input, plans } = await setup();
      const current = await plans.create(user.id, { ...input, name: "In uso", startsOn: "2026-03-01" });
      await plans.create(user.id, { ...input, name: "Vecchia", startsOn: "2026-04-01", endsOn: "2026-05-01" });
      await plans.create(user.id, { ...input, name: "Da parte", startsOn: "2026-06-01", archived: true });
      expect(await plans.get(user.id, current.id)).toEqual(current);
    });

    it("of another user are not found", async () => {
      const { user, input, plans } = await setup();
      const other = await setup();
      const plan = await plans.create(user.id, input);
      await expect(plans.get(other.user.id, plan.id)).rejects.toThrow(NotFoundError);
      await expect(plans.replace(other.user.id, plan.id, other.input)).rejects.toThrow(NotFoundError);
      await expect(plans.delete(other.user.id, plan.id)).rejects.toThrow(NotFoundError);
    });

    it("refuse a day id that is not one of the plan's", async () => {
      const { user, input, plans } = await setup();
      const plan = await plans.create(user.id, input);
      const other = await plans.create(user.id, input);
      // One of its own days next to the other plan's: one stranger is enough to refuse.
      const days = [{ ...input.days[0]!, id: plan.days[0]!.id }, { ...input.days[0]!, id: other.days[0]!.id }];
      await expect(plans.replace(user.id, plan.id, { ...input, days }))
        .rejects.toThrow(new InputError("Uno degli allenamenti della scheda non esiste più. Ricarica la pagina."));
      expect(await plans.get(user.id, other.id)).toEqual(other);
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
    it("are one at a time: another does not start while one is in progress", async () => {
      const { user, workouts } = await setup();
      const first = await workouts.start(user.id, null);
      await expect(workouts.start(user.id, null))
        .rejects.toThrow(new ConflictError("Hai già un allenamento in corso: terminalo prima di iniziarne un altro."));
      await workouts.update(user.id, first.id, { finished: true });
      const second = await workouts.start(user.id, null);
      // and a finished one is not reopened over the one in progress
      await expect(workouts.update(user.id, first.id, { finished: false }))
        .rejects.toThrow(new ConflictError("C’è già un altro allenamento in corso: terminalo prima di riaprire questo."));
      await workouts.update(user.id, second.id, { finished: true });
      expect((await workouts.update(user.id, first.id, { finished: false })).finishedAt).toBeNull();
      // another user's workout in progress is no obstacle
      const other = await setup();
      await expect(workouts.start(other.user.id, null)).resolves.toMatchObject({ finishedAt: null });
    });

    it("take a set sent again with its key once, and refuse the same key with something else", async () => {
      const { user, squat, workouts } = await setup();
      const workout = await workouts.start(user.id, null);
      const first = await workouts.addSet(user.id, workout.id, { exerciseId: squat.id, reps: 5, weightKg: 100, key: "k-1" });
      expect(await workouts.addSet(user.id, workout.id, { exerciseId: squat.id, reps: 5, weightKg: 100, key: "k-1" })).toEqual(first);
      await expect(workouts.addSet(user.id, workout.id, { exerciseId: squat.id, reps: 6, weightKg: 100, key: "k-1" }))
        .rejects.toThrow(new ConflictError("Questa serie è già segnata con altri numeri. Ricarica la pagina."));
    });

    it("hold at most 200 sets: no session has more, and the server's card does not fill up", async () => {
      const { user, squat, workouts, workoutsRepo } = await setup();
      const workout = await workouts.start(user.id, null);
      for (let i = 0; i < 200; i++) await workoutsRepo.addSet(workout.id, { exerciseId: squat.id, reps: 5, weightKg: 100 });
      await expect(workouts.addSet(user.id, workout.id, { exerciseId: squat.id, reps: 5, weightKg: 100 }))
        .rejects.toThrow(new InputError("Al più 200 serie in un allenamento."));
      // the same set sent again with its key is still the same set, not one more
      await expect(workouts.addSet(user.id, workout.id, { exerciseId: squat.id, reps: 5, weightKg: 100, key: "x" })).rejects.toThrow(InputError);
    });

    it("give back at the cap a set already there under its key, sent again", async () => {
      const { user, squat, workouts, workoutsRepo } = await setup();
      const workout = await workouts.start(user.id, null);
      const kept = await workoutsRepo.addSet(workout.id, { exerciseId: squat.id, reps: 5, weightKg: 100, key: "kept" });
      for (let i = 0; i < 199; i++) await workoutsRepo.addSet(workout.id, { exerciseId: squat.id, reps: 5, weightKg: 100 });
      expect(await workouts.addSet(user.id, workout.id, { exerciseId: squat.id, reps: 5, weightKg: 100, key: "kept" })).toEqual(kept);
    });

    it("refuse a key again with another exercise or weight, not only other reps", async () => {
      const { user, squat, bench, workouts } = await setup();
      const workout = await workouts.start(user.id, null);
      await workouts.addSet(user.id, workout.id, { exerciseId: squat.id, reps: 5, weightKg: 100, key: "k" });
      await expect(workouts.addSet(user.id, workout.id, { exerciseId: bench.id, reps: 5, weightKg: 100, key: "k" })).rejects.toThrow(ConflictError);
      await expect(workouts.addSet(user.id, workout.id, { exerciseId: squat.id, reps: 5, weightKg: 102.5, key: "k" })).rejects.toThrow(ConflictError);
    });

    it("can be reopened while open already (nothing to do), and closed or noted with old ones left open", async () => {
      const { user, workouts, workoutsRepo } = await setup();
      // two left open from before the one-at-a-time rule
      const older = await workoutsRepo.create(user.id, null, new Date("2026-09-01T17:00:00Z"));
      const newer = await workoutsRepo.create(user.id, null, new Date("2026-09-02T17:00:00Z"));
      await expect(workouts.update(user.id, newer.id, { notes: "ok" })).resolves.toMatchObject({ notes: "ok" });
      await expect(workouts.update(user.id, newer.id, { finished: true })).resolves.toMatchObject({ finishedAt: expect.any(String) });
      expect((await workouts.update(user.id, older.id, { finished: false })).finishedAt).toBeNull();
    });

    it("are one at a time even when two starts arrive together", async () => {
      const { user, workouts } = await setup();
      const both = await Promise.allSettled([workouts.start(user.id, null), workouts.start(user.id, null)]);
      expect(both.map((one) => one.status).sort()).toEqual(["fulfilled", "rejected"]);
    });

    it("start free, with what was done before", async () => {
      const { user, squat, workouts, workoutsRepo } = await setup();
      const earlier = await workoutsRepo.create(user.id, null, new Date("2026-09-01T17:00:00Z"));
      await workoutsRepo.addSet(earlier.id, { exerciseId: squat.id, reps: 5, weightKg: 90 });
      await workoutsRepo.update(user.id, earlier.id, { finished: true });
      const workout = await workouts.start(user.id, null);
      expect(workout).toMatchObject({ planDayId: null, planName: null, dayName: null, plan: [], sets: [] });
      expect(workout.previous).toEqual({
        [squat.id]: { workoutId: earlier.id, startedAt: "2026-09-01T17:00:00.000Z", sets: [{ reps: 5, weightKg: 90 }], note: null, before: [] },
      });
      expect(workout.exerciseNotes).toEqual({});
      expect(workout.previousNote).toBeNull();
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
      await expect(workouts.start(user.id, plan.days[0]!.id)).rejects.toThrow(new InputError("L’allenamento della scheda non esiste più. Ricarica la pagina."));
    });

    it("keep a note for each exercise of the session", async () => {
      const { user, squat, bench, workouts } = await setup();
      const workout = await workouts.start(user.id, null);
      expect(await workouts.setExerciseNote(user.id, workout.id, squat.id, "spalla fastidiosa")).toEqual({ exerciseId: squat.id, note: "spalla fastidiosa" });
      await workouts.setExerciseNote(user.id, workout.id, bench.id, "presa stretta");
      await workouts.setExerciseNote(user.id, workout.id, bench.id, null);
      expect((await workouts.get(user.id, workout.id)).exerciseNotes).toEqual({ [squat.id]: "spalla fastidiosa" });
    });

    it("take notes only in the user's own workouts, on the user's own exercises", async () => {
      const { user, squat, workouts } = await setup();
      const other = await setup();
      const workout = await workouts.start(user.id, null);
      const theirs = await workouts.start(other.user.id, null);
      await expect(workouts.setExerciseNote(user.id, theirs.id, squat.id, "x")).rejects.toThrow(NotFoundError);
      await expect(workouts.setExerciseNote(user.id, workout.id, other.squat.id, "x"))
        .rejects.toThrow(new InputError("Uno degli esercizi non esiste più. Ricarica la pagina."));
      expect((await workouts.get(user.id, workout.id)).exerciseNotes).toEqual({});
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

    it("sum up each of the user's exercises done", async () => {
      const { user, squat, stats, workoutsRepo } = await setup();
      const other = await setup();
      const old = await workoutsRepo.create(user.id, null, new Date("2026-08-01T17:00:00Z"));
      const recent = await workoutsRepo.create(user.id, null, new Date("2026-09-20T17:00:00Z"));
      await workoutsRepo.addSet(old.id, { exerciseId: squat.id, reps: 5, weightKg: 80 });
      await workoutsRepo.addSet(recent.id, { exerciseId: squat.id, reps: 5, weightKg: 100 });
      const theirs = await workoutsRepo.create(other.user.id, null);
      await workoutsRepo.addSet(theirs.id, { exerciseId: other.squat.id, reps: 1, weightKg: 300 });
      expect(await stats.exercises(user.id)).toEqual([
        { exerciseId: squat.id, name: "Squat", sessions: 2, avgWeight: 90, maxWeight: 100, lastAt: "2026-09-20T17:00:00.000Z" },
      ]);
    });
  });
});

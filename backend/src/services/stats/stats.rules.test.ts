import { describe, expect, it } from "vitest";
import { estimatedMax, exerciseStats, overview, setStats } from "./stats.rules";

describe("the estimated one-rep max", () => {
  it("is the weight itself for a single rep", () => {
    expect(estimatedMax(100, 1)).toBe(100);
  });

  it("follows Epley for more reps: kg × (1 + reps / 30)", () => {
    expect(estimatedMax(100, 10)).toBe(133.33);
    expect(estimatedMax(60, 5)).toBe(70);
  });

  it("is nothing without weight", () => {
    expect(estimatedMax(0, 12)).toBe(0);
  });
});

describe("the stats of some sets", () => {
  it("count sets and reps, and add up the volume", () => {
    const stats = setStats([{ reps: 10, weightKg: 50 }, { reps: 8, weightKg: 55 }, { reps: 6, weightKg: 60 }]);
    expect(stats).toMatchObject({ sets: 3, reps: 24, volume: 500 + 440 + 360 });
  });

  it("average the weight of the sets, and keep the heaviest", () => {
    const stats = setStats([{ reps: 10, weightKg: 50 }, { reps: 8, weightKg: 55 }, { reps: 6, weightKg: 60 }]);
    expect(stats).toMatchObject({ avgWeight: 55, maxWeight: 60 });
  });

  it("keep the best estimated max, which may not be the heaviest set", () => {
    // 100 × 1 = 100, 90 × 6 = 108
    expect(setStats([{ reps: 1, weightKg: 100 }, { reps: 6, weightKg: 90 }]).bestE1rm).toBe(108);
  });

  it("round to two decimals", () => {
    const stats = setStats([{ reps: 3, weightKg: 10 }, { reps: 3, weightKg: 10 }, { reps: 3, weightKg: 12.5 }]);
    expect(stats.avgWeight).toBe(10.83);
    expect(setStats([{ reps: 3, weightKg: 0.1 }, { reps: 3, weightKg: 0.2 }]).volume).toBe(0.9);
  });

  it("are all zero without sets", () => {
    expect(setStats([])).toEqual({ sets: 0, reps: 0, volume: 0, avgWeight: 0, maxWeight: 0, bestE1rm: 0 });
  });
});

describe("an exercise's history", () => {
  const legPress = [
    { workoutId: 2, startedAt: "2026-09-10T18:00:00.000Z", sets: [{ reps: 10, weightKg: 100 }, { reps: 10, weightKg: 120 }] },
    { workoutId: 5, startedAt: "2026-09-17T18:00:00.000Z", sets: [{ reps: 8, weightKg: 130 }] },
  ];

  it("lists each session, the most recent first", () => {
    const { sessions } = exerciseStats(legPress);
    expect(sessions.map((session) => session.workoutId)).toEqual([5, 2]);
    expect(sessions[1]).toEqual({
      workoutId: 2, startedAt: "2026-09-10T18:00:00.000Z", sets: 2, reps: 20, volume: 2200, avgWeight: 110, maxWeight: 120, bestE1rm: 160,
    });
  });

  it("sums up every set of every session", () => {
    expect(exerciseStats(legPress).overall).toEqual({
      sessions: 2, sets: 3, reps: 28, volume: 3240, avgWeight: 116.67, maxWeight: 130, bestE1rm: 164.67,
    });
  });

  it("leaves out sessions without sets", () => {
    const { sessions, overall } = exerciseStats([...legPress, { workoutId: 9, startedAt: "2026-09-20T18:00:00.000Z", sets: [] }]);
    expect(sessions.map((session) => session.workoutId)).toEqual([5, 2]);
    expect(overall.sessions).toBe(2);
  });

  it("is empty with no sessions", () => {
    expect(exerciseStats([])).toEqual({
      sessions: [], overall: { sessions: 0, sets: 0, reps: 0, volume: 0, avgWeight: 0, maxWeight: 0, bestE1rm: 0 },
    });
  });
});

describe("the overview", () => {
  const now = new Date("2026-10-01T12:00:00.000Z");
  const sets = [
    { exerciseId: 1, exerciseName: "Squat", workoutId: 1, startedAt: "2026-08-01T18:00:00.000Z", reps: 5, weightKg: 80 },
    { exerciseId: 1, exerciseName: "Squat", workoutId: 2, startedAt: "2026-09-01T12:00:00.000Z", reps: 5, weightKg: 90 },
    { exerciseId: 1, exerciseName: "Squat", workoutId: 2, startedAt: "2026-09-01T12:00:00.000Z", reps: 5, weightKg: 100 },
    { exerciseId: 2, exerciseName: "Panca", workoutId: 3, startedAt: "2026-09-20T18:00:00.000Z", reps: 10, weightKg: 50 },
  ];
  const starts = ["2026-08-01T18:00:00.000Z", "2026-09-01T12:00:00.000Z", "2026-09-20T18:00:00.000Z", "2026-09-25T18:00:00.000Z"];

  it("counts the workouts, and those of the last thirty days", () => {
    expect(overview(sets, starts, now)).toMatchObject({ workouts: 4, workoutsLast30Days: 3 });
  });

  it("adds up the volume of the last thirty days, counting from exactly thirty days ago", () => {
    // 1 September 12:00 is exactly thirty days before: in.
    expect(overview(sets, starts, now).volumeLast30Days).toBe(450 + 500 + 500);
    expect(overview(sets, starts, new Date("2026-10-01T12:00:00.001Z")).volumeLast30Days).toBe(500);
  });

  it("sums up each exercise, the most recently done first", () => {
    expect(overview(sets, starts, now).exercises).toEqual([
      { exerciseId: 2, name: "Panca", sessions: 1, avgWeight: 50, maxWeight: 50, lastAt: "2026-09-20T18:00:00.000Z" },
      { exerciseId: 1, name: "Squat", sessions: 2, avgWeight: 90, maxWeight: 100, lastAt: "2026-09-01T12:00:00.000Z" },
    ]);
  });

  it("is empty with nothing done", () => {
    expect(overview([], [], now)).toEqual({ workouts: 0, workoutsLast30Days: 0, volumeLast30Days: 0, exercises: [] });
  });
});

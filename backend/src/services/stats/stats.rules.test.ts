import { describe, expect, it } from "vitest";
import { estimatedMax, exerciseStats, exerciseSummaries, setStats } from "./stats.rules";

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

describe("the summary of each exercise", () => {
  const sets = [
    { exerciseId: 1, exerciseName: "Squat", workoutId: 1, startedAt: "2026-08-01T18:00:00.000Z", reps: 5, weightKg: 80 },
    { exerciseId: 1, exerciseName: "Squat", workoutId: 2, startedAt: "2026-09-01T12:00:00.000Z", reps: 5, weightKg: 90 },
    { exerciseId: 1, exerciseName: "Squat", workoutId: 2, startedAt: "2026-09-01T12:00:00.000Z", reps: 5, weightKg: 100 },
    { exerciseId: 2, exerciseName: "Panca", workoutId: 3, startedAt: "2026-09-20T18:00:00.000Z", reps: 10, weightKg: 50 },
  ];

  it("gives sessions, average and heaviest weight, and the last time, the most recently done first", () => {
    expect(exerciseSummaries(sets)).toEqual([
      { exerciseId: 2, name: "Panca", sessions: 1, avgWeight: 50, maxWeight: 50, lastAt: "2026-09-20T18:00:00.000Z" },
      { exerciseId: 1, name: "Squat", sessions: 2, avgWeight: 90, maxWeight: 100, lastAt: "2026-09-01T12:00:00.000Z" },
    ]);
  });

  it("is empty with nothing done", () => {
    expect(exerciseSummaries([])).toEqual([]);
  });
});

describe("many sets", () => {
  // years of training, or someone filling the server on purpose: the stats must not stop it for everyone
  const many = Array.from({ length: 200_000 }, (_, i) => ({
    exerciseId: 1 + (i % 2), exerciseName: i % 2 ? "Panca" : "Squat", workoutId: 1 + Math.floor(i / 20),
    startedAt: new Date(Date.UTC(2020, 0, 1) + Math.floor(i / 20) * 86_400_000).toISOString(), reps: 5 + (i % 6), weightKg: 50 + (i % 40),
  }));

  it("are summed up in a moment, without running out of stack", () => {
    const started = performance.now();
    const summaries = exerciseSummaries(many);
    // all the squat sets in one session: the heaviest case for a single session
    const squat = exerciseStats([{ workoutId: 1, startedAt: many[0]!.startedAt, sets: many.filter((set) => set.exerciseId === 1) }]);
    expect(performance.now() - started).toBeLessThan(1500);
    expect(summaries).toHaveLength(2);
    expect(squat.overall.maxWeight).toBe(88);
    expect(squat.overall.sets).toBe(100_000);
  });
});

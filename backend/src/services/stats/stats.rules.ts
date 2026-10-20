import type { StatSet } from "../../repositories";

/** No reps: to failure, not counted; no weight: done without one. */
export interface DoneSet {
  readonly reps: number | null;
  readonly weightKg: number | null;
}

export interface SetStats {
  readonly sets: number;
  readonly reps: number;
  /** The most reps in one set: what counts without weights. */
  readonly maxReps: number;
  readonly volume: number;
  readonly avgWeight: number;
  readonly maxWeight: number;
  readonly bestE1rm: number;
}

export interface SessionSets {
  readonly workoutId: number;
  readonly startedAt: string;
  readonly sets: readonly DoneSet[];
}

export type ExerciseSession = SetStats & { readonly workoutId: number; readonly startedAt: string };

export interface ExerciseHistory {
  readonly sessions: ExerciseSession[];
  readonly overall: SetStats & { readonly sessions: number };
}

const round = (value: number): number => Math.round(value * 100) / 100;

/** The one-rep max a set suggests (Epley). A single rep is its own max. */
export function estimatedMax(weightKg: number, reps: number): number {
  return reps === 1 ? weightKg : round(weightKg * (1 + reps / 30));
}

/**
 * Sets, reps, volume (reps × kg), the average and heaviest weight of the sets,
 * the best estimated max. Each number counts the sets that say what it needs:
 * a set without weight has no weight to average, one to failure without reps
 * no reps to add up.
 */
export function setStats(sets: readonly DoneSet[]): SetStats {
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  // a loop and not Math.max(...): spread over a hundred thousand sets runs out of stack
  const most = (values: number[]) => values.reduce((best, value) => Math.max(best, value), 0);
  const reps = sets.flatMap((set) => (set.reps === null ? [] : [set.reps]));
  const weights = sets.flatMap((set) => (set.weightKg === null ? [] : [set.weightKg]));
  const both = sets.flatMap((set) => (set.reps === null || set.weightKg === null ? [] : [{ reps: set.reps, weightKg: set.weightKg }]));
  return {
    sets: sets.length,
    reps: sum(reps),
    maxReps: most(reps),
    volume: round(sum(both.map((set) => set.reps * set.weightKg))),
    avgWeight: weights.length === 0 ? 0 : round(sum(weights) / weights.length),
    maxWeight: most(weights),
    bestE1rm: most(both.map((set) => estimatedMax(set.weightKg, set.reps))),
  };
}

/** Each session with sets of one exercise, the most recent first, and all of them together. */
export function exerciseStats(sessions: readonly SessionSets[]): ExerciseHistory {
  const done = sessions.filter((session) => session.sets.length > 0);
  return {
    sessions: done
      .map((session) => ({ workoutId: session.workoutId, startedAt: session.startedAt, ...setStats(session.sets) }))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    overall: { sessions: done.length, ...setStats(done.flatMap((session) => session.sets)) },
  };
}

/** One exercise at a glance, for the exercise list. */
export interface ExerciseSummary {
  readonly exerciseId: number;
  readonly name: string;
  readonly sessions: number;
  readonly avgWeight: number;
  readonly maxWeight: number;
  readonly maxReps: number;
  readonly lastAt: string;
}

/**
 * Each exercise done: in how many sessions, its average and heaviest weight,
 * the last time; the most recently done first. `sets` come oldest first, as
 * the stats repository reads them.
 */
export function exerciseSummaries(sets: readonly StatSet[]): ExerciseSummary[] {
  const byExercise = new Map<number, StatSet[]>();
  // pushed, not copied: copying the list at each set made many sets slow as their square
  for (const set of sets) {
    const done = byExercise.get(set.exerciseId);
    if (done) done.push(set);
    else byExercise.set(set.exerciseId, [set]);
  }

  return [...byExercise.values()]
    .map((done) => {
      const stats = setStats(done);
      return {
        exerciseId: done[0]!.exerciseId,
        name: done[0]!.exerciseName,
        sessions: new Set(done.map((set) => set.workoutId)).size,
        avgWeight: stats.avgWeight,
        maxWeight: stats.maxWeight,
        maxReps: stats.maxReps,
        // The sets come oldest first: the last one is the latest.
        lastAt: done.at(-1)!.startedAt,
      };
    })
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

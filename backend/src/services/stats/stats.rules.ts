import type { StatSet } from "../../repositories";

export interface DoneSet {
  readonly reps: number;
  readonly weightKg: number;
}

export interface SetStats {
  readonly sets: number;
  readonly reps: number;
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

/** Sets, reps, volume (reps × kg), the average and heaviest weight of the sets, the best estimated max. */
export function setStats(sets: readonly DoneSet[]): SetStats {
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  const weights = sets.map((set) => set.weightKg);
  return {
    sets: sets.length,
    reps: sum(sets.map((set) => set.reps)),
    volume: round(sum(sets.map((set) => set.reps * set.weightKg))),
    avgWeight: sets.length === 0 ? 0 : round(sum(weights) / sets.length),
    // a loop and not Math.max(...): spread over a hundred thousand sets runs out of stack
    maxWeight: weights.reduce((best, weight) => Math.max(best, weight), 0),
    bestE1rm: sets.reduce((best, set) => Math.max(best, estimatedMax(set.weightKg, set.reps)), 0),
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
        // The sets come oldest first: the last one is the latest.
        lastAt: done.at(-1)!.startedAt,
      };
    })
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

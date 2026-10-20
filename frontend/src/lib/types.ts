/* What the API sends and takes, as docs/API.md writes it. */

export interface User {
  id: number;
  username: string;
  /** Vede come usano l'app tutti gli altri. Lo dice `/auth/me`. */
  isAdmin?: boolean;
  /** Da quando c'è l'account. Lo dice `/auth/me`. */
  createdAt?: string;
}

/** Come un utente usa l'app: quello che ha, quanto si allena, quando c'era. Solo conti e date. */
export interface UserUsage {
  id: number;
  username: string;
  isAdmin: boolean;
  createdAt: string;
  lastWorkoutAt: string | null;
  /** L'ultima volta che ha aperto l'app, circa. */
  lastSeenAt: string | null;
  workouts: number;
  workoutsLast30Days: number;
  sets: number;
  exercises: number;
  plans: number;
}

export interface Exercise {
  id: number;
  name: string;
  muscleGroup: string | null;
  notes: string | null;
  /** Senza pesi (trazioni, piegamenti): le serie contano le ripetizioni, i chili solo come zavorra. */
  bodyweight: boolean;
}

export interface ExerciseInput {
  name: string;
  muscleGroup: string | null;
  notes: string | null;
  /** Non detto è no. */
  bodyweight?: boolean;
}

export interface PlanExercise {
  id: number;
  exerciseId: number;
  exerciseName: string;
  position: number;
  /**
   * Le ripetizioni di ogni serie prevista, una voce per serie (1..20), testo
   * libero: "12", "8-10", "max". Quante serie sono, lo dice la lunghezza.
   */
  reps: string[];
  restSeconds: number | null;
  notes: string | null;
}

export interface Plan {
  id: number;
  name: string;
  notes: string | null;
  exercises: PlanExercise[];
}

export interface PlanExerciseInput {
  exerciseId: number;
  reps: string[];
  restSeconds: number | null;
  notes: string | null;
}

export interface PlanInput {
  name: string;
  notes: string | null;
  exercises: PlanExerciseInput[];
}

export interface Workout {
  id: number;
  planId: number | null;
  /** Copiato all'inizio: resta anche se la scheda sparisce. */
  planName: string | null;
  startedAt: string;
  finishedAt: string | null;
  notes: string | null;
}

export interface WorkoutSummary extends Workout {
  exercises: number;
  sets: number;
  volume: number;
}

/**
 * Una serie come si scrive: le ripetizioni (nessuna solo a cedimento, «MAX»),
 * i chili (nessuno senza peso), se era a cedimento, e una nota sua: «SX».
 */
export interface SetInput {
  reps: number | null;
  weightKg: number | null;
  toFailure: boolean;
  note: string | null;
}

/** Una serie fatta: `continues` è un pezzo della serie prima (stripping, il braccio SX dopo). */
export interface PastSet extends SetInput {
  continues: boolean;
}

export interface WorkoutSet extends PastSet {
  id: number;
  exerciseId: number;
  exerciseName: string;
  createdAt: string;
}

export type DoneSet = PastSet;

export interface PreviousSets {
  workoutId: number;
  startedAt: string;
  sets: DoneSet[];
  /** Quello che si era scritto su quell'esercizio quella volta. */
  note: string | null;
  /** Le serie della volta prima ancora: per dire se l'ultima era andata meglio. */
  before: DoneSet[];
}

export interface WorkoutDetail extends Workout {
  /** Gli esercizi della scheda; vuoto se libero, o se la scheda non c'è più. */
  plan: PlanExercise[];
  sets: WorkoutSet[];
  /** Per exerciseId: l'ultima sessione precedente con quell'esercizio. */
  previous: Record<string, PreviousSets>;
  /** La nota di ogni esercizio in questo allenamento, per id. */
  exerciseNotes: Record<string, string>;
  /** La nota dell'ultimo allenamento della stessa scheda (o libero, se libero). */
  previousNote: { workoutId: number; startedAt: string; note: string } | null;
  /** Gli id degli esercizi senza pesi: le loro serie non chiedono i chili. */
  bodyweight: number[];
}

export interface SetStats {
  sets: number;
  reps: number;
  /** Le ripetizioni della serie migliore: quello che conta senza pesi. */
  maxReps: number;
  volume: number;
  avgWeight: number;
  maxWeight: number;
  bestE1rm: number;
}

export interface ExerciseSession extends SetStats {
  workoutId: number;
  startedAt: string;
}

export interface ExerciseStats {
  exercise: Exercise;
  overall: SetStats & { sessions: number };
  sessions: ExerciseSession[];
}

/** Come va un esercizio fatto almeno una volta, per la sua riga nell'elenco. */
export interface ExerciseOverview {
  exerciseId: number;
  name: string;
  sessions: number;
  avgWeight: number;
  maxWeight: number;
  maxReps: number;
  lastAt: string;
}

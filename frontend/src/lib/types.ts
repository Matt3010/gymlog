/* What the API sends and takes, as docs/API.md writes it. */

export interface User {
  id: number;
  username: string;
}

export interface Exercise {
  id: number;
  name: string;
  muscleGroup: string | null;
  notes: string | null;
}

export interface ExerciseInput {
  name: string;
  muscleGroup: string | null;
  notes: string | null;
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

export interface PlanDay {
  id: number;
  name: string;
  position: number;
  exercises: PlanExercise[];
}

export interface Plan {
  id: number;
  name: string;
  notes: string | null;
  archived: boolean;
  days: PlanDay[];
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
  archived: boolean;
  /** Un giorno già salvato porta il suo id: il server lo cambia, e gli allenamenti restano collegati. */
  days: { id?: number; name: string; exercises: PlanExerciseInput[] }[];
}

export interface Workout {
  id: number;
  planDayId: number | null;
  /** Copiati all'inizio: restano anche se la scheda cambia o sparisce. */
  planName: string | null;
  dayName: string | null;
  startedAt: string;
  finishedAt: string | null;
  notes: string | null;
}

export interface WorkoutSummary extends Workout {
  exercises: number;
  sets: number;
  volume: number;
}

export interface WorkoutSet {
  id: number;
  exerciseId: number;
  exerciseName: string;
  reps: number;
  weightKg: number;
  createdAt: string;
}

export interface DoneSet {
  reps: number;
  weightKg: number;
}

export interface PreviousSets {
  workoutId: number;
  startedAt: string;
  sets: DoneSet[];
  /** Quello che si era scritto su quell'esercizio quella volta. */
  note: string | null;
}

export interface WorkoutDetail extends Workout {
  /** Gli esercizi del giorno della scheda; vuoto se libero, o se il giorno non c'è più. */
  plan: PlanExercise[];
  sets: WorkoutSet[];
  /** Per exerciseId: l'ultima sessione precedente con quell'esercizio. */
  previous: Record<string, PreviousSets>;
  /** La nota di ogni esercizio in questo allenamento, per id. */
  exerciseNotes: Record<string, string>;
  /** La nota dell'ultimo allenamento dello stesso giorno della scheda (o libero, se libero). */
  previousNote: { workoutId: number; startedAt: string; note: string } | null;
}

export interface SetStats {
  sets: number;
  reps: number;
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
  lastAt: string;
}

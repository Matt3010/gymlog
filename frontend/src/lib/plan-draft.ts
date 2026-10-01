import type { Plan, PlanInput } from './types';

/*
 * La scheda mentre la scrivi: una copia da cambiare liberamente, che diventa
 * quello che l'API prende solo al salvataggio. Le note sono testo (vuoto, non
 * `null`) perché stanno in un campo; le chiavi servono a Svelte per
 * riconoscere una riga quando la sposti.
 */

export interface DraftExercise {
  key: number;
  exerciseId: number;
  exerciseName: string;
  /** Una voce per serie. */
  reps: string[];
  restSeconds: number | null;
  notes: string;
}

export interface DraftDay {
  key: number;
  name: string;
  exercises: DraftExercise[];
}

export interface Draft {
  name: string;
  notes: string;
  archived: boolean;
  days: DraftDay[];
}

let lastKey = 0;
export const newKey = (): number => ++lastKey;

const LETTERS = 'ABCDEFGHIJKLMN';

export function draftOf(plan: Plan | null): Draft {
  if (plan === null) return { name: '', notes: '', archived: false, days: [{ key: newKey(), name: 'A', exercises: [] }] };
  return {
    name: plan.name,
    notes: plan.notes ?? '',
    archived: plan.archived,
    days: plan.days.map((day) => ({
      key: newKey(),
      name: day.name,
      exercises: day.exercises.map((exercise) => ({
        key: newKey(),
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        reps: [...exercise.reps],
        restSeconds: exercise.restSeconds,
        notes: exercise.notes ?? '',
      })),
    })),
  };
}

const orNull = (text: string): string | null => (text.trim() === '' ? null : text.trim());

export function toInput(draft: Draft): PlanInput {
  return {
    name: draft.name.trim(),
    notes: orNull(draft.notes),
    archived: draft.archived,
    days: draft.days.map((day) => ({
      name: day.name.trim(),
      exercises: day.exercises.map((exercise) => ({
        exerciseId: exercise.exerciseId,
        reps: exercise.reps.map((one) => one.trim()),
        restSeconds: exercise.restSeconds,
        notes: orNull(exercise.notes),
      })),
    })),
  };
}

/** Un giorno in fondo, con la prima lettera che nessun altro giorno usa. */
export function addDay(draft: Draft): void {
  const used = new Set(draft.days.map((day) => day.name.trim()));
  const name = [...LETTERS].find((letter) => !used.has(letter)) ?? '';
  draft.days.push({ key: newKey(), name, exercises: [] });
}

/** La riga scambiata con quella sopra (-1) o sotto (+1); oltre i bordi resta dov'è. */
export function move<T>(list: T[], index: number, delta: -1 | 1): T[] {
  const other = index + delta;
  if (other < 0 || other >= list.length) return list;
  const next = [...list];
  [next[index], next[other]] = [next[other]!, next[index]!];
  return next;
}

/** Quello che il server rifiuterebbe, detto prima e con le parole della scheda. */
export function problemOf(draft: Draft): string | null {
  if (draft.name.trim() === '') return 'La scheda ha bisogno di un nome.';
  for (const day of draft.days) {
    if (day.name.trim() === '') return 'Ogni giorno ha bisogno di un nome, come «A» o «Gambe».';
    for (const exercise of day.exercises) {
      const empty = exercise.reps.findIndex((one) => one.trim() === '');
      if (empty >= 0) {
        return `Nel giorno «${day.name.trim()}» la serie ${empty + 1} dell’esercizio «${exercise.exerciseName}» non ha ripetizioni. Scrivi quante, anche «max».`;
      }
      if (!(exercise.reps.length >= 1 && exercise.reps.length <= 20)) {
        return `Nel giorno «${day.name.trim()}» le serie dell’esercizio «${exercise.exerciseName}» vanno da 1 a 20.`;
      }
    }
  }
  return null;
}

/** Una serie in più, uguale all'ultima: di solito la prossima chiede quanto quella prima. Fino a 20. */
export function addSet(exercise: DraftExercise): void {
  if (exercise.reps.length >= 20) return;
  exercise.reps.push(exercise.reps.at(-1) ?? '10');
}

/** Toglie quella serie; l'ultima rimasta resta, perché un esercizio senza serie non si fa. */
export function removeSet(exercise: DraftExercise, index: number): void {
  if (exercise.reps.length <= 1) return;
  exercise.reps.splice(index, 1);
}

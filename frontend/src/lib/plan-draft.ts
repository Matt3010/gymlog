import { fusoDelBrowser, oraIn } from './fuso';
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
  /** Il giorno già salvato: si rimanda, così il server lo cambia invece di rifarlo. */
  id?: number;
  name: string;
  exercises: DraftExercise[];
}

export interface Draft {
  name: string;
  notes: string;
  /** Come le scrive un calendario; la fine vuota è nessuna, come per le note. */
  startsOn: string;
  endsOn: string;
  archived: boolean;
  days: DraftDay[];
}

let lastKey = 0;
// Stryker disable next-line UpdateOperator: going down or up, every key is new all the same
export const newKey = (): number => ++lastKey;

const LETTERS = 'ABCDEFGHIJKLMN';

/** Una scheda nuova parte oggi, dove si trova il telefono. */
export function draftOf(plan: Plan | null, today = oraIn(fusoDelBrowser()).date): Draft {
  if (plan === null) return { name: '', notes: '', startsOn: today, endsOn: '', archived: false, days: [{ key: newKey(), name: 'A', exercises: [] }] };
  return {
    name: plan.name,
    notes: plan.notes ?? '',
    startsOn: plan.startsOn,
    endsOn: plan.endsOn ?? '',
    archived: plan.archived,
    days: plan.days.map((day) => ({
      key: newKey(),
      id: day.id,
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
    startsOn: draft.startsOn,
    endsOn: orNull(draft.endsOn),
    archived: draft.archived,
    days: draft.days.map((day) => ({
      ...(day.id === undefined ? {} : { id: day.id }),
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

/**
 * La scheda salvata torna con un id per ogni giorno: quelli mandati nuovi lo
 * prendono, ciascuno dal suo posto in quello che si era mandato. Il giorno
 * aggiunto intanto resta senza, e partirà al salvataggio dopo.
 *
 * Conta com'era il giorno *nel salvataggio partito* (`input`), non com'è
 * adesso: un giorno partito senza id il server lo rifà nuovo, anche se nel
 * frattempo una risposta prima gliene aveva dato uno, e quello di prima non
 * esiste più.
 */
export function learnDayIds(sent: readonly DraftDay[], input: PlanInput, saved: Plan): void {
  // what was sent, what was saved and the days kept aside are the same days, in the same order
  sent.forEach((day, index) => {
    if (input.days[index]!.id === undefined) day.id = saved.days[index]!.id;
  });
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
  if (draft.startsOn === '') return 'La scheda ha bisogno di un giorno da cui parte.';
  // scritte allo stesso modo, come testo si confrontano come giorni
  if (draft.endsOn !== '' && draft.endsOn < draft.startsOn) return 'La scheda non può finire prima di cominciare.';
  for (const day of draft.days) {
    if (day.name.trim() === '') return 'Ogni allenamento ha bisogno di un nome, come «A» o «Gambe».';
    for (const exercise of day.exercises) {
      const empty = exercise.reps.findIndex((one) => one.trim() === '');
      if (empty >= 0) {
        return `Nell’allenamento «${day.name.trim()}» la serie ${empty + 1} dell’esercizio «${exercise.exerciseName}» non ha ripetizioni. Scrivi quante, anche «max».`;
      }
      if (!(exercise.reps.length >= 1 && exercise.reps.length <= 20)) {
        return `Nell’allenamento «${day.name.trim()}» le serie dell’esercizio «${exercise.exerciseName}» vanno da 1 a 20.`;
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

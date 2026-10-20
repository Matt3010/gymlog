import type { SetChange, SetInput, WorkoutChange } from "../../repositories";
import { type Body, bool, id, InputError, number, object, optionalNumber, optionalText } from "../common";

export function parseWorkoutStart(value: unknown): { planId: number | null } {
  const body = object(value);
  return { planId: body.planId === undefined || body.planId === null ? null : id(body, "planId") };
}

/** Only what is given changes. */
export function parseWorkoutChange(value: unknown): WorkoutChange {
  const body = object(value);
  return {
    ...("notes" in body ? { notes: optionalText(body, "notes") } : {}),
    ...("finished" in body ? { finished: bool(body, "finished") } : {}),
  };
}

function weight(body: Body): number {
  const kg = number(body, "weightKg", 0, 1000);
  // The column keeps two decimals: more would be rounded without a word.
  if (Math.round(kg * 100) / 100 !== kg) throw new InputError("Peso: al più due decimali.");
  return kg;
}

/**
 * A set as written: the reps, which only a set to failure may leave out; the
 * weight, none for a set without one; to failure or not; a short note.
 */
export function parseSetChange(value: unknown): SetChange {
  const body = object(value);
  const toFailure = body.toFailure === undefined ? false : bool(body, "toFailure");
  return {
    reps: toFailure ? optionalNumber(body, "reps", 1, 100, true) : number(body, "reps", 1, 100, true),
    weightKg: body.weightKg === undefined || body.weightKg === null ? null : weight(body),
    toFailure,
    note: optionalText(body, "note", 100),
  };
}

export function parseSet(value: unknown): SetInput {
  const body = object(value);
  const key = optionalText(body, "key", 64);
  return { exerciseId: id(body, "exerciseId"), ...parseSetChange(body), ...(key === null ? {} : { key }) };
}

/** The note on one exercise in a workout: blank takes it away. The key must be there. */
export function parseExerciseNote(value: unknown): { note: string | null } {
  const body = object(value);
  if (!("note" in body)) throw new InputError("Testo della nota: obbligatorio.");
  return { note: optionalText(body, "note") };
}

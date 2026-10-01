import type { SetInput, WorkoutChange } from "../../repositories";
import { type Body, bool, id, InputError, number, object, optionalText } from "../common";

export function parseWorkoutStart(value: unknown): { planDayId: number | null } {
  const body = object(value);
  return { planDayId: body.planDayId === undefined || body.planDayId === null ? null : id(body, "planDayId") };
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

export function parseSetChange(value: unknown): { reps: number; weightKg: number } {
  const body = object(value);
  return { reps: number(body, "reps", 1, 100, true), weightKg: weight(body) };
}

export function parseSet(value: unknown): SetInput {
  const body = object(value);
  return { exerciseId: id(body, "exerciseId"), ...parseSetChange(body) };
}

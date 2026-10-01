import type { PlanExerciseInput, PlanInput } from "../../repositories";
import { bool, id, InputError, list, number, object, optionalNumber, optionalText, text } from "../common";

const MAX_DAYS = 14;
const MAX_EXERCISES_PER_DAY = 30;

function parsePlanExercise(value: unknown): PlanExerciseInput {
  const body = object(value);
  return {
    exerciseId: id(body, "exerciseId"),
    sets: number(body, "sets", 1, 20, true),
    reps: text(body, "reps", 20),
    restSeconds: optionalNumber(body, "restSeconds", 0, 3600, true),
    notes: optionalText(body, "notes"),
  };
}

/** A whole plan: it is saved at once, days and exercises included. */
export function parsePlan(value: unknown): PlanInput {
  const body = object(value);
  const days = list(body, "days");
  if (days.length > MAX_DAYS) throw new InputError(`Giorni: al più ${MAX_DAYS}.`);
  return {
    name: text(body, "name"),
    notes: optionalText(body, "notes"),
    archived: body.archived === undefined ? false : bool(body, "archived"),
    days: days.map((dayValue) => {
      const day = object(dayValue);
      const name = text(day, "name");
      const exercises = list(day, "exercises");
      if (exercises.length > MAX_EXERCISES_PER_DAY) throw new InputError(`Esercizi: al più ${MAX_EXERCISES_PER_DAY} per giorno.`);
      return { name, exercises: exercises.map(parsePlanExercise) };
    }),
  };
}

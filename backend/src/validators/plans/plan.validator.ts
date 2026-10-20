import type { PlanExerciseInput, PlanInput } from "../../repositories";
import { type Body, id, InputError, list, object, optionalNumber, optionalText, text } from "../common";

const MAX_EXERCISES = 30;
const MAX_SETS = 20;

/** The reps of each set: one to twenty sets, each a short text ("12", "8-10", "max"). */
function setsReps(body: Body): string[] {
  const reps = body.reps;
  if (!Array.isArray(reps) || reps.length === 0 || reps.length > MAX_SETS) throw new InputError(`Serie: da 1 a ${MAX_SETS}.`);
  return reps.map((value) => text({ reps: value }, "reps", 20));
}

function parsePlanExercise(value: unknown): PlanExerciseInput {
  const body = object(value);
  return {
    exerciseId: id(body, "exerciseId"),
    reps: setsReps(body),
    restSeconds: optionalNumber(body, "restSeconds", 0, 3600, true),
    notes: optionalText(body, "notes"),
  };
}

/** A whole plan: it is saved at once, exercises included. */
export function parsePlan(value: unknown): PlanInput {
  const body = object(value);
  const exercises = list(body, "exercises");
  if (exercises.length > MAX_EXERCISES) throw new InputError(`Esercizi: al più ${MAX_EXERCISES} per scheda.`);
  return {
    name: text(body, "name"),
    notes: optionalText(body, "notes"),
    exercises: exercises.map(parsePlanExercise),
  };
}

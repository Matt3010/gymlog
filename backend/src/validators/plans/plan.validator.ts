import type { PlanExerciseInput, PlanInput } from "../../repositories";
import { type Body, bool, id, InputError, list, object, optionalNumber, optionalText, text } from "../common";

const MAX_DAYS = 14;
const MAX_EXERCISES_PER_DAY = 30;
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
      // Labelled as a day in the error: the key itself is just "id".
      const dayId = day.id === undefined ? undefined : id({ planDayId: day.id }, "planDayId");
      const name = text(day, "name");
      const exercises = list(day, "exercises");
      if (exercises.length > MAX_EXERCISES_PER_DAY) throw new InputError(`Esercizi: al più ${MAX_EXERCISES_PER_DAY} per giorno.`);
      return { ...(dayId === undefined ? {} : { id: dayId }), name, exercises: exercises.map(parsePlanExercise) };
    }),
  };
}

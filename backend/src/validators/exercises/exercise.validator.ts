import type { ExerciseInput } from "../../repositories";
import { bool, object, optionalText, text } from "../common";

export function parseExercise(value: unknown): ExerciseInput {
  const body = object(value);
  return {
    name: text(body, "name"),
    muscleGroup: optionalText(body, "muscleGroup", 100),
    notes: optionalText(body, "notes"),
    bodyweight: body.bodyweight === undefined ? false : bool(body, "bodyweight"),
  };
}

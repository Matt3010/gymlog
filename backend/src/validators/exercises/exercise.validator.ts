import type { ExerciseInput } from "../../repositories";
import { object, optionalText, text } from "../common";

export function parseExercise(value: unknown): ExerciseInput {
  const body = object(value);
  return { name: text(body, "name"), muscleGroup: optionalText(body, "muscleGroup", 100), notes: optionalText(body, "notes") };
}

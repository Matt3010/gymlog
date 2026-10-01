import { authenticated, idParam, route, type Route } from "../../http";
import type { ExercisesService } from "../../services";
import { parseExercise } from "../../validators";

export function exercisesController(exercises: ExercisesService): Route[] {
  return [
    route("GET", "/api/exercises", authenticated((_context, user) => exercises.list(user.id))),
    route("POST", "/api/exercises", authenticated(async (context, user) => exercises.create(user.id, parseExercise(await context.body())))),
    route("PATCH", "/api/exercises/(\\d+)", authenticated(async (context, user) =>
      exercises.update(user.id, idParam(context), parseExercise(await context.body())))),
    route("DELETE", "/api/exercises/(\\d+)", authenticated((context, user) => exercises.delete(user.id, idParam(context)))),
  ];
}

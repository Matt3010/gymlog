import { authenticated, idParam, intParam, route, type Route } from "../../http";
import type { WorkoutsManager } from "../../managers";
import type { WorkoutsService } from "../../services";
import { parseSet, parseSetChange, parseWorkoutChange, parseWorkoutStart } from "../../validators";

/** Workouts and the sets logged in them. What needs plans or exercises goes through the manager. */
export function workoutsController(workouts: WorkoutsService, manager: WorkoutsManager): Route[] {
  return [
    route("GET", "/api/workouts", authenticated((context, user) =>
      workouts.list(user.id, intParam(context, "limit", 20, 1, 100), intParam(context, "offset", 0, 0, 1_000_000)))),
    route("POST", "/api/workouts", authenticated(async (context, user) =>
      manager.start(user.id, parseWorkoutStart((await context.body()) ?? {}).planDayId))),
    route("GET", "/api/workouts/(\\d+)", authenticated((context, user) => manager.get(user.id, idParam(context)))),
    route("PATCH", "/api/workouts/(\\d+)", authenticated(async (context, user) =>
      manager.update(user.id, idParam(context), parseWorkoutChange(await context.body())))),
    route("DELETE", "/api/workouts/(\\d+)", authenticated((context, user) => workouts.delete(user.id, idParam(context)))),

    route("POST", "/api/workouts/(\\d+)/sets", authenticated(async (context, user) =>
      manager.addSet(user.id, idParam(context), parseSet(await context.body())))),
    route("PATCH", "/api/sets/(\\d+)", authenticated(async (context, user) =>
      workouts.updateSet(user.id, idParam(context), parseSetChange(await context.body())))),
    route("DELETE", "/api/sets/(\\d+)", authenticated((context, user) => workouts.deleteSet(user.id, idParam(context)))),
  ];
}

import { authenticated, idParam, route, type Route } from "../../http";
import type { PlansManager } from "../../managers";
import type { PlansService } from "../../services";
import { parsePlan } from "../../validators";

/** Plans are saved whole: PUT replaces days and exercises. Saving goes through the manager, which checks the exercises. */
export function plansController(plans: PlansService, manager: PlansManager): Route[] {
  return [
    route("GET", "/api/plans", authenticated((_context, user) => plans.list(user.id))),
    route("POST", "/api/plans", authenticated(async (context, user) => manager.create(user.id, parsePlan(await context.body())))),
    route("GET", "/api/plans/(\\d+)", authenticated((context, user) => plans.get(user.id, idParam(context)))),
    route("PUT", "/api/plans/(\\d+)", authenticated(async (context, user) =>
      manager.replace(user.id, idParam(context), parsePlan(await context.body())))),
    route("DELETE", "/api/plans/(\\d+)", authenticated((context, user) => plans.delete(user.id, idParam(context)))),
  ];
}

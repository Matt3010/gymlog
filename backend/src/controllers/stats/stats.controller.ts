import { authenticated, idParam, route, type Route } from "../../http";
import type { StatsManager } from "../../managers";
import type { StatsService } from "../../services";

export function statsController(stats: StatsService, manager: StatsManager): Route[] {
  return [
    route("GET", "/api/stats/overview", authenticated((_context, user) => stats.overview(user.id))),
    route("GET", "/api/stats/exercises/(\\d+)", authenticated((context, user) => manager.exercise(user.id, idParam(context)))),
  ];
}

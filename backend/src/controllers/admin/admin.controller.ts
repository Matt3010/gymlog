import { authenticated, route, type Route } from "../../http";
import type { AdminService } from "../../services";

/** For whoever runs the app: how the others use it. 403 to anyone else. */
export function adminController(admin: AdminService): Route[] {
  return [
    route("GET", "/api/admin/usage", authenticated((_context, user) => admin.usage(user.id))),
  ];
}

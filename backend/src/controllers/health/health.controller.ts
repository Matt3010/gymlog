import { sql } from "drizzle-orm";
import { route, type Route } from "../../http";
import type { Database } from "../../lib";

/** For Docker's healthcheck: alive means the database answers too. */
export function healthController(db: Database): Route[] {
  return [
    route("GET", "/api/health", async () => {
      // Stryker disable next-line StringLiteral: an empty query goes to the server and back all the same
      await db.execute(sql`select 1`);
      return { ok: true };
    }),
  ];
}

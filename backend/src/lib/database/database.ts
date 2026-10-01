import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate as runMigrations } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

/** Drizzle over a pg pool; `$client` is the pool, for closing it. */
export type Database = NodePgDatabase & { $client: pg.Pool };

/** The database or one transaction: repositories accept either. */
export type Executor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Numeric columns (the weights) come back as strings by default: kg fit a number. */
pg.types.setTypeParser(1700, (value) => Number(value));
/** bigint (int8) too: counts fit in a double. */
pg.types.setTypeParser(20, (value) => Number(value));

export function createDb(url: string): Database {
  const pool = new pg.Pool({ connectionString: url, max: 5 });
  // An idle connection dropped by Postgres (a restart) is only logged: unhandled, it would crash the API.
  pool.on("error", (error) => console.error("[gymlog] database connection lost", error));
  return drizzle(pool);
}

const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

/**
 * Applies the migrations drizzle-kit generated in migrations/ that have not
 * run yet. Safe to call at every start.
 */
export async function migrate(db: Database): Promise<void> {
  await runMigrations(db, { migrationsFolder: MIGRATIONS });
}

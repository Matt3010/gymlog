import pg from "pg";
import { afterAll, beforeAll } from "vitest";
import { createDb, type Database, migrate } from "./database";

/**
 * A Postgres of its own for one describe block: made and migrated before,
 * dropped after. Tests using it are skipped without E2E_DATABASE_URL (e.g.
 * postgres://postgres:test@127.0.0.1:55432). A random name each time, so files
 * and parallel runs on the same server never share one.
 */
export const SERVER = process.env.E2E_DATABASE_URL;

export function testDatabase(): { readonly db: Database; readonly name: string } {
  const name = `gymlog_test_${Math.random().toString(36).slice(2, 10)}`;
  const handle = { db: undefined as unknown as Database, name };

  async function onRoot(sql: string): Promise<void> {
    const root = new pg.Client({ connectionString: `${SERVER}/postgres` });
    await root.connect();
    try {
      await root.query(sql);
    } finally {
      await root.end();
    }
  }

  beforeAll(async () => {
    if (SERVER === undefined) return;
    await onRoot(`create database ${name}`);
    handle.db = createDb(`${SERVER}/${name}`);
    await migrate(handle.db);
  }, 60_000);

  afterAll(async () => {
    if (SERVER === undefined) return;
    await handle.db?.$client.end();
    await onRoot(`drop database if exists ${name} with (force)`);
  });

  return handle;
}

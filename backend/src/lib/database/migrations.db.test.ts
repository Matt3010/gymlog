import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SERVER } from "./test-database";

const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

/** One migration file, statement by statement, as drizzle runs it. */
async function apply(client: pg.Client, file: string): Promise<void> {
  for (const statement of readFileSync(path.join(MIGRATIONS, file), "utf8").split("--> statement-breakpoint")) {
    await client.query(statement);
  }
}

/**
 * A database of its own migrated up to `before` (that one left out), for the
 * data written then; dropped after. The client is connected before the tests.
 */
function databaseBefore(before: string): pg.Client {
  const name = `gymlog_test_${Math.random().toString(36).slice(2, 10)}`;
  const client = new pg.Client({ connectionString: `${SERVER}/${name}` });

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
    await client.connect();
    for (const file of readdirSync(MIGRATIONS).filter((one) => one.endsWith(".sql")).sort()) {
      if (file >= before) break;
      await apply(client, file);
    }
  }, 60_000);

  afterAll(async () => {
    if (SERVER === undefined) return;
    await client.end();
    await onRoot(`drop database if exists ${name} with (force)`);
  });

  return client;
}

/** Plans with days becoming plans that are one workout each. */
describe.skipIf(SERVER === undefined)("the migration to one workout per plan", () => {
  const client = databaseBefore("0009");

  it("makes a plan of every day, keeping its exercises and the workouts that followed it", async () => {
    await client.query(`
      insert into users (id, username, password_hash) values (1, 'anna', 'x');
      insert into exercises (id, user_id, name) values (1, 1, 'Squat'), (2, 1, 'Panca');
      insert into plans (id, user_id, name, notes, starts_on, ends_on, archived) values
        (1, 1, 'Forza', 'tre volte', '2026-09-01', null, false),
        (2, 1, 'Estate', null, '2026-06-01', '2026-08-31', true);
      select setval('plans_id_seq', 2);
      insert into plan_days (id, plan_id, name, position) values (10, 1, 'B', 1), (11, 1, 'A', 0), (20, 2, 'Unico', 0);
      insert into plan_exercises (plan_day_id, exercise_id, position, reps, rest_seconds) values
        (11, 1, 0, '{5,5,5}', 180), (11, 2, 1, '{8}', null), (10, 2, 0, '{10,10}', 90), (20, 1, 0, '{12}', null);
      insert into workouts (id, user_id, plan_day_id, plan_name, day_name) values
        (100, 1, 11, 'Forza', 'A'), (101, 1, 20, 'Estate', 'Unico'), (102, 1, null, 'Vecchia', 'C'), (103, 1, null, null, null);
    `);
    await apply(client, "0009_single_workout_plans.sql");

    const { rows: plans } = await client.query("select id, user_id, name, notes from plans order by id");
    expect(plans.map(({ id: _, ...plan }) => plan)).toEqual([
      // in the order the days had
      { user_id: 1, name: "Forza · A", notes: "tre volte" },
      { user_id: 1, name: "Forza · B", notes: "tre volte" },
      // one day alone keeps the plan's name
      { user_id: 1, name: "Estate", notes: null },
    ]);
    const [a, b, summer] = plans.map((plan) => plan.id as number);
    const { rows: exercises } = await client.query("select plan_id, exercise_id, position, reps, rest_seconds from plan_exercises order by plan_id, position");
    expect(exercises).toEqual([
      { plan_id: a, exercise_id: 1, position: 0, reps: ["5", "5", "5"], rest_seconds: 180 },
      { plan_id: a, exercise_id: 2, position: 1, reps: ["8"], rest_seconds: null },
      { plan_id: b, exercise_id: 2, position: 0, reps: ["10", "10"], rest_seconds: 90 },
      { plan_id: summer, exercise_id: 1, position: 0, reps: ["12"], rest_seconds: null },
    ]);
    const { rows: workouts } = await client.query("select id, plan_id, plan_name from workouts order by id");
    expect(workouts).toEqual([
      { id: 100, plan_id: a, plan_name: "Forza · A" },
      { id: 101, plan_id: summer, plan_name: "Estate" },
      // a day gone long ago keeps both its names, in one
      { id: 102, plan_id: null, plan_name: "Vecchia · C" },
      { id: 103, plan_id: null, plan_name: null },
    ]);

    // the links hold: a plan deleted takes its exercises, and lets its workouts go
    await client.query("delete from plans where id = $1", [a]);
    expect((await client.query("select count(*)::int as n from plan_exercises where plan_id = $1", [a])).rows[0].n).toBe(0);
    expect((await client.query("select plan_id, plan_name from workouts where id = 100")).rows[0]).toEqual({ plan_id: null, plan_name: "Forza · A" });
  });
});

/** Sets without weight, to failure, with a note of their own. */
describe.skipIf(SERVER === undefined)("the migration to the details of a set", () => {
  const client = databaseBefore("0010");

  it("says no weight with none instead of 0 kg, and marks as bodyweight what was only ever done that way", async () => {
    await client.query(`
      insert into users (id, username, password_hash) values (1, 'anna', 'x');
      insert into exercises (id, user_id, name) values (1, 1, 'Trazioni'), (2, 1, 'Panca'), (3, 1, 'Dip'), (4, 1, 'Mai fatto');
      insert into workouts (id, user_id) values (1, 1);
      insert into workout_sets (workout_id, exercise_id, reps, weight_kg) values
        (1, 1, 5, 0), (1, 1, 4, 0), (1, 2, 8, 60), (1, 3, 10, 0), (1, 3, 6, 10);
    `);
    await apply(client, "0010_set_details.sql");

    const { rows: sets } = await client.query("select exercise_id, reps, weight_kg, to_failure, note from workout_sets order by id");
    expect(sets).toEqual([
      { exercise_id: 1, reps: 5, weight_kg: null, to_failure: false, note: null },
      { exercise_id: 1, reps: 4, weight_kg: null, to_failure: false, note: null },
      { exercise_id: 2, reps: 8, weight_kg: 60, to_failure: false, note: null },
      { exercise_id: 3, reps: 10, weight_kg: null, to_failure: false, note: null },
      { exercise_id: 3, reps: 6, weight_kg: 10, to_failure: false, note: null },
    ]);
    // dips were done with a weight once: not bodyweight only; one never done stays as it was
    const { rows: exercises } = await client.query("select name, bodyweight from exercises order by id");
    expect(exercises).toEqual([
      { name: "Trazioni", bodyweight: true }, { name: "Panca", bodyweight: false }, { name: "Dip", bodyweight: false }, { name: "Mai fatto", bodyweight: false },
    ]);
    // reps may be missing only to failure
    await expect(client.query("insert into workout_sets (workout_id, exercise_id, reps, weight_kg) values (1, 2, null, 10)")).rejects.toThrow(/workout_sets_reps_or_failure/);
    await client.query("insert into workout_sets (workout_id, exercise_id, reps, weight_kg, to_failure) values (1, 2, null, 10, true)");
  });
});

import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';

/*
 * The README's screens: a few weeks of training written through the API,
 * dated back in the database, and the app photographed on a phone, by day
 * and by night. Only with SCREENS=1:
 *
 *   SCREENS=1 E2E_DATABASE_URL=postgres://postgres:test@127.0.0.1:55432 pnpm --filter frontend test:e2e screens
 */
test.skip(!process.env.E2E_DATABASE_URL || !process.env.SCREENS, 'only with SCREENS=1, to redo the README screens');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../../docs/screens');
const base = () => process.env.E2E_BASE_URL!;

type Pg = { connect(): Promise<void>; query(sql: string, values?: unknown[]): Promise<unknown>; end(): Promise<void> };

/** A query on the app's database: the API dates a workout now, the screens want weeks of them. */
async function sql(text: string, values: unknown[] = []): Promise<void> {
  const pg = createRequire(path.resolve(HERE, '../../backend/package.json'))('pg') as { Client: new (options: { connectionString: string }) => Pg };
  const client = new pg.Client({ connectionString: process.env.E2E_APP_DATABASE_URL! });
  await client.connect();
  try {
    await client.query(text, values);
  } finally {
    await client.end();
  }
}

async function call<T>(page: Page, method: string, route: string, data?: unknown): Promise<T> {
  const response = await page.request.fetch(`${base()}/api${route}`, { method, data, headers: { 'x-gymlog': '1' } });
  expect(response.ok(), `${method} ${route}: ${await response.text()}`).toBe(true);
  return (await response.json()) as T;
}

async function shoot(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}

test('the README screens', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(base());
  await page.getByLabel('Utente').fill(process.env.E2E_USER!);
  await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_PASSWORD!);
  await page.getByRole('button', { name: 'Entra' }).click();
  await expect(page.getByRole('heading', { name: 'Allenati' })).toBeVisible();

  const made: Record<string, number> = {};
  for (const [name, muscleGroup] of [
    ['Panca piana', 'Petto'], ['Rematore bilanciere', 'Dorso'], ['Military press', 'Spalle'],
    ['Squat', 'Gambe'], ['Stacco da terra', 'Dorso'], ['Trazioni', 'Dorso'],
  ]) made[name!] = (await call<{ id: number }>(page, 'POST', '/exercises', { name, muscleGroup, notes: null, bodyweight: name === 'Trazioni' })).id;

  const rows = (list: [string, string[], number][]) => list.map(([name, reps, restSeconds]) => ({ exerciseId: made[name], reps, restSeconds, notes: null }));
  const upper = await call<{ id: number }>(page, 'POST', '/plans', {
    name: 'Parte alta', notes: 'Alternata con la parte bassa, tre volte a settimana.',
    exercises: rows([['Panca piana', ['8', '6', '6', '5'], 150], ['Rematore bilanciere', ['10', '10', '8'], 120], ['Military press', ['8', '8', '8'], 90]]),
  });
  const lower = await call<{ id: number }>(page, 'POST', '/plans', {
    name: 'Parte bassa', notes: null,
    exercises: rows([['Squat', ['5', '5', '5', '5'], 180], ['Stacco da terra', ['5', '5', '3'], 180], ['Trazioni', ['max', 'max', 'max'], 120]]),
  });

  // Six sessions in three weeks, the two plans in turn, the weights going up.
  const sessions: [number, number, [string, number, (number | null)[]][]][] = [
    [20, upper.id, [['Panca piana', 8, [70, 75, 75, 77.5]], ['Rematore bilanciere', 10, [60, 60, 62.5]], ['Military press', 8, [40, 40, 42.5]]]],
    [18, lower.id, [['Squat', 5, [90, 95, 95, 95]], ['Stacco da terra', 5, [110, 115, 120]], ['Trazioni', 8, [null, null, null]]]],
    [13, upper.id, [['Panca piana', 8, [72.5, 77.5, 77.5, 80]], ['Rematore bilanciere', 10, [62.5, 62.5, 65]], ['Military press', 8, [42.5, 42.5, 42.5]]]],
    [11, lower.id, [['Squat', 5, [95, 100, 100, 100]], ['Stacco da terra', 5, [115, 120, 125]], ['Trazioni', 9, [null, null, null]]]],
    [6, upper.id, [['Panca piana', 7, [75, 80, 80, 82.5]], ['Rematore bilanciere', 10, [62.5, 65, 65]], ['Military press', 8, [42.5, 45, 45]]]],
    [4, lower.id, [['Squat', 5, [100, 102.5, 105, 105]], ['Stacco da terra', 5, [120, 125, 130]], ['Trazioni', 10, [null, null, null]]]],
  ];
  for (const [daysAgo, planId, done] of sessions) {
    const workout = await call<{ id: number }>(page, 'POST', '/workouts', { planId });
    for (const [name, reps, weights] of done) {
      for (const weightKg of weights) await call(page, 'POST', `/workouts/${workout.id}/sets`, { exerciseId: made[name], reps, weightKg });
    }
    await call(page, 'PATCH', `/workouts/${workout.id}`, { finished: true });
    const started = `now() - interval '${daysAgo} days' - interval '2 hours'`;
    await sql(`update workouts set started_at = ${started}, finished_at = ${started} + interval '68 minutes' where id = $1`, [workout.id]);
    await sql(`update workout_sets set created_at = ${started} + interval '30 minutes' where workout_id = $1`, [workout.id]);
  }

  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const suffix = scheme === 'dark' ? '-dark' : '';
    await page.goto(`${base()}/`);
    await expect(page.getByRole('button', { name: /^Parte alta / })).toBeVisible();
    await shoot(page, `home${suffix}`);
    await page.goto(`${base()}/exercises`);
    await expect(page.getByText('Panca piana').first()).toBeVisible();
    await shoot(page, `exercises${suffix}`);
    await page.goto(`${base()}/exercises/${made['Panca piana']}`);
    await expect(page.locator('svg').first()).toBeVisible();
    await shoot(page, `exercise-stats${suffix}`);
    await page.goto(`${base()}/plans`);
    await expect(page.getByRole('link', { name: /^Parte alta/ })).toBeVisible();
    await shoot(page, `plans${suffix}`);
    await page.getByRole('link', { name: /^Parte alta/ }).click();
    await expect(page.getByLabel('Recupero (s)').first()).toBeVisible();
    await shoot(page, `plan${suffix}`);
    await page.goto(`${base()}/history`);
    await expect(page.getByRole('link').filter({ hasText: 'Parte alta' }).first()).toBeVisible();
    await shoot(page, `history${suffix}`);
  }

  // What whoever runs the app sees of everyone.
  await sql(`update users set is_admin = true where username = $1`, [process.env.E2E_USER]);
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(`${base()}/admin`);
    await expect(page.getByRole('region', { name: 'Utenti' })).toBeVisible();
    await shoot(page, `admin${scheme === 'dark' ? '-dark' : ''}`);
  }

  // Who you are, from any page: the menu, then the profile.
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const suffix = scheme === 'dark' ? '-dark' : '';
    await page.goto(`${base()}/plans`);
    await page.getByRole('button', { name: /^Account di / }).click();
    await expect(page.getByRole('button', { name: 'Profilo' })).toBeVisible();
    await shoot(page, `account-menu${suffix}`);
    await page.getByRole('button', { name: 'Profilo' }).click();
    await expect(page.getByRole('heading', { name: 'Profilo' })).toBeVisible();
    await shoot(page, `profile${suffix}`);
  }

  // Today's session, halfway through the bench press, with the rest running.
  const today = await call<{ id: number }>(page, 'POST', '/workouts', { planId: upper.id });
  for (const weightKg of [77.5, 82.5]) await call(page, 'POST', `/workouts/${today.id}/sets`, { exerciseId: made['Panca piana'], reps: 6, weightKg });
  // the second one stripped down, to failure, with a note of its own
  await call(page, 'POST', `/workouts/${today.id}/sets`, { exerciseId: made['Panca piana'], reps: null, weightKg: 75, toFailure: true, note: 'fermo al petto', continues: true });
  await sql(`update workouts set started_at = now() - interval '18 minutes' where id = $1`, [today.id]);
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(`${base()}/workouts/${today.id}`);
    await page.evaluate(() => localStorage.setItem('gymlog.rest', JSON.stringify({ endsAt: Date.now() + 104_000, total: 150 })));
    await page.reload();
    await expect(page.getByRole('timer', { name: 'Recupero' })).toBeVisible();
    await shoot(page, `workout${scheme === 'dark' ? '-dark' : ''}`);
  }
});

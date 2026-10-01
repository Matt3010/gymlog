import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * A database of its own, the API on it, and the app built for production and
 * served by `vite preview` in front (its proxy passes /api on), each on a
 * free port; a user made with the CLI, as on the Pi. The real build, so the
 * service worker is the one the Pi serves. What the spec needs comes
 * through the environment (E2E_BASE_URL, E2E_USER, E2E_PASSWORD). Everything
 * goes when the run ends, the database too.
 */

const FRONTEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BACKEND = path.resolve(FRONTEND, '../backend');
const TSX = path.join(BACKEND, 'node_modules/tsx/dist/cli.mjs');
const VITE = path.join(FRONTEND, 'node_modules/vite/bin/vite.js');

export const E2E_USER = 'prova';
export const E2E_PASSWORD = 'password lunga ok';

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

async function waitFor(url: string, what: string, child: ChildProcess, log: () => string): Promise<void> {
  const until = Date.now() + 60_000;
  while (Date.now() < until) {
    if (child.exitCode !== null) throw new Error(`${what} stopped (exit ${child.exitCode}):\n${log()}`);
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${what} did not answer at ${url} within a minute:\n${log()}`);
}

function start(what: string, args: string[], cwd: string, env: NodeJS.ProcessEnv) {
  const child = spawn(process.execPath, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout?.on('data', (chunk) => (output += chunk));
  child.stderr?.on('data', (chunk) => (output += chunk));
  return { child, log: () => output.slice(-4000), what };
}

function stop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    child.once('exit', () => resolve());
    child.kill();
  });
}

export default async function globalSetup(): Promise<(() => Promise<void>) | undefined> {
  const server = process.env.E2E_DATABASE_URL;
  if (!server) return undefined;

  // pg is the backend's: the frontend has no business with Postgres.
  const pg = createRequire(path.join(BACKEND, 'package.json'))('pg') as {
    Client: new (options: { connectionString: string }) => { connect(): Promise<void>; query(sql: string): Promise<unknown>; end(): Promise<void> };
  };
  const name = `gymlog_e2e_${Math.random().toString(36).slice(2, 10)}`;
  const onRoot = async (sql: string) => {
    const root = new pg.Client({ connectionString: `${server}/postgres` });
    await root.connect();
    try {
      await root.query(sql);
    } finally {
      await root.end();
    }
  };
  await onRoot(`create database ${name}`);
  const databaseUrl = `${server}/${name}`;

  const [apiPort, webPort] = [await freePort(), await freePort()];
  const apiEnv = { DATABASE_URL: databaseUrl, API_PORT: String(apiPort), API_HOST: '127.0.0.1', INSECURE_COOKIE: '1', JWT_SECRET: 'ab'.repeat(32) };
  const api = start('the API', [TSX, 'src/main.ts'], BACKEND, apiEnv);
  const built = spawnSync(process.execPath, [VITE, 'build'], { cwd: FRONTEND, encoding: 'utf8' });
  if (built.status !== 0) throw new Error(`the build failed:
${built.stdout}${built.stderr}`);
  const web = start('vite preview', [VITE, 'preview', '--port', String(webPort), '--strictPort', '--host', '127.0.0.1'], FRONTEND, {
    GYMLOG_API: `http://127.0.0.1:${apiPort}`,
  });

  const teardown = async () => {
    await Promise.all([stop(api.child), stop(web.child)]);
    await onRoot(`drop database if exists ${name} with (force)`);
  };

  try {
    // The API migrates the database before listening: once it answers, the CLI finds the tables.
    await waitFor(`http://127.0.0.1:${apiPort}/api/health`, api.what, api.child, api.log);
    const created = spawnSync(process.execPath, [TSX, 'src/cli/users.ts', 'create', E2E_USER], {
      cwd: BACKEND, env: { ...process.env, DATABASE_URL: databaseUrl, GYMLOG_PASSWORD: E2E_PASSWORD }, encoding: 'utf8',
    });
    if (created.status !== 0) throw new Error(`the user was not created:\n${created.stdout}${created.stderr}`);
    await waitFor(`http://127.0.0.1:${webPort}/`, web.what, web.child, web.log);
  } catch (error) {
    await teardown();
    throw error;
  }

  process.env.E2E_BASE_URL = `http://127.0.0.1:${webPort}`;
  process.env.E2E_USER = E2E_USER;
  process.env.E2E_PASSWORD = E2E_PASSWORD;
  return teardown;
}

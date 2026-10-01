import { createApiServer } from "./bootstrap";
import { appConfigFromEnv } from "./config";
import { createDb, migrate } from "./lib";

/** Entry point: migrates the database, then serves the API until Docker stops it. */
async function main(): Promise<void> {
  // .env is optional, and never overrides what the environment already set
  // (docker compose passes the same file through env_file).
  try {
    process.loadEnvFile();
  } catch {
    // No .env: defaults and the real environment are enough.
  }

  const config = appConfigFromEnv(process.env);
  const db = createDb(config.databaseUrl);
  await migrate(db);
  if (config.jwtSecretGenerated) console.warn("[gymlog] JWT_SECRET not set: everyone signs in again after each restart.");

  const server = createApiServer({ db, jwtSecret: config.jwtSecret, secureCookie: config.secureCookie });
  server.listen(config.port, config.host, () => console.log(`[gymlog] API on http://${config.host}:${config.port}`));

  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    server.close(() => void db.$client.end());
    // Open keep-alive connections would hold the close back.
    server.closeIdleConnections();
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}

main().catch((error: unknown) => {
  console.error("[gymlog] failed to start", error);
  process.exitCode = 1;
});

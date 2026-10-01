import { jwtSecret } from "../services";

export interface AppConfig {
  readonly databaseUrl: string;
  readonly port: number;
  /** Where the API listens: loopback on a laptop, 0.0.0.0 inside compose (nginx reaches it there). */
  readonly host: string;
  readonly jwtSecret: Uint8Array;
  /** No JWT_SECRET: a random one, so everyone signs in again after a restart. */
  readonly jwtSecretGenerated: boolean;
  /** False only over plain http on a laptop. */
  readonly secureCookie: boolean;
}

/** The settings from the environment (docker compose passes .env). An empty value means "not set". */
export function appConfigFromEnv(env: Record<string, string | undefined>): AppConfig {
  const value = (key: string) => (env[key] === "" ? undefined : env[key]);

  const databaseUrl = value("DATABASE_URL");
  if (databaseUrl === undefined) throw new Error("DATABASE_URL is required, e.g. postgres://gymlog:<password>@localhost:5432/gymlog");

  const port = Number(value("API_PORT") ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("API_PORT must be a port number");

  const secret = jwtSecret(value("JWT_SECRET"));
  return {
    databaseUrl,
    port,
    host: value("API_HOST") ?? "127.0.0.1",
    jwtSecret: secret.secret,
    jwtSecretGenerated: secret.generated,
    secureCookie: value("INSECURE_COOKIE") !== "1",
  };
}

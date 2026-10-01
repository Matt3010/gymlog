import { describe, expect, it } from "vitest";
import { appConfigFromEnv } from "./app-config";

const DB = "postgres://gymlog:pw@postgres:5432/gymlog";

describe("the configuration", () => {
  it("needs the database", () => {
    expect(() => appConfigFromEnv({})).toThrow("DATABASE_URL is required");
    expect(() => appConfigFromEnv({ DATABASE_URL: "" })).toThrow("DATABASE_URL is required");
  });

  it("listens on loopback, port 3000, with secure cookies, by default", () => {
    expect(appConfigFromEnv({ DATABASE_URL: DB })).toMatchObject({ databaseUrl: DB, port: 3000, host: "127.0.0.1", secureCookie: true, jwtSecretGenerated: true });
  });

  it("takes the port, the host and plain-http cookies", () => {
    expect(appConfigFromEnv({ DATABASE_URL: DB, API_PORT: "4000", API_HOST: "0.0.0.0", INSECURE_COOKIE: "1" }))
      .toMatchObject({ port: 4000, host: "0.0.0.0", secureCookie: false });
  });

  it("refuses a port that is not one", () => {
    expect(() => appConfigFromEnv({ DATABASE_URL: DB, API_PORT: "x" })).toThrow("API_PORT must be a port number");
    expect(() => appConfigFromEnv({ DATABASE_URL: DB, API_PORT: "70000" })).toThrow("API_PORT must be a port number");
    expect(() => appConfigFromEnv({ DATABASE_URL: DB, API_PORT: "0" })).toThrow("API_PORT must be a port number");
    expect(() => appConfigFromEnv({ DATABASE_URL: DB, API_PORT: "65536" })).toThrow("API_PORT must be a port number");
    expect(appConfigFromEnv({ DATABASE_URL: DB, API_PORT: "1" }).port).toBe(1);
    expect(appConfigFromEnv({ DATABASE_URL: DB, API_PORT: "65535" }).port).toBe(65_535);
  });

  it("reads the JWT secret, an empty one meaning not set", () => {
    expect(appConfigFromEnv({ DATABASE_URL: DB, JWT_SECRET: "ab".repeat(32) })).toMatchObject({ jwtSecret: new Uint8Array(32).fill(0xab), jwtSecretGenerated: false });
    expect(appConfigFromEnv({ DATABASE_URL: DB, JWT_SECRET: "" }).jwtSecretGenerated).toBe(true);
  });
});

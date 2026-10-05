import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors";
import { InputError } from "../validators";
import { HttpError } from "./http.errors";
import { cookieHeader, idParam, readCookie } from "./request";
import { authenticated, route, type Route } from "./router";
import { createHttpServer, sameSite } from "./server";

const USER = { id: 1, username: "anna" };
const servers: ReturnType<typeof createHttpServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))));
});

/** A server with these routes; "good" is the only access token it takes. */
async function serve(routes: Route[]) {
  const logged: { line: string; error: unknown }[] = [];
  const verified: string[] = [];
  const server = createHttpServer({
    routes,
    verifyAccess: async (token) => {
      verified.push(token);
      return token === "good" ? USER : undefined;
    },
    logError: (line, error) => logged.push({ line, error }),
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  async function call(method: string, path: string, headers: Record<string, string> = {}, body?: string) {
    const response = await fetch(`${base}${path}`, { method, headers, ...(body === undefined ? {} : { body }) });
    const text = await response.text();
    return { status: response.status, headers: response.headers, body: text === "" ? undefined : JSON.parse(text) };
  }
  return { call, logged, verified, base };
}

const failing = (error: unknown, method: Route["method"] = "POST") => [route(method, "/api/x", async () => { throw error; })];

describe("the answer", () => {
  it("is JSON, never cached, never sniffed", async () => {
    const { call } = await serve([route("GET", "/api/x", async () => ({ a: 1 }))]);
    const result = await call("GET", "/api/x");
    expect(result.body).toEqual({ a: 1 });
    expect(result.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(result.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("is { ok: true } when the handler returns nothing", async () => {
    const { call } = await serve([route("GET", "/api/x", async () => undefined)]);
    expect((await call("GET", "/api/x")).body).toEqual({ ok: true });
  });

  it("to HEAD is the GET route's, and needs no header", async () => {
    const { call } = await serve([route("GET", "/api/x", async () => ({ a: 1 }))]);
    expect(await call("HEAD", "/api/x")).toMatchObject({ status: 200, body: undefined });
  });
});

describe("errors", () => {
  const change = { "x-gymlog": "1" };

  it("of HTTP keep their status and message", async () => {
    const { call } = await serve(failing(new HttpError(418, "Teiera.")));
    expect(await call("POST", "/api/x", change)).toMatchObject({ status: 418, body: { error: "Teiera." } });
  });

  it("of something that exists already are 409", async () => {
    const { call } = await serve(failing(new ConflictError("Esiste già un esercizio con questo nome.")));
    expect(await call("POST", "/api/x", change)).toMatchObject({ status: 409, body: { error: "Esiste già un esercizio con questo nome." } });
  });

  it("of something not for this user are 403", async () => {
    const { call } = await serve(failing(new ForbiddenError("Solo per chi amministra l’app.")));
    expect(await call("POST", "/api/x", change)).toMatchObject({ status: 403, body: { error: "Solo per chi amministra l’app." } });
  });

  it("of input are 400, of something missing 404", async () => {
    expect(await (await serve(failing(new InputError("Nome mancante.")))).call("POST", "/api/x", change)).toMatchObject({ status: 400, body: { error: "Nome mancante." } });
    expect(await (await serve(failing(new NotFoundError()))).call("POST", "/api/x", change)).toMatchObject({ status: 404, body: { error: "Non trovato." } });
  });

  it("of a name taken are 409, wherever Drizzle put the code", async () => {
    const message = { status: 409, body: { error: "Esiste già, con lo stesso nome." } };
    expect(await (await serve(failing({ code: "23505" }))).call("POST", "/api/x", change)).toMatchObject(message);
    expect(await (await serve(failing(new Error("q", { cause: { code: "23505" } })))).call("POST", "/api/x", change)).toMatchObject(message);
  });

  it("of something still in use are 409 on a delete", async () => {
    const { call } = await serve(failing(new Error("q", { cause: { code: "23503" } }), "DELETE"));
    expect(await call("DELETE", "/api/x", change)).toMatchObject({ status: 409, body: { error: "Non si può eliminare: è usato in una scheda o in un allenamento." } });
  });

  it.each([
    ["anything else", new Error("boom")],
    ["a code that is no text", { code: 23505 }],
    ["a cause with no code", new Error("q", { cause: {} })],
    ["something in use, outside a delete", new Error("q", { cause: { code: "23503" } })],
  ])("are 500 for %s, and logged", async (_name, error) => {
    const { call, logged } = await serve(failing(error));
    expect(await call("POST", "/api/x", change)).toMatchObject({ status: 500, body: { error: "Qualcosa non ha funzionato. Riprova tra poco." } });
    expect(logged).toEqual([{ line: "[gymlog] POST /api/x failed", error }]);
  });

  it("are 500 for a delete that fails for another reason", async () => {
    const error = new Error("boom");
    const { call, logged } = await serve(failing(error, "DELETE"));
    expect(await call("DELETE", "/api/x", change)).toMatchObject({ status: 500 });
    expect(logged).toEqual([{ line: "[gymlog] DELETE /api/x failed", error }]);
  });

  it("are 401 without a token, and the token is not checked then", async () => {
    const { call, verified } = await serve([route("GET", "/api/x", authenticated(async (_context, user) => user))]);
    expect(await call("GET", "/api/x")).toMatchObject({ status: 401, body: { error: "Accesso richiesto." } });
    expect(verified).toEqual([]);
    expect(await call("GET", "/api/x", { cookie: "gymlog_at=bad" })).toMatchObject({ status: 401 });
    expect(await call("GET", "/api/x", { cookie: "other=1; gymlog_at=good" })).toMatchObject({ status: 200, body: USER });
  });
});

describe("a change", () => {
  const ok = [route("POST", "/api/x", async () => ({ done: true }))];

  it("is judged by the forwarded host when nginx sends one", async () => {
    const { call } = await serve(ok);
    const headers = { "x-gymlog": "1", origin: "https://gym.example", "x-forwarded-host": "gym.example" };
    expect((await call("POST", "/api/x", headers)).status).toBe(200);
    expect((await call("POST", "/api/x", { ...headers, "x-forwarded-host": "evil.example" })).status).toBe(403);
  });
});

describe("the same site", () => {
  it.each([
    ["https://gym.example", "gym.example", true],
    ["http://127.0.0.1:8091", "127.0.0.1:8091", true],
    ["https://gym.example", "gym.example:443", true],
    ["https://gym.example:8443", "gym.example", true],
    ["https://evil.example", "gym.example", false],
    ["http://127.0.0.1:8091", "127.0.0.1:9999", false],
    ["https://evil.example:8443", "gym.example", false],
    ["not a url", "gym.example", false],
    ["https://gym.example", "bad host/x:y", false],
    ["http://[::1]:8080", "[::1]", true],
  ])("%s for host %s is %s", (origin, host, expected) => {
    expect(sameSite(origin, host)).toBe(expected);
  });
});

describe("an id in the path", () => {
  const id = (raw: string) => idParam({ params: [raw] } as never);

  it("is a number from 1 to the largest Postgres integer", () => {
    expect(id("1")).toBe(1);
    expect(id("2147483647")).toBe(2_147_483_647);
  });

  it.each(["0", "2147483648", "99999999999999999999"])("is not found when %s", (raw) => {
    expect(() => id(raw)).toThrow(new HttpError(404, "Non trovato."));
  });
});

describe("cookies", () => {
  it("are http-only, strict, and secure unless told", () => {
    expect(cookieHeader("a", "/api", "v", 60, true)).toBe("a=v; Path=/api; HttpOnly; SameSite=Strict; Max-Age=60; Secure");
    expect(cookieHeader("a", "/api", "v", 60, false)).toBe("a=v; Path=/api; HttpOnly; SameSite=Strict; Max-Age=60");
  });

  it("are read by name, whole", () => {
    const request = { headers: { cookie: "x=1; gymlog_at=a=b=c ; y=2" } } as never;
    expect(readCookie(request, "gymlog_at")).toBe("a=b=c");
    expect(readCookie(request, "none")).toBeUndefined();
    expect(readCookie({ headers: {} } as never, "x")).toBeUndefined();
  });
});

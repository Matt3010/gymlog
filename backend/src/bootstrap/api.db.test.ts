import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../lib";
import { SERVER, testDatabase } from "../lib/database/test-database";
import { createLoginLimiter, createTokenManager } from "../services";
import { createAuthService } from "../services";
import { createApiServer } from "./api.bootstrap";

const SECRET = new Uint8Array(32).fill(7);
const PASSWORD = "correct horse battery";

/** A browser of one: keeps the cookies it is given, sends the page's header on changes. */
function client(base: () => string) {
  const jar = new Map<string, { value: string; path: string }>();
  async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = { "x-gymlog": "1" }) {
    const cookie = [...jar].filter(([, c]) => path.startsWith(c.path)).map(([name, c]) => `${name}=${c.value}`).join("; ");
    const response = await fetch(`${base()}${path}`, {
      method,
      headers: { ...(method === "GET" ? {} : headers), ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { "content-type": "application/json" }) },
      ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
    });
    for (const line of response.headers.getSetCookie()) {
      const [pair, ...attributes] = line.split("; ");
      const [name, value] = pair!.split("=") as [string, string];
      const path = attributes.find((a) => a.startsWith("Path="))!.slice(5);
      if (attributes.includes("Max-Age=0")) jar.delete(name);
      else jar.set(name, { value, path });
    }
    const text = await response.text();
    return { status: response.status, body: text === "" ? undefined : JSON.parse(text), headers: response.headers, setCookies: response.headers.getSetCookie() };
  }
  return { call, jar };
}

describe.skipIf(SERVER === undefined)("the API", () => {
  const handle = testDatabase();
  let base = "";
  let server: ReturnType<typeof createApiServer>;
  const errors: unknown[] = [];
  const lines: string[] = [];

  beforeAll(async () => {
    server = createApiServer({
      db: handle.db, jwtSecret: SECRET, secureCookie: true, limiter: createLoginLimiter(3), addressLimiter: createLoginLimiter(6),
      logError: (_line, error) => errors.push(error),
      log: (line) => lines.push(line),
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  async function signedIn() {
    const username = `u${Math.random().toString(36).slice(2)}`;
    await createAuthService(handle.db, createTokenManager(SECRET)).createUser(username, PASSWORD);
    const browser = client(() => base);
    const login = await browser.call("POST", "/api/auth/login", { username, password: PASSWORD });
    expect(login.status).toBe(200);
    return { ...browser, username, user: login.body.user as { id: number; username: string } };
  }

  describe("health", () => {
    it("answers without login", async () => {
      expect(await client(() => base).call("GET", "/api/health")).toMatchObject({ status: 200, body: { ok: true } });
    });

    it("fails when the database does not answer", async () => {
      const db = createDb("postgres://nobody:x@127.0.0.1:1/none");
      const logged: unknown[] = [];
      const down = createApiServer({ db, jwtSecret: SECRET, secureCookie: true, logError: (_line, error) => logged.push(error) });
      await new Promise<void>((resolve) => down.listen(0, "127.0.0.1", resolve));
      try {
        const response = await fetch(`http://127.0.0.1:${(down.address() as AddressInfo).port}/api/health`);
        expect(response.status).toBe(500);
        expect(logged).toHaveLength(1);
      } finally {
        await new Promise((resolve) => down.close(resolve));
        await db.$client.end();
      }
    });
  });

  describe("logging in", () => {
    it("sets the access and refresh cookies, secure and http-only", async () => {
      const { setCookies, user, username } = await (async () => {
        const username = `u${Math.random().toString(36).slice(2)}`;
        await createAuthService(handle.db, createTokenManager(SECRET)).createUser(username, PASSWORD);
        const result = await client(() => base).call("POST", "/api/auth/login", { username, password: PASSWORD });
        return { setCookies: result.setCookies, user: result.body.user, username };
      })();
      expect(user).toEqual({ id: expect.any(Number), username });
      expect(setCookies).toEqual([
        expect.stringMatching(/^gymlog_at=[\w-]+\.[\w-]+\.[\w-]+; Path=\/api; HttpOnly; SameSite=Strict; Max-Age=900; Secure$/),
        expect.stringMatching(/^gymlog_rt=[\w-]{43}; Path=\/api\/auth; HttpOnly; SameSite=Strict; Max-Age=2592000; Secure$/),
      ]);
    });

    it("says who is signed in", async () => {
      const { call, user } = await signedIn();
      expect(await call("GET", "/api/auth/me")).toMatchObject({ status: 200, body: { user } });
    });

    it("refuses a wrong password", async () => {
      const { username } = await signedIn();
      const result = await client(() => base).call("POST", "/api/auth/login", { username, password: "wrong password" });
      expect(result).toMatchObject({ status: 401, body: { error: "Utente o password errati." } });
      expect(result.setCookies).toEqual([]);
      expect(lines).toContain(`[gymlog] failed login for "${username}" from 127.0.0.1`);
    });

    it("logs at most fifty characters of a wrong username", async () => {
      const long = "x".repeat(80);
      await client(() => base).call("POST", "/api/auth/login", { username: long, password: "wrong password" });
      expect(lines).toContain(`[gymlog] failed login for "${"x".repeat(50)}" from 127.0.0.1`);
    });

    it("stops an address after too many failures, even with the right password", async () => {
      const { username } = await signedIn();
      const browser = client(() => base);
      const headers = { "x-gymlog": "1", "x-real-ip": "203.0.113.9" };
      for (let i = 0; i < 3; i++) await browser.call("POST", "/api/auth/login", { username, password: "wrong password" }, headers);
      expect(await browser.call("POST", "/api/auth/login", { username, password: PASSWORD }, headers))
        .toMatchObject({ status: 429, body: { error: "Troppi tentativi. Riprova tra un quarto d'ora." } });
      // Another address is not stopped.
      expect((await browser.call("POST", "/api/auth/login", { username, password: PASSWORD }, { "x-gymlog": "1", "x-real-ip": "203.0.113.10" })).status).toBe(200);
    });

    it("forgets the failures of a name once it gets in", async () => {
      const { username } = await signedIn();
      const browser = client(() => base);
      const headers = { "x-gymlog": "1", "x-real-ip": "203.0.113.40" };
      for (let i = 0; i < 2; i++) await browser.call("POST", "/api/auth/login", { username, password: "wrong password" }, headers);
      expect((await browser.call("POST", "/api/auth/login", { username, password: PASSWORD }, headers)).status).toBe(200);
      for (let i = 0; i < 2; i++) await browser.call("POST", "/api/auth/login", { username, password: "wrong password" }, headers);
      expect((await browser.call("POST", "/api/auth/login", { username, password: PASSWORD }, headers)).status).toBe(200);
    });

    it("cannot be reset with an account of one's own: a success clears only that name's count", async () => {
      const victim = await signedIn();
      const attacker = await signedIn();
      const browser = client(() => base);
      const headers = { "x-gymlog": "1", "x-real-ip": "203.0.113.20" };
      for (let round = 0; round < 2; round++) {
        for (let i = 0; i < 2; i++) await browser.call("POST", "/api/auth/login", { username: victim.username, password: "wrong password" }, headers);
        expect((await browser.call("POST", "/api/auth/login", { username: attacker.username, password: PASSWORD }, headers)).status).toBe(200);
      }
      expect(await browser.call("POST", "/api/auth/login", { username: victim.username, password: PASSWORD }, headers))
        .toMatchObject({ status: 429 });
    });

    it("stops an address trying many names, however each one goes: a ceiling for the address alone", async () => {
      const own = await signedIn();
      const browser = client(() => base);
      const headers = { "x-gymlog": "1", "x-real-ip": "203.0.113.30" };
      for (let i = 0; i < 6; i++) {
        await browser.call("POST", "/api/auth/login", { username: `nessuno${i}`, password: "wrong password" }, headers);
        // a success of one's own does not lower it
        if (i === 2) expect((await browser.call("POST", "/api/auth/login", { username: own.username, password: PASSWORD }, headers)).status).toBe(200);
      }
      expect(await browser.call("POST", "/api/auth/login", { username: "altro", password: "wrong password" }, headers))
        .toMatchObject({ status: 429 });
      // another address is not stopped
      expect((await browser.call("POST", "/api/auth/login", { username: own.username, password: PASSWORD }, { "x-gymlog": "1", "x-real-ip": "203.0.113.31" })).status).toBe(200);
    });

    it("writes a username in the log as it is, quoted: a newline in it cannot forge a line", async () => {
      await client(() => base).call("POST", "/api/auth/login", { username: "x\n[gymlog] new account", password: "wrong password" });
      // quoted as JSON: the newline stays a visible \n inside the quotes, on the same line
      expect(lines).toContain(String.raw`[gymlog] failed login for "x\n[gymlog] new account" from 127.0.0.1`);
    });

    it("renews the access with the session cookie, as often as needed, keeping the same session", async () => {
      const { call, jar, user } = await signedIn();
      const session = jar.get("gymlog_rt")!.value;
      const renewed = await call("POST", "/api/auth/refresh");
      expect(renewed).toMatchObject({ status: 200, body: { user } });
      // a new access comes with it
      expect(renewed.setCookies).toEqual(expect.arrayContaining([expect.stringMatching(/^gymlog_at=[^;]+;/)]));
      expect(jar.get("gymlog_rt")!.value).toBe(session);
      expect(await call("POST", "/api/auth/refresh")).toMatchObject({ status: 200, body: { user } });
    });

    it("refuses a renewal without the refresh cookie, and logs out without one", async () => {
      const anonymous = client(() => base);
      expect(await anonymous.call("POST", "/api/auth/refresh")).toMatchObject({ status: 401, body: { error: "Accesso richiesto." } });
      expect(await anonymous.call("POST", "/api/auth/logout")).toMatchObject({ status: 200, body: { ok: true } });
    });

    it("logs out, clearing the cookies and ending the session", async () => {
      const { call, jar } = await signedIn();
      const refresh = jar.get("gymlog_rt")!.value;
      const result = await call("POST", "/api/auth/logout");
      expect(result).toMatchObject({ status: 200, body: { ok: true } });
      expect(result.setCookies).toEqual([expect.stringMatching(/^gymlog_at=; .*Max-Age=0/), expect.stringMatching(/^gymlog_rt=; .*Max-Age=0/)]);
      jar.set("gymlog_rt", { value: refresh, path: "/api/auth" });
      expect((await call("POST", "/api/auth/refresh")).status).toBe(401);
    });
  });

  describe("signing up", () => {
    it("says whether it is open, without login", async () => {
      expect(await client(() => base).call("GET", "/api/auth/signup")).toMatchObject({ status: 200, body: { open: true } });
    });

    it("makes the account and signs it in", async () => {
      const browser = client(() => base);
      const username = `n${Math.random().toString(36).slice(2, 10)}`;
      const result = await browser.call("POST", "/api/auth/register", { username: username.toUpperCase(), password: PASSWORD }, { "x-gymlog": "1", "x-real-ip": "198.51.100.1" });
      expect(result).toMatchObject({ status: 200, body: { user: { id: expect.any(Number), username } } });
      expect(lines).toContain(`[gymlog] new account "${username}" from 198.51.100.1`);
      expect(result.setCookies).toEqual([expect.stringMatching(/^gymlog_at=/), expect.stringMatching(/^gymlog_rt=/)]);
      expect(await browser.call("GET", "/api/auth/me")).toMatchObject({ status: 200, body: { user: { username } } });
    });

    it("refuses a name taken and a bad body", async () => {
      const { username } = await signedIn();
      const headers = { "x-gymlog": "1", "x-real-ip": "198.51.100.2" };
      expect(await client(() => base).call("POST", "/api/auth/register", { username, password: PASSWORD }, headers))
        .toMatchObject({ status: 400, body: { error: "Questo nome utente è già preso." } });
      expect(await client(() => base).call("POST", "/api/auth/register", { username: "x", password: PASSWORD }, headers))
        .toMatchObject({ status: 400, body: { error: "Utente: da 3 a 30 caratteri, solo lettere, numeri, punto, trattino e trattino basso." } });
    });

    it("stops an address after a few sign-ups", async () => {
      const browser = client(() => base);
      const headers = { "x-gymlog": "1", "x-real-ip": "198.51.100.3" };
      const fresh = () => ({ username: `n${Math.random().toString(36).slice(2, 10)}`, password: PASSWORD });
      for (let i = 0; i < 3; i++) expect((await browser.call("POST", "/api/auth/register", fresh(), headers)).status).toBe(200);
      expect(await browser.call("POST", "/api/auth/register", fresh(), headers))
        .toMatchObject({ status: 429, body: { error: "Troppi tentativi. Riprova tra un quarto d'ora." } });
    });

    it("is refused when closed", async () => {
      const closed = createApiServer({ db: handle.db, jwtSecret: SECRET, secureCookie: true, allowSignup: false });
      await new Promise<void>((resolve) => closed.listen(0, "127.0.0.1", resolve));
      try {
        const at = () => `http://127.0.0.1:${(closed.address() as AddressInfo).port}`;
        expect(await client(at).call("GET", "/api/auth/signup")).toMatchObject({ body: { open: false } });
        expect(await client(at).call("POST", "/api/auth/register", { username: "chiuso", password: PASSWORD }))
          .toMatchObject({ status: 403, body: { error: "Le registrazioni sono chiuse." } });
      } finally {
        await new Promise((resolve) => closed.close(resolve));
      }
    });
  });

  describe("every request", () => {
    it("needs a login, except logging in", async () => {
      const anonymous = client(() => base);
      for (const path of ["/api/auth/me", "/api/exercises", "/api/plans", "/api/workouts", "/api/stats/exercises"]) {
        expect(await anonymous.call("GET", path)).toMatchObject({ status: 401, body: { error: "Accesso richiesto." } });
      }
    });

    it("refuses a forged access token", async () => {
      const { call, jar } = await signedIn();
      jar.set("gymlog_at", { value: "a.b.c", path: "/api" });
      expect((await call("GET", "/api/exercises")).status).toBe(401);
    });

    it("needs the app's header on a change", async () => {
      const { call } = await signedIn();
      expect(await call("POST", "/api/exercises", { name: "Squat" }, {})).toMatchObject({ status: 403, body: { error: "Richiesta non ammessa." } });
      expect(await call("POST", "/api/exercises", { name: "Squat" }, { "x-gymlog": "1", origin: "https://evil.example", host: "gym.example" }))
        .toMatchObject({ status: 403 });
      expect((await call("POST", "/api/exercises", { name: "Squat" }, { "x-gymlog": "1", origin: base })).status).toBe(200);
    });

    it("answers 404 for an unknown path and 405 for a wrong method", async () => {
      const { call } = await signedIn();
      expect(await call("GET", "/api/nothing")).toMatchObject({ status: 404, body: { error: "Non trovato." } });
      expect(await call("PUT", "/api/exercises")).toMatchObject({ status: 405, body: { error: "Metodo non ammesso." } });
    });

    it("answers 400 for a body that is not JSON or not valid", async () => {
      const { call } = await signedIn();
      expect(await call("POST", "/api/exercises", "{nope")).toMatchObject({ status: 400, body: { error: "JSON non valido." } });
      expect(await call("POST", "/api/exercises", { name: "" })).toMatchObject({ status: 400, body: { error: "Nome: manca o è troppo lungo." } });
    });

    it("takes a body of 256 KB, and refuses one byte more", async () => {
      const { call } = await signedIn();
      const sized = (bytes: number) => `{"name":"${"x".repeat(bytes - 11)}"}`;
      expect(Buffer.byteLength(sized(262_144))).toBe(262_144);
      // Read whole, then refused for its name only.
      expect(await call("POST", "/api/exercises", sized(262_144))).toMatchObject({ status: 400, body: { error: "Nome: manca o è troppo lungo." } });
      expect(await call("POST", "/api/exercises", sized(262_145))).toMatchObject({ status: 413, body: { error: "Richiesta troppo grande." } });
    });

    it("answers 404 for an id that is no number, or too big", async () => {
      const { call } = await signedIn();
      expect((await call("GET", "/api/plans/abc")).status).toBe(404);
      expect((await call("GET", "/api/plans/99999999999")).status).toBe(404);
    });

    it("is never cached", async () => {
      const { call } = await signedIn();
      expect((await call("GET", "/api/exercises")).headers.get("cache-control")).toBe("no-store");
    });
  });

  describe("exercises", () => {
    it("are created, listed, changed and deleted", async () => {
      const { call } = await signedIn();
      const created = await call("POST", "/api/exercises", { name: "Squat", muscleGroup: "Gambe", notes: null });
      expect(created).toMatchObject({ status: 200, body: { id: expect.any(Number), name: "Squat", muscleGroup: "Gambe", notes: null } });
      const id = created.body.id;
      expect((await call("GET", "/api/exercises")).body).toEqual([created.body]);
      expect((await call("PATCH", `/api/exercises/${id}`, { name: "Squat basso" })).body).toMatchObject({ id, name: "Squat basso", muscleGroup: null });
      expect(await call("DELETE", `/api/exercises/${id}`)).toMatchObject({ status: 200, body: { ok: true } });
      expect((await call("GET", "/api/exercises")).body).toEqual([]);
    });

    it("refuse a name already used, and a delete while in use", async () => {
      const { call } = await signedIn();
      const squat = (await call("POST", "/api/exercises", { name: "Squat" })).body;
      expect(await call("POST", "/api/exercises", { name: "squat" })).toMatchObject({ status: 409, body: { error: "Esiste già un esercizio con questo nome." } });
      const bench = (await call("POST", "/api/exercises", { name: "Panca" })).body;
      expect(await call("PATCH", `/api/exercises/${bench.id}`, { name: "SQUAT" })).toMatchObject({ status: 409, body: { error: "Esiste già un esercizio con questo nome." } });
      await call("POST", "/api/plans", { name: "P", days: [{ name: "A", exercises: [{ exerciseId: squat.id, reps: ["5", "5", "5"] }] }] });
      expect(await call("DELETE", `/api/exercises/${squat.id}`))
        .toMatchObject({ status: 409, body: { error: "Non si può eliminare: è usato in una scheda o in un allenamento." } });
    });

    it("of another user are not found", async () => {
      const mine = await signedIn();
      const theirs = await signedIn();
      const squat = (await mine.call("POST", "/api/exercises", { name: "Squat" })).body;
      expect((await theirs.call("PATCH", `/api/exercises/${squat.id}`, { name: "x" })).status).toBe(404);
      expect((await theirs.call("DELETE", `/api/exercises/${squat.id}`)).status).toBe(404);
    });
  });

  describe("plans and workouts", () => {
    it("go from a plan to a logged, finished workout and its stats", async () => {
      const { call } = await signedIn();
      const squat = (await call("POST", "/api/exercises", { name: "Squat" })).body;
      const plan = (await call("POST", "/api/plans", {
        name: "Forza", notes: null, archived: false,
        days: [{ name: "A", exercises: [{ exerciseId: squat.id, reps: ["5", "5", "5", "5", "5"], restSeconds: 180, notes: null }] }],
      })).body;
      expect(plan).toMatchObject({ id: expect.any(Number), name: "Forza", days: [{ name: "A", exercises: [{ exerciseName: "Squat" }] }] });
      expect((await call("GET", `/api/plans/${plan.id}`)).body).toEqual(plan);
      expect((await call("GET", "/api/plans")).body).toEqual([plan]);
      const renamed = (await call("PUT", `/api/plans/${plan.id}`, { ...plan, name: "Forza 2" })).body;
      expect(renamed).toMatchObject({ id: plan.id, name: "Forza 2" });

      const dayId = renamed.days[0].id;
      const workout = (await call("POST", "/api/workouts", { planDayId: dayId })).body;
      expect(workout).toMatchObject({ planDayId: dayId, planName: "Forza 2", dayName: "A", plan: renamed.days[0].exercises, sets: [], previous: {}, exerciseNotes: {} });
      expect(await call("PUT", `/api/workouts/${workout.id}/exercises/${squat.id}/note`, { note: " ginocchio ok " }))
        .toMatchObject({ status: 200, body: { exerciseId: squat.id, note: "ginocchio ok" } });

      const set = (await call("POST", `/api/workouts/${workout.id}/sets`, { exerciseId: squat.id, reps: 5, weightKg: 100 })).body;
      expect(set).toMatchObject({ id: expect.any(Number), exerciseId: squat.id, exerciseName: "Squat", reps: 5, weightKg: 100 });
      expect((await call("PATCH", `/api/sets/${set.id}`, { reps: 5, weightKg: 102.5 })).body).toMatchObject({ id: set.id, weightKg: 102.5 });
      const extra = (await call("POST", `/api/workouts/${workout.id}/sets`, { exerciseId: squat.id, reps: 3, weightKg: 110 })).body;
      expect(await call("DELETE", `/api/sets/${extra.id}`)).toMatchObject({ status: 200 });

      const finished = (await call("PATCH", `/api/workouts/${workout.id}`, { finished: true, notes: "bene" })).body;
      expect(finished).toMatchObject({ notes: "bene", finishedAt: expect.any(String), sets: [{ id: set.id, weightKg: 102.5 }], exerciseNotes: { [squat.id]: "ginocchio ok" } });
      expect((await call("GET", `/api/workouts/${workout.id}`)).body).toEqual(finished);

      const list = (await call("GET", "/api/workouts")).body;
      expect(list).toEqual([expect.objectContaining({ id: workout.id, sets: 1, exercises: 1, volume: 512.5 })]);

      const next = (await call("POST", "/api/workouts", { planDayId: null })).body;
      // one in progress at a time: another is refused with the reason, until this one is ended
      expect(await call("POST", "/api/workouts", { planDayId: dayId }))
        .toMatchObject({ status: 409, body: { error: "Hai già un allenamento in corso: terminalo prima di iniziarne un altro." } });
      await call("PATCH", `/api/workouts/${next.id}`, { finished: true });
      const again = (await call("POST", "/api/workouts", { planDayId: dayId })).body;
      // Renaming the plan and the day, the day kept by its id: the workout follows, targets included.
      const renamedAgain = (await call("PUT", `/api/plans/${plan.id}`, {
        ...renamed, name: "Forza 3", days: [{ ...renamed.days[0], name: "Gambe" }],
      })).body;
      expect(renamedAgain.days[0].id).toBe(dayId);
      expect((await call("GET", `/api/workouts/${again.id}`)).body).toMatchObject({ planName: "Forza 3", dayName: "Gambe", plan: renamedAgain.days[0].exercises });
      expect((await call("GET", "/api/workouts")).body[0]).toMatchObject({ id: again.id, planName: "Forza 3", dayName: "Gambe" });
      expect(again.previousNote).toEqual({ workoutId: workout.id, startedAt: workout.startedAt, note: "bene" });
      expect(await call("DELETE", `/api/workouts/${again.id}`)).toMatchObject({ status: 200 });
      expect(next.previous).toEqual({ [squat.id]: { workoutId: workout.id, startedAt: workout.startedAt, sets: [{ reps: 5, weightKg: 102.5 }], note: "ginocchio ok", before: [] } });

      const stats = (await call("GET", `/api/stats/exercises/${squat.id}`)).body;
      expect(stats).toMatchObject({ exercise: { id: squat.id }, overall: { sessions: 1, maxWeight: 102.5 }, sessions: [{ workoutId: workout.id, volume: 512.5 }] });
      expect((await call("GET", "/api/stats/exercises")).body).toEqual([
        { exerciseId: squat.id, name: "Squat", sessions: 1, avgWeight: 102.5, maxWeight: 102.5, lastAt: workout.startedAt },
      ]);
      expect((await call("GET", "/api/stats/overview")).status).toBe(404);

      expect(await call("DELETE", `/api/workouts/${next.id}`)).toMatchObject({ status: 200 });
      expect((await call("GET", `/api/workouts/${next.id}`)).status).toBe(404);
      expect(await call("DELETE", `/api/plans/${plan.id}`)).toMatchObject({ status: 200 });
      expect((await call("GET", `/api/workouts/${workout.id}`)).body).toMatchObject({ planDayId: null, planName: "Forza 3", dayName: "Gambe", plan: [] });
    });

    it("page the workouts, within bounds", async () => {
      const { call } = await signedIn();
      const ids: number[] = [];
      for (let i = 0; i < 3; i++) {
        ids.push((await call("POST", "/api/workouts", i === 0 ? undefined : {})).body.id);
        await call("PATCH", `/api/workouts/${ids[i]}`, { finished: true });
      }
      expect((await call("GET", "/api/workouts")).body).toHaveLength(3);
      expect((await call("GET", "/api/workouts?limit=2")).body.map((w: { id: number }) => w.id)).toEqual([ids[2], ids[1]]);
      expect((await call("GET", "/api/workouts?limit=2&offset=2")).body.map((w: { id: number }) => w.id)).toEqual([ids[0]]);
      expect((await call("GET", "/api/workouts?limit=0")).body).toHaveLength(1);
      expect((await call("GET", "/api/workouts?limit=x")).body).toHaveLength(3);
    });

    it("refuse another user's exercise or plan day with a message", async () => {
      const mine = await signedIn();
      const theirs = await signedIn();
      const squat = (await theirs.call("POST", "/api/exercises", { name: "Squat" })).body;
      const plan = (await theirs.call("POST", "/api/plans", { name: "P", days: [{ name: "A", exercises: [{ exerciseId: squat.id, reps: ["5", "5", "5"] }] }] })).body;
      expect(await mine.call("POST", "/api/plans", { name: "P", days: [{ name: "A", exercises: [{ exerciseId: squat.id, reps: ["5", "5", "5"] }] }] }))
        .toMatchObject({ status: 400, body: { error: "Uno degli esercizi non esiste più. Ricarica la pagina." } });
      expect(await mine.call("POST", "/api/workouts", { planDayId: plan.days[0].id }))
        .toMatchObject({ status: 400, body: { error: "Il giorno della scheda non esiste più. Ricarica la pagina." } });
      expect((await mine.call("GET", `/api/plans/${plan.id}`)).status).toBe(404);
      expect((await mine.call("GET", `/api/stats/exercises/${squat.id}`)).status).toBe(404);
    });
  });

  it("logs nothing as an error in all of the above", () => {
    expect(errors).toEqual([]);
  });
});

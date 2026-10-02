import { describe, expect, it } from "vitest";
import { SERVER, testDatabase } from "../../lib/database/test-database";
import { createTokenManager, refreshTokenHash } from "./token.rules";
import { createUsersRepository } from "../../repositories";
import { InputError } from "../../validators";
import { createAuthService, REFRESH_DAYS } from "./auth.service";

const PASSWORD = "correct horse battery";

describe.skipIf(SERVER === undefined)("the auth service", () => {
  const handle = testDatabase();
  const users = () => createUsersRepository(handle.db);
  const auth = () => createAuthService(handle.db, createTokenManager(new Uint8Array(32).fill(1)));
  const newName = () => `u${Math.random().toString(36).slice(2)}`;

  async function sessionDays(refresh: string): Promise<number> {
    const { rows } = await handle.db.$client.query<{ days: number }>(
      "select round(extract(epoch from expires_at - now()) / 86400)::int as days from sessions where token_hash = $1",
      [refreshTokenHash(refresh)],
    );
    return rows[0]!.days;
  }

  it("keeps refresh sessions thirty days", () => {
    expect(REFRESH_DAYS).toBe(30);
  });

  it("creates a user whose password logs in", async () => {
    const name = newName();
    const user = await auth().createUser(name, PASSWORD);
    expect(user).toEqual({ id: expect.any(Number), username: name });
    const tokens = await auth().login(name, PASSWORD);
    expect(tokens?.user).toEqual(user);
    expect(await auth().verifyAccess(tokens!.access)).toEqual(user);
    expect(await sessionDays(tokens!.refresh)).toBe(30);
  });

  it("stores no password, only a hash", async () => {
    const name = newName();
    await auth().createUser(name, PASSWORD);
    expect((await users().findByUsername(name))?.passwordHash).toMatch(/^scrypt\$/);
  });

  it("refuses a short password", async () => {
    await expect(auth().createUser(newName(), "short")).rejects.toThrow("Password: almeno 10 caratteri.");
    await expect(auth().setPassword(newName(), "short")).rejects.toThrow("Password: almeno 10 caratteri.");
  });

  it("gives nothing for a wrong password or an unknown user", async () => {
    const name = newName();
    await auth().createUser(name, PASSWORD);
    expect(await auth().login(name, "wrong password")).toBeUndefined();
    expect(await auth().login(newName(), PASSWORD)).toBeUndefined();
  });

  it("clears expired sessions at login", async () => {
    const name = newName();
    const user = await auth().createUser(name, PASSWORD);
    await users().createSession("expired", user.id, -1);
    await auth().login(name, PASSWORD);
    const { rows } = await handle.db.$client.query("select 1 from sessions where token_hash = 'expired'");
    expect(rows).toEqual([]);
  });

  it("renews with the same session, again and again, thirty more days from each renewal", async () => {
    const name = newName();
    const user = await auth().createUser(name, PASSWORD);
    const first = (await auth().login(name, PASSWORD))!;
    await handle.db.$client.query("update sessions set expires_at = now() + interval '2 days' where token_hash = $1", [refreshTokenHash(first.refresh)]);
    const renewed = await auth().refresh(first.refresh);
    expect(renewed?.user).toEqual(user);
    // the same ticket: an answer lost on the way costs nothing, the next renewal works the same
    expect(renewed?.refresh).toBe(first.refresh);
    expect(await sessionDays(first.refresh)).toBe(30);
    expect(await auth().refresh(first.refresh)).toBeDefined();
  });

  it("does not renew a session past its end", async () => {
    const name = newName();
    await auth().createUser(name, PASSWORD);
    const first = (await auth().login(name, PASSWORD))!;
    await handle.db.$client.query("update sessions set expires_at = now() - interval '1 minute' where token_hash = $1", [refreshTokenHash(first.refresh)]);
    expect(await auth().refresh(first.refresh)).toBeUndefined();
  });

  it("ends the session at logout", async () => {
    const name = newName();
    await auth().createUser(name, PASSWORD);
    const tokens = (await auth().login(name, PASSWORD))!;
    await auth().logout(tokens.refresh);
    expect(await auth().refresh(tokens.refresh)).toBeUndefined();
  });

  it("sets a new password, ending the sessions", async () => {
    const name = newName();
    await auth().createUser(name, PASSWORD);
    const tokens = (await auth().login(name, PASSWORD))!;
    await auth().setPassword(name, "another long password");
    expect(await auth().refresh(tokens.refresh)).toBeUndefined();
    expect(await auth().login(name, PASSWORD)).toBeUndefined();
    expect(await auth().login(name, "another long password")).toBeDefined();
  });

  it("registers a user, lower-case, signed in at once", async () => {
    const name = newName();
    const tokens = await auth().register(name.toUpperCase(), PASSWORD);
    expect(tokens.user).toEqual({ id: expect.any(Number), username: name });
    expect(await auth().verifyAccess(tokens.access)).toEqual(tokens.user);
    expect(await auth().refresh(tokens.refresh)).toBeDefined();
    expect(await auth().login(name, PASSWORD)).toBeDefined();
  });

  it("refuses a name already taken, whatever the case", async () => {
    const name = newName();
    await auth().register(name, PASSWORD);
    await expect(auth().register(name.toUpperCase(), PASSWORD)).rejects.toThrow(new InputError("Questo nome utente è già preso."));
  });

  it("finds a user by name whatever the case", async () => {
    const name = newName();
    await auth().createUser(name.toUpperCase(), PASSWORD);
    expect((await auth().login(name, PASSWORD))?.user.username).toBe(name);
  });

  it("refuses a new password for nobody", async () => {
    await expect(auth().setPassword(newName(), PASSWORD)).rejects.toThrow("Utente non trovato.");
  });
});

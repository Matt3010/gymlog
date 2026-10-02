import { describe, expect, it } from "vitest";
import { SERVER, testDatabase } from "../../lib/database/test-database";
import { createUsersRepository } from "./users.repository";

describe.skipIf(SERVER === undefined)("the users repository", () => {
  const handle = testDatabase();
  const repo = () => createUsersRepository(handle.db);

  it("creates a user and finds it by name, with its hash", async () => {
    const created = await repo().create("anna", "hash-a");
    expect(created).toEqual({ id: expect.any(Number), username: "anna" });
    expect(await repo().findByUsername("anna")).toEqual({ ...created, passwordHash: "hash-a" });
  });

  it("finds nobody by an unknown name", async () => {
    expect(await repo().findByUsername("nobody")).toBeUndefined();
  });

  it("refuses a name already taken", async () => {
    await repo().create("bruno", "x");
    await expect(repo().create("bruno", "y")).rejects.toMatchObject({ cause: { code: "23505" } });
  });

  it("renews a valid session as many times as asked, with the same token", async () => {
    const bea = await repo().create("bea", "x");
    await repo().createSession("token-1", bea.id, 30);
    expect(await repo().renewSession("token-1", 30)).toEqual(bea);
    expect(await repo().renewSession("token-1", 30)).toEqual(bea);
  });

  it("does not renew an expired session", async () => {
    const carlo = await repo().create("carlo", "x");
    await repo().createSession("token-old", carlo.id, -1);
    expect(await repo().renewSession("token-old", 30)).toBeUndefined();
  });

  it("ends a session", async () => {
    const dario = await repo().create("dario", "x");
    await repo().createSession("token-2", dario.id, 30);
    await repo().deleteSession("token-2");
    expect(await repo().renewSession("token-2", 30)).toBeUndefined();
  });

  it("clears expired sessions only", async () => {
    const elena = await repo().create("elena", "x");
    await repo().createSession("token-expired", elena.id, -1);
    await repo().createSession("token-valid", elena.id, 30);
    await repo().deleteExpiredSessions();
    const left = await handle.db.$client.query("select token_hash from sessions where user_id = $1", [elena.id]);
    expect(left.rows).toEqual([{ token_hash: "token-valid" }]);
  });

  it("changes a password", async () => {
    const fede = await repo().create("fede", "old");
    await repo().setPasswordHash(fede.id, "new");
    expect((await repo().findByUsername("fede"))?.passwordHash).toBe("new");
  });

  it("ends every session of one user only", async () => {
    const ivo = await repo().create("ivo", "x");
    const gino = await repo().create("gino", "x");
    await repo().createSession("token-ivo", ivo.id, 30);
    await repo().createSession("token-gino", gino.id, 30);
    await repo().deleteSessionsOf(ivo.id);
    expect(await repo().renewSession("token-ivo", 30)).toBeUndefined();
    expect(await repo().renewSession("token-gino", 30)).toEqual(gino);
  });
});

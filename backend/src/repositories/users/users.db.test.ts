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

  /** A token rotated that long ago, as if time had passed. */
  const rotatedAgo = (hash: string, seconds: number) =>
    handle.db.$client.query(`update sessions set rotated_at = now() - make_interval(secs => ${seconds}) where token_hash = $1`, [hash]);

  it("rotates a valid session: the new token goes on, the old one is marked", async () => {
    const bea = await repo().create("bea", "x");
    await repo().createSession("token-1", bea.id, 30);
    expect(await repo().rotateSession("token-1", "token-1b", 30, 60)).toEqual({ user: bea });
    expect(await repo().rotateSession("token-1b", "token-1c", 30, 60)).toEqual({ user: bea });
    // only the last two are kept: the one in use and the one just left
    const { rows } = await handle.db.$client.query("select token_hash from sessions where user_id = $1 order by token_hash", [bea.id]);
    expect(rows).toEqual([{ token_hash: "token-1b" }, { token_hash: "token-1c" }]);
  });

  it("takes the old token once more within the grace, as two tabs renewing together do", async () => {
    const bice = await repo().create("bice", "x");
    await repo().createSession("token-g", bice.id, 30);
    await repo().rotateSession("token-g", "token-g1", 30, 60);
    expect(await repo().rotateSession("token-g", "token-g2", 30, 60)).toEqual({ user: bice });
    expect(await repo().rotateSession("token-g1", "token-g3", 30, 60)).toEqual({ user: bice });
  });

  it("ends the whole login when an old token comes back after the grace: someone has a copy", async () => {
    const bruna = await repo().create("bruna", "x");
    await repo().createSession("token-r", bruna.id, 30);
    await repo().createSession("token-other", bruna.id, 30);
    await repo().rotateSession("token-r", "token-r1", 30, 60);
    await rotatedAgo("token-r", 61);
    expect(await repo().rotateSession("token-r", "token-r2", 30, 60)).toBe("reused");
    expect(await repo().rotateSession("token-r1", "token-r3", 30, 60)).toBeUndefined();
    // another login of the same user goes on
    expect(await repo().rotateSession("token-other", "token-other1", 30, 60)).toEqual({ user: bruna });
  });

  it("does not renew an expired or unknown session", async () => {
    const carlo = await repo().create("carlo", "x");
    await repo().createSession("token-old", carlo.id, -1);
    expect(await repo().rotateSession("token-old", "token-old1", 30, 60)).toBeUndefined();
    expect(await repo().rotateSession("token-none", "token-none1", 30, 60)).toBeUndefined();
  });

  it("ends a session with every token of its login", async () => {
    const dario = await repo().create("dario", "x");
    await repo().createSession("token-2", dario.id, 30);
    await repo().rotateSession("token-2", "token-2b", 30, 60);
    await repo().deleteSession("token-2b");
    expect(await repo().rotateSession("token-2", "token-2c", 30, 60)).toBeUndefined();
    expect(await repo().rotateSession("token-2b", "token-2d", 30, 60)).toBeUndefined();
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
    expect(await repo().rotateSession("token-ivo", "token-ivo1", 30, 60)).toBeUndefined();
    expect(await repo().rotateSession("token-gino", "token-gino1", 30, 60)).toEqual({ user: gino });
  });
});

import { randomUUID } from "node:crypto";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { type Executor, sessions, users } from "../../lib";

export interface User {
  readonly id: number;
  readonly username: string;
}

/** Who is signed in, as their profile shows it. */
export interface Profile extends User {
  readonly isAdmin: boolean;
  readonly createdAt: string;
}

/** Accounts and their refresh sessions. Only hashes are stored. */
export interface UsersRepository {
  findByUsername(username: string): Promise<(User & { passwordHash: string }) | undefined>;
  findById(userId: number): Promise<(User & { passwordHash: string }) | undefined>;
  profile(userId: number): Promise<Profile | undefined>;
  create(username: string, passwordHash: string): Promise<User>;
  setPasswordHash(userId: number, passwordHash: string): Promise<void>;
  deleteSessionsOf(userId: number): Promise<void>;

  /** A new login: a family of its own. */
  createSession(tokenHash: string, userId: number, days: number): Promise<void>;
  /**
   * A valid token is replaced by `newHash`, valid `days` from now, in the same
   * login. The one replaced still works for `graceSeconds` (two tabs renewing
   * together); back after that, someone has a copy: the whole login ends and
   * the answer is "reused". Expired or unknown: nothing.
   */
  rotateSession(tokenHash: string, newHash: string, days: number, graceSeconds: number): Promise<{ user: User } | "reused" | undefined>;
  /** Ends the login of that token: every token of it. */
  deleteSession(tokenHash: string): Promise<void>;
  deleteExpiredSessions(): Promise<void>;
}

const user = { id: users.id, username: users.username };

export function createUsersRepository(db: Executor): UsersRepository {
  return {
    async findByUsername(username) {
      const [row] = await db.select({ ...user, passwordHash: users.passwordHash }).from(users).where(eq(users.username, username));
      return row;
    },

    async findById(userId) {
      const [row] = await db.select({ ...user, passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId));
      return row;
    },

    async profile(userId) {
      const [row] = await db.select({
        ...user,
        isAdmin: users.isAdmin,
        createdAt: sql<string>`to_char(${users.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
      }).from(users).where(eq(users.id, userId));
      return row;
    },

    async create(username, passwordHash) {
      const [row] = await db.insert(users).values({ username, passwordHash }).returning(user);
      return row!;
    },

    async setPasswordHash(userId, passwordHash) {
      await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
    },

    async deleteSessionsOf(userId) {
      await db.delete(sessions).where(eq(sessions.userId, userId));
    },

    async createSession(tokenHash, userId, days) {
      await db.insert(sessions).values({ tokenHash, userId, family: randomUUID(), expiresAt: sql`now() + make_interval(days => ${days})` });
    },

    async rotateSession(tokenHash, newHash, days, graceSeconds) {
      const { rows } = await db.execute<{ userId: number; username: string; family: string; rotated: boolean; late: boolean }>(sql`
        select s.user_id as "userId", u.username, s.family, s.rotated_at is not null as rotated,
          coalesce(s.rotated_at < now() - make_interval(secs => ${graceSeconds}), false) as late
        from sessions s join users u on u.id = s.user_id
        where s.token_hash = ${tokenHash} and s.expires_at > now()
        for update of s`);
      const found = rows[0];
      if (found === undefined) return undefined;
      if (found.late) {
        await db.delete(sessions).where(eq(sessions.family, found.family));
        return "reused";
      }
      // only the one in use and the one just left are kept: older ones are no use any more
      await db.delete(sessions).where(and(eq(sessions.family, found.family), sql`${sessions.rotatedAt} is not null`, sql`${sessions.tokenHash} <> ${tokenHash}`));
      if (!found.rotated) await db.update(sessions).set({ rotatedAt: sql`now()` }).where(eq(sessions.tokenHash, tokenHash));
      await db.insert(sessions).values({ tokenHash: newHash, userId: found.userId, family: found.family, expiresAt: sql`now() + make_interval(days => ${days})` });
      return { user: { id: found.userId, username: found.username } };
    },

    async deleteSession(tokenHash) {
      await db.delete(sessions).where(sql`${sessions.family} = (select family from sessions where token_hash = ${tokenHash})`);
    },

    async deleteExpiredSessions() {
      await db.delete(sessions).where(lt(sessions.expiresAt, sql`now()`));
    },
  };
}

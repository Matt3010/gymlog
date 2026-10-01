import { and, eq, gt, lt, sql } from "drizzle-orm";
import { type Executor, sessions, users } from "../../lib";

export interface User {
  readonly id: number;
  readonly username: string;
}

/** Accounts and their refresh sessions. Only hashes are stored. */
export interface UsersRepository {
  findByUsername(username: string): Promise<(User & { passwordHash: string }) | undefined>;
  create(username: string, passwordHash: string): Promise<User>;
  setPasswordHash(userId: number, passwordHash: string): Promise<void>;
  deleteSessionsOf(userId: number): Promise<void>;

  createSession(tokenHash: string, userId: number, days: number): Promise<void>;
  /** Deletes a valid session and returns its user: a refresh token works once. */
  consumeSession(tokenHash: string): Promise<User | undefined>;
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
      await db.insert(sessions).values({ tokenHash, userId, expiresAt: sql`now() + make_interval(days => ${days})` });
    },

    async consumeSession(tokenHash) {
      // One statement: the delete is the lock, so two renewals with the same token cannot both win.
      const [row] = await db
        .with(db.$with("used").as(
          db.delete(sessions)
            .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, sql`now()`)))
            .returning({ userId: sessions.userId }),
        ))
        .select(user)
        .from(users)
        .where(sql`${users.id} in (select user_id from used)`);
      return row;
    },

    async deleteSession(tokenHash) {
      await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    },

    async deleteExpiredSessions() {
      await db.delete(sessions).where(lt(sessions.expiresAt, sql`now()`));
    },
  };
}

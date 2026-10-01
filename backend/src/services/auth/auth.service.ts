import type { Executor } from "../../lib";
import { createUsersRepository, type User } from "../../repositories";
import { InputError } from "../../validators";
import { checkNewPassword, DUMMY_HASH, hashPassword, verifyPassword } from "./password.rules";
import { newRefreshToken, refreshTokenHash, type TokenManager } from "./token.rules";

export const REFRESH_DAYS = 30;

export interface Tokens {
  readonly access: string;
  readonly refresh: string;
  readonly user: User;
}

export interface AuthService {
  /** Tokens for the right password, undefined otherwise. */
  login(username: string, password: string): Promise<Tokens | undefined>;
  /** The user an access token was issued to, if genuine and not expired. No database read. */
  verifyAccess(token: string): Promise<User | undefined>;
  /** Trades a refresh token for new tokens. The old refresh token stops working. */
  refresh(token: string): Promise<Tokens | undefined>;
  logout(refreshToken: string): Promise<void>;
  /** Rejects a password too short. */
  createUser(username: string, password: string): Promise<User>;
  /** Rejects a password too short; ends every session of the user. */
  setPassword(username: string, password: string): Promise<void>;
}

/**
 * Login with JWTs. The access token is short and checked without the
 * database; the refresh token is random, stored hashed and replaced at every
 * use, so logging out really ends a session (at most one access token later).
 */
export function createAuthService(db: Executor, tokens: TokenManager): AuthService {
  const users = createUsersRepository(db);

  async function issue(executor: Executor, user: User): Promise<Tokens> {
    const refresh = newRefreshToken();
    await createUsersRepository(executor).createSession(refreshTokenHash(refresh), user.id, REFRESH_DAYS);
    return { access: await tokens.sign(user), refresh, user };
  }

  function requireGoodPassword(password: string): void {
    const problem = checkNewPassword(password);
    if (problem !== undefined) throw new InputError(problem);
  }

  return {
    async login(username, password) {
      const user = await users.findByUsername(username);
      // A missing user costs the same time as a wrong password.
      const ok = await verifyPassword(password, user?.passwordHash ?? (await DUMMY_HASH));
      // Stryker disable next-line ConditionalExpression: the stand-in hash matches no password, so a missing user is never ok
      if (user === undefined || !ok) return undefined;
      await users.deleteExpiredSessions();
      return issue(db, { id: user.id, username: user.username });
    },

    verifyAccess(token) {
      return tokens.verify(token);
    },

    refresh(token) {
      // The old session goes and the new one comes together: a failure in between logs nobody out.
      return db.transaction(async (tx) => {
        const user = await createUsersRepository(tx).consumeSession(refreshTokenHash(token));
        return user === undefined ? undefined : issue(tx, user);
      });
    },

    async logout(refreshToken) {
      await users.deleteSession(refreshTokenHash(refreshToken));
    },

    async createUser(username, password) {
      requireGoodPassword(password);
      return users.create(username, await hashPassword(password));
    },

    async setPassword(username, password) {
      requireGoodPassword(password);
      const user = await users.findByUsername(username);
      if (user === undefined) throw new InputError("Utente non trovato.");
      const hash = await hashPassword(password);
      // Together: a new password with the old sessions still valid would keep a stolen one alive.
      await db.transaction(async (tx) => {
        const repository = createUsersRepository(tx);
        await repository.setPasswordHash(user.id, hash);
        await repository.deleteSessionsOf(user.id);
      });
    },
  };
}

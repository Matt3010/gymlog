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
  /** A new account, signed in at once. Rejects a name already taken. */
  register(username: string, password: string): Promise<Tokens>;
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
/**
 * `reuseGraceSeconds`: an old refresh token back within this is two tabs
 * renewing at once, not a copy; later, it was copied, and the user's
 * sessions all end (the thief's too).
 */
export function createAuthService(db: Executor, tokens: TokenManager, { reuseGraceSeconds = 30 } = {}): AuthService {
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
      const user = await users.findByUsername(username.toLowerCase());
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
        const sessions = createUsersRepository(tx);
        const hash = refreshTokenHash(token);
        const user = await sessions.consumeSession(hash);
        if (user !== undefined) return issue(tx, user);
        // used already, and not a moment ago: someone else has it; everyone out
        const stolen = await sessions.reusedAfter(hash, reuseGraceSeconds);
        if (stolen !== undefined) await sessions.deleteSessionsOf(stolen);
        return undefined;
      });
    },

    async logout(refreshToken) {
      await users.deleteSession(refreshTokenHash(refreshToken));
    },

    async register(username, password) {
      // Two sign-ups with one name at the same moment: the second meets the
      // unique index, and the server answers that it exists already.
      return issue(db, await this.createUser(username, password));
    },

    async createUser(username, password) {
      requireGoodPassword(password);
      const name = username.toLowerCase();
      if (await users.findByUsername(name)) throw new InputError("Questo nome utente è già preso.");
      return users.create(name, await hashPassword(password));
    },

    async setPassword(username, password) {
      requireGoodPassword(password);
      const user = await users.findByUsername(username.toLowerCase());
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

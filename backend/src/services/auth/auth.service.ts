import type { Executor } from "../../lib";
import { createUsersRepository, type Profile, type User } from "../../repositories";
import { found } from "../../errors";
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
  /** Who is signed in, from the database: whether admin, since when. */
  profile(userId: number): Promise<Profile>;
  /**
   * A new password, given the current one: every session ends, and this one
   * goes on with new tokens. Undefined when the current password is wrong.
   */
  changePassword(userId: number, current: string, next: string): Promise<Tokens | undefined>;
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

  /** Together: a new password with the old sessions still valid would keep a stolen one alive. */
  async function replacePassword(userId: number, hash: string): Promise<void> {
    await db.transaction(async (tx) => {
      const repository = createUsersRepository(tx);
      await repository.setPasswordHash(userId, hash);
      await repository.deleteSessionsOf(userId);
    });
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

    /*
     * A session as on most sites: the same ticket for as long as it is used,
     * thirty days more at each renewal. An answer lost on the way costs
     * nothing (the next renewal works the same); logout ends it, a new
     * password ends them all.
     */
    async refresh(token) {
      const user = await users.renewSession(refreshTokenHash(token), REFRESH_DAYS);
      return user === undefined ? undefined : { access: await tokens.sign(user), refresh: token, user };
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
      await replacePassword(user.id, await hashPassword(password));
    },

    async profile(userId) {
      return found(await users.profile(userId));
    },

    async changePassword(userId, current, next) {
      requireGoodPassword(next);
      const user = found(await users.findById(userId));
      if (!(await verifyPassword(current, user.passwordHash))) return undefined;
      await replacePassword(user.id, await hashPassword(next));
      return issue(db, { id: user.id, username: user.username });
    },
  };
}

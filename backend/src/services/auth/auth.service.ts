import type { Executor } from "../../lib";
import { createUsersRepository, type Profile, type User } from "../../repositories";
import { found } from "../../errors";
import { InputError } from "../../validators";
import { checkNewPassword, DUMMY_HASH, hashPassword, verifyPassword } from "./password.rules";
import { newRefreshToken, refreshTokenHash, type TokenManager } from "./token.rules";

export const REFRESH_DAYS = 30;
/** How long a refresh token just replaced still works: two tabs renewing at the same moment. */
export const GRACE_SECONDS = 60;

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
  /**
   * Trades a refresh token for new tokens, a new refresh token among them. The
   * old one works a minute more (two tabs renewing together), then not; back
   * after that, the whole login ends.
   */
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

  function requireGoodPassword(password: string, username: string): void {
    const problem = checkNewPassword(password, username);
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
     * A session as on most sites, thirty days more at each renewal, with a new
     * ticket each time. The old one works a minute more: an answer lost on the
     * way, or two tabs renewing at once, cost nothing. Back later than that it
     * is a copy (stolen, or out of a backup): the whole login ends, the thief's
     * and the owner's, who simply logs in again. Logout ends the login, a new
     * password all of them.
     */
    async refresh(token) {
      const next = newRefreshToken();
      const rotated = await db.transaction((tx) =>
        createUsersRepository(tx).rotateSession(refreshTokenHash(token), refreshTokenHash(next), REFRESH_DAYS, GRACE_SECONDS));
      if (rotated === undefined || rotated === "reused") return undefined;
      return { access: await tokens.sign(rotated.user), refresh: next, user: rotated.user };
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
      requireGoodPassword(password, username);
      const name = username.toLowerCase();
      if (await users.findByUsername(name)) throw new InputError("Questo nome utente è già preso.");
      return users.create(name, await hashPassword(password));
    },

    async setPassword(username, password) {
      requireGoodPassword(password, username);
      const user = await users.findByUsername(username.toLowerCase());
      if (user === undefined) throw new InputError("Utente non trovato.");
      await replacePassword(user.id, await hashPassword(password));
    },

    async profile(userId) {
      return found(await users.profile(userId));
    },

    async changePassword(userId, current, next) {
      const user = found(await users.findById(userId));
      requireGoodPassword(next, user.username);
      if (!(await verifyPassword(current, user.passwordHash))) return undefined;
      await replacePassword(user.id, await hashPassword(next));
      return issue(db, { id: user.id, username: user.username });
    },
  };
}

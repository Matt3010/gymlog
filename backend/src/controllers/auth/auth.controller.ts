import {
  ACCESS_COOKIE, authenticated, type Context, cookieHeader, HttpError, readCookie, REFRESH_COOKIE, route, type Route,
} from "../../http";
import { ACCESS_SECONDS, addressKey, type AuthService, type LoginLimiter, REFRESH_DAYS, type Tokens } from "../../services";
import { parseLogin, parseRegister } from "../../validators";

export interface AuthControllerDeps {
  readonly auth: AuthService;
  readonly limiter: LoginLimiter;
  /** Failed logins of an address whatever the name: a ceiling, never cleared by a success. */
  readonly addressLimiter: LoginLimiter;
  /** False only for trying the app over plain http on a laptop. */
  readonly secureCookie: boolean;
  /** Whether the login page offers to make an account. */
  readonly allowSignup: boolean;
  readonly log: (line: string) => void;
}

/** Login, token renewal, logout, who is signed in. */
export function authController({ auth, limiter, addressLimiter, secureCookie, allowSignup, log }: AuthControllerDeps): Route[] {
  function setTokens(context: Context, tokens: Tokens | undefined): void {
    context.response.setHeader("set-cookie", [
      cookieHeader(ACCESS_COOKIE, "/api", tokens?.access ?? "", tokens === undefined ? 0 : ACCESS_SECONDS, secureCookie),
      cookieHeader(REFRESH_COOKIE, "/api/auth", tokens?.refresh ?? "", tokens === undefined ? 0 : REFRESH_DAYS * 86_400, secureCookie),
    ]);
  }

  return [
    route("POST", "/api/auth/login", async (context) => {
      const { username, password } = parseLogin(await context.body());
      // Blocked per address and name together: guessing from elsewhere never locks the owner out,
      // and a success with an account of one's own does not wipe the count for someone else's.
      const address = addressKey(context.ip);
      // Stryker disable next-line MethodExpression: folded to upper or to lower case, «Bob» and «bob» are one name all the same
      const key = `${address}|${username.toLowerCase()}`;
      // and per address alone, higher: many names tried from one place (and every try costs a hash)
      if (limiter.blocked(key) || addressLimiter.blocked(address)) throw new HttpError(429, "Troppi tentativi. Riprova tra un quarto d'ora.");

      // Counted before checking, so parallel attempts cannot all slip through.
      limiter.fail(key);
      const tokens = await auth.login(username, password);
      if (tokens === undefined) {
        // quoted as JSON: a newline in the name cannot start a line of its own in the log
        log(`[gymlog] failed login for ${JSON.stringify(username.slice(0, 50))} from ${context.ip}`);
        addressLimiter.fail(address);
        throw new HttpError(401, "Utente o password errati.");
      }
      limiter.succeed(key);
      setTokens(context, tokens);
      return { user: tokens.user };
    }),

    route("GET", "/api/auth/signup", async () => ({ open: allowSignup })),

    route("POST", "/api/auth/register", async (context) => {
      if (!allowSignup) throw new HttpError(403, "Le registrazioni sono chiuse.");
      // A few accounts per address in a quarter of an hour: every attempt counts, made or not.
      const key = `signup:${addressKey(context.ip)}`;
      if (limiter.blocked(key)) throw new HttpError(429, "Troppi tentativi. Riprova tra un quarto d'ora.");
      limiter.fail(key);
      const { username, password } = parseRegister(await context.body());
      const tokens = await auth.register(username, password);
      log(`[gymlog] new account "${tokens.user.username}" from ${context.ip}`);
      setTokens(context, tokens);
      return { user: tokens.user };
    }),

    route("POST", "/api/auth/refresh", async (context) => {
      const token = readCookie(context.request, REFRESH_COOKIE);
      const tokens = token === undefined ? undefined : await auth.refresh(token);
      // A failed renewal leaves the cookies alone: with two tabs open, the
      // other one may have just renewed them, and clearing would log it out.
      if (tokens === undefined) throw new HttpError(401, "Accesso richiesto.");
      setTokens(context, tokens);
      return { user: tokens.user };
    }),

    route("POST", "/api/auth/logout", async (context) => {
      const token = readCookie(context.request, REFRESH_COOKIE);
      if (token !== undefined) await auth.logout(token);
      setTokens(context, undefined);
      return { ok: true };
    }),

    route("GET", "/api/auth/me", authenticated(async (_context, user) => ({ user }))),
  ];
}

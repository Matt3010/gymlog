import {
  ACCESS_COOKIE, authenticated, type Context, cookieHeader, HttpError, readCookie, REFRESH_COOKIE, route, type Route,
} from "../../http";
import { ACCESS_SECONDS, addressKey, type AuthService, type LoginLimiter, REFRESH_DAYS, type Tokens } from "../../services";
import { parseLogin } from "../../validators";

export interface AuthControllerDeps {
  readonly auth: AuthService;
  readonly limiter: LoginLimiter;
  /** False only for trying the app over plain http on a laptop. */
  readonly secureCookie: boolean;
  readonly log: (line: string) => void;
}

/** Login, token renewal, logout, who is signed in. */
export function authController({ auth, limiter, secureCookie, log }: AuthControllerDeps): Route[] {
  function setTokens(context: Context, tokens: Tokens | undefined): void {
    context.response.setHeader("set-cookie", [
      cookieHeader(ACCESS_COOKIE, "/api", tokens?.access ?? "", tokens === undefined ? 0 : ACCESS_SECONDS, secureCookie),
      cookieHeader(REFRESH_COOKIE, "/api/auth", tokens?.refresh ?? "", tokens === undefined ? 0 : REFRESH_DAYS * 86_400, secureCookie),
    ]);
  }

  return [
    route("POST", "/api/auth/login", async (context) => {
      const { username, password } = parseLogin(await context.body());
      // Blocked per address: guessing from elsewhere never locks the owner out.
      const key = addressKey(context.ip);
      if (limiter.blocked(key)) throw new HttpError(429, "Troppi tentativi. Riprova tra un quarto d'ora.");

      // Counted before checking, so parallel attempts cannot all slip through.
      limiter.fail(key);
      const tokens = await auth.login(username, password);
      if (tokens === undefined) {
        log(`[gymlog] failed login for "${username.slice(0, 50)}" from ${context.ip}`);
        throw new HttpError(401, "Utente o password errati.");
      }
      limiter.succeed(key);
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

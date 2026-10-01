import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { User } from "../repositories";
import { NotFoundError } from "../errors";
import { InputError } from "../validators";
import { HttpError } from "./http.errors";
import { readBody, readCookie } from "./request";
import { send } from "./response";
import type { Context, Route } from "./router";

/**
 * Sent by the app with every change. A form on another site cannot set it,
 * and with the SameSite cookies that closes cross-site requests twice.
 */
const CSRF_HEADER = "x-gymlog";

export const ACCESS_COOKIE = "gymlog_at";
export const REFRESH_COOKIE = "gymlog_rt";

export interface HttpServerDeps {
  readonly routes: readonly Route[];
  /** The user an access token belongs to, if it is genuine and not expired. */
  readonly verifyAccess: (token: string) => Promise<User | undefined>;
  readonly logError?: (line: string, error: unknown) => void;
}

/**
 * Whether a browser's Origin is this site. nginx passes the Host it received,
 * with its port when there is one; a same hostname on a default port counts too.
 */
export function sameSite(origin: string, forwardedHost: string): boolean {
  if (!URL.canParse(origin)) return false;
  const from = new URL(origin);
  const hereText = `${from.protocol}//${forwardedHost}`;
  if (!URL.canParse(hereText)) return false;
  const here = new URL(hereText);
  if (from.host === here.host) return true;
  return !/:\d+$/.test(forwardedHost) && from.hostname === here.hostname;
}

/** The Postgres error code, wherever the driver or Drizzle put it. */
function postgresCode(error: unknown): unknown {
  const { code, cause } = error as { code?: unknown; cause?: { code?: unknown } };
  return typeof code === "string" ? code : cause?.code;
}

/**
 * The API's HTTP server: finds the route, checks where a change comes from,
 * and turns errors into answers. What each route does is in controllers/.
 * It listens on the Docker network only; nginx is the way in.
 */
export function createHttpServer({ routes, verifyAccess, logError = console.error }: HttpServerDeps): Server {
  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    // Stryker disable next-line StringLiteral: Node always sets both on a server request
    const url = new URL(request.url ?? "/", "http://api.local");
    // Stryker disable next-line StringLiteral: Node always sets both on a server request
    const method = request.method ?? "GET";
    const matching = routes.filter((candidate) => candidate.path.test(url.pathname));
    // HEAD is answered like GET; Node leaves the body out.
    const match = matching.find((candidate) => candidate.method === (method === "HEAD" ? "GET" : method));
    if (match === undefined) {
      throw matching.length > 0 ? new HttpError(405, "Metodo non ammesso.") : new HttpError(404, "Non trovato.");
    }

    // Every change needs the app's header, login included, and, when the
    // browser names an origin, it must be this site.
    if (method !== "GET" && method !== "HEAD") {
      const origin = request.headers.origin;
      // Stryker disable next-line StringLiteral: any text without a host fails sameSite the same way
      const host = String(request.headers["x-forwarded-host"] ?? request.headers.host ?? "");
      if (request.headers[CSRF_HEADER] !== "1" || (origin !== undefined && !sameSite(origin, host))) {
        throw new HttpError(403, "Richiesta non ammessa.");
      }
    }

    // nginx puts the visitor's address here; the port is not reachable any other way.
    // Stryker disable next-line StringLiteral: an open socket always has an address
    const ip = String(request.headers["x-real-ip"] ?? request.socket.remoteAddress ?? "unknown");
    let user: Promise<User> | undefined;
    const context: Context = {
      request, response, url, ip,
      params: match.path.exec(url.pathname)!.slice(1),
      body: () => readBody(request),
      user: () =>
        (user ??= (async () => {
          const token = readCookie(request, ACCESS_COOKIE);
          const signedIn = token === undefined ? undefined : await verifyAccess(token);
          if (signedIn === undefined) throw new HttpError(401, "Accesso richiesto.");
          return signedIn;
        })()),
    };

    send(response, 200, (await match.handler(context)) ?? { ok: true });
  }

  const server = createServer((request, response) => {
    handle(request, response).catch((error: unknown) => {
      if (error instanceof HttpError) return send(response, error.status, { error: error.message });
      if (error instanceof InputError) return send(response, 400, { error: error.message });
      if (error instanceof NotFoundError) return send(response, 404, { error: error.message });
      const code = postgresCode(error);
      if (code === "23505") return send(response, 409, { error: "Esiste già un esercizio con questo nome." });
      // Only a delete can meet a row still in use: writes check what they name first.
      if (code === "23503" && request.method === "DELETE") {
        return send(response, 409, { error: "Non si può eliminare: è usato in una scheda o in un allenamento." });
      }
      logError(`[gymlog] ${request.method} ${request.url} failed`, error);
      send(response, 500, { error: "Qualcosa non ha funzionato. Riprova tra poco." });
    });
  });

  // Slow or stuck clients are cut off rather than held open.
  server.headersTimeout = 10_000;
  server.requestTimeout = 30_000;
  server.keepAliveTimeout = 5_000;
  return server;
}

import type { IncomingMessage, ServerResponse } from "node:http";
import type { User } from "../repositories";

export interface Context {
  readonly request: IncomingMessage;
  readonly response: ServerResponse;
  readonly url: URL;
  /** The route pattern's capture groups. */
  readonly params: readonly string[];
  /** The visitor's address, as nginx reports it. */
  readonly ip: string;
  body(): Promise<unknown>;
  /** The signed-in user; rejects with 401 otherwise. */
  user(): Promise<User>;
}

export type Handler = (context: Context) => Promise<unknown>;

export interface Route {
  readonly method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly path: RegExp;
  readonly handler: Handler;
}

/**
 * A route for exactly this path: a regular expression without anchors,
 * e.g. "/api/plans/(\\d+)", whose groups become the context's params.
 */
export function route(method: Route["method"], path: string, handler: Handler): Route {
  return { method, path: new RegExp(`^${path}$`), handler };
}

/** Signed in: the handler gets the user. */
export function authenticated(work: (context: Context, user: User) => Promise<unknown>): Handler {
  return async (context) => work(context, await context.user());
}

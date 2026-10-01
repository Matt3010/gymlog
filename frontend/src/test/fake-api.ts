import { vi } from 'vitest';

/** One request the screen sent: what a test checks, instead of the code that sent it. */
export interface Call {
  method: string;
  path: string;
  body: unknown;
  headers: Record<string, string>;
}

/** What the server answers: a body (200), or a status with its body. */
export type Reply = unknown | { status: number; body?: unknown };
type Handler = Reply | ((call: Call) => Reply);

const isReply = (value: unknown): value is { status: number; body?: unknown } =>
  typeof value === 'object' && value !== null && 'status' in value && typeof (value as { status: unknown }).status === 'number';

/**
 * The server, faked at the edge: `fetch` itself. Routes are "METHOD /path"
 * as the screens call them, with the query string, without /api. A request
 * nobody expected answers 500 with what it was, so a test fails saying so
 * instead of hanging.
 */
export function fakeApi() {
  const routes = new Map<string, Handler>();
  const calls: Call[] = [];

  const fetch = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    const path = url.replace(/^\/api/, '');
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    const call: Call = { method, path, body, headers: { ...(init.headers as Record<string, string>) } };
    calls.push(call);
    const handler = routes.get(`${method} ${path}`);
    // a handler may take its time, like a server over a real network
    const reply = await (handler === undefined
      ? { status: 500, body: { error: `nessuna risposta finta per ${method} ${path}` } }
      : typeof handler === 'function' ? (handler as (call: Call) => Reply)(call) : handler);
    const { status, body: payload } = isReply(reply) ? reply : { status: 200, body: reply };
    return new Response(payload === undefined ? null : JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetch);

  return {
    calls,
    /** What the server answers to this request from now on. */
    on(route: string, handler: Handler) {
      routes.set(route, handler);
      return this;
    },
    /** The requests that changed something (not GET), as "METHOD /path" with their body. */
    changes() {
      return calls.filter((call) => call.method !== 'GET').map(({ method, path, body }) => ({ route: `${method} ${path}`, body }));
    },
  };
}

/** A server that never answers: what a page shows while it waits. */
export function silentApi(): void {
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
}

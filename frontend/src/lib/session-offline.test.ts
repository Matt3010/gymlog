import { describe, expect, it, vi } from 'vitest';
import { ApiError, type Client } from './api';
import { Session } from './session.svelte';

const ANNA = { id: 1, username: 'anna' };

function client(me: () => Promise<unknown>, refresh: () => Promise<unknown> = me): Client {
  return {
    get: vi.fn(() => me()) as Client['get'],
    post: vi.fn((path: string) => (path === '/auth/refresh' ? refresh() : Promise.resolve({ ok: true }))) as Client['post'],
    put: vi.fn(), patch: vi.fn(), delete: vi.fn(),
  };
}

describe('without network, the session', () => {
  it('opens on whoever was in last, instead of the server-unreachable door', async () => {
    await new Session(client(() => Promise.resolve({ user: ANNA }))).check();
    const offline = new Session(client(() => Promise.reject(new ApiError('Il telefono è senza rete.'))));
    await offline.check();
    expect([offline.status, offline.user]).toEqual(['in', ANNA]);
  });

  it('with nobody in before, still says the server cannot be reached', async () => {
    const offline = new Session(client(() => Promise.reject(new ApiError('Il telefono è senza rete.'))));
    await offline.check();
    expect(offline.status).toBe('unreachable');
  });

  it('forgets who was in on leaving, or when the server closes the door', async () => {
    const first = new Session(client(() => Promise.resolve({ user: ANNA })));
    await first.check();
    first.signedOut();
    const offline = new Session(client(() => Promise.reject(new ApiError('senza rete'))));
    await offline.check();
    expect(offline.status).toBe('unreachable');
  });

  it('a server that answers 5xx is not a missing network: no entering on memory', async () => {
    await new Session(client(() => Promise.resolve({ user: ANNA }))).check();
    const broken = new Session(client(() => Promise.reject(new ApiError('inceppato', 500))));
    await broken.check();
    expect(broken.status).toBe('unreachable');
  });
});

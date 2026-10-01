import { describe, expect, it, vi } from 'vitest';
import { ApiError, type Client } from './api';
import { Session } from './session.svelte';

const anna = { id: 1, username: 'anna' };

/** A client whose answers are given per method and path. */
function client(answers: Record<string, () => unknown>): Client & { calls: string[] } {
  const calls: string[] = [];
  const answer = (method: string) => async (path: string) => {
    calls.push(`${method} ${path}`);
    const reply = answers[`${method} ${path}`];
    if (!reply) throw new Error(`unexpected ${method} ${path}`);
    return reply();
  };
  return { calls, get: answer('GET'), post: answer('POST'), put: answer('PUT'), patch: answer('PATCH'), delete: answer('DELETE') } as Client & { calls: string[] };
}

const refused = () => { throw new ApiError('Accesso richiesto.', 401); };

describe('the session', () => {
  it('is being checked until it knows', () => {
    expect(new Session(client({})).status).toBe('checking');
  });

  it('is in when the login is still good', async () => {
    const session = new Session(client({ 'GET /auth/me': () => ({ user: anna }) }));
    await session.check();
    expect([session.status, session.user]).toEqual(['in', anna]);
  });

  it('renews an expired login before giving up on it', async () => {
    const api = client({ 'GET /auth/me': refused, 'POST /auth/refresh': () => ({ user: anna }) });
    const session = new Session(api);
    await session.check();
    expect([session.status, session.user]).toEqual(['in', anna]);
    expect(api.calls).toEqual(['GET /auth/me', 'POST /auth/refresh']);
  });

  it('is out when neither works', async () => {
    const session = new Session(client({ 'GET /auth/me': refused, 'POST /auth/refresh': refused }));
    await session.check();
    expect([session.status, session.user]).toEqual(['out', null]);
  });

  it('says the server is unreachable instead of showing the door', async () => {
    const session = new Session(client({ 'GET /auth/me': () => { throw new ApiError('Il server non risponde.'); } }));
    await session.check();
    expect([session.status, session.problem]).toEqual(['unreachable', 'Il server non risponde.']);
  });

  it('logs in, and passes on a refusal', async () => {
    const api = client({ 'POST /auth/login': () => ({ user: anna }) });
    const session = new Session(api);
    await session.login('anna', 'secret');
    expect([session.status, session.user]).toEqual(['in', anna]);

    const wrong = new Session(client({ 'POST /auth/login': () => { throw new ApiError('Utente o password errati.', 401); } }));
    await expect(wrong.login('anna', 'x')).rejects.toThrow('Utente o password errati.');
    expect(wrong.status).toBe('checking');
  });

  it('signs up and is in at once, and passes on a refusal', async () => {
    const api = client({ 'POST /auth/register': () => ({ user: anna }) });
    const session = new Session(api);
    await session.register('anna', 'password lunga');
    expect([session.status, session.user]).toEqual(['in', anna]);
    const taken = new Session(client({ 'POST /auth/register': () => { throw new ApiError('Questo nome utente è già preso.', 400); } }));
    await expect(taken.register('anna', 'password lunga')).rejects.toThrow('Questo nome utente è già preso.');
    expect(taken.status).not.toBe('in');
  });

  it('knows whether sign-up is open, closed when it cannot ask', async () => {
    expect(await new Session(client({ 'GET /auth/signup': () => ({ open: true }) })).signupOpen()).toBe(true);
    expect(await new Session(client({ 'GET /auth/signup': () => ({ open: false }) })).signupOpen()).toBe(false);
    expect(await new Session(client({ 'GET /auth/signup': () => { throw new ApiError('giù', 503); } })).signupOpen()).toBe(false);
  });

  it('logs out, even when the server cannot be told', async () => {
    const session = new Session(client({ 'POST /auth/login': () => ({ user: anna }), 'POST /auth/logout': () => { throw new ApiError('Il server non risponde.'); } }));
    await session.login('anna', 'secret');
    await session.logout();
    expect([session.status, session.user]).toEqual(['out', null]);
  });

  it('goes out when told the login is over', async () => {
    const session = new Session(client({ 'POST /auth/login': () => ({ user: anna }) }));
    await session.login('anna', 'secret');
    session.signedOut();
    expect([session.status, session.user]).toEqual(['out', null]);
  });
});

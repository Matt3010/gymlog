import { describe, expect, it, vi } from 'vitest';
import { ApiError, createClient } from './api';

type Call = { url: string; method: string; headers: Record<string, string>; body: string | undefined; credentials?: string };

/** A server in a box: answers each call with the next reply given for its path. */
function server(replies: Record<string, (Response | (() => Response) | Error)[]>) {
  const calls: Call[] = [];
  const fetch = vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({
      url,
      method: init.method ?? 'GET',
      headers: Object.fromEntries(new Headers(init.headers).entries()),
      body: init.body as string | undefined,
      credentials: init.credentials,
    });
    const next = replies[url]?.shift();
    if (next === undefined) throw new Error(`no reply left for ${url}`);
    if (next instanceof Error) throw next;
    return typeof next === 'function' ? next() : next;
  });
  return { fetch, calls };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('a request', () => {
  it('goes to /api with the cookies, and gives back the JSON', async () => {
    const { fetch, calls } = server({ '/api/exercises': [json(200, [{ id: 1 }])] });
    const api = createClient({ fetch, onSignedOut: vi.fn() });
    expect(await api.get('/exercises')).toEqual([{ id: 1 }]);
    expect(calls[0]).toMatchObject({ url: '/api/exercises', method: 'GET', credentials: 'same-origin' });
  });

  it('sends no app header on a read', async () => {
    const { fetch, calls } = server({ '/api/exercises': [json(200, [])] });
    await createClient({ fetch, onSignedOut: vi.fn() }).get('/exercises');
    expect(calls[0]!.headers['x-gymlog']).toBeUndefined();
  });

  it.each([
    ['post', 'POST'],
    ['put', 'PUT'],
    ['patch', 'PATCH'],
  ] as const)('sends a change (%s) as JSON with the app header', async (verb, method) => {
    const { fetch, calls } = server({ '/api/plans/3': [json(200, { ok: true })] });
    await createClient({ fetch, onSignedOut: vi.fn() })[verb]('/plans/3', { name: 'A' });
    expect(calls[0]).toMatchObject({
      method,
      body: '{"name":"A"}',
      headers: { 'x-gymlog': '1', 'content-type': 'application/json' },
    });
  });

  it('sends a delete with the app header and no body', async () => {
    const { fetch, calls } = server({ '/api/sets/4': [json(200, { ok: true })] });
    await createClient({ fetch, onSignedOut: vi.fn() }).delete('/sets/4');
    expect(calls[0]).toMatchObject({ method: 'DELETE', body: undefined, headers: { 'x-gymlog': '1' } });
    expect(calls[0]!.headers['content-type']).toBeUndefined();
  });
});

describe('an error', () => {
  it("carries the server's own message and status", async () => {
    const { fetch } = server({ '/api/exercises': [json(409, { error: 'Esiste già un esercizio con questo nome.' })] });
    const failure = await createClient({ fetch, onSignedOut: vi.fn() }).post('/exercises', {}).catch((error) => error);
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ message: 'Esiste già un esercizio con questo nome.', status: 409 });
  });

  it.each([
    [404, 'Quello che cercavi non c’è più. Ricarica la pagina per vedere com’è adesso.'],
    [502, 'Il server non si raggiunge adesso. Riprova fra poco.'],
    [500, 'Il server si è inceppato mentre rispondeva (codice 500). Riprova fra poco.'],
    [418, 'Il server ha rifiutato la richiesta senza dire perché (codice 418).'],
  ])('says what went wrong when the server does not (%i)', async (status, message) => {
    const { fetch } = server({ '/api/x': [new Response('oops', { status })] });
    await expect(createClient({ fetch, onSignedOut: vi.fn() }).get('/x')).rejects.toMatchObject({ message, status });
  });

  it('says the request did not arrive when there is no answer', async () => {
    const { fetch } = server({ '/api/x': [new TypeError('Failed to fetch')] });
    await expect(createClient({ fetch, onSignedOut: vi.fn() }).get('/x')).rejects.toMatchObject({
      message: 'Il server non risponde, e la richiesta non è arrivata. Controlla la rete e riprova.',
      status: undefined,
    });
  });

  it('says the phone has no network when it has none', async () => {
    const offline = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const { fetch } = server({ '/api/x': [new TypeError('Failed to fetch')] });
    await expect(createClient({ fetch, onSignedOut: vi.fn() }).get('/x')).rejects.toMatchObject({
      message: 'Il telefono è senza rete, e la richiesta non è partita.',
    });
    offline.mockRestore();
  });
});

describe('an expired login', () => {
  it('is renewed once, and the request tried again', async () => {
    const { fetch, calls } = server({
      '/api/workouts': [json(401, { error: 'Accesso richiesto.' }), json(200, [{ id: 9 }])],
      '/api/auth/refresh': [json(200, { user: { id: 1, username: 'anna' } })],
    });
    const onSignedOut = vi.fn();
    expect(await createClient({ fetch, onSignedOut }).get('/workouts')).toEqual([{ id: 9 }]);
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual(['GET /api/workouts', 'POST /api/auth/refresh', 'GET /api/workouts']);
    expect(calls[1]!.headers['x-gymlog']).toBe('1');
    expect(onSignedOut).not.toHaveBeenCalled();
  });

  it('is renewed once for many requests waiting together', async () => {
    const { fetch, calls } = server({
      '/api/a': [json(401, {}), json(200, 'a')],
      '/api/b': [json(401, {}), json(200, 'b')],
      '/api/auth/refresh': [json(200, {})],
    });
    const api = createClient({ fetch, onSignedOut: vi.fn() });
    expect(await Promise.all([api.get('/a'), api.get('/b')])).toEqual(['a', 'b']);
    expect(calls.filter((call) => call.url === '/api/auth/refresh')).toHaveLength(1);
  });

  it('is renewed again later, when it expires again', async () => {
    const { fetch, calls } = server({
      '/api/a': [json(401, {}), json(200, 'a'), json(401, {}), json(200, 'a')],
      '/api/auth/refresh': [json(200, {}), json(200, {})],
    });
    const api = createClient({ fetch, onSignedOut: vi.fn() });
    await api.get('/a');
    await api.get('/a');
    expect(calls.filter((call) => call.url === '/api/auth/refresh')).toHaveLength(2);
  });

  it('signs out when the renewal is refused', async () => {
    const { fetch, calls } = server({
      '/api/workouts': [json(401, { error: 'Accesso richiesto.' })],
      '/api/auth/refresh': [json(401, { error: 'Accesso richiesto.' })],
    });
    const onSignedOut = vi.fn();
    await expect(createClient({ fetch, onSignedOut }).get('/workouts')).rejects.toMatchObject({ status: 401, message: 'Accesso richiesto.' });
    expect(onSignedOut).toHaveBeenCalledOnce();
    expect(calls).toHaveLength(2);
  });

  it('does not sign out when the renewal gets no answer, or the server is down: it is the network, try later', async () => {
    for (const renewal of [new TypeError('Failed to fetch'), json(502, {}), json(500, {})]) {
      const { fetch } = server({
        '/api/workouts': [json(401, { error: 'Accesso richiesto.' })],
        '/api/auth/refresh': [renewal],
      });
      const onSignedOut = vi.fn();
      const failure = await createClient({ fetch, onSignedOut }).get('/workouts').catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(ApiError);
      // like no answer at all: whoever waits (the queue of changes) tries again later
      expect((failure as ApiError).status).toBeUndefined();
      expect(onSignedOut).not.toHaveBeenCalled();
    }
  });

  it('signs out when the request is refused again after the renewal', async () => {
    const { fetch } = server({
      '/api/workouts': [json(401, {}), json(401, { error: 'Accesso richiesto.' })],
      '/api/auth/refresh': [json(200, {})],
    });
    const onSignedOut = vi.fn();
    await expect(createClient({ fetch, onSignedOut }).get('/workouts')).rejects.toMatchObject({ status: 401 });
    expect(onSignedOut).toHaveBeenCalledOnce();
  });

  it('is not renewed on the login itself: a wrong password is just an error', async () => {
    const { fetch, calls } = server({ '/api/auth/login': [json(401, { error: 'Utente o password errati.' })] });
    const onSignedOut = vi.fn();
    await expect(createClient({ fetch, onSignedOut }).post('/auth/login', {})).rejects.toMatchObject({
      status: 401,
      message: 'Utente o password errati.',
    });
    expect(calls).toHaveLength(1);
    expect(onSignedOut).not.toHaveBeenCalled();
  });
});

describe('the copy kept on the phone', () => {
  const kept = () => {
    const box = new Map<string, unknown>();
    return { box, copies: { read: (path: string) => box.get(path), write: (path: string, value: unknown) => void box.set(path, value) } };
  };

  it('is written by every read that arrives, and given back when the network is missing', async () => {
    const { copies } = kept();
    const { fetch } = server({ '/api/plans': [json(200, [{ id: 1 }]), new TypeError('Failed to fetch')] });
    const api = createClient({ fetch, onSignedOut: vi.fn(), copies });
    expect(await api.get('/plans')).toEqual([{ id: 1 }]);
    expect(await api.get('/plans')).toEqual([{ id: 1 }]);
  });

  it('is not a reason to hide a real answer of the server: an error stays an error', async () => {
    const { copies } = kept();
    const { fetch } = server({ '/api/plans/1': [json(200, { id: 1 }), json(404, { error: 'Non trovato.' })] });
    const api = createClient({ fetch, onSignedOut: vi.fn(), copies });
    await api.get('/plans/1');
    await expect(api.get('/plans/1')).rejects.toThrow('Non trovato.');
  });

  it('without a copy, says the network is missing as before', async () => {
    const { copies } = kept();
    const { fetch } = server({ '/api/plans': [new TypeError('Failed to fetch')] });
    await expect(createClient({ fetch, onSignedOut: vi.fn(), copies }).get('/plans')).rejects.toBeInstanceOf(ApiError);
  });

  it('is skipped by a read that wants it fresh, or the doors', async () => {
    const { box, copies } = kept();
    const { fetch } = server({ '/api/workouts?limit=6&offset=0': [json(200, []), new TypeError('x')], '/api/auth/me': [json(200, { user: { id: 1 } })] });
    const api = createClient({ fetch, onSignedOut: vi.fn(), copies });
    await api.get('/workouts?limit=6&offset=0');
    await expect(api.get('/workouts?limit=6&offset=0', { fresh: true })).rejects.toBeInstanceOf(ApiError);
    await api.get('/auth/me');
    expect([...box.keys()]).toEqual(['/workouts?limit=6&offset=0']);
  });
});

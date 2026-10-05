// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderServiceWorker, shellOf, versionOf } from './build';
import template from './sw.js?raw';

/*
 * The service worker as the browser runs it: the real file, with the shell
 * and the version written in by the build, evaluated against a fake `self`,
 * fake caches and a fake network.
 */

const ORIGIN = 'https://gym.example';
const SHELL = ['/index.html', '/assets/index-AAAA.js', '/assets/index-BBBB.css', '/manifest.webmanifest', '/icona-192.png'];

type Listener = (event: never) => void;

function fakeCaches() {
  const stores = new Map<string, Map<string, Response>>();
  const key = (request: Request | string) => (typeof request === 'string' ? new URL(request, ORIGIN).href : request.url);
  const open = async (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;
    return {
      async addAll(urls: string[]) {
        for (const url of urls) store.set(key(url), await network(new Request(new URL(url, ORIGIN))));
      },
      async put(request: Request | string, response: Response) {
        store.set(key(request), response);
      },
      async match(request: Request | string) {
        return store.get(key(request))?.clone();
      },
    };
  };
  return {
    stores,
    open: vi.fn(open),
    keys: async () => [...stores.keys()],
    delete: vi.fn(async (name: string) => stores.delete(name)),
    async match(request: Request | string) {
      for (const store of stores.values()) {
        const found = store.get(key(request));
        if (found) return found.clone();
      }
      return undefined;
    },
  };
}

let online = true;
let caches: ReturnType<typeof fakeCaches>;
const network = vi.fn(async (request: Request) => {
  if (!online) throw new TypeError('Failed to fetch');
  return new Response(`network ${new URL(request.url).pathname}`, { status: 200 });
});

function boot(version = 'v1') {
  const listeners = new Map<string, Listener>();
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
    skipWaiting: vi.fn(async () => undefined),
    clients: { claim: vi.fn(async () => undefined) },
  };
  new Function('self', 'caches', 'fetch', renderServiceWorker(template, SHELL, version))(self, caches, network);

  async function lifecycle(type: 'install' | 'activate') {
    let done: Promise<unknown> = Promise.resolve();
    listeners.get(type)!({ waitUntil: (promise: Promise<unknown>) => (done = promise) } as never);
    await done;
  }

  /** What the page gets for this request: the worker's answer, or `undefined` when it lets it go to the network. */
  async function request(path: string, init: { method?: string; mode?: 'navigate' } = {}): Promise<string | undefined> {
    const url = path.startsWith('http') ? path : `${ORIGIN}${path}`;
    const request = new Request(url, { method: init.method ?? 'GET' });
    if (init.mode) Object.defineProperty(request, 'mode', { value: init.mode });
    let answer: Promise<Response> | undefined;
    listeners.get('fetch')!({ request, respondWith: (response: Promise<Response>) => (answer = response) } as never);
    return answer === undefined ? undefined : (await answer).text();
  }

  return { self, lifecycle, request };
}

beforeEach(() => {
  online = true;
  caches = fakeCaches();
  network.mockClear();
});

describe('installing', () => {
  it('keeps a copy of the whole app shell, under the version, and takes over at once', async () => {
    const worker = boot('v7');
    await worker.lifecycle('install');
    expect([...caches.stores.keys()]).toEqual(['gymlog-v7']);
    expect([...caches.stores.get('gymlog-v7')!.keys()]).toEqual(SHELL.map((path) => `${ORIGIN}${path}`));
    expect(worker.self.skipWaiting).toHaveBeenCalled();
  });
});

describe('activating', () => {
  it('throws away the copies of the older versions, and serves the open pages', async () => {
    caches.stores.set('gymlog-v1', new Map());
    caches.stores.set('gymlog-v2', new Map());
    caches.stores.set('someone-else', new Map());
    const worker = boot('v2');
    await worker.lifecycle('activate');
    expect([...caches.stores.keys()]).toEqual(['gymlog-v2', 'someone-else']);
    expect(worker.self.clients.claim).toHaveBeenCalled();
  });
});

describe('a request', () => {
  it('to the API always goes to the network, untouched', async () => {
    const worker = boot();
    await worker.lifecycle('install');
    expect(await worker.request('/api/workouts?limit=20&offset=0')).toBeUndefined();
    expect(await worker.request('/api/workouts', { method: 'POST' })).toBeUndefined();
    online = false;
    expect(await worker.request('/api/auth/me')).toBeUndefined();
  });

  it('that is not a GET, or to another site, is left alone', async () => {
    const worker = boot();
    await worker.lifecycle('install');
    expect(await worker.request('/assets/index-AAAA.js', { method: 'POST' })).toBeUndefined();
    expect(await worker.request('https://elsewhere.example/assets/index-AAAA.js')).toBeUndefined();
  });

  it('for a bundle is served from the copy, without the network', async () => {
    const worker = boot();
    await worker.lifecycle('install');
    network.mockClear();
    online = false;
    expect(await worker.request('/assets/index-AAAA.js')).toBe('network /assets/index-AAAA.js');
    expect(network).not.toHaveBeenCalled();
  });

  it('for a bundle not kept yet goes to the network, and is kept for next time', async () => {
    const worker = boot();
    await worker.lifecycle('install');
    expect(await worker.request('/assets/lazy-CCCC.js')).toBe('network /assets/lazy-CCCC.js');
    online = false;
    expect(await worker.request('/assets/lazy-CCCC.js')).toBe('network /assets/lazy-CCCC.js');
  });

  it('for the icons and the manifest is served from the copy too', async () => {
    const worker = boot();
    await worker.lifecycle('install');
    online = false;
    expect(await worker.request('/manifest.webmanifest')).toBe('network /manifest.webmanifest');
  });

  it('for a page asks the network first, for the newest app', async () => {
    const worker = boot();
    await worker.lifecycle('install');
    network.mockImplementationOnce(async () => new Response('the newest page'));
    expect(await worker.request('/history', { mode: 'navigate' })).toBe('the newest page');
  });

  it('for a page without network gets the kept app, which opens on any address', async () => {
    const worker = boot();
    await worker.lifecycle('install');
    online = false;
    expect(await worker.request('/workouts/12', { mode: 'navigate' })).toBe('network /index.html');
  });

  it('for anything else of the site goes to the network as usual', async () => {
    const worker = boot();
    await worker.lifecycle('install');
    expect(await worker.request('/robots.txt')).toBeUndefined();
  });
});

describe('the build', () => {
  it('lists the page, the bundles and the public files, without maps or the worker itself', () => {
    expect(shellOf(['assets/index-AAAA.js', 'assets/index-AAAA.js.map', 'index.html', 'assets/index-BBBB.css'], ['sw.js', 'manifest.webmanifest', 'icona-192.png']))
      .toEqual(['/index.html', '/assets/index-AAAA.js', '/assets/index-BBBB.css', '/icona-192.png', '/manifest.webmanifest']);
  });

  it('names a version that changes when anything kept changes', () => {
    const one = versionOf(['/index.html', '/assets/index-AAAA.js']);
    expect(one).toMatch(/^[0-9a-z]{6,}$/);
    expect(versionOf(['/index.html', '/assets/index-AAAA.js'])).toBe(one);
    expect(versionOf(['/index.html', '/assets/index-ZZZZ.js'])).not.toBe(one);
  });

  it('writes the shell and the version into the worker, and nothing is left to fill', () => {
    const source = renderServiceWorker(template, ['/index.html'], 'v9');
    expect(source).toContain('["/index.html"]');
    expect(source).toContain('"v9"');
    expect(source).not.toMatch(/__SHELL__|__VERSION__/);
  });

  it('refuses a worker without the places to fill', () => {
    expect(() => renderServiceWorker('self.addEventListener()', [], 'v1')).toThrow('sw.js must contain __SHELL__ and __VERSION__');
  });
});

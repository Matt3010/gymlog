import { afterEach, describe, expect, it, vi } from 'vitest';
import { install } from './install.svelte';
import { rete } from './rete.svelte';
import { forgetJSON, readJSON, writeJSON } from './storage';

/* What the app knows of the phone: whether it can be installed, the network, what this browser keeps. */

const offer = (prompt = vi.fn(async () => undefined)) =>
  Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) });

afterEach(() => {
  install.offerta = null;
  install.nonOra = false;
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('installing', () => {
  it('is not offered until the browser says it can, or on an iPhone', () => {
    expect([install.installata, install.iPhone, install.possibile]).toEqual([false, false, false]);
  });

  it('is offered when the browser can, keeping its own sheet for when we ask', async () => {
    const event = offer();
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(install.possibile).toBe(true);
    await install.installa();
    expect(event.prompt).toHaveBeenCalledOnce();
    expect(install.offerta).toBeNull();
    expect(install.possibile).toBe(false);
  });

  it('asks nothing without an offer', async () => {
    await install.installa();
    expect(install.offerta).toBeNull();
  });

  it('is no longer offered once installed', () => {
    window.dispatchEvent(offer());
    window.dispatchEvent(new Event('appinstalled'));
    expect(install.possibile).toBe(false);
  });

  it('remembers «non ora» in this browser', () => {
    install.lascia();
    expect(install.nonOra).toBe(true);
    expect(readJSON('gymlog.installa.no', false)).toBe(true);
  });
});

describe('the network', () => {
  it('is missing from the offline event to the online one', () => {
    window.dispatchEvent(new Event('offline'));
    expect(rete.manca).toBe(true);
    window.dispatchEvent(new Event('online'));
    expect(rete.manca).toBe(false);
  });
});

describe('what this browser keeps', () => {
  it('is written and read back as JSON, and forgotten', () => {
    writeJSON('k', { a: 1 });
    expect(localStorage.getItem('k')).toBe('{"a":1}');
    expect(readJSON('k', null)).toEqual({ a: 1 });
    forgetJSON('k');
    expect(localStorage.getItem('k')).toBeNull();
    expect(readJSON('k', 'nulla')).toBe('nulla');
  });

  it('falls back when what is kept is not JSON', () => {
    localStorage.setItem('k', '{rotto');
    expect(readJSON('k', 7)).toBe(7);
  });

  it('does not break when the browser keeps nothing (private mode)', () => {
    const storage = Object.getPrototypeOf(localStorage) as Storage;
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    vi.spyOn(storage, 'removeItem').mockImplementation(() => {
      throw new Error('quota');
    });
    vi.spyOn(storage, 'getItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => writeJSON('k', 1)).not.toThrow();
    expect(() => forgetJSON('k')).not.toThrow();
    expect(readJSON('k', 'nulla')).toBe('nulla');
  });
});

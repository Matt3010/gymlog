import { afterEach, describe, expect, it, vi } from 'vitest';
import { nav } from './nav.svelte';
import { toast } from './toast.svelte';

/**
 * A link in the page, clicked the way a finger or a mouse does. Whether the
 * app took it is read after the app's listener; then the click is stopped,
 * since jsdom cannot open another document.
 */
function click(href: string, init: MouseEventInit = {}): { defaultPrevented: boolean } {
  const link = document.createElement('a');
  link.href = href;
  document.body.append(link);
  let taken = false;
  const after = (event: Event) => {
    taken = event.defaultPrevented;
    event.preventDefault();
  };
  window.addEventListener('click', after);
  link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init }));
  window.removeEventListener('click', after);
  link.remove();
  return { defaultPrevented: taken };
}

describe('a link of the app', () => {
  it('changes page without reloading, and leaves a step back', () => {
    const before = history.length;
    const event = click('/plans');
    expect(event.defaultPrevented).toBe(true);
    expect(nav.path).toBe('/plans');
    expect(window.location.pathname).toBe('/plans');
    expect(nav.route).toEqual({ kind: 'plans' });
    expect(history.length).toBe(before + 1);
  });

  it('is written the good way in the address bar', () => {
    click('/plans/');
    expect(window.location.pathname).toBe('/plans');
  });

  it.each([
    ['ctrl', { ctrlKey: true }],
    ['cmd', { metaKey: true }],
    ['shift', { shiftKey: true }],
    ['alt', { altKey: true }],
    ['the middle button', { button: 1 }],
  ])('with %s is left to the browser', (_name, init) => {
    const event = click('/plans', init);
    expect(event.defaultPrevented).toBe(false);
    expect(nav.path).toBe('/');
  });

  it('to another site is left to the browser', () => {
    const event = click('https://example.org/plans');
    expect(event.defaultPrevented).toBe(false);
    expect(nav.path).toBe('/');
  });

  it('takes away a message about the page being left', () => {
    toast.show('Scheda salvata.');
    click('/workouts/3');
    expect(nav.path).toBe('/workouts/3');
    expect(toast.open).toBe(false);
  });

  it('to the page already open changes nothing, the message included', () => {
    toast.show('Scheda salvata.');
    click('/');
    expect(toast.open).toBe(true);
  });
});

describe('going back', () => {
  it('follows the address, and takes away the message', () => {
    nav.go('/history');
    toast.show('Allenamento eliminato.');
    history.replaceState({}, '', '/exercises');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(nav.path).toBe('/exercises');
    expect(toast.open).toBe(false);
  });
});

describe('a page sending you on', () => {
  it('keeps the message it has just shown', () => {
    toast.show('Scheda eliminata.');
    nav.go('/plans', { replace: true });
    expect(nav.path).toBe('/plans');
    expect(toast.open).toBe(true);
  });

  it('may leave no step back', () => {
    const before = history.length;
    nav.go('/plans', { replace: true });
    expect(history.length).toBe(before);
  });
});

describe('a guard over leaving', () => {
  afterEach(() => nav.custodisci(() => false));

  it('is asked before going, and can hold the page', () => {
    const guard = vi.fn(() => true);
    nav.custodisci(guard);
    click('/plans');
    expect(guard).toHaveBeenCalledOnce();
    expect(nav.path).toBe('/');
    nav.go('/history');
    expect(nav.path).toBe('/');
  });

  it('holds the back button too (and the swipe back on an iPhone): the address stays, and goes on when it says so', () => {
    nav.go('/plans/9');
    let go = () => undefined as void;
    nav.custodisci((vai) => {
      go = vai;
      return true;
    });
    // the browser has already moved the address back
    history.replaceState({}, '', '/plans');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(nav.path).toBe('/plans/9');
    expect(window.location.pathname).toBe('/plans/9');
    nav.custodisci(() => false);
    go();
    expect(nav.path).toBe('/plans');
    expect(window.location.pathname).toBe('/plans');
  });

  it('goes on when it says so', () => {
    let go = () => undefined as void;
    nav.custodisci((vai) => {
      go = vai;
      return true;
    });
    nav.go('/history');
    expect(nav.path).toBe('/');
    nav.custodisci(() => false);
    go();
    expect(nav.path).toBe('/history');
  });

  it('lets the page go when there is nothing to ask', () => {
    nav.custodisci(() => false);
    click('/exercises');
    expect(nav.path).toBe('/exercises');
  });
});

describe('problems Stryker found unchecked', () => {
  it('leaves a link for a new tab or a download to the browser', () => {
    const blank = document.createElement('a');
    blank.href = '/plans';
    blank.target = '_blank';
    const download = document.createElement('a');
    download.href = '/plans';
    download.setAttribute('download', '');
    for (const link of [blank, download]) {
      document.body.append(link);
      let taken = true;
      const after = (event: Event) => {
        taken = event.defaultPrevented;
        event.preventDefault();
      };
      window.addEventListener('click', after);
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
      window.removeEventListener('click', after);
      link.remove();
      expect(taken).toBe(false);
    }
  });

  it('is not bothered by a click on plain text', () => {
    const text = document.createTextNode('ciao');
    document.body.append(text);
    expect(() => text.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))).not.toThrow();
    text.remove();
  });

  it('opens a new page from its top', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    nav.go('/exercises');
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
    scrollTo.mockRestore();
  });

  it('keeps going in place after the guard said yes, when the going was in place', () => {
    nav.go('/plans');
    const before = history.length;
    let go = () => undefined as void;
    nav.custodisci((vai) => {
      go = vai;
      return true;
    });
    nav.go('/history', { replace: true });
    nav.custodisci(() => false);
    go();
    expect(nav.path).toBe('/history');
    expect(window.location.pathname).toBe('/history');
    expect(history.length).toBe(before);
  });

  it('writes an address of the app the right way as it opens', async () => {
    history.replaceState({}, '', '/plans/');
    vi.resetModules();
    const fresh = (await import('./nav.svelte')).nav;
    expect(fresh.path).toBe('/plans');
    expect(window.location.pathname).toBe('/plans');
    // an Italian address of before is written in English
    history.replaceState({}, '', '/schede/9');
    vi.resetModules();
    expect((await import('./nav.svelte')).nav.path).toBe('/plans/9');
    expect(window.location.pathname).toBe('/plans/9');
    // an address already right is left as it is
    history.replaceState({}, '', '/history');
    vi.resetModules();
    const replaced = vi.spyOn(history, 'replaceState');
    expect((await import('./nav.svelte')).nav.path).toBe('/history');
    expect(replaced).not.toHaveBeenCalled();
    replaced.mockRestore();
  });
});

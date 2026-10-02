import { describe, expect, it, vi } from 'vitest';
import { keepUpToDate } from './update';

/** A service worker container and a page, as small as needed. */
function world(controlled: boolean, update = vi.fn(() => Promise.resolve())) {
  const sw = new EventTarget() as EventTarget & { controller: object | null; ready: Promise<{ update: () => Promise<void> }> };
  sw.controller = controlled ? {} : null;
  sw.ready = Promise.resolve({ update });
  const page = new EventTarget() as EventTarget & { visibilityState: string };
  page.visibilityState = 'visible';
  const show = (state: 'visible' | 'hidden') => {
    page.visibilityState = state;
    page.dispatchEvent(new Event('visibilitychange'));
  };
  return { sw, page, update, show };
}

describe('the app kept open in the background', () => {
  it('looks for a new version each time it comes back to the front', async () => {
    const { sw, page, update, show } = world(true);
    keepUpToDate(sw as never, page as never, vi.fn());
    show('hidden');
    show('visible');
    await Promise.resolve();
    expect(update).toHaveBeenCalledOnce();
  });

  it('takes a new version on going to the background, never under the eyes', () => {
    const { sw, page, show } = world(true);
    const reload = vi.fn();
    keepUpToDate(sw as never, page as never, reload);
    sw.dispatchEvent(new Event('controllerchange'));
    expect(reload).not.toHaveBeenCalled();
    show('hidden');
    expect(reload).toHaveBeenCalledOnce();
  });

  it('does not reload for the very first install: that page is already the new one', () => {
    const { sw, page, show } = world(false);
    const reload = vi.fn();
    keepUpToDate(sw as never, page as never, reload);
    sw.dispatchEvent(new Event('controllerchange'));
    show('hidden');
    expect(reload).not.toHaveBeenCalled();
  });

  it('after the very first install, takes the next new version as any other', () => {
    const { sw, page, show } = world(false);
    const reload = vi.fn();
    keepUpToDate(sw as never, page as never, reload);
    sw.dispatchEvent(new Event('controllerchange'));
    sw.dispatchEvent(new Event('controllerchange'));
    show('hidden');
    expect(reload).toHaveBeenCalledOnce();
  });

  it('says nothing when it cannot look, without network', async () => {
    const failed = vi.fn();
    window.addEventListener('unhandledrejection', failed);
    const { page, sw, show } = world(true, vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    keepUpToDate(sw as never, page as never, vi.fn());
    show('hidden');
    show('visible');
    await new Promise((resolve) => setTimeout(resolve, 0));
    window.removeEventListener('unhandledrejection', failed);
    expect(failed).not.toHaveBeenCalled();
  });
});

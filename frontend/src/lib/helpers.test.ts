import { afterEach, describe, expect, it, vi } from 'vitest';
import { alCentro, centra } from './centra';
import { placeAnchored, placeBeside } from './popover';
import { portal } from './portal';
import { swipeToClose } from './swipe';
import { unici } from './unici';

/* The small helpers taken from restaurant-index, with jsdom's missing geometry faked where they measure. */

/** An element whose box is this, as getBoundingClientRect says it. */
function boxed(rect: { left?: number; top: number; width?: number; height?: number }, tag = 'button'): HTMLElement {
  const element = document.createElement(tag);
  const { left = 0, top, width = 40, height = 20 } = rect;
  element.getBoundingClientRect = () => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) });
  document.body.append(element);
  return element;
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('unici', () => {
  it('keeps the first of each key, in order', () => {
    expect(unici([{ id: 1, n: 'a' }, { id: 2, n: 'b' }, { id: 1, n: 'c' }], (one) => one.id)).toEqual([{ id: 1, n: 'a' }, { id: 2, n: 'b' }]);
  });

  it('is empty for no list at all', () => {
    expect(unici(null, (one) => one)).toEqual([]);
    expect(unici(undefined, (one) => one)).toEqual([]);
  });
});

describe('centra', () => {
  it('scrolls the list so the chosen one sits in the middle', () => {
    const list = boxed({ top: 100, height: 200 }, 'div');
    Object.defineProperty(list, 'clientHeight', { value: 200 });
    list.scrollTop = 30;
    const on = boxed({ top: 400, height: 20 }, 'div');
    on.className = 'is-on';
    Object.defineProperty(on, 'offsetHeight', { value: 20 });
    list.append(on);
    centra(list);
    // 400 - 100 + 30 = 330 inside; minus (200 - 20) / 2
    expect(list.scrollTop).toBe(240);
  });

  it('leaves the list alone with nothing chosen', () => {
    const list = boxed({ top: 0 }, 'div');
    list.scrollTop = 12;
    centra(list);
    expect(list.scrollTop).toBe(12);
  });

  it('waits a frame when used on a list just opened', () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
    const list = boxed({ top: 0, height: 100 }, 'div');
    Object.defineProperty(list, 'clientHeight', { value: 100 });
    const on = boxed({ top: 300, height: 10 }, 'div');
    on.className = 'is-on';
    Object.defineProperty(on, 'offsetHeight', { value: 10 });
    list.append(on);
    alCentro(list);
    expect(list.scrollTop).toBe(0);
    frames[0]!(0);
    expect(list.scrollTop).toBe(255);
  });
});

describe('a popover', () => {
  const screenSized = (width: number, height: number) => {
    vi.stubGlobal('innerWidth', width);
    vi.stubGlobal('innerHeight', height);
  };

  it('opens under its button, centred, when there is room', () => {
    screenSized(400, 800);
    const button = boxed({ left: 100, top: 100, width: 40, height: 20 });
    // 100 + 20 - 100 = 20; below: 800 - 120 - 10 - 8
    expect(placeAnchored(button, 200, 100)).toEqual({ left: 20, top: 130, max: 662 });
  });

  it('stays inside the screen on both sides', () => {
    screenSized(400, 800);
    expect(placeAnchored(boxed({ left: 0, top: 100 }), 200, 100).left).toBe(8);
    expect(placeAnchored(boxed({ left: 390, top: 100 }), 200, 100).left).toBe(192);
    expect(placeAnchored(boxed({ left: 0, top: 100 }), 200, 100, 50).left).toBe(50);
  });

  it('opens above when there is no room below', () => {
    screenSized(400, 800);
    const button = boxed({ left: 100, top: 700, height: 20 });
    // above: 700 - 10 - 8 = 682
    expect(placeAnchored(button, 200, 300)).toEqual({ left: 20, top: 390, max: 682 });
  });

  it('takes the wider side and gets shorter when it fits nowhere', () => {
    screenSized(400, 400);
    expect(placeAnchored(boxed({ left: 100, top: 100, height: 20 }), 200, 500)).toEqual({ left: 20, top: 130, max: 262 });
    expect(placeAnchored(boxed({ left: 100, top: 300, height: 20 }), 200, 500)).toEqual({ left: 20, top: 8, max: 282 });
    expect(placeAnchored(boxed({ left: 100, top: 30, height: 340 }), 200, 500)).toEqual({ left: 20, top: 380, max: 120 });
  });

  it('opens beside the sheet its button is in, when there is room', () => {
    screenSized(1200, 800);
    const sheet = boxed({ left: 800, top: 0, width: 360, height: 800 }, 'aside');
    const button = boxed({ left: 900, top: 300 });
    sheet.append(button);
    expect(placeBeside(button, 264, 100)).toEqual({ left: 526, top: 292, max: 784 });
  });

  it('keeps beside the sheet inside the screen at the bottom', () => {
    screenSized(1200, 800);
    const sheet = boxed({ left: 800, top: 0, width: 360, height: 800 }, 'aside');
    const button = boxed({ left: 900, top: 780 });
    sheet.append(button);
    expect(placeBeside(button, 264, 100).top).toBe(692);
  });

  it('falls back under the button when the sheet leaves no room beside it', () => {
    screenSized(400, 800);
    const sheet = boxed({ left: 40, top: 0, width: 360, height: 800 }, 'aside');
    const button = boxed({ left: 100, top: 100 });
    sheet.append(button);
    expect(placeBeside(button, 264, 100)).toEqual(placeAnchored(button, 264, 100, 100));
  });
});

describe('portal', () => {
  it('hangs the node on the body, out of any clipping, and takes it away', () => {
    const box = document.createElement('div');
    const node = document.createElement('p');
    box.append(node);
    const action = portal(node);
    expect(node.parentElement).toBe(document.body);
    action.destroy();
    expect(node.isConnected).toBe(false);
  });
});

describe('swiping a sheet away', () => {
  const narrow = (matches: boolean) =>
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: matches && query === '(max-width: 600px)', media: query }) as MediaQueryList);

  function sheet() {
    const node = document.createElement('div');
    const body = document.createElement('div');
    const button = document.createElement('button');
    body.append(button);
    node.append(body);
    document.body.append(node);
    node.setPointerCapture = vi.fn();
    const onClose = vi.fn();
    const action = swipeToClose(node, onClose);
    const pointer = (type: string, target: HTMLElement, clientY: number, button = 0) =>
      target.dispatchEvent(Object.assign(new MouseEvent(type, { bubbles: true, clientY, button }), { pointerId: 1 }));
    return { node, body, button, onClose, action, pointer };
  }

  it('closes it when pulled down far enough on a phone', () => {
    narrow(true);
    const { node, body, onClose, pointer } = sheet();
    pointer('pointerdown', body, 100);
    pointer('pointermove', body, 160);
    expect(node.style.transform).toBe('translateY(60px)');
    expect(node.setPointerCapture).toHaveBeenCalledWith(1);
    pointer('pointermove', body, 200);
    pointer('pointerup', body, 200);
    expect(onClose).toHaveBeenCalledOnce();
    expect(node.style.transform).toBe('');
  });

  it('springs back when pulled only a little', () => {
    narrow(true);
    vi.useFakeTimers();
    const { node, body, onClose, pointer } = sheet();
    pointer('pointerdown', body, 100);
    pointer('pointermove', body, 150);
    pointer('pointercancel', body, 150);
    expect(onClose).not.toHaveBeenCalled();
    expect(node.style.transition).toContain('transform 0.22s');
    vi.advanceTimersByTime(240);
    expect(node.style.transition).toBe('');
    vi.useRealTimers();
  });

  it('never moves upwards, and does not capture a tiny jitter', () => {
    narrow(true);
    const { node, body, pointer } = sheet();
    pointer('pointerdown', body, 100);
    pointer('pointermove', body, 60);
    expect(node.style.transform).toBe('translateY(0px)');
    pointer('pointermove', body, 104);
    expect(node.setPointerCapture).not.toHaveBeenCalled();
  });

  it('is not a gesture on a wide screen, with another button, from a control, or with content scrolled', () => {
    for (const [wide, start, button, scrolled] of [[true, 'body', 0, false], [false, 'body', 2, false], [false, 'button', 0, false], [false, 'body', 0, true]] as const) {
      narrow(!wide);
      const s = sheet();
      if (scrolled) s.body.scrollTop = 20;
      s.pointer('pointerdown', start === 'body' ? s.body : s.button, 100, button);
      s.pointer('pointermove', s.body, 300);
      s.pointer('pointerup', s.body, 300);
      expect(s.onClose).not.toHaveBeenCalled();
      expect(s.node.style.transform).toBe('');
      document.body.innerHTML = '';
    }
  });

  it('a lost pointer does not stop the gesture', () => {
    narrow(true);
    const { node, body, onClose, pointer } = sheet();
    node.setPointerCapture = () => {
      throw new Error('gone');
    };
    pointer('pointerdown', body, 100);
    pointer('pointermove', body, 300);
    pointer('pointerup', body, 300);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('stops listening once destroyed', () => {
    narrow(true);
    const { body, onClose, pointer, action } = sheet();
    action.destroy();
    pointer('pointerdown', body, 100);
    pointer('pointermove', body, 300);
    pointer('pointerup', body, 300);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('an up without a down does nothing', () => {
    narrow(true);
    const { body, onClose, pointer } = sheet();
    pointer('pointerup', body, 300);
    expect(onClose).not.toHaveBeenCalled();
  });
});

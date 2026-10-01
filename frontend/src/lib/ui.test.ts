import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Probe from '../test/Probe.svelte';
import { ui, type ModalRequest } from './ui.svelte';

/* The stack of windows and the questions attached to a button, without drawing them. */

const window_ = (title: string, change: Partial<ModalRequest> = {}): ModalRequest => ({ title, view: Probe, props: { text: title }, ...change });

/** A shell for a window, as Modal.svelte registers it, with its close button inside. */
function shell(request: ModalRequest): HTMLElement {
  const box = document.createElement('div');
  const close = document.createElement('button');
  close.dataset.chiudi = '';
  box.append(close);
  document.body.append(box);
  ui.registra(request, box);
  return box;
}

const press = (target: Element) => target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));

afterEach(() => {
  ui.closeAll();
  ui.sure = null;
  ui.pick = null;
  document.body.innerHTML = '';
});

describe('windows', () => {
  it('a new one from outside takes the place of those open, which close as if closed', () => {
    const first = window_('Prima', { onclose: vi.fn() });
    const second = window_('Seconda', { onclose: vi.fn() });
    ui.openModal(first);
    press(document.body);
    ui.openModal(second);
    expect(ui.modals).toEqual([second]);
    expect(ui.modal).toBe(second);
    expect(first.onclose).toHaveBeenCalledOnce();
    expect(second.onclose).not.toHaveBeenCalled();
  });

  it('opened from inside the one in front lies over it, and closing it goes back to it', () => {
    const under = window_('Sotto');
    ui.openModal(under);
    const box = shell(under);
    const button = document.createElement('button');
    box.append(button);
    press(button);
    const over = window_('Sopra');
    ui.openModal(over);
    expect(ui.modals).toEqual([under, over]);
    ui.closeModal();
    expect(ui.modals).toEqual([under]);
  });

  it('can be told to lie over, or to take the place', () => {
    const a = window_('A');
    ui.openModal(a);
    ui.openModal(window_('B', { sopra: true }));
    expect(ui.modals).toHaveLength(2);
    ui.openModal(window_('C', { sopra: false }));
    expect(ui.modals.map((one) => one.title)).toEqual(['C']);
  });

  it('closing one closes those over it too, the top first', () => {
    const order: string[] = [];
    const a = window_('A', { onclose: () => order.push('A') });
    const b = window_('B', { sopra: true, onclose: () => order.push('B') });
    const c = window_('C', { sopra: true, onclose: () => order.push('C') });
    ui.openModal(a);
    ui.openModal(b);
    ui.openModal(c);
    ui.closeModal(b);
    expect(ui.modals).toEqual([a]);
    expect(order).toEqual(['C', 'B']);
    ui.closeModal(b);
    expect(ui.modals).toEqual([a]);
  });

  it('closing gives the focus back to the button that opened it', async () => {
    const button = document.createElement('button');
    document.body.append(button);
    button.focus();
    const request = window_('Prova');
    ui.openModal(request);
    shell(request).querySelector('button')!.focus();
    ui.closeModal(request);
    await tick();
    await Promise.resolve();
    expect(document.activeElement).toBe(button);
  });

  it('closing gives the focus to the window that comes back in front, when the button is gone', async () => {
    const under = window_('Sotto');
    ui.openModal(under);
    const box = shell(under);
    box.tabIndex = -1;
    const inside = document.createElement('button');
    box.append(inside);
    press(inside);
    const over = window_('Sopra');
    ui.openModal(over);
    inside.remove();
    ui.closeModal(over);
    await tick();
    await Promise.resolve();
    expect(document.activeElement).toBe(box);
  });

  it('all go when the page changes, with what floats over them', () => {
    const chiudi = vi.fn();
    ui.sopra(chiudi);
    ui.askSure(document.body, { title: 'Sicuro?', verb: 'Sì', onYes: () => undefined });
    ui.openModal(window_('A'));
    ui.closeAll();
    expect(ui.modals).toEqual([]);
    expect(ui.sure).toBeNull();
    expect(chiudi).toHaveBeenCalledOnce();
  });
});

describe('something not saved', () => {
  it('is asked about before a window closes from its cross, and Butta closes it', () => {
    const request = window_('Scheda');
    ui.openModal(request);
    const box = shell(request);
    ui.segnaModifiche(request, () => true);
    expect(ui.conModifiche).toBe(true);
    ui.lascia();
    expect(ui.modals).toEqual([request]);
    expect(ui.sure).toMatchObject({ title: 'Buttare le modifiche?', verb: 'Butta', no: 'Continua a scrivere', anchor: box.querySelector('[data-chiudi]') });
    expect(ui.inDubbio).toBe(true);
    ui.sure!.onYes();
    expect(ui.modals).toEqual([]);
  });

  it('«Continua a scrivere» goes back to the field you were in', () => {
    const request = window_('Scheda');
    ui.openModal(request);
    const box = shell(request);
    const field = document.createElement('input');
    box.append(field);
    field.focus();
    ui.segnaModifiche(request, () => true);
    ui.lascia();
    box.querySelector<HTMLButtonElement>('[data-chiudi]')!.focus();
    ui.sure!.onNo!();
    expect(document.activeElement).toBe(field);
  });

  it('Esc on the question goes back to the field too', () => {
    const request = window_('Scheda');
    ui.openModal(request);
    const box = shell(request);
    const field = document.createElement('input');
    box.append(field);
    field.focus();
    ui.segnaModifiche(request, () => true);
    ui.lascia();
    box.querySelector<HTMLButtonElement>('[data-chiudi]')!.focus();
    expect(ui.escape()).toBe(true);
    expect(ui.sure).toBeNull();
    expect(document.activeElement).toBe(field);
  });

  it('is not asked about again once thrown away', () => {
    const request = window_('Scheda');
    ui.openModal(request);
    shell(request);
    ui.segnaModifiche(request, () => true);
    ui.chiediPrima([request], () => undefined);
    ui.sure!.onYes();
    expect(ui.chiediPrima([request], () => undefined)).toBe(false);
  });

  it('stops counting once the field is gone', () => {
    const request = window_('Scheda');
    ui.openModal(request);
    shell(request);
    const stop = ui.segnaModifiche(request, () => true);
    stop();
    expect(ui.conModifiche).toBe(false);
    ui.lascia();
    expect(ui.modals).toEqual([]);
  });

  it('a field halfway through going away has nothing to say', () => {
    const request = window_('Scheda');
    ui.openModal(request);
    shell(request);
    ui.segnaModifiche(request, () => {
      throw new Error('gone');
    });
    expect(ui.conModifiche).toBe(false);
  });

  it('is asked about before another window takes its place', () => {
    const request = window_('Scheda');
    ui.openModal(request);
    shell(request);
    ui.segnaModifiche(request, () => true);
    press(document.body);
    const next = window_('Altra');
    ui.openModal(next);
    expect(ui.modals).toEqual([request]);
    ui.sure!.onYes();
    expect(ui.modals).toEqual([next]);
  });

  it('cannot be asked about with no window drawn', () => {
    const request = window_('Scheda');
    ui.openModal(request);
    ui.segnaModifiche(request, () => true);
    expect(ui.chiediPrima([request], () => undefined)).toBe(false);
  });

  it('stops the browser leaving the page, only when there is some', () => {
    const quiet = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(quiet);
    expect(quiet.defaultPrevented).toBe(false);
    const request = window_('Scheda');
    ui.openModal(request);
    ui.segnaModifiche(request, () => true);
    const leaving = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(leaving);
    expect(leaving.defaultPrevented).toBe(true);
  });
});

describe('questions and choices', () => {
  it('one at a time: a question closes a choice and the other way round', () => {
    const anchor = document.createElement('button');
    ui.askPick(anchor, { title: 'Ordina', options: [], onPick: () => undefined });
    ui.askSure(anchor, { title: 'Sicuro?', verb: 'Sì', onYes: () => undefined });
    expect([ui.pick, ui.sure?.title]).toEqual([null, 'Sicuro?']);
    ui.askPick(anchor, { title: 'Ordina', options: [], onPick: () => undefined });
    expect([ui.sure, ui.pick?.title]).toEqual([null, 'Ordina']);
  });

  it('attached to a window go when it closes, the others stay', () => {
    const request = window_('A');
    ui.openModal(request);
    const box = shell(request);
    const inside = document.createElement('button');
    box.append(inside);
    ui.askSure(inside, { title: 'Sicuro?', verb: 'Sì', onYes: () => undefined });
    ui.closeModal(request);
    expect(ui.sure).toBeNull();
    const request2 = window_('B');
    ui.openModal(request2);
    shell(request2);
    ui.askPick(document.body, { title: 'Fuori', options: [], onPick: () => undefined });
    ui.closeModal(request2);
    expect(ui.pick?.title).toBe('Fuori');
  });

  it('a choice taken from a sheet counts as the button that opened it', () => {
    const under = window_('Sotto');
    ui.openModal(under);
    const box = shell(under);
    const anchor = document.createElement('button');
    box.append(anchor);
    ui.askPick(anchor, { title: 'Scegli', options: [], onPick: () => undefined });
    const sheet = document.createElement('div');
    sheet.dataset.pop = '';
    const option = document.createElement('button');
    sheet.append(option);
    document.body.append(sheet);
    press(option);
    ui.openModal(window_('Sopra'));
    expect(ui.modals).toHaveLength(2);
  });
});

describe('Esc', () => {
  it('takes away one layer at a time, the top first', () => {
    const request = window_('A');
    ui.openModal(request);
    const chiudi = vi.fn();
    ui.sopra(chiudi);
    ui.askPick(document.body, { title: 'Scegli', options: [], onPick: () => undefined });
    ui.askSure(document.body, { title: 'Sicuro?', verb: 'Sì', onYes: () => undefined });
    expect(ui.escape()).toBe(true);
    expect(chiudi).toHaveBeenCalledOnce();
    expect(ui.escape()).toBe(true);
    expect(ui.sure).toBeNull();
    ui.askPick(document.body, { title: 'Scegli', options: [], onPick: () => undefined });
    expect(ui.escape()).toBe(true);
    expect(ui.pick).toBeNull();
    expect(ui.escape()).toBe(true);
    expect(ui.modals).toEqual([]);
    expect(ui.escape()).toBe(false);
  });

  it('forgets what floated over once it closed by itself', () => {
    const chiudi = vi.fn();
    const smetti = ui.sopra(chiudi);
    smetti();
    smetti();
    expect(ui.escape()).toBe(false);
    expect(chiudi).not.toHaveBeenCalled();
  });
});

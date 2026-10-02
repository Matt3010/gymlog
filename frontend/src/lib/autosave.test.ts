import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Autosave, settled } from './autosave.svelte';

/* Saving as you go: after a pause, one at a time, the latest wins, nothing left behind. */

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** A save that waits until told, to see what happens while one is on its way. */
function server() {
  const sent: string[] = [];
  const answers: { ok: () => void; fail: (message: string) => void }[] = [];
  const save = vi.fn(
    (value: string) =>
      new Promise<void>((resolve, reject) => {
        sent.push(value);
        answers.push({ ok: resolve, fail: (message) => reject(new Error(message)) });
      }),
  );
  return { sent, save, answer: (at = 0) => answers[at]! };
}

describe('saving as you go', () => {
  it('waits for a pause, then sends only the last value', async () => {
    const { sent, save, answer } = server();
    const auto = new Autosave(save, 600);
    auto.change('a');
    vi.advanceTimersByTime(300);
    auto.change('ab');
    vi.advanceTimersByTime(599);
    expect(sent).toEqual([]);
    expect(auto.status).toBe('idle');
    vi.advanceTimersByTime(1);
    expect(sent).toEqual(['ab']);
    expect(auto.status).toBe('saving');
    answer().ok();
    await vi.runAllTimersAsync();
    expect(auto.status).toBe('saved');
  });

  it('sends one at a time, and after the one on its way only the latest', async () => {
    const { sent, save, answer } = server();
    const auto = new Autosave(save, 600);
    auto.change('1');
    vi.advanceTimersByTime(600);
    auto.change('2');
    vi.advanceTimersByTime(600);
    auto.change('3');
    vi.advanceTimersByTime(600);
    expect(sent).toEqual(['1']);
    answer(0).ok();
    await vi.advanceTimersByTimeAsync(0);
    expect(sent).toEqual(['1', '3']);
    expect(auto.status).toBe('saving');
    answer(1).ok();
    await vi.advanceTimersByTimeAsync(0);
    expect(auto.status).toBe('saved');
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('sends at once what is waiting when flushed, and waits for it', async () => {
    const { sent, save, answer } = server();
    const auto = new Autosave(save, 600);
    auto.change('x');
    const done = auto.flush();
    expect(sent).toEqual(['x']);
    let finished = false;
    void done.then(() => (finished = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(finished).toBe(false);
    answer().ok();
    await vi.advanceTimersByTimeAsync(0);
    expect(finished).toBe(true);
    vi.advanceTimersByTime(600);
    expect(sent).toEqual(['x']);
  });

  it('has nothing to send when flushed with nothing changed', async () => {
    const { save } = server();
    const auto = new Autosave(save, 600);
    await auto.flush();
    expect(save).not.toHaveBeenCalled();
    expect(auto.status).toBe('idle');
  });

  it('says why when refused, keeps it so, and tries again with the next change', async () => {
    const { sent, save, answer } = server();
    const auto = new Autosave(save, 600);
    auto.change('a');
    vi.advanceTimersByTime(600);
    answer(0).fail('Il server si è inceppato.');
    await vi.advanceTimersByTimeAsync(0);
    expect([auto.status, auto.error]).toEqual(['error', 'Il server si è inceppato.']);
    vi.advanceTimersByTime(5000);
    expect(sent).toEqual(['a']);
    auto.change('ab');
    vi.advanceTimersByTime(600);
    expect(sent).toEqual(['a', 'ab']);
    expect(auto.status).toBe('saving');
    answer(1).ok();
    await vi.advanceTimersByTimeAsync(0);
    expect([auto.status, auto.error]).toEqual(['saved', '']);
  });

  it('says a refusal of something that is not an error too', async () => {
    const auto = new Autosave(() => Promise.reject('rete'), 0);
    auto.change(1);
    await auto.flush();
    expect(auto.error).toBe('rete');
  });

  it('a newer change while one is refused is still sent', async () => {
    const { sent, save, answer } = server();
    const auto = new Autosave(save, 600);
    auto.change('a');
    vi.advanceTimersByTime(600);
    auto.change('b');
    answer(0).fail('no');
    await vi.advanceTimersByTimeAsync(0);
    expect(sent).toEqual(['a', 'b']);
    answer(1).ok();
    await vi.advanceTimersByTimeAsync(0);
    expect(auto.status).toBe('saved');
  });
});

describe('a read after a save', () => {
  it('waits for every save on its way, and for nothing when none is', async () => {
    const { save, answer } = server();
    const one = new Autosave(save, 0);
    const two = new Autosave(save, 0);
    let read = false;
    await settled();
    one.change('a');
    two.change('b');
    void one.flush();
    void two.flush();
    void settled().then(() => (read = true));
    answer(0).ok();
    await vi.advanceTimersByTimeAsync(0);
    expect(read).toBe(false);
    answer(1).ok();
    await vi.advanceTimersByTimeAsync(0);
    expect(read).toBe(true);
  });

  it('is not held back by a refused save', async () => {
    const { save, answer } = server();
    const one = new Autosave(save, 0);
    one.change('a');
    void one.flush();
    const read = settled();
    answer(0).fail('no');
    await expect(read).resolves.toBeUndefined();
  });
});

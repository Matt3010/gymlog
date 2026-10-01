import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RestTimer } from './rest-timer.svelte';

beforeEach(() => vi.useFakeTimers({ now: new Date('2026-10-01T17:00:00Z') }));
afterEach(() => vi.useRealTimers());

describe('the rest timer', () => {
  it('is still until started', () => {
    const timer = new RestTimer();
    expect([timer.running, timer.remaining, timer.total]).toEqual([false, 0, 0]);
  });

  it('counts down the seconds of the rest', () => {
    const timer = new RestTimer();
    timer.start(90);
    expect([timer.running, timer.remaining, timer.total]).toEqual([true, 90, 90]);
    vi.advanceTimersByTime(30_000);
    expect(timer.remaining).toBe(60);
    vi.advanceTimersByTime(500);
    // a second begun is a second still to wait
    expect(timer.remaining).toBe(60);
  });

  it('stops at zero, and says so once', () => {
    const done = vi.fn();
    const timer = new RestTimer(done);
    timer.start(10);
    vi.advanceTimersByTime(10_000);
    expect([timer.running, timer.remaining]).toEqual([false, 0]);
    vi.advanceTimersByTime(10_000);
    expect(done).toHaveBeenCalledOnce();
  });

  it('follows the clock, not the ticks: a phone asleep for a minute is a minute later', () => {
    const timer = new RestTimer();
    timer.start(90);
    vi.setSystemTime(new Date('2026-10-01T17:01:00Z'));
    vi.advanceTimersByTime(250);
    expect(timer.remaining).toBe(30);
  });

  it('starts again from the top when started again', () => {
    const timer = new RestTimer();
    timer.start(90);
    vi.advanceTimersByTime(80_000);
    timer.start(60);
    expect([timer.remaining, timer.total]).toEqual([60, 60]);
  });

  it('gives or takes seconds while running', () => {
    const timer = new RestTimer();
    timer.start(60);
    timer.add(15);
    expect([timer.remaining, timer.total]).toEqual([75, 75]);
    timer.add(-100);
    expect([timer.running, timer.remaining]).toEqual([false, 0]);
  });

  it('stops when asked, without saying it is done', () => {
    const done = vi.fn();
    const timer = new RestTimer(done);
    timer.start(60);
    timer.stop();
    vi.advanceTimersByTime(70_000);
    expect([timer.running, timer.remaining]).toEqual([false, 0]);
    expect(done).not.toHaveBeenCalled();
  });

  it('does not start with no rest', () => {
    const timer = new RestTimer();
    timer.start(0);
    expect(timer.running).toBe(false);
  });
});

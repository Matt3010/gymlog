import { describe, expect, it } from 'vitest';
import { copies } from './copies';

describe('the copies of what was read', () => {
  it('are kept on the phone, by address', () => {
    copies.write('/plans', [{ id: 1 }]);
    expect(copies.read('/plans')).toEqual([{ id: 1 }]);
    expect(copies.read('/exercises')).toBeUndefined();
  });

  it('all go away on leaving, and nothing else does', () => {
    copies.write('/plans', [{ id: 1 }]);
    copies.write('/workouts/7', { id: 7 });
    localStorage.setItem('gymlog.home.plan', '3');
    copies.forgetAll();
    expect(copies.read('/plans')).toBeUndefined();
    expect(copies.read('/workouts/7')).toBeUndefined();
    expect(localStorage.getItem('gymlog.home.plan')).toBe('3');
  });

  it('are only the latest 80, so the phone does not fill up over months: the oldest written go first', () => {
    for (let i = 0; i < 85; i++) copies.write(`/workouts/${i}`, { id: i });
    // one read again recently is written again, so it is kept
    copies.write('/workouts/2', { id: 2 });
    expect(copies.read('/workouts/0')).toBeUndefined();
    expect(copies.read('/workouts/1')).toBeUndefined();
    expect(copies.read('/workouts/2')).toEqual({ id: 2 });
    expect(copies.read('/workouts/84')).toEqual({ id: 84 });
    expect(Object.keys(localStorage).filter((key) => key.startsWith('gymlog.copy:'))).toHaveLength(80);
  });
});

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
});

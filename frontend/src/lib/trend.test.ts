import { describe, expect, it } from 'vitest';
import { estimatedMax, trendOf } from './trend';

describe('the estimated max', () => {
  it('is the weight itself for a single', () => {
    expect(estimatedMax({ reps: 1, weightKg: 100 })).toBe(100);
  });

  it('grows with the reps (Epley), to the hundredth', () => {
    expect(estimatedMax({ reps: 10, weightKg: 60 })).toBe(80);
    expect(estimatedMax({ reps: 8, weightKg: 62.5 })).toBe(79.17);
  });
});

describe('the trend of a set against one before', () => {
  it('is up with more kilos at the same reps, or more reps at the same kilos', () => {
    expect(trendOf({ reps: 8, weightKg: 62.5 }, { reps: 8, weightKg: 60 })).toBe('up');
    expect(trendOf({ reps: 9, weightKg: 60 }, { reps: 8, weightKg: 60 })).toBe('up');
  });

  it('is down with less of either', () => {
    expect(trendOf({ reps: 8, weightKg: 57.5 }, { reps: 8, weightKg: 60 })).toBe('down');
    expect(trendOf({ reps: 7, weightKg: 60 }, { reps: 8, weightKg: 60 })).toBe('down');
  });

  it('weighs kilos and reps together: a heavier set with fewer reps can still be better', () => {
    expect(trendOf({ reps: 9, weightKg: 60 }, { reps: 10, weightKg: 57.5 })).toBe('up');
    expect(trendOf({ reps: 6, weightKg: 62.5 }, { reps: 10, weightKg: 60 })).toBe('down');
  });

  it('is the same when the estimated max is', () => {
    expect(trendOf({ reps: 8, weightKg: 60 }, { reps: 8, weightKg: 60 })).toBe('same');
  });

  it('is nothing without one before', () => {
    expect(trendOf({ reps: 8, weightKg: 60 }, undefined)).toBeUndefined();
  });

  it('takes plain numbers too, like the estimated max of two sessions', () => {
    expect(trendOf(80, 79.17)).toBe('up');
    expect(trendOf(79.17, 80)).toBe('down');
    expect(trendOf(80, 80)).toBe('same');
  });
});

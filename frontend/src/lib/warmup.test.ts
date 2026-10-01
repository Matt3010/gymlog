import { describe, expect, it } from 'vitest';
import { warmupFor } from './warmup';

describe('the warm-up before the working sets', () => {
  it('ramps up from the working weight: 40% × 8, 60% × 5, 80% × 3', () => {
    expect(warmupFor(60)).toEqual([
      { reps: 8, weightKg: 22.5 },
      { reps: 5, weightKg: 35 },
      { reps: 3, weightKg: 47.5 },
    ]);
  });

  it('adds a single at 90% from 100 kg on: near a heavy weight the jumps get smaller', () => {
    expect(warmupFor(100)).toEqual([
      { reps: 8, weightKg: 40 },
      { reps: 5, weightKg: 60 },
      { reps: 3, weightKg: 80 },
      { reps: 1, weightKg: 90 },
    ]);
    expect(warmupFor(97.5)).toHaveLength(3);
  });

  it('rounds down to 2,5 kg, what plates and dumbbells allow', () => {
    expect(warmupFor(42.5).map((set) => set.weightKg)).toEqual([15, 25, 32.5]);
  });

  it('drops a step that comes out empty or the same as the one before', () => {
    expect(warmupFor(12.5)).toEqual([
      { reps: 8, weightKg: 5 },
      { reps: 5, weightKg: 7.5 },
      { reps: 3, weightKg: 10 },
    ]);
    expect(warmupFor(5)).toEqual([{ reps: 5, weightKg: 2.5 }]);
    expect(warmupFor(2.5)).toEqual([]);
  });

  it('is nothing without a working weight', () => {
    expect(warmupFor(null)).toEqual([]);
    expect(warmupFor(0)).toEqual([]);
  });
});

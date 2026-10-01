import { describe, expect, it } from 'vitest';
import type { PlanExercise, WorkoutDetail, WorkoutSet, WorkoutSummary } from './types';
import { blocksOf, describeSets, describeTarget, inProgress, prefill, readSet, targetReps } from './workout';

const target = (exerciseId: number, exerciseName: string, extra: Partial<PlanExercise> = {}): PlanExercise => ({
  id: exerciseId * 10, exerciseId, exerciseName, position: 0, reps: ['8-10', '8-10', '8-10'], restSeconds: 90, notes: null, ...extra,
});

let nextSet = 1;
const set = (exerciseId: number, exerciseName: string, reps: number, weightKg: number): WorkoutSet => ({
  id: nextSet++, exerciseId, exerciseName, reps, weightKg, createdAt: '2026-10-01T17:00:00.000Z',
});

const detail = (extra: Partial<WorkoutDetail> = {}): WorkoutDetail => ({
  id: 1, planDayId: 5, planName: 'Forza', dayName: 'A', startedAt: '2026-10-01T17:00:00.000Z', finishedAt: null, notes: null,
  plan: [], sets: [], previous: {}, exerciseNotes: {}, previousNote: null, ...extra,
});

describe('the blocks of a workout', () => {
  it('follow the plan day, each with its target, its sets and the last time', () => {
    const squat = target(1, 'Squat');
    const bench = target(2, 'Panca', { reps: ['10', '10', '8', '6'] });
    const done = [set(1, 'Squat', 8, 100), set(2, 'Panca', 10, 60), set(1, 'Squat', 8, 102.5)];
    const previous = { '1': { workoutId: 9, startedAt: '2026-09-28T17:00:00.000Z', sets: [{ reps: 8, weightKg: 97.5 }], note: null } };
    const blocks = blocksOf(detail({ plan: [squat, bench], sets: done, previous }));
    expect(blocks).toEqual([
      { exerciseId: 1, name: 'Squat', target: squat, sets: [done[0], done[2]], previous: previous['1'] },
      { exerciseId: 2, name: 'Panca', target: bench, sets: [done[1]], previous: null },
    ]);
  });

  it('add the exercises done outside the plan, in the order they were first logged', () => {
    const blocks = blocksOf(detail({
      plan: [target(1, 'Squat')],
      sets: [set(3, 'Curl', 12, 15), set(4, 'Crunch', 20, 0), set(3, 'Curl', 10, 15)],
    }));
    expect(blocks.map((block) => [block.name, block.target === null, block.sets.length])).toEqual([
      ['Squat', false, 0], ['Curl', true, 2], ['Crunch', true, 1],
    ]);
  });

  it('add the exercises just added, with no sets yet, at the end', () => {
    const blocks = blocksOf(detail({ plan: [target(1, 'Squat')] }), [{ id: 7, name: 'Plank' }, { id: 1, name: 'Squat' }]);
    expect(blocks.map((block) => block.name)).toEqual(['Squat', 'Plank']);
  });

  it('show an exercise once, even when the plan names it twice', () => {
    const blocks = blocksOf(detail({ plan: [target(1, 'Squat'), target(1, 'Squat', { id: 99 })], sets: [set(1, 'Squat', 5, 100)] }));
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.sets).toHaveLength(1);
  });

  it('carry the last time for exercises outside the plan too', () => {
    const previous = { '3': { workoutId: 9, startedAt: '2026-09-28T17:00:00.000Z', sets: [{ reps: 12, weightKg: 14 }], note: null } };
    const blocks = blocksOf(detail({ sets: [set(3, 'Curl', 12, 15)], previous }));
    expect(blocks[0]!.previous).toEqual(previous['3']);
  });
});

describe('the reps a plan asks for', () => {
  it('are the first number written', () => {
    expect(targetReps('8')).toBe(8);
    expect(targetReps('8-10')).toBe(8);
    expect(targetReps(' 12 per lato')).toBe(12);
  });

  it('are nothing when no number is written', () => {
    expect(targetReps('max')).toBeNull();
    expect(targetReps('')).toBeNull();
  });
});

describe('the next set, proposed', () => {
  const block = { exerciseId: 1, name: 'Squat', target: target(1, 'Squat', { reps: ['12', '10', '8-9', 'max'] }), sets: [] as WorkoutSet[], previous: null };
  const previous = { workoutId: 9, startedAt: '2026-09-28T17:00:00.000Z', sets: [{ reps: 8, weightKg: 95 }, { reps: 6, weightKg: 100 }], note: null };

  it('takes the reps the plan asks for that set, and the weight of the last set', () => {
    expect(prefill(block)).toEqual({ reps: 12, weightKg: null });
    expect(prefill({ ...block, sets: [set(1, 'Squat', 12, 100)] })).toEqual({ reps: 10, weightKg: 100 });
    expect(prefill({ ...block, sets: [set(1, 'Squat', 12, 100), set(1, 'Squat', 10, 105)] })).toEqual({ reps: 8, weightKg: 105 });
  });

  it('takes the weight of last time before a set is done today', () => {
    expect(prefill({ ...block, previous })).toEqual({ reps: 12, weightKg: 95 });
  });

  it('repeats the last set when the plan says no number for that one', () => {
    const three = [set(1, 'Squat', 12, 100), set(1, 'Squat', 10, 100), set(1, 'Squat', 9, 102.5)];
    expect(prefill({ ...block, sets: three })).toEqual({ reps: 9, weightKg: 102.5 });
  });

  it('repeats the last set beyond what the plan asks', () => {
    const many = [12, 10, 8, 7, 6].map((reps) => set(1, 'Squat', reps, 100));
    expect(prefill({ ...block, sets: many })).toEqual({ reps: 6, weightKg: 100 });
  });

  it('without a plan repeats today, then last time', () => {
    expect(prefill({ ...block, target: null })).toEqual({ reps: null, weightKg: null });
    expect(prefill({ ...block, target: null, previous })).toEqual({ reps: 8, weightKg: 95 });
    expect(prefill({ ...block, target: null, previous, sets: [set(1, 'Squat', 5, 110)] })).toEqual({ reps: 5, weightKg: 110 });
  });
});

describe('what the plan asks, said', () => {
  it('is each set’s reps, then the rest', () => {
    expect(describeTarget(target(1, 'Squat', { reps: ['12', '10', '8'], restSeconds: 90 }))).toBe('12 · 10 · 8 · recupero 1:30');
  });

  it('without a rest is the reps alone, with the notes after', () => {
    expect(describeTarget(target(1, 'Squat', { reps: ['max'], restSeconds: null, notes: 'lento' }))).toBe('max · lento');
  });
});

describe('sets, in short', () => {
  it('do not group: each set as it was done', () => {
    expect(describeSets([{ reps: 8, weightKg: 60 }, { reps: 8, weightKg: 60 }, { reps: 6, weightKg: 62.5 }])).toBe('8 × 60 kg, 8 × 60 kg, 6 × 62,5 kg');
  });

  it('are written like the logged ones, one by one, in order', () => {
    expect(describeSets([{ reps: 10, weightKg: 57.5 }, { reps: 10, weightKg: 60 }, { reps: 9, weightKg: 60 }])).toBe('10 × 57,5 kg, 10 × 60 kg, 9 × 60 kg');
    expect(describeSets([])).toBe('');
  });

  it('are nothing without sets', () => {
    expect(describeSets([])).toBe('');
  });
});

describe('the workout in progress', () => {
  const summary = (id: number, finishedAt: string | null): WorkoutSummary => ({
    ...detail({ id, finishedAt }), exercises: 0, sets: 0, volume: 0,
  });

  it('is the most recent one not finished', () => {
    expect(inProgress([summary(5, null), summary(4, '2026-09-30T18:00:00Z'), summary(3, null)])?.id).toBe(5);
    expect(inProgress([summary(4, '2026-09-30T18:00:00Z'), summary(3, null)])?.id).toBe(3);
  });

  it('is none when all are finished', () => {
    expect(inProgress([summary(4, '2026-09-30T18:00:00Z')])).toBeUndefined();
    expect(inProgress([])).toBeUndefined();
  });
});

describe('a set as typed', () => {
  it('is reps and kilos, with a comma or a dot', () => {
    expect(readSet('8', '62,5')).toEqual({ reps: 8, weightKg: 62.5 });
    expect(readSet(' 1 ', '0')).toEqual({ reps: 1, weightKg: 0 });
    expect(readSet('100', '1000')).toEqual({ reps: 100, weightKg: 1000 });
  });

  it.each([['0', '10'], ['101', '10'], ['7,5', '10'], ['', '10'], ['otto', '10']])('refuses reps %j', (reps, kg) => {
    expect(readSet(reps, kg)).toEqual({ error: 'Le ripetizioni vanno da 1 a 100.' });
  });

  it.each([['8', ''], ['8', '1000,5'], ['8', '-2'], ['8', 'tanti']])('refuses kilos %j', (reps, kg) => {
    expect(readSet(reps, kg)).toEqual({ error: 'Il peso va da 0 a 1000 kg, con la virgola se serve.' });
  });

  it('refuses more than two decimals, which the server would not keep', () => {
    expect(readSet('8', '62,555')).toEqual({ error: 'Il peso ha al più due decimali.' });
  });
});

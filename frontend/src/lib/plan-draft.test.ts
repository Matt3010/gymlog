import { describe, expect, it } from 'vitest';
import { addSet, draftOf, move, problemOf, removeSet, toInput } from './plan-draft';
import type { Plan } from './types';

const plan: Plan = {
  id: 3, name: 'Forza', notes: 'tre volte',
  exercises: [
    { id: 100, exerciseId: 1, exerciseName: 'Squat', position: 0, reps: ['5', '5', '3'], restSeconds: 180, notes: null },
    { id: 101, exerciseId: 2, exerciseName: 'Panca', position: 1, reps: ['8'], restSeconds: null, notes: 'fermo' },
  ],
};

describe('a draft', () => {
  it('starts from a plan, each exercise with a key of its own', () => {
    const draft = draftOf(plan);
    expect(draft).toMatchObject({
      name: 'Forza', notes: 'tre volte',
      exercises: [
        { exerciseId: 1, exerciseName: 'Squat', reps: ['5', '5', '3'], restSeconds: 180, notes: '' },
        { exerciseId: 2, exerciseName: 'Panca', reps: ['8'], restSeconds: null, notes: 'fermo' },
      ],
    });
    const keys = draft.exercises.map((one) => one.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has empty notes when the plan has none', () => {
    expect(draftOf({ ...plan, notes: null })).toMatchObject({ notes: '' });
  });

  it('starts empty for a new plan', () => {
    expect(draftOf(null)).toEqual({ name: '', notes: '', exercises: [] });
  });

  it('becomes what the API takes, trimmed, empty notes as nothing', () => {
    const draft = draftOf(plan);
    draft.name = '  Forza 2 ';
    draft.notes = '  ';
    draft.exercises[0]!.reps[1] = ' 5-6 ';
    draft.exercises[0]!.notes = ' lento ';
    expect(toInput(draft)).toEqual({
      name: 'Forza 2', notes: null,
      exercises: [
        { exerciseId: 1, reps: ['5', '5-6', '3'], restSeconds: 180, notes: 'lento' },
        { exerciseId: 2, reps: ['8'], restSeconds: null, notes: 'fermo' },
      ],
    });
  });
});

describe('moving', () => {
  it('swaps a row with the one next to it', () => {
    expect(move(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(move(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
  });

  it('goes nowhere past the ends', () => {
    expect(move(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(move(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
  });
});

describe('what stops a draft from being saved', () => {
  it('is nothing for a good one, or one without exercises', () => {
    expect(problemOf(draftOf(plan))).toBeNull();
    expect(problemOf({ ...draftOf(plan), exercises: [] })).toBeNull();
  });

  it('is a missing name (only spaces is missing too)', () => {
    expect(problemOf({ ...draftOf(plan), name: ' ' })).toBe('La scheda ha bisogno di un nome.');
  });

  it('is a set without reps, naming which', () => {
    const draft = draftOf(plan);
    draft.exercises[0]!.reps[1] = ' ';
    expect(problemOf(draft)).toBe('La serie 2 dell’esercizio «Squat» non ha ripetizioni. Scrivi quante, anche «max».');
    draft.exercises[0]!.reps[0] = '';
    expect(problemOf(draft)).toBe('La serie 1 dell’esercizio «Squat» non ha ripetizioni. Scrivi quante, anche «max».');
  });

  it('is an exercise with no sets, or more than 20', () => {
    const draft = draftOf(plan);
    draft.exercises[1]!.reps = [];
    expect(problemOf(draft)).toBe('Le serie dell’esercizio «Panca» vanno da 1 a 20.');
    draft.exercises[1]!.reps = Array.from({ length: 21 }, () => '5');
    expect(problemOf(draft)).toBe('Le serie dell’esercizio «Panca» vanno da 1 a 20.');
    draft.exercises[1]!.reps = Array.from({ length: 20 }, () => '5');
    expect(problemOf(draft)).toBeNull();
    // one set is enough
    draft.exercises[1]!.reps = ['5'];
    expect(problemOf(draft)).toBeNull();
  });
});

describe('the sets of an exercise in a plan', () => {
  it('grow by one copying the last, up to 20', () => {
    const exercise = draftOf(plan).exercises[0]!;
    addSet(exercise);
    expect(exercise.reps).toEqual(['5', '5', '3', '3']);
    exercise.reps = Array.from({ length: 20 }, () => '5');
    addSet(exercise);
    expect(exercise.reps).toHaveLength(20);
  });

  it('start from 10 when there is none', () => {
    const exercise = { ...draftOf(plan).exercises[0]!, reps: [] };
    addSet(exercise);
    expect(exercise.reps).toEqual(['10']);
  });

  it('lose the one taken away, never the last one left', () => {
    const exercise = draftOf(plan).exercises[0]!;
    removeSet(exercise, 1);
    expect(exercise.reps).toEqual(['5', '3']);
    removeSet(exercise, 0);
    removeSet(exercise, 0);
    expect(exercise.reps).toEqual(['3']);
  });
});

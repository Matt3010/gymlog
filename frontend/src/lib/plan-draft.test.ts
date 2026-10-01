import { describe, expect, it } from 'vitest';
import { addDay, draftOf, move, problemOf, toInput, type Draft } from './plan-draft';
import type { Plan } from './types';

const plan: Plan = {
  id: 3, name: 'Forza', notes: 'tre volte', archived: false,
  days: [
    {
      id: 10, name: 'A', position: 0,
      exercises: [{ id: 100, exerciseId: 1, exerciseName: 'Squat', position: 0, sets: 5, reps: '5', restSeconds: 180, notes: null }],
    },
    { id: 11, name: 'B', position: 1, exercises: [] },
  ],
};

describe('a draft', () => {
  it('starts from a plan, each day and exercise with a key of its own', () => {
    const draft = draftOf(plan);
    expect(draft).toMatchObject({
      name: 'Forza', notes: 'tre volte', archived: false,
      days: [
        { name: 'A', exercises: [{ exerciseId: 1, exerciseName: 'Squat', sets: 5, reps: '5', restSeconds: 180, notes: '' }] },
        { name: 'B', exercises: [] },
      ],
    });
    const keys = [...draft.days.map((day) => day.key), ...draft.days.flatMap((day) => day.exercises.map((one) => one.key))];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('starts empty for a new plan, with a first day', () => {
    expect(draftOf(null)).toMatchObject({ name: '', notes: '', archived: false, days: [{ name: 'A', exercises: [] }] });
  });

  it('becomes what the API takes, trimmed, empty notes as nothing', () => {
    const draft = draftOf(plan);
    draft.name = '  Forza 2 ';
    draft.notes = '  ';
    draft.days[0]!.name = ' A ';
    draft.days[0]!.exercises[0]!.reps = ' 5-6 ';
    draft.days[0]!.exercises[0]!.notes = ' lento ';
    expect(toInput(draft)).toEqual({
      name: 'Forza 2', notes: null, archived: false,
      days: [
        { name: 'A', exercises: [{ exerciseId: 1, sets: 5, reps: '5-6', restSeconds: 180, notes: 'lento' }] },
        { name: 'B', exercises: [] },
      ],
    });
  });
});

describe('a new day', () => {
  it('takes the next free letter', () => {
    const draft = draftOf(plan);
    addDay(draft);
    expect(draft.days.map((day) => day.name)).toEqual(['A', 'B', 'C']);
  });

  it('fills a gap first', () => {
    const draft: Draft = { ...draftOf(null), days: [] };
    addDay(draft);
    draft.days[0]!.name = 'B';
    addDay(draft);
    expect(draft.days.map((day) => day.name)).toEqual(['B', 'A']);
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
  it('is nothing for a good one', () => {
    expect(problemOf(draftOf(plan))).toBeNull();
  });

  it('is a missing name, of the plan or a day', () => {
    expect(problemOf({ ...draftOf(plan), name: ' ' })).toBe('La scheda ha bisogno di un nome.');
    const draft = draftOf(plan);
    draft.days[1]!.name = '';
    expect(problemOf(draft)).toBe('Ogni giorno ha bisogno di un nome, come «A» o «Gambe».');
  });

  it('is an exercise without reps, or with sets out of range', () => {
    const draft = draftOf(plan);
    draft.days[0]!.exercises[0]!.reps = '';
    expect(problemOf(draft)).toBe('Nel giorno «A» l’esercizio «Squat» non ha ripetizioni. Scrivi quante, anche «max».');
    draft.days[0]!.exercises[0]!.reps = '5';
    draft.days[0]!.exercises[0]!.sets = 0;
    expect(problemOf(draft)).toBe('Nel giorno «A» le serie dell’esercizio «Squat» vanno da 1 a 20.');
    draft.days[0]!.exercises[0]!.sets = 21;
    expect(problemOf(draft)).toBe('Nel giorno «A» le serie dell’esercizio «Squat» vanno da 1 a 20.');
    draft.days[0]!.exercises[0]!.sets = 20;
    expect(problemOf(draft)).toBeNull();
  });
});

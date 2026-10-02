import { describe, expect, it } from 'vitest';
import { addDay, addSet, draftOf, learnDayIds, move, problemOf, removeSet, toInput, type Draft } from './plan-draft';
import type { Plan } from './types';

const plan: Plan = {
  id: 3, name: 'Forza', notes: 'tre volte', archived: false,
  days: [
    {
      id: 10, name: 'A', position: 0,
      exercises: [{ id: 100, exerciseId: 1, exerciseName: 'Squat', position: 0, reps: ['5', '5', '3'], restSeconds: 180, notes: null }],
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
        { name: 'A', exercises: [{ exerciseId: 1, exerciseName: 'Squat', reps: ['5', '5', '3'], restSeconds: 180, notes: '' }] },
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
    draft.days[0]!.exercises[0]!.reps[1] = ' 5-6 ';
    draft.days[0]!.exercises[0]!.notes = ' lento ';
    expect(toInput(draft)).toEqual({
      name: 'Forza 2', notes: null, archived: false,
      days: [
        { id: 10, name: 'A', exercises: [{ exerciseId: 1, reps: ['5', '5-6', '3'], restSeconds: 180, notes: 'lento' }] },
        { id: 11, name: 'B', exercises: [] },
      ],
    });
  });

  it('sends the id of a saved day, none for a new one', () => {
    const draft = draftOf(plan);
    addDay(draft);
    expect(toInput(draft).days.map((day) => day.id)).toEqual([10, 11, undefined]);
    expect('id' in toInput(draft).days[2]!).toBe(false);
  });
});

describe('a saved plan coming back', () => {
  it('gives its id to each new day that was sent, by its place in what was sent', () => {
    const draft = draftOf(plan);
    addDay(draft);
    const sent = [...draft.days];
    const input = toInput(draft);
    // meanwhile a day is added at the end, not sent yet
    addDay(draft);
    learnDayIds(sent, input, { ...plan, days: [...plan.days, { id: 12, name: 'C', position: 2, exercises: [] }] });
    expect(draft.days.map((day) => day.id)).toEqual([10, 11, 12, undefined]);
  });

  it('leaves alone a day that already has its id', () => {
    const draft = draftOf(plan);
    learnDayIds([...draft.days], toInput(draft), { ...plan, days: [{ ...plan.days[0]!, id: 99 }, plan.days[1]!] });
    expect(draft.days.map((day) => day.id)).toEqual([10, 11]);
  });

  it('takes the id the server gave to a day sent without one, even if it had learned another meanwhile', () => {
    const draft = draftOf(plan);
    addDay(draft);
    // a save went out before the new day's id was known…
    const input = toInput(draft);
    const sent = [...draft.days];
    // …while an earlier answer had already given it 12: the server deleted that and made it 13
    draft.days[2]!.id = 12;
    learnDayIds(sent, input, { ...plan, days: [...plan.days, { id: 13, name: 'C', position: 2, exercises: [] }] });
    expect(draft.days.map((day) => day.id)).toEqual([10, 11, 13]);
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

  it('is a set without reps, naming which', () => {
    const draft = draftOf(plan);
    draft.days[0]!.exercises[0]!.reps[1] = ' ';
    expect(problemOf(draft)).toBe('Nel giorno «A» la serie 2 dell’esercizio «Squat» non ha ripetizioni. Scrivi quante, anche «max».');
  });

  it('is an exercise with no sets, or more than 20', () => {
    const draft = draftOf(plan);
    draft.days[0]!.exercises[0]!.reps = [];
    expect(problemOf(draft)).toBe('Nel giorno «A» le serie dell’esercizio «Squat» vanno da 1 a 20.');
    draft.days[0]!.exercises[0]!.reps = Array.from({ length: 21 }, () => '5');
    expect(problemOf(draft)).toBe('Nel giorno «A» le serie dell’esercizio «Squat» vanno da 1 a 20.');
    draft.days[0]!.exercises[0]!.reps = Array.from({ length: 20 }, () => '5');
    expect(problemOf(draft)).toBeNull();
  });
});

describe('the sets of an exercise in a plan', () => {
  it('grow by one copying the last, up to 20', () => {
    const exercise = draftOf(plan).days[0]!.exercises[0]!;
    addSet(exercise);
    expect(exercise.reps).toEqual(['5', '5', '3', '3']);
    exercise.reps = Array.from({ length: 20 }, () => '5');
    addSet(exercise);
    expect(exercise.reps).toHaveLength(20);
  });

  it('start from 10 when there is none', () => {
    const exercise = { ...draftOf(plan).days[0]!.exercises[0]!, reps: [] };
    addSet(exercise);
    expect(exercise.reps).toEqual(['10']);
  });

  it('lose the one taken away, never the last one left', () => {
    const exercise = draftOf(plan).days[0]!.exercises[0]!;
    removeSet(exercise, 1);
    expect(exercise.reps).toEqual(['5', '3']);
    removeSet(exercise, 0);
    removeSet(exercise, 0);
    expect(exercise.reps).toEqual(['3']);
  });
});

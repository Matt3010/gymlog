import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeApi } from '../test/fake-api';
import { copies } from './copies';
import { applyPending, Outbox, type Op } from './outbox.svelte';
import type { WorkoutDetail, WorkoutSet } from './types';

const set = (id: number, reps: number, weightKg: number): WorkoutSet => ({
  id, exerciseId: 1, exerciseName: 'Squat', reps, weightKg, createdAt: '2026-10-01T17:05:00.000Z',
});

const DETAIL: WorkoutDetail = {
  id: 7, planDayId: null, planName: null, dayName: null, startedAt: '2026-10-01T17:00:00.000Z', finishedAt: null, notes: null,
  plan: [], sets: [set(100, 8, 60)], previous: {}, exerciseNotes: {}, previousNote: null,
};

/* la rete del telefono, come la dice il browser: un interruttore */
let connected = true;
beforeEach(() => {
  connected = true;
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => connected);
});
afterEach(() => vi.restoreAllMocks());

const offline = () => {
  connected = false;
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
};
const online = () => (connected = true);

describe('the changes waiting to be sent', () => {
  it('go to the server in order, and leave the queue once there', async () => {
    const api = fakeApi()
      .on('POST /workouts/7/sets', set(201, 8, 62.5))
      .on('PUT /workouts/7/exercises/1/note', { exerciseId: 1, note: 'ok' })
      .on('PATCH /workouts/7', DETAIL)
      .on('GET /workouts/7', DETAIL);
    const box = new Outbox();
    box.add({ kind: 'addSet', workoutId: 7, setId: box.tempId(), exerciseName: 'Squat', body: { exerciseId: 1, reps: 8, weightKg: 62.5 } });
    box.add({ kind: 'note', workoutId: 7, exerciseId: 1, note: 'ok' });
    box.add({ kind: 'workout', workoutId: 7, change: { finished: true } });
    await box.flush();
    expect(api.changes().map((change) => change.route)).toEqual(['POST /workouts/7/sets', 'PUT /workouts/7/exercises/1/note', 'PATCH /workouts/7']);
    expect(box.pending).toBe(0);
  });

  it('wait without network, kept on the phone, and go when it comes back', async () => {
    offline();
    const box = new Outbox();
    box.add({ kind: 'note', workoutId: 7, exerciseId: 1, note: 'scendere lento' });
    await box.flush();
    expect(box.pending).toBe(1);
    // the app reloads in the meantime: the queue is still there
    const again = new Outbox();
    expect(again.pending).toBe(1);
    online();
    const api = fakeApi().on('PUT /workouts/7/exercises/1/note', { exerciseId: 1, note: 'scendere lento' }).on('GET /workouts/7', DETAIL);
    await again.flush();
    expect(api.changes()).toEqual([{ route: 'PUT /workouts/7/exercises/1/note', body: { note: 'scendere lento' } }]);
    expect(again.pending).toBe(0);
  });

  it('give a set logged offline its real number: later changes follow it there', async () => {
    offline();
    const box = new Outbox();
    const temp = box.tempId();
    expect(temp).toBeLessThan(0);
    box.add({ kind: 'addSet', workoutId: 7, setId: temp, exerciseName: 'Squat', body: { exerciseId: 1, reps: 8, weightKg: 60 } });
    await box.flush();
    online();
    const api = fakeApi().on('POST /workouts/7/sets', set(201, 8, 60)).on('PATCH /sets/201', set(201, 9, 60)).on('GET /workouts/7', DETAIL);
    await box.flush();
    // the page still knows it by its provisional number
    box.add({ kind: 'updateSet', workoutId: 7, setId: temp, body: { reps: 9, weightKg: 60 } });
    await box.flush();
    expect(api.changes()).toEqual([
      { route: 'POST /workouts/7/sets', body: { exerciseId: 1, reps: 8, weightKg: 60 } },
      { route: 'PATCH /sets/201', body: { reps: 9, weightKg: 60 } },
    ]);
  });

  it('fold together what has not left yet: a set corrected before it is sent goes as corrected, one taken away does not go', async () => {
    offline();
    const box = new Outbox();
    const kept = box.tempId();
    const dropped = box.tempId();
    box.add({ kind: 'addSet', workoutId: 7, setId: kept, exerciseName: 'Squat', body: { exerciseId: 1, reps: 8, weightKg: 60 } });
    box.add({ kind: 'addSet', workoutId: 7, setId: dropped, exerciseName: 'Squat', body: { exerciseId: 1, reps: 5, weightKg: 70 } });
    box.add({ kind: 'updateSet', workoutId: 7, setId: kept, body: { reps: 10, weightKg: 60 } });
    box.add({ kind: 'deleteSet', workoutId: 7, setId: dropped });
    box.add({ kind: 'updateSet', workoutId: 7, setId: 100, body: { reps: 6, weightKg: 60 } });
    box.add({ kind: 'updateSet', workoutId: 7, setId: 100, body: { reps: 7, weightKg: 60 } });
    box.add({ kind: 'note', workoutId: 7, exerciseId: 1, note: 'a' });
    box.add({ kind: 'note', workoutId: 7, exerciseId: 1, note: 'ab' });
    expect(box.ops).toEqual<Op[]>([
      { kind: 'addSet', workoutId: 7, setId: kept, exerciseName: 'Squat', body: { exerciseId: 1, reps: 10, weightKg: 60 } },
      { kind: 'updateSet', workoutId: 7, setId: 100, body: { reps: 7, weightKg: 60 } },
      { kind: 'note', workoutId: 7, exerciseId: 1, note: 'ab' },
    ]);
  });

  it('a workout deleted takes its own changes along, and goes alone', () => {
    offline();
    const box = new Outbox();
    box.add({ kind: 'addSet', workoutId: 7, setId: box.tempId(), exerciseName: 'Squat', body: { exerciseId: 1, reps: 8, weightKg: 60 } });
    box.add({ kind: 'updateSet', workoutId: 7, setId: 100, body: { reps: 6, weightKg: 60 } });
    box.add({ kind: 'note', workoutId: 8, exerciseId: 1, note: 'altro' });
    box.add({ kind: 'deleteWorkout', workoutId: 7 });
    expect(box.ops).toEqual<Op[]>([{ kind: 'note', workoutId: 8, exerciseId: 1, note: 'altro' }, { kind: 'deleteWorkout', workoutId: 7 }]);
  });

  it('count a delete that finds nothing as done: it went the first time, the answer was lost', async () => {
    const said = vi.fn();
    fakeApi()
      .on('DELETE /sets/100', { status: 404, body: { error: 'Quello che cercavi non c’è più.' } })
      .on('DELETE /workouts/8', { status: 404, body: { error: 'Quello che cercavi non c’è più.' } })
      .on('GET /workouts/7', DETAIL);
    const box = new Outbox(said);
    box.add({ kind: 'deleteSet', workoutId: 7, setId: 100 });
    box.add({ kind: 'deleteWorkout', workoutId: 8 });
    await box.flush();
    expect(said).not.toHaveBeenCalled();
    expect(box.pending).toBe(0);
  });

  it('give each set a key of its own, the same however many times it is sent', () => {
    const box = new Outbox();
    const keys = new Set([box.newKey(), box.newKey(), box.newKey()]);
    expect(keys.size).toBe(3);
    for (const key of keys) expect(key.length).toBeLessThanOrEqual(64);
  });

  it('refused by the server, are dropped with the reason, and the rest goes on', async () => {
    const said = vi.fn();
    const api = fakeApi()
      .on('PATCH /sets/100', { status: 404, body: { error: 'La serie non c’è più.' } })
      .on('PUT /workouts/7/exercises/1/note', { exerciseId: 1, note: 'ok' })
      .on('GET /workouts/7', DETAIL);
    const box = new Outbox(said);
    box.add({ kind: 'updateSet', workoutId: 7, setId: 100, body: { reps: 6, weightKg: 60 } });
    box.add({ kind: 'note', workoutId: 7, exerciseId: 1, note: 'ok' });
    await box.flush();
    expect(said).toHaveBeenCalledWith('Una modifica non è stata salvata: La serie non c’è più.');
    expect(api.changes().map((change) => change.route)).toEqual(['PATCH /sets/100', 'PUT /workouts/7/exercises/1/note']);
    expect(box.pending).toBe(0);
  });

  it('once sent, refresh the copy of each workout touched, and say so to whoever shows it', async () => {
    const fresh = { ...DETAIL, sets: [set(100, 8, 60), set(201, 8, 62.5)] };
    fakeApi().on('POST /workouts/7/sets', set(201, 8, 62.5)).on('GET /workouts/7', fresh);
    const box = new Outbox();
    const seen = vi.fn();
    const stop = box.onSynced(seen);
    box.add({ kind: 'addSet', workoutId: 7, setId: box.tempId(), exerciseName: 'Squat', body: { exerciseId: 1, reps: 8, weightKg: 62.5 } });
    await box.flush();
    expect(seen).toHaveBeenCalledWith(7, fresh);
    stop();
  });

  it('do not even try while the phone says there is no network', async () => {
    connected = false;
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const box = new Outbox();
    box.add({ kind: 'note', workoutId: 7, exerciseId: 1, note: 'ok' });
    await box.flush();
    expect(fetch).not.toHaveBeenCalled();
    expect(box.pending).toBe(1);
  });

  it('with no answer even though the phone thought it had network, wait and keep the order', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    const box = new Outbox();
    box.add({ kind: 'note', workoutId: 7, exerciseId: 1, note: 'a' });
    box.add({ kind: 'note', workoutId: 7, exerciseId: 2, note: 'b' });
    await box.flush();
    expect(box.ops.map((op) => (op.kind === 'note' ? op.note : ''))).toEqual(['a', 'b']);
  });

  it('go one flush at a time: a second call waits for the first', async () => {
    const api = fakeApi().on('PUT /workouts/7/exercises/1/note', { exerciseId: 1, note: 'ok' }).on('GET /workouts/7', DETAIL);
    const box = new Outbox();
    box.add({ kind: 'note', workoutId: 7, exerciseId: 1, note: 'ok' });
    await Promise.all([box.flush(), box.flush()]);
    expect(api.changes()).toHaveLength(1);
  });
});

describe('forgetting the queue', () => {
  it('leaves a send already in flight with nothing to touch when it comes back', async () => {
    // the first request waits for an answer given by hand; the ones after never come back
    const answers: ((value: Response) => void)[] = [];
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => answers.push(resolve))));
    const answer = (value: Response) => answers[0]!(value);
    const box = new Outbox();
    box.add({ kind: 'note', workoutId: 7, exerciseId: 1, note: 'di chi esce' });
    const going = box.flush();
    box.forget();
    box.add({ kind: 'note', workoutId: 8, exerciseId: 1, note: 'di chi entra' });
    answer(new Response(JSON.stringify({ exerciseId: 1, note: 'x' }), { status: 200 }));
    await going;
    expect(box.ops).toEqual([{ kind: 'note', workoutId: 8, exerciseId: 1, note: 'di chi entra' }]);
    expect(box.sent).toEqual([]);
  });
});

describe('what the page shows', () => {
  it('keeps a change already sent in sight until the fresh copy arrives: no set blinks away', async () => {
    let fresh = false;
    fakeApi()
      .on('POST /workouts/7/sets', set(201, 8, 62.5))
      .on('GET /workouts/7', () => (fresh ? { ...DETAIL, sets: [set(100, 8, 60), set(201, 8, 62.5)] } : { status: 503 }));
    const box = new Outbox();
    const temp = box.tempId();
    box.add({ kind: 'addSet', workoutId: 7, setId: temp, exerciseName: 'Squat', body: { exerciseId: 1, reps: 8, weightKg: 62.5 } });
    await box.flush();
    // sent, but the copy could not be refreshed: the old copy still shows it
    expect(box.pending).toBe(0);
    expect(box.shown(DETAIL).sets.map((one) => one.id)).toEqual([100, temp]);
    // the fresh copy, with the set under its real number, shows it once
    fresh = true;
    const withIt = { ...DETAIL, sets: [set(100, 8, 60), set(201, 8, 62.5)] };
    expect(box.shown(withIt).sets.map((one) => one.id)).toEqual([100, 201]);
    fakeApi().on('PUT /workouts/7/exercises/1/note', { exerciseId: 1, note: 'x' }).on('GET /workouts/7', withIt);
    box.add({ kind: 'note', workoutId: 7, exerciseId: 1, note: 'x' });
    await box.flush();
    expect(box.shown(DETAIL).sets.map((one) => one.id)).toEqual([100]);
  });
});

describe('a workout as it is on the phone', () => {
  it('is the last copy from the server with the changes not sent yet on top', () => {
    const shown = applyPending(DETAIL, [
      { kind: 'addSet', workoutId: 7, setId: -1, exerciseName: 'Squat', body: { exerciseId: 1, reps: 8, weightKg: 62.5 } },
      { kind: 'updateSet', workoutId: 7, setId: 100, body: { reps: 9, weightKg: 60 } },
      { kind: 'note', workoutId: 7, exerciseId: 1, note: 'lento' },
      { kind: 'workout', workoutId: 7, change: { notes: 'bene', finished: true } },
      { kind: 'note', workoutId: 8, exerciseId: 1, note: 'di un altro' },
    ]);
    expect(shown.sets.map((one) => [one.id, one.reps, one.weightKg])).toEqual([[100, 9, 60], [-1, 8, 62.5]]);
    expect(shown.sets[1]).toMatchObject({ exerciseName: 'Squat' });
    expect(shown.exerciseNotes).toEqual({ 1: 'lento' });
    expect(shown.notes).toBe('bene');
    expect(shown.finishedAt).not.toBeNull();
    // the copy itself is left as it was
    expect(DETAIL.sets).toHaveLength(1);
  });

  it('loses a set taken away, a note emptied, and comes back open when reopened', () => {
    const shown = applyPending({ ...DETAIL, finishedAt: '2026-10-01T18:00:00.000Z', exerciseNotes: { 1: 'x' } }, [
      { kind: 'deleteSet', workoutId: 7, setId: 100 },
      { kind: 'note', workoutId: 7, exerciseId: 1, note: null },
      { kind: 'workout', workoutId: 7, change: { finished: false } },
    ]);
    expect(shown.sets).toEqual([]);
    expect(shown.exerciseNotes).toEqual({});
    expect(shown.finishedAt).toBeNull();
  });
});

describe('problems found reviewing', () => {
  const added = (box: Outbox, reps = 8): Extract<Op, { kind: 'addSet' }> => ({ kind: 'addSet', workoutId: 7, setId: box.tempId(), exerciseName: 'Squat', body: { exerciseId: 1, reps, weightKg: 60 } });

  it('do not take the old copy on the phone for the fresh one: a set just sent does not vanish', async () => {
    copies.write('/workouts/7', DETAIL);
    fakeApi()
      .on('POST /workouts/7/sets', set(201, 8, 60))
      // the network drops right after the set went: the reading gets no answer at all
      .on('GET /workouts/7', () => Promise.reject(new TypeError('Failed to fetch')) as never);
    const box = new Outbox();
    const seen = vi.fn();
    box.onSynced(seen);
    const op = added(box);
    box.add(op);
    await box.flush();
    expect(seen).not.toHaveBeenCalled();
    expect(box.shown(DETAIL).sets).toHaveLength(2);
  });

  it('wait and retry when the server is down for a moment (502, 503, 504), losing nothing', async () => {
    const said = vi.fn();
    fakeApi().on('POST /workouts/7/sets', { status: 502, body: {} });
    const box = new Outbox(said);
    box.add(added(box));
    await box.flush();
    expect(said).not.toHaveBeenCalled();
    expect(box.pending).toBe(1);
  });

  it('drop a correction of a set already taken away: no false error', async () => {
    offline();
    const box = new Outbox();
    box.add({ kind: 'deleteSet', workoutId: 7, setId: 100 });
    box.add({ kind: 'updateSet', workoutId: 7, setId: 100, body: { reps: 9, weightKg: 60 } });
    expect(box.ops).toEqual([{ kind: 'deleteSet', workoutId: 7, setId: 100 }]);
  });

  it('try anyway on the timer even when the phone says there is no network, as it can be wrong', async () => {
    connected = false;
    const api = fakeApi().on('PUT /workouts/7/exercises/1/note', { exerciseId: 1, note: 'a' }).on('GET /workouts/7', DETAIL);
    const box = new Outbox();
    box.add({ kind: 'note', workoutId: 7, exerciseId: 1, note: 'a' });
    await box.flush();
    expect(api.changes()).toEqual([]);
    await box.flush({ evenOffline: true });
    expect(api.changes()).toHaveLength(1);
  });

  it('after leaving and coming back in, send each change once: an old send ending does not start a second sender', async () => {
    const answers: ((value: Response) => void)[] = [];
    const sent: string[] = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init: RequestInit = {}) => {
      if ((init.method ?? 'GET') === 'GET') return Promise.resolve(new Response(JSON.stringify(DETAIL), { status: 200 }));
      sent.push(String(init.body));
      return new Promise<Response>((resolve) => answers.push(resolve));
    }));
    const ok = () => new Response(JSON.stringify({ exerciseId: 1, note: 'x' }), { status: 200 });
    const box = new Outbox();
    box.add({ kind: 'note', workoutId: 7, exerciseId: 1, note: 'old' });
    box.forget();
    box.add({ kind: 'note', workoutId: 8, exerciseId: 1, note: 'b1' });
    answers[0]!(ok());
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    box.add({ kind: 'note', workoutId: 8, exerciseId: 2, note: 'b2' });
    for (let i = 1; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      answers[i]?.(ok());
    }
    await box.flush();
    expect(sent.filter((body) => body.includes('b1'))).toHaveLength(1);
    expect(sent.filter((body) => body.includes('b2'))).toHaveLength(1);
  });

  it('let go of changes on a workout the server no longer has (deleted elsewhere)', async () => {
    fakeApi().on('PUT /workouts/7/exercises/1/note', { exerciseId: 1, note: 'a' })
      .on('GET /workouts/7', { status: 404, body: { error: 'Non trovato.' } });
    const box = new Outbox();
    box.add({ kind: 'note', workoutId: 7, exerciseId: 1, note: 'a' });
    await box.flush();
    expect(box.sent).toEqual([]);
  });

  it('remember only the last numbers of sets already arrived: the phone does not fill up', async () => {
    let next = 200;
    fakeApi().on('POST /workouts/7/sets', () => set(next++, 8, 60)).on('GET /workouts/7', DETAIL);
    const box = new Outbox();
    const first = box.tempId();
    box.add({ ...added(box), setId: first });
    await box.flush();
    for (let i = 0; i < 105; i++) box.add(added(box));
    await box.flush();
    const ids = JSON.parse(localStorage.getItem('gymlog.outbox')!).ids as Record<string, number>;
    expect(Object.keys(ids)).toHaveLength(100);
    // the most recent are kept, the oldest go
    expect(box.realId(first)).toBe(first);
  });
});

describe('whose the queue is', () => {
  it('stays on the phone for the same person after leaving, and goes when they come back in', () => {
    offline();
    const box = new Outbox();
    box.claim(1);
    box.add({ kind: 'note', workoutId: 7, exerciseId: 1, note: 'mia' });
    box.claim(1);
    expect(box.pending).toBe(1);
    // the app reloads: still theirs
    const again = new Outbox();
    again.claim(1);
    expect(again.pending).toBe(1);
  });

  it('is dropped when someone else comes in on the same phone: never sent in their name', () => {
    offline();
    const box = new Outbox();
    box.claim(1);
    box.add({ kind: 'note', workoutId: 7, exerciseId: 1, note: 'di anna' });
    box.claim(2);
    expect(box.pending).toBe(0);
  });
});

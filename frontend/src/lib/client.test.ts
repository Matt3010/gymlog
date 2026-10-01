import { describe, expect, it } from 'vitest';
import { fakeApi } from '../test/fake-api';
import { Autosave } from './autosave.svelte';
import { exercisesApi, plansApi } from './endpoints';

describe('the app’s client', () => {
  it('reads only after the saves on their way have arrived, so a page shows what was just written', async () => {
    const api = fakeApi().on('GET /plans', []).on('GET /exercises', []);
    let arrive = () => undefined as void;
    const saver = new Autosave(() => new Promise<void>((resolve) => (arrive = resolve)), 0);
    saver.change('x');
    void saver.flush();
    const list = plansApi.list();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(api.calls).toEqual([]);
    arrive();
    await list;
    expect(api.calls.map((call) => call.path)).toEqual(['/plans']);
  });

  it('writes without waiting', async () => {
    const api = fakeApi().on('POST /exercises', { id: 1, name: 'x', muscleGroup: null, notes: null });
    const saver = new Autosave(() => new Promise<void>(() => undefined), 0);
    saver.change('x');
    void saver.flush();
    await exercisesApi.create({ name: 'x', muscleGroup: null, notes: null });
    expect(api.calls.map((call) => call.method)).toEqual(['POST']);
  });
});

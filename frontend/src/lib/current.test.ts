import { describe, expect, it, vi } from 'vitest';
import { fakeApi } from '../test/fake-api';
import { copies } from './copies';
import { current } from './current.svelte';
import { outbox } from './sync';

const OPEN = { id: 9, title: 'Forza · A', startedAt: '2026-10-01T17:00:00.000Z', sets: 2 };

describe('the workout in progress', () => {
  it('is kept on the phone, so the bar is there again when the app reopens without network', () => {
    current.set(OPEN);
    expect(copies.read('in-corso')).toEqual(OPEN);
    current.set(null);
    expect(copies.read('in-corso')).toBeNull();
  });

  it('asks the server as it is now, never a copy; without network keeps what it knew', async () => {
    current.set(OPEN);
    copies.write('/workouts?limit=6&offset=0', []);
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    await current.refresh();
    expect(current.workout).toEqual(OPEN);
  });

  it('follows the server when it answers', async () => {
    current.set(OPEN);
    fakeApi().on('GET /workouts?limit=6&offset=0', []);
    await current.refresh();
    expect(current.workout).toBeNull();
    expect(copies.read('in-corso')).toBeNull();
  });

  it('asks only after the changes waiting have left: a workout just deleted is not brought back', async () => {
    let open = [{ id: 9, planDayId: null, planName: 'Forza', dayName: 'A', startedAt: OPEN.startedAt, finishedAt: null, notes: null, exercises: 0, sets: 0, volume: 0 }];
    const order: string[] = [];
    fakeApi()
      // the server takes its time over the delete, as over a real network
      .on('DELETE /workouts/9', () => new Promise((done) => setTimeout(() => {
        order.push('DELETE');
        open = [];
        done({ ok: true });
      }, 30)) as never)
      .on('GET /workouts?limit=6&offset=0', () => {
        order.push('GET');
        return open;
      });
    current.set(OPEN);
    outbox.add({ kind: 'deleteWorkout', workoutId: 9 });
    current.set(null);
    await current.refresh();
    expect(order).toEqual(['DELETE', 'GET']);
    expect(current.workout).toBeNull();
  });
});

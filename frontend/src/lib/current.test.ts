import { describe, expect, it } from 'vitest';
import { fakeApi } from '../test/fake-api';
import { session } from './client';
import { current } from './current.svelte';

const OPEN = { id: 9, title: 'Forza · A', startedAt: '2026-10-01T17:00:00.000Z', sets: 2 };

describe('the workout in progress', () => {
  it('follows the server when it answers', async () => {
    current.set(OPEN);
    fakeApi().on('GET /workouts?limit=6&offset=0', []);
    await current.refresh();
    expect(current.workout).toBeNull();
  });

  it('keeps what it knew when the server does not answer', async () => {
    current.set(OPEN);
    fakeApi().on('GET /workouts?limit=6&offset=0', { status: 503 });
    await current.refresh();
    expect(current.workout).toEqual(OPEN);
  });

  it('goes away on leaving: whoever comes in next on the same phone does not see it', () => {
    current.set(OPEN);
    session.signedOut();
    expect(current.workout).toBeNull();
  });
});

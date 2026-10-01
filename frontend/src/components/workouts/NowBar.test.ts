import { render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nav } from '../../lib/nav.svelte';
import { rest } from '../../lib/rest.svelte';
import type { WorkoutSummary } from '../../lib/types';
import { fakeApi } from '../../test/fake-api';
import NowBar from './NowBar.svelte';

const RECENT = 'GET /workouts?limit=6&offset=0';

const workout = (id: number, change: Partial<WorkoutSummary> = {}): WorkoutSummary => ({
  id, planDayId: 11, planName: 'Ciao', dayName: 'A', startedAt: new Date(Date.now() - 24 * 60_000).toISOString(),
  finishedAt: null, notes: null, exercises: 1, sets: 3, volume: 375, ...change,
});

afterEach(() => rest.stop());

describe('the workout in progress, on every page', () => {
  it('sits above the tabs: what it is, how far, how long; a tap resumes it', async () => {
    fakeApi().on(RECENT, [workout(9), workout(8, { finishedAt: '2026-10-01T18:00:00.000Z' })]);
    nav.go('/schede');
    render(NowBar);
    const bar = await screen.findByRole('link', { name: /^In corso/ });
    expect(bar).toHaveAttribute('href', '/allenamenti/9');
    expect(bar.textContent?.replace(/\s+/g, ' ').trim()).toBe('In corso Ciao · A 3 serie · 24 min');
  });

  it('names a free workout as such, and says one set in the singular', async () => {
    fakeApi().on(RECENT, [workout(9, { planName: null, dayName: null, sets: 1 })]);
    render(NowBar);
    expect(await screen.findByRole('link', { name: /^In corso/ })).toHaveTextContent(/Allenamento libero\s*1 serie/);
  });

  it('counts the rest down while it runs, even away from the workout', async () => {
    fakeApi().on(RECENT, [workout(9)]);
    render(NowBar);
    const bar = await screen.findByRole('link', { name: /^In corso/ });
    rest.start(72);
    await vi.waitFor(() => expect(bar).toHaveTextContent(/Recupero\s*1:12/));
    rest.stop();
    await vi.waitFor(() => expect(bar).toHaveTextContent('3 serie'));
  });

  it('is not there without a workout in progress', async () => {
    fakeApi().on(RECENT, [workout(8, { finishedAt: '2026-10-01T18:00:00.000Z' })]);
    render(NowBar);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole('link', { name: /^In corso/ })).not.toBeInTheDocument();
  });

  it('steps aside on the page of that workout, and comes back elsewhere', async () => {
    fakeApi().on(RECENT, [workout(9)]);
    nav.go('/allenamenti/9');
    render(NowBar);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole('link', { name: /^In corso/ })).not.toBeInTheDocument();
    nav.go('/');
    expect(await screen.findByRole('link', { name: /^In corso/ })).toBeInTheDocument();
  });

  it('looks again at every change of page: a workout ended there is gone here', async () => {
    let open = true;
    fakeApi().on(RECENT, () => [workout(9, open ? {} : { finishedAt: '2026-10-01T18:00:00.000Z' })]);
    render(NowBar);
    await screen.findByRole('link', { name: /^In corso/ });
    open = false;
    nav.go('/storico');
    await vi.waitFor(() => expect(screen.queryByRole('link', { name: /^In corso/ })).not.toBeInTheDocument());
  });
});

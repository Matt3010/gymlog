import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { current } from '../../lib/current.svelte';
import { install } from '../../lib/install.svelte';
import { nav } from '../../lib/nav.svelte';
import type { Plan, WorkoutDetail, WorkoutSummary } from '../../lib/types';
import { fakeApi } from '../../test/fake-api';
import Host from '../../test/Host.svelte';
import HomePage from './HomePage.svelte';

const RECENT = 'GET /workouts?limit=6&offset=0';

const plan = (id: number, name: string, exercises: number): Plan => ({
  id, name, notes: null,
  exercises: Array.from({ length: exercises }, (_, i) => ({
    id: id * 10 + i, exerciseId: i + 1, exerciseName: `E${i}`, position: i, reps: ['8', '8', '8'], restSeconds: 90, notes: null,
  })),
});

const SPINTA = plan(1, 'Spinta', 2);
const TIRATA = plan(3, 'Tirata', 1);
const VUOTA = plan(2, 'Vuota', 0);

function workout(id: number, change: Partial<WorkoutSummary> = {}): WorkoutSummary {
  return {
    id, planId: 1, planName: 'Spinta', startedAt: '2026-09-20T17:00:00.000Z', finishedAt: '2026-09-20T18:00:00.000Z',
    notes: null, exercises: 2, sets: 6, volume: 2400, ...change,
  };
}

const started = (id: number): WorkoutDetail => ({
  id, planId: null, planName: null, startedAt: new Date().toISOString(), finishedAt: null, notes: null, plan: [], sets: [], previous: {}, exerciseNotes: {}, previousNote: null, bodyweight: [],
});

describe('home', () => {
  const plans = () => [...document.querySelectorAll('button.plan')].map((b) => b.textContent?.replace(/\s+/g, ' ').trim());

  it('shows every plan, each saying what is in it', async () => {
    fakeApi().on('GET /plans', [SPINTA, TIRATA, VUOTA]).on(RECENT, []);
    render(HomePage);
    expect(await screen.findByText('Inizia un allenamento')).toBeInTheDocument();
    expect(plans()).toEqual(['Spinta E0, E1', 'Tirata E0', 'Vuota Nessun esercizio']);
  });

  it('lets no other workout start while one is in progress: it says so, and where to end it', async () => {
    fakeApi().on('GET /plans', [SPINTA, TIRATA]).on(RECENT, []);
    current.set({ id: 9, title: 'Spinta', startedAt: '2026-10-01T17:00:00.000Z', sets: 2 });
    render(HomePage);
    await screen.findByRole('button', { name: 'Spinta E0, E1' });
    expect(screen.getByText('Hai un allenamento in corso: terminalo per iniziarne un altro.')).toBeInTheDocument();
    for (const one of document.querySelectorAll('button.plan')) expect(one).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Allenamento libero' })).toBeDisabled();
    // ended elsewhere: free again
    current.set(null);
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Allenamento libero' })).toBeEnabled());
    expect(screen.queryByText(/terminalo per iniziarne un altro/)).not.toBeInTheDocument();
  });

  it('starts a workout from a plan and opens it', async () => {
    const api = fakeApi().on('GET /plans', [SPINTA, TIRATA]).on(RECENT, []).on('POST /workouts', started(40));
    render(HomePage);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Tirata E0' }));
    expect(api.changes()).toEqual([{ route: 'POST /workouts', body: { planId: 3 } }]);
    expect(nav.path).toBe('/workouts/40');
  });

  it('starts a free workout', async () => {
    const api = fakeApi().on('GET /plans', [SPINTA]).on(RECENT, []).on('POST /workouts', started(41));
    render(HomePage);
    // secondary, outside the plans' cards: a way out, not the first choice
    const free = await screen.findByRole('button', { name: 'Allenamento libero' });
    expect(free).toHaveClass('ghost');
    expect(free.closest('.card')).toBeNull();
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Allenamento libero' }));
    expect(api.changes()).toEqual([{ route: 'POST /workouts', body: { planId: null } }]);
    expect(nav.path).toBe('/workouts/41');
  });

  it('says why a workout did not start, and stays', async () => {
    fakeApi().on('GET /plans', [SPINTA]).on(RECENT, [])
      .on('POST /workouts', { status: 400, body: { error: 'La scheda non esiste più. Ricarica la pagina.' } });
    render(HomePage);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Spinta E0, E1' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La scheda non esiste più. Ricarica la pagina.');
    expect(nav.path).toBe('/');
    expect(screen.getByRole('button', { name: 'Spinta E0, E1' })).toBeEnabled();
  });

  it('leaves the workout in progress to the bar above the tabs, seen from every page', async () => {
    fakeApi().on('GET /plans', [SPINTA]).on(RECENT, [workout(9, { finishedAt: null, sets: 1 })]);
    render(HomePage);
    await screen.findByRole('button', { name: 'Spinta E0, E1' });
    expect(screen.queryByText('In corso')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Riprendi' })).not.toBeInTheDocument();
  });

  it('leaves the workouts done to the history, its own section', async () => {
    fakeApi().on('GET /plans', [SPINTA]).on(RECENT, [workout(8), workout(7)]);
    render(HomePage);
    await screen.findByRole('button', { name: 'Spinta E0, E1' });
    expect(screen.queryByText('Gli ultimi')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Tutto lo storico' })).not.toBeInTheDocument();
  });

  it('invites to write a plan when there is none', async () => {
    fakeApi().on('GET /plans', []).on(RECENT, []);
    render(HomePage);
    expect(await screen.findByText('Nessuna scheda, per ora.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Scrivi una scheda' })).toHaveAttribute('href', '/plans/new');
    expect(screen.queryByText('Gli ultimi')).not.toBeInTheDocument();
  });

  it('shows the shape of the page while it loads', async () => {
    fakeApi().on('GET /plans', () => new Promise(() => undefined) as never).on(RECENT, []);
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
    render(HomePage);
    // a loader, not a skeleton; and only after a short wait, so a fast load does not flash
    expect(screen.queryByRole('status', { name: 'Caricamento…' })).not.toBeInTheDocument();
    expect(await screen.findByRole('status', { name: 'Caricamento…' })).toBeInTheDocument();
    expect(document.querySelector('.skeleton')).toBeNull();
    expect(screen.queryByText('Inizia un allenamento')).not.toBeInTheDocument();
  });

  it('offers to install the app when the browser can, and installs it on request', async () => {
    fakeApi().on('GET /plans', [SPINTA]).on(RECENT, []);
    render(HomePage);
    await screen.findByText('Spinta');
    expect(screen.queryByRole('button', { name: 'Installa' })).not.toBeInTheDocument();
    const prompt = vi.fn(async () => undefined);
    const offer = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) });
    window.dispatchEvent(offer);
    expect(await screen.findByText('Installala e si apre come un’app, a tutto schermo, anche senza rete.')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Installa' }));
    expect(prompt).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Installa' })).not.toBeInTheDocument();
  });

  it('stops offering it after «Non ora»', async () => {
    fakeApi().on('GET /plans', [SPINTA]).on(RECENT, []);
    render(HomePage);
    await screen.findByText('Spinta');
    window.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: vi.fn(), userChoice: Promise.resolve({}) }));
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Non ora' }));
    expect(screen.queryByRole('button', { name: 'Installa' })).not.toBeInTheDocument();
    expect(install.nonOra).toBe(true);
    expect(localStorage.getItem('gymlog.installa.no')).toBe('true');
  });
});

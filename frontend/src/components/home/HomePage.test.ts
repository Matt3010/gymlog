import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { install } from '../../lib/install.svelte';
import { nav } from '../../lib/nav.svelte';
import type { Plan, WorkoutDetail, WorkoutSummary } from '../../lib/types';
import { fakeApi } from '../../test/fake-api';
import HomePage from './HomePage.svelte';

const RECENT = 'GET /workouts?limit=6&offset=0';

const day = (id: number, name: string, exercises: number) => ({
  id, name, position: 0,
  exercises: Array.from({ length: exercises }, (_, i) => ({
    id: id * 10 + i, exerciseId: i + 1, exerciseName: `E${i}`, position: i, reps: ['8', '8', '8'], restSeconds: 90, notes: null,
  })),
});

const FORZA: Plan = { id: 1, name: 'Forza', notes: null, archived: false, days: [day(11, 'A', 2), day(12, 'B', 1)] };
const VECCHIA: Plan = { id: 2, name: 'Vecchia', notes: null, archived: true, days: [day(21, 'Unico', 1)] };

function workout(id: number, change: Partial<WorkoutSummary> = {}): WorkoutSummary {
  return {
    id, planDayId: 11, planName: 'Forza', dayName: 'A', startedAt: '2026-09-20T17:00:00.000Z', finishedAt: '2026-09-20T18:00:00.000Z',
    notes: null, exercises: 2, sets: 6, volume: 2400, ...change,
  };
}

const started = (id: number): WorkoutDetail => ({
  id, planDayId: null, planName: null, dayName: null, startedAt: new Date().toISOString(), finishedAt: null, notes: null, plan: [], sets: [], previous: {}, exerciseNotes: {}, previousNote: null,
});

describe('home', () => {
  it('offers the days of the plans in use, not of the archived ones', async () => {
    fakeApi().on('GET /plans', [FORZA, VECCHIA]).on(RECENT, []);
    render(HomePage);
    expect(await screen.findByText('Forza')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'A 2 esercizi' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'B 1 esercizio' })).toBeInTheDocument();
    expect(screen.queryByText('Vecchia')).not.toBeInTheDocument();
  });

  it('starts a workout from a day and opens it', async () => {
    const api = fakeApi().on('GET /plans', [FORZA]).on(RECENT, []).on('POST /workouts', started(40));
    render(HomePage);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'B 1 esercizio' }));
    expect(api.changes()).toEqual([{ route: 'POST /workouts', body: { planDayId: 12 } }]);
    expect(nav.path).toBe('/allenamenti/40');
  });

  it('starts a free workout', async () => {
    const api = fakeApi().on('GET /plans', [FORZA]).on(RECENT, []).on('POST /workouts', started(41));
    render(HomePage);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Allenamento libero' }));
    expect(api.changes()).toEqual([{ route: 'POST /workouts', body: { planDayId: null } }]);
    expect(nav.path).toBe('/allenamenti/41');
  });

  it('says why a workout did not start, and stays', async () => {
    fakeApi().on('GET /plans', [FORZA]).on(RECENT, [])
      .on('POST /workouts', { status: 400, body: { error: 'Il giorno della scheda non esiste più. Ricarica la pagina.' } });
    render(HomePage);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'A 2 esercizi' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Il giorno della scheda non esiste più. Ricarica la pagina.');
    expect(nav.path).toBe('/');
    expect(screen.getByRole('button', { name: 'A 2 esercizi' })).toBeEnabled();
  });

  it('puts the workout left open on top, to resume', async () => {
    fakeApi().on('GET /plans', [FORZA]).on(RECENT, [workout(9, { finishedAt: null, sets: 1 }), workout(8)]);
    render(HomePage);
    const resume = await screen.findByRole('link', { name: 'Riprendi' });
    expect(resume).toHaveAttribute('href', '/allenamenti/9');
    expect(screen.getByText(/^Iniziato .* · 1 serie$/)).toBeInTheDocument();
  });

  it('lists the last ones done, linking to each and to the whole history', async () => {
    fakeApi().on('GET /plans', [FORZA]).on(RECENT, [workout(8), workout(7, { planName: null, dayName: null, sets: 1, volume: 62.5 })]);
    render(HomePage);
    const list = (await screen.findByText('Gli ultimi')).parentElement!;
    const rows = within(list).getAllByRole('link').map((link) => [link.getAttribute('href'), link.textContent?.replace(/\s+/g, ' ').trim()]);
    expect(rows).toEqual([
      ['/allenamenti/8', 'dom 20 set Forza · A 6 serie · 2400 kg'],
      ['/allenamenti/7', 'dom 20 set Allenamento libero 1 serie · 62,5 kg'],
      ['/storico', 'Tutto lo storico'],
    ]);
    expect(screen.queryByRole('link', { name: 'Riprendi' })).not.toBeInTheDocument();
  });

  it('invites to write a plan when there is none', async () => {
    fakeApi().on('GET /plans', []).on(RECENT, []);
    render(HomePage);
    expect(await screen.findByText('Nessuna scheda, per ora.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Scrivi una scheda' })).toHaveAttribute('href', '/schede/nuova');
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
    fakeApi().on('GET /plans', [FORZA]).on(RECENT, []);
    render(HomePage);
    await screen.findByText('Forza');
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
    fakeApi().on('GET /plans', [FORZA]).on(RECENT, []);
    render(HomePage);
    await screen.findByText('Forza');
    window.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: vi.fn(), userChoice: Promise.resolve({}) }));
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Non ora' }));
    expect(screen.queryByRole('button', { name: 'Installa' })).not.toBeInTheDocument();
    expect(install.nonOra).toBe(true);
    expect(localStorage.getItem('gymlog.installa.no')).toBe('true');
  });
});

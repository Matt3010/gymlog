import { render, screen, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import type { ExerciseStats } from '../../lib/types';
import { fakeApi, silentApi } from '../../test/fake-api';
import ExerciseStatsPage from './ExerciseStatsPage.svelte';

/** The value under a tile's name, as shown. */
const tile = (name: string) => screen.getByText(name, { selector: 'dt' }).nextElementSibling?.textContent;

const SQUAT: ExerciseStats = {
  exercise: { id: 1, name: 'Squat', muscleGroup: null, notes: null },
  overall: { sessions: 2, sets: 3, reps: 21, volume: 2050, avgWeight: 96.67, maxWeight: 110, bestE1rm: 121 },
  sessions: [
    { workoutId: 8, startedAt: '2026-09-20T17:00:00.000Z', sets: 1, reps: 3, volume: 330, avgWeight: 110, maxWeight: 110, bestE1rm: 121 },
    { workoutId: 5, startedAt: '2026-09-18T17:00:00.000Z', sets: 2, reps: 18, volume: 1720, avgWeight: 90, maxWeight: 95, bestE1rm: 116.67 },
  ],
};

describe('the stats of an exercise', () => {
  it('goes back to the exercises', async () => {
    fakeApi().on('GET /stats/exercises/1', SQUAT);
    render(ExerciseStatsPage, { id: 1 });
    expect(await screen.findByRole('link', { name: 'Esercizi' })).toHaveAttribute('href', '/esercizi');
  });

  it('draws how the estimated max and the heaviest set went, the oldest session on the left', async () => {
    fakeApi().on('GET /stats/exercises/1', SQUAT);
    render(ExerciseStatsPage, { id: 1 });
    const chart = await screen.findByRole('img', { name: /^Andamento/ });
    expect(chart).toHaveAccessibleName('Andamento di Squat in 2 sessioni: 1RM stimato da 116,67 a 121 kg, massimo da 95 a 110 kg.');
    const values = (series: string) => [...chart.querySelectorAll(`circle[data-series="${series}"]`)].map((dot) => Number(dot.getAttribute('data-value')));
    expect(values('e1rm')).toEqual([116.67, 121]);
    expect(values('max')).toEqual([95, 110]);
  });

  it('draws no chart from a single session: a dot is not a trend', async () => {
    fakeApi().on('GET /stats/exercises/1', { ...SQUAT, sessions: SQUAT.sessions.slice(0, 1) });
    render(ExerciseStatsPage, { id: 1 });
    await screen.findByRole('table');
    expect(screen.queryByRole('img', { name: /^Andamento/ })).not.toBeInTheDocument();
  });

  it('marks each session’s estimated max against the one before it', async () => {
    const older = { ...SQUAT.sessions[1]!, workoutId: 2, startedAt: '2026-09-15T17:00:00.000Z' };
    fakeApi().on('GET /stats/exercises/1', { ...SQUAT, sessions: [...SQUAT.sessions, older] });
    render(ExerciseStatsPage, { id: 1 });
    const table = await screen.findByRole('table');
    const arrows = within(table).getAllByRole('row').slice(1)
      .map((row) => within(row).queryByRole('img')?.getAttribute('aria-label') ?? null);
    expect(arrows).toEqual(['Meglio della volta prima', 'Come la volta prima', null]);
  });

  it('shows its numbers of always', async () => {
    fakeApi().on('GET /stats/exercises/1', SQUAT);
    render(ExerciseStatsPage, { id: 1 });
    expect(await screen.findByRole('heading', { name: 'Squat' })).toBeInTheDocument();
    expect([tile('Massimo'), tile('Media'), tile('1RM stimato'), tile('Sessioni'), tile('Serie'), tile('Volume')])
      .toEqual(['110 kg', '96,67 kg', '121 kg', '2', '3', '2050 kg']);
  });

  it('shows each session in a row, the most recent first, linking to the workout', async () => {
    fakeApi().on('GET /stats/exercises/1', SQUAT);
    render(ExerciseStatsPage, { id: 1 });
    const table = await screen.findByRole('table');
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Data', 'Serie', 'Rip.', 'Volume', 'Media', 'Max', '1RM']);
    const rows = within(table).getAllByRole('row').slice(1).map((row) => [...row.children].map((cell) => cell.textContent));
    expect(rows).toEqual([
      ['dom 20 set', '1', '3', '330', '110', '110', '121'],
      ['ven 18 set', '2', '18', '1720', '90', '95', '116,67'],
    ]);
    expect(within(table).getByRole('link', { name: 'ven 18 set' })).toHaveAttribute('href', '/allenamenti/5');
  });

  it('keeps the table of sessions in rows on a phone too, the header once', async () => {
    fakeApi().on('GET /stats/exercises/1', SQUAT);
    render(ExerciseStatsPage, { id: 1 });
    const table = await screen.findByRole('table');
    expect(table.closest('.scorre')).toHaveClass('in-riga');
    expect(within(table).getAllByRole('row')[0]!.parentElement!.tagName).toBe('THEAD');
  });

  it('says there is nothing yet for an exercise never done', async () => {
    fakeApi().on('GET /stats/exercises/1', { ...SQUAT, overall: { ...SQUAT.overall, sessions: 0 }, sessions: [] });
    render(ExerciseStatsPage, { id: 1 });
    expect(await screen.findByText('Nessuna serie, per ora.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('says why when the exercise is not there', async () => {
    fakeApi().on('GET /stats/exercises/1', { status: 404, body: { error: 'Non trovato.' } });
    render(ExerciseStatsPage, { id: 1 });
    expect(await screen.findByRole('alert')).toHaveTextContent('Non trovato.');
  });

});

describe('while it loads, the page', () => {
  it('shows its shape', async () => {
    silentApi();
    render(ExerciseStatsPage, { id: 1 });
    // a loader, not a skeleton; and only after a short wait, so a fast load does not flash
    expect(screen.queryByRole('status', { name: 'Caricamento…' })).not.toBeInTheDocument();
    expect(await screen.findByRole('status', { name: 'Caricamento…' })).toBeInTheDocument();
    expect(document.querySelector('.skeleton')).toBeNull();
  });
});

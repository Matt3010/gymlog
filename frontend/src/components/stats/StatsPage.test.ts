import { render, screen, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import type { ExerciseStats, Overview } from '../../lib/types';
import { fakeApi, silentApi } from '../../test/fake-api';
import ExerciseStatsPage from './ExerciseStatsPage.svelte';
import StatsPage from './StatsPage.svelte';

/** The value under a tile's name, as shown. */
const tile = (name: string) => screen.getByText(name, { selector: 'dt' }).nextElementSibling?.textContent;

const OVERVIEW: Overview = {
  workouts: 14, workoutsLast30Days: 6, volumeLast30Days: 12_345.5,
  exercises: [
    { exerciseId: 2, name: 'Panca piana', sessions: 1, avgWeight: 52.5, maxWeight: 55, lastAt: '2026-09-20T17:00:00.000Z' },
    { exerciseId: 1, name: 'Squat', sessions: 6, avgWeight: 81.25, maxWeight: 100, lastAt: '2026-09-18T17:00:00.000Z' },
  ],
};

describe('the stats overview', () => {
  it('shows the totals as the server counts them, in Italian', async () => {
    fakeApi().on('GET /stats/overview', OVERVIEW);
    render(StatsPage);
    await screen.findByText('Allenamenti', { selector: 'dt' });
    expect(tile('Allenamenti')).toBe('14');
    expect(tile('Ultimi 30 giorni')).toBe('6');
    expect(tile('Volume 30 giorni')).toBe('12.345,5 kg');
  });

  it('lists each exercise with its average and its max, opening its stats', async () => {
    fakeApi().on('GET /stats/overview', OVERVIEW);
    render(StatsPage);
    const squat = await screen.findByRole('link', { name: /^Squat/ });
    expect(squat).toHaveAttribute('href', '/statistiche/1');
    expect(squat).toHaveTextContent('media 81,25 kg · max 100 kg');
    expect(squat).toHaveTextContent('6 sessioni · l’ultima ven 18 set');
    expect(screen.getByRole('link', { name: /^Panca piana/ })).toHaveTextContent('1 sessione · l’ultima dom 20 set');
    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(['/statistiche/2', '/statistiche/1']);
  });

  it('says there is nothing yet', async () => {
    fakeApi().on('GET /stats/overview', { ...OVERVIEW, workouts: 0, workoutsLast30Days: 0, volumeLast30Days: 0, exercises: [] });
    render(StatsPage);
    expect(await screen.findByText('Nessuna serie, per ora.')).toBeInTheDocument();
  });
});

const SQUAT: ExerciseStats = {
  exercise: { id: 1, name: 'Squat', muscleGroup: null, notes: null },
  overall: { sessions: 2, sets: 3, reps: 21, volume: 2050, avgWeight: 96.67, maxWeight: 110, bestE1rm: 121 },
  sessions: [
    { workoutId: 8, startedAt: '2026-09-20T17:00:00.000Z', sets: 1, reps: 3, volume: 330, avgWeight: 110, maxWeight: 110, bestE1rm: 121 },
    { workoutId: 5, startedAt: '2026-09-18T17:00:00.000Z', sets: 2, reps: 18, volume: 1720, avgWeight: 90, maxWeight: 95, bestE1rm: 116.67 },
  ],
};

describe('the stats of an exercise', () => {
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

  it('draws max and average session by session, the oldest on the left', async () => {
    fakeApi().on('GET /stats/exercises/1', SQUAT);
    render(ExerciseStatsPage, { id: 1 });
    const chart = await screen.findByRole('img', { name: 'Andamento di Squat in 2 sessioni: massimo da 95 a 110 kg, media da 90 a 110 kg.' });
    const lines = [...chart.querySelectorAll('path.line')];
    expect(lines.map((line) => line.getAttribute('data-series'))).toEqual(['max', 'avg']);
    const points = (series: string) => [...chart.querySelectorAll(`circle[data-series="${series}"]`)].map((dot) => ({
      x: Number(dot.getAttribute('cx')), y: Number(dot.getAttribute('cy')), value: dot.getAttribute('data-value'),
    }));
    const max = points('max');
    expect(max.map((point) => point.value)).toEqual(['95', '110']);
    // later to the right, heavier higher up
    expect(max[1]!.x).toBeGreaterThan(max[0]!.x);
    expect(max[1]!.y).toBeLessThan(max[0]!.y);
    expect(points('avg').map((point) => point.value)).toEqual(['90', '110']);
    expect(within(chart.parentElement!).getByText('Massimo')).toBeInTheDocument();
    expect(within(chart.parentElement!).getByText('Media')).toBeInTheDocument();
    // the range is the data's own, not the padded bounds of the drawing
    expect(within(chart.parentElement!).getByText('90–110 kg')).toBeInTheDocument();
  });

  it('keeps the table of sessions in rows on a phone too, the header once', async () => {
    fakeApi().on('GET /stats/exercises/1', SQUAT);
    render(ExerciseStatsPage, { id: 1 });
    const table = await screen.findByRole('table');
    expect(table.closest('.scorre')).toHaveClass('in-riga');
    expect(within(table).getAllByRole('row')[0]!.parentElement!.tagName).toBe('THEAD');
  });

  it('draws nothing with a single session: one point is no trend', async () => {
    fakeApi().on('GET /stats/exercises/1', { ...SQUAT, overall: { ...SQUAT.overall, sessions: 1 }, sessions: SQUAT.sessions.slice(0, 1) });
    render(ExerciseStatsPage, { id: 1 });
    await screen.findByRole('table');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
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

  it('of always, the overview, shows its shape while it loads', () => {
    silentApi();
    render(StatsPage);
    expect(document.querySelector('.skeleton')).toBeInTheDocument();
  });
});

describe('while it loads, the page', () => {
  it('shows its shape', () => {
    silentApi();
    render(ExerciseStatsPage, { id: 1 });
    expect(document.querySelector('.skeleton')).toBeInTheDocument();
  });
});

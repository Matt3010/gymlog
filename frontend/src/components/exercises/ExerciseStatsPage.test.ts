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

  it('draws no chart', async () => {
    fakeApi().on('GET /stats/exercises/1', SQUAT);
    render(ExerciseStatsPage, { id: 1 });
    await screen.findByRole('table');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
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
  it('shows its shape', () => {
    silentApi();
    render(ExerciseStatsPage, { id: 1 });
    expect(document.querySelector('.skeleton')).toBeInTheDocument();
  });
});

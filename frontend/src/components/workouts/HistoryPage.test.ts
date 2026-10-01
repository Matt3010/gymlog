import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { WorkoutSummary } from '../../lib/types';
import { fakeApi, silentApi } from '../../test/fake-api';
import HistoryPage from './HistoryPage.svelte';

function workout(id: number): WorkoutSummary {
  return {
    id, planDayId: null, planName: 'Forza', dayName: 'A', startedAt: '2026-09-20T17:00:00.000Z', finishedAt: '2026-09-20T18:00:00.000Z',
    notes: null, exercises: 2, sets: 4, volume: 1520.5,
  };
}

const page = (from: number, count: number) => Array.from({ length: count }, (_, i) => workout(from + i));
const links = () => screen.queryAllByRole('link').map((link) => link.getAttribute('href'));

describe('the history', () => {
  it('lists the workouts with their numbers, each opening its page', async () => {
    fakeApi().on('GET /workouts?limit=20&offset=0', [workout(3), { ...workout(2), finishedAt: null, planName: null, dayName: null, sets: 1, volume: 0 }]);
    render(HistoryPage);
    expect(await screen.findByRole('link', { name: 'dom 20 set Forza · A 4 serie · 1520,5 kg' })).toHaveAttribute('href', '/allenamenti/3');
    expect(screen.getByRole('link', { name: 'dom 20 set Allenamento libero · in corso 1 serie · 0 kg' })).toHaveAttribute('href', '/allenamenti/2');
    expect(screen.queryByRole('button', { name: 'Carica altri' })).not.toBeInTheDocument();
  });

  it('loads twenty more from where it got, while a page comes full', async () => {
    const api = fakeApi()
      .on('GET /workouts?limit=20&offset=0', page(100, 20))
      .on('GET /workouts?limit=20&offset=20', page(200, 3));
    render(HistoryPage);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Carica altri' }));
    expect(api.calls.map((call) => call.path)).toEqual(['/workouts?limit=20&offset=0', '/workouts?limit=20&offset=20']);
    await screen.findAllByRole('link', { name: /4 serie/ });
    expect(links()).toHaveLength(23);
    expect(links().at(-1)).toBe('/allenamenti/202');
    expect(screen.queryByRole('button', { name: 'Carica altri' })).not.toBeInTheDocument();
  });

  it('loads only the first page by itself', async () => {
    const api = fakeApi()
      .on('GET /workouts?limit=20&offset=0', page(100, 20))
      .on('GET /workouts?limit=20&offset=20', page(200, 20))
      .on('GET /workouts?limit=20&offset=40', page(300, 3));
    render(HistoryPage);
    await screen.findAllByRole('link', { name: /4 serie/ });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(api.calls.map((call) => call.path)).toEqual(['/workouts?limit=20&offset=0']);
    expect(links()).toHaveLength(20);
  });

  it('says there is nothing yet', async () => {
    fakeApi().on('GET /workouts?limit=20&offset=0', []);
    render(HistoryPage);
    expect(await screen.findByText('Nessun allenamento, per ora.')).toBeInTheDocument();
  });

  it('says why it cannot load', async () => {
    fakeApi().on('GET /workouts?limit=20&offset=0', { status: 502 });
    render(HistoryPage);
    expect(await screen.findByRole('alert')).toHaveTextContent('Il server non si raggiunge adesso. Riprova fra poco.');
  });

  it('shows the shape of the page while it loads', () => {
    silentApi();
    render(HistoryPage);
    expect(document.querySelector('.skeleton')).toBeInTheDocument();
  });
});

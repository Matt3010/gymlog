import { render, screen, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import type { UserUsage } from '../../lib/types';
import { fakeApi } from '../../test/fake-api';
import Host from '../../test/Host.svelte';
import AdminPage from './AdminPage.svelte';

const now = Date.now();
const ago = (days: number) => new Date(now - days * 86_400_000).toISOString();

const usage = (id: number, change: Partial<UserUsage> = {}): UserUsage => ({
  id, username: `u${id}`, isAdmin: false, createdAt: ago(60), lastWorkoutAt: null, lastSeenAt: null,
  workouts: 0, workoutsLast30Days: 0, sets: 0, exercises: 0, plans: 0, ...change,
});

describe('the admin page', () => {
  it('sums up the users, then says for each what they have and when they were last there', async () => {
    fakeApi().on('GET /admin/usage', {
      users: [
        usage(1, { username: 'matt3010', isAdmin: true, lastSeenAt: ago(0), lastWorkoutAt: ago(1), workouts: 14, workoutsLast30Days: 9, sets: 230, exercises: 8, plans: 2 }),
        usage(3, { username: 'dek', lastSeenAt: ago(10), lastWorkoutAt: ago(12), workouts: 3, workoutsLast30Days: 3, sets: 41, exercises: 2, plans: 1 }),
        usage(4, { username: 'giorgia', lastSeenAt: ago(45), exercises: 2 }),
        usage(2, { username: 'grace' }),
      ],
    });
    render(Host, { page: AdminPage });
    expect(await screen.findByRole('heading', { name: 'Utilizzo' })).toBeInTheDocument();

    const totals = within(await screen.findByRole('region', { name: 'In tutto' }));
    const tile = (name: string) => totals.getByText(name).nextElementSibling?.textContent;
    expect(tile('Utenti')).toBe('4');
    expect(tile('Attivi in 7 giorni')).toBe('1');
    expect(tile('Attivi in 30 giorni')).toBe('2');
    expect(tile('Allenamenti in 30 giorni')).toBe('12');

    const rows = within(screen.getByRole('region', { name: 'Utenti' })).getAllByRole('listitem').map((row) => row.textContent?.replace(/\s+/g, ' ').trim());
    expect(rows).toEqual([
      'matt3010 admin Visto oggi · ultimo allenamento ieri 14 allenamenti (9 in 30 giorni) · 230 serie · 8 esercizi · 2 schede',
      'dek Visto 10 giorni fa · ultimo allenamento 12 giorni fa 3 allenamenti (3 in 30 giorni) · 41 serie · 2 esercizi · 1 scheda',
      'giorgia Visto 45 giorni fa · nessun allenamento 0 allenamenti · 0 serie · 2 esercizi · 0 schede',
      'grace Mai visto · nessun allenamento 0 allenamenti · 0 serie · 0 esercizi · 0 schede',
    ]);
  });

  it('says why, to someone who does not run the app', async () => {
    fakeApi().on('GET /admin/usage', { status: 403, body: { error: 'Solo per chi amministra l’app.' } });
    render(Host, { page: AdminPage });
    expect(await screen.findByRole('alert')).toHaveTextContent('Solo per chi amministra l’app.');
  });
});

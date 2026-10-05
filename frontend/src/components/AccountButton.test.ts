import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { session } from '../lib/client';
import { nav } from '../lib/nav.svelte';
import { fakeApi } from '../test/fake-api';
import Host from '../test/Host.svelte';
import PlanEditorPage from './plans/PlanEditorPage.svelte';
import HistoryPage from './workouts/HistoryPage.svelte';

/** The menu the account button opens: its title, then its entries. */
const menu = () => [...document.querySelectorAll('#pick-popover .what, #pick-popover .one .name')].map((one) => one.textContent);

describe('the account', () => {
  it('sits at the top right of every page, a page inside another too, with the initial of the name', async () => {
    fakeApi().on('GET /workouts', []);
    session.user = { id: 1, username: 'matt', isAdmin: false };
    const { unmount } = render(Host, { page: HistoryPage });
    const account = await screen.findByRole('button', { name: 'Account di matt' });
    expect(account).toHaveTextContent('M');
    expect(account.closest('header')).not.toBeNull();
    unmount();
    render(Host, { page: PlanEditorPage, params: { id: null } });
    expect(screen.getByRole('button', { name: 'Account di matt' }).closest('header')).not.toBeNull();
  });

  it('opens a menu with the profile and the way out; usage too for an admin', async () => {
    fakeApi().on('GET /workouts', []);
    session.user = { id: 1, username: 'matt', isAdmin: false };
    const { unmount } = render(Host, { page: HistoryPage });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Account di matt' }));
    expect(menu()).toEqual(['matt', 'Profilo', 'Esci']);
    await user.click(screen.getByRole('button', { name: 'Profilo' }));
    expect(nav.path).toBe('/profile');
    unmount();

    session.user = { id: 1, username: 'matt', isAdmin: true };
    render(Host, { page: HistoryPage });
    await user.click(await screen.findByRole('button', { name: 'Account di matt' }));
    expect(menu()).toEqual(['matt', 'Profilo', 'Utilizzo dell’app', 'Esci']);
    await user.click(screen.getByRole('button', { name: 'Utilizzo dell’app' }));
    expect(nav.path).toBe('/admin');
  });

  it('logs out from any page, after asking', async () => {
    const api = fakeApi().on('GET /workouts', []).on('POST /auth/logout', { ok: true });
    session.user = { id: 1, username: 'matt', isAdmin: false };
    render(Host, { page: HistoryPage });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Account di matt' }));
    await user.click(screen.getByRole('button', { name: 'Esci' }));
    const question = within(await screen.findByRole('alertdialog', { name: 'Uscire da gymlog?' }));
    expect(api.changes()).toEqual([]);
    await user.click(question.getByRole('button', { name: 'Esci' }));
    await vi.waitFor(() => expect(api.changes()).toEqual([{ route: 'POST /auth/logout', body: undefined }]));
  });
});

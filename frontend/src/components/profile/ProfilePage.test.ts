import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { session } from '../../lib/client';
import { toast } from '../../lib/toast.svelte';
import { fakeApi } from '../../test/fake-api';
import Host from '../../test/Host.svelte';
import ProfilePage from './ProfilePage.svelte';

const ME = { id: 1, username: 'matt', isAdmin: false, createdAt: '2026-10-01T09:00:00.000Z' };

describe('the profile', () => {
  it('says who you are and since when', async () => {
    fakeApi().on('GET /auth/me', { user: ME });
    session.user = ME;
    render(Host, { page: ProfilePage });
    expect(await screen.findByRole('heading', { name: 'Profilo' })).toBeInTheDocument();
    expect(screen.getByText('matt')).toBeInTheDocument();
    expect(screen.getByText('Iscritto dal 1 ott 2026')).toBeInTheDocument();
  });

  it('changes the password with the current one, the new one written twice', async () => {
    const api = fakeApi().on('POST /auth/password', { ok: true });
    session.user = ME;
    render(Host, { page: ProfilePage });
    const user = userEvent.setup();
    const change = screen.getByRole('button', { name: 'Cambia la password' });
    expect(change).toBeDisabled();
    await user.type(screen.getByLabelText('Password attuale'), 'old password!');
    await user.type(screen.getByLabelText('Nuova password'), 'new password!!');
    await user.type(screen.getByLabelText('Ripeti la nuova password'), 'new password!?');
    await user.click(change);
    expect(screen.getByRole('alert')).toHaveTextContent('Le due password non coincidono.');
    expect(api.changes()).toEqual([]);
    await user.clear(screen.getByLabelText('Ripeti la nuova password'));
    await user.type(screen.getByLabelText('Ripeti la nuova password'), 'new password!!');
    await user.click(change);
    expect(api.changes()).toEqual([{ route: 'POST /auth/password', body: { current: 'old password!', next: 'new password!!' } }]);
    expect(toast.message).toBe('Password cambiata. Le altre sessioni sono chiuse.');
    expect(screen.getByLabelText('Password attuale')).toHaveValue('');
    expect(screen.getByLabelText('Nuova password')).toHaveValue('');
  });

  it('says why a new password is refused, and keeps what is written', async () => {
    fakeApi().on('POST /auth/password', { status: 400, body: { error: 'La password attuale non è giusta.' } });
    session.user = ME;
    render(Host, { page: ProfilePage });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Password attuale'), 'wrong one!!');
    await user.type(screen.getByLabelText('Nuova password'), 'new password!!');
    await user.type(screen.getByLabelText('Ripeti la nuova password'), 'new password!!');
    await user.click(screen.getByRole('button', { name: 'Cambia la password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La password attuale non è giusta.');
    expect(screen.getByLabelText('Password attuale')).toHaveValue('wrong one!!');
  });
});

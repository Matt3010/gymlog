import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../../App.svelte';
import { session } from '../../lib/client';
import { fakeApi } from '../../test/fake-api';
import LoginScreen from './LoginScreen.svelte';

const ANNA = { id: 1, username: 'anna' };

describe('the login screen', () => {
  it('sends the name without spaces around and the password as typed, and lets you in', async () => {
    const api = fakeApi().on('POST /auth/login', { user: ANNA });
    render(LoginScreen);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Utente'), '  anna ');
    await user.type(screen.getByLabelText('Password', { selector: 'input' }), ' segreta lunga ');
    await user.click(screen.getByRole('button', { name: 'Entra' }));
    expect(api.changes()).toEqual([{ route: 'POST /auth/login', body: { username: 'anna', password: ' segreta lunga ' } }]);
    expect(api.calls[0]?.headers['x-gymlog']).toBe('1');
    expect(session.status).toBe('in');
    expect(session.user).toEqual(ANNA);
  });

  it('says why when the password is wrong, and empties it', async () => {
    fakeApi().on('POST /auth/login', { status: 401, body: { error: 'Utente o password errati.' } });
    render(LoginScreen);
    const user = userEvent.setup();
    const password = screen.getByLabelText('Password', { selector: 'input' });
    await user.type(screen.getByLabelText('Utente'), 'anna');
    await user.type(password, 'sbagliata');
    await user.click(screen.getByRole('button', { name: 'Entra' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Utente o password errati.');
    expect(password).toHaveValue('');
    expect(session.status).not.toBe('in');
  });

  it('shows the password on request', async () => {
    fakeApi();
    render(LoginScreen);
    const password = screen.getByLabelText('Password', { selector: 'input' });
    expect(password).toHaveAttribute('type', 'password');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Mostra la password' }));
    expect(password).toHaveAttribute('type', 'text');
  });
});

describe('the app', () => {
  const home = (api: ReturnType<typeof fakeApi>) => api.on('GET /plans', []).on('GET /workouts?limit=6&offset=0', []);

  it('opens on the home of whoever is signed in, with the sections below', async () => {
    home(fakeApi().on('GET /auth/me', { user: ANNA }));
    render(App);
    expect(await screen.findByRole('heading', { name: 'Allenati' })).toBeInTheDocument();
    const sections = screen.getByRole('navigation', { name: 'Sezioni' });
    expect([...sections.querySelectorAll('a')].map((link) => link.textContent?.trim())).toEqual(['Allenati', 'Schede', 'Esercizi', 'Storico', 'Statistiche']);
    expect(screen.getByRole('link', { name: 'Allenati' })).toHaveAttribute('aria-current', 'page');
  });

  it('renews an expired access before showing the door', async () => {
    const api = home(fakeApi().on('GET /auth/me', { status: 401, body: { error: 'Accesso richiesto.' } }).on('POST /auth/refresh', { user: ANNA }));
    render(App);
    expect(await screen.findByRole('heading', { name: 'Allenati' })).toBeInTheDocument();
    expect(api.changes().map((change) => change.route)).toEqual(['POST /auth/refresh']);
  });

  it('shows the door when the renewal is refused too', async () => {
    fakeApi().on('GET /auth/me', { status: 401, body: {} }).on('POST /auth/refresh', { status: 401, body: {} });
    render(App);
    expect(await screen.findByRole('heading', { name: 'Bentornato' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Sezioni' })).not.toBeInTheDocument();
  });

  it('says the server does not answer, and tries again on request', async () => {
    const api = fakeApi().on('GET /auth/me', { status: 503 });
    render(App);
    expect(await screen.findByRole('heading', { name: 'Il server non risponde' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Il server non si raggiunge adesso. Riprova fra poco.');
    home(api.on('GET /auth/me', { user: ANNA }));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Riprova' }));
    expect(await screen.findByRole('heading', { name: 'Allenati' })).toBeInTheDocument();
  });

  it('goes back to the door when a page finds the access ended', async () => {
    fakeApi()
      .on('GET /auth/me', { user: ANNA })
      .on('GET /plans', { status: 401, body: {} })
      .on('GET /workouts?limit=6&offset=0', { status: 401, body: {} })
      .on('POST /auth/refresh', { status: 401, body: {} });
    render(App);
    expect(await screen.findByRole('heading', { name: 'Bentornato' })).toBeInTheDocument();
  });

  it('signs out from home', async () => {
    const api = home(fakeApi().on('GET /auth/me', { user: ANNA }).on('POST /auth/logout', { ok: true }));
    render(App);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Esci (anna)' }));
    expect(await screen.findByRole('heading', { name: 'Bentornato' })).toBeInTheDocument();
    expect(api.changes().map((change) => change.route)).toEqual(['POST /auth/logout']);
  });
});

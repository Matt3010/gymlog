import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App.svelte';
import { nav } from './lib/nav.svelte';
import { ui } from './lib/ui.svelte';
import { fakeApi } from './test/fake-api';
import Probe from './test/Probe.svelte';

/*
 * What the app hosts over every page: the windows (`ui.openModal`), the
 * questions attached to a button (`ui.askSure`), Esc one layer at a time,
 * the line saying the network is missing.
 */

const ANNA = { id: 1, username: 'anna' };

async function signedIn() {
  fakeApi().on('GET /auth/me', { user: ANNA }).on('GET /plans', []).on('GET /workouts?limit=6&offset=0', []);
  render(App);
  await screen.findByRole('heading', { name: 'Allenati' });
}

afterEach(() => ui.closeAll());

describe('a window', () => {
  it('opens over the page with its component, and Esc closes it', async () => {
    await signedIn();
    ui.openModal({ title: 'Prova', view: Probe, props: { text: 'dentro la finestra' } });
    expect(await screen.findByRole('dialog', { name: 'Prova' })).toHaveTextContent('dentro la finestra');
    expect(document.body).toHaveClass('sheet-open');
    await userEvent.setup().keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body).not.toHaveClass('sheet-open');
  });

  it('closes when the page changes', async () => {
    await signedIn();
    ui.openModal({ title: 'Prova', view: Probe, props: { text: 'x' } });
    await screen.findByRole('dialog');
    nav.go('/storico');
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('with something written and not saved asks before the page changes, and stays on «Continua a scrivere»', async () => {
    await signedIn();
    ui.openModal({ title: 'Prova', view: Probe, props: { text: 'x', dirty: true } });
    await screen.findByRole('dialog');
    nav.go('/storico');
    expect(await screen.findByRole('alertdialog', { name: 'Buttare le modifiche?' })).toBeInTheDocument();
    expect(nav.path).toBe('/');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Continua a scrivere' }));
    expect(screen.getByRole('dialog', { name: 'Prova' })).toBeInTheDocument();
    expect(nav.path).toBe('/');
  });

  it('with something not saved goes on the page asked for after «Butta»', async () => {
    await signedIn();
    ui.openModal({ title: 'Prova', view: Probe, props: { text: 'x', dirty: true } });
    await screen.findByRole('dialog');
    nav.go('/storico');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Butta' }));
    expect(nav.path).toBe('/storico');
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('a question attached to a button', () => {
  it('says what happens, and goes on only with its verb', async () => {
    await signedIn();
    const onYes = vi.fn();
    const anchor = await screen.findByRole('button', { name: 'Allenamento libero' });
    ui.askSure(anchor, { title: 'Eliminare la scheda «Forza»?', detail: 'Gli allenamenti fatti restano.', verb: 'Elimina', onYes });
    const question = await screen.findByRole('alertdialog', { name: 'Eliminare la scheda «Forza»?' });
    expect(question).toHaveTextContent('Gli allenamenti fatti restano.');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(onYes).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    ui.askSure(anchor, { title: 'Eliminare?', verb: 'Elimina', onYes });
    await user.click(await screen.findByRole('button', { name: 'Elimina' }));
    expect(onYes).toHaveBeenCalledOnce();
  });

  it('goes away with Esc before the window under it', async () => {
    await signedIn();
    ui.openModal({ title: 'Prova', view: Probe, props: { text: 'x' } });
    const inside = await screen.findByRole('button', { name: 'Chiudi' });
    ui.askSure(inside, { title: 'Sicuro?', verb: 'Sì', onYes: () => undefined });
    await screen.findByRole('alertdialog');
    await userEvent.setup().keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Prova' })).toBeInTheDocument();
  });
});

describe('the network', () => {
  it('missing is said on every page, until it is back', async () => {
    await signedIn();
    window.dispatchEvent(new Event('offline'));
    expect(await screen.findByRole('status')).toHaveTextContent('Il telefono è senza rete. Quello che segni adesso non arriva.');
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(screen.queryByText(/senza rete/)).not.toBeInTheDocument());
  });
});

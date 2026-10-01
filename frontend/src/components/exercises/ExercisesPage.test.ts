import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { toast } from '../../lib/toast.svelte';
import type { Exercise } from '../../lib/types';
import { type Call, fakeApi, silentApi } from '../../test/fake-api';
import Host from '../../test/Host.svelte';
import ExercisesPage from './ExercisesPage.svelte';

const SQUAT: Exercise = { id: 1, name: 'Squat', muscleGroup: 'Gambe', notes: null };
const SQUAT_STATS = { exerciseId: 1, name: 'Squat', sessions: 6, avgWeight: 81.25, maxWeight: 100, lastAt: '2026-09-18T17:00:00.000Z' };
const PANCA: Exercise = { id: 2, name: 'Panca piana', muscleGroup: null, notes: 'presa media' };

/** The names in the list, top to bottom. */
const names = () => [...document.querySelectorAll('.row .name')].map((node) => node.textContent);
const sheet = () => within(screen.getByRole('dialog'));

describe('the exercises', () => {
  it('are listed with their group, each opening its stats page', async () => {
    fakeApi().on('GET /stats/exercises', []).on('GET /exercises', [PANCA, SQUAT]);
    render(Host, { page: ExercisesPage });
    expect(await screen.findByRole('link', { name: /^Squat Gambe/ })).toHaveAttribute('href', '/esercizi/1');
    expect(names()).toEqual(['Panca piana', 'Squat']);
    expect(screen.getByRole('heading', { name: 'Esercizi' }).parentElement).toHaveTextContent('2');
  });

  it('show under the name how each is going, only for those done at least once', async () => {
    fakeApi().on('GET /stats/exercises', [SQUAT_STATS]).on('GET /exercises', [PANCA, SQUAT]);
    render(Host, { page: ExercisesPage });
    const squat = await screen.findByRole('link', { name: /^Squat/ });
    expect(squat).toHaveTextContent('media 81,25 kg · max 100 kg · 6 sessioni · l’ultima ven 18 set');
    expect(screen.getByRole('link', { name: /^Panca piana/ }).textContent).not.toMatch(/media|sessioni/);
    // every row has its second line: an exercise never done says so
    expect(screen.getByRole('link', { name: /^Panca piana/ })).toHaveTextContent('Nessuna sessione ancora');
  });

  it('say «1 sessione» for one', async () => {
    fakeApi().on('GET /stats/exercises', [{ ...SQUAT_STATS, sessions: 1 }]).on('GET /exercises', [SQUAT]);
    render(Host, { page: ExercisesPage });
    expect(await screen.findByRole('link', { name: /^Squat/ })).toHaveTextContent('1 sessione · l’ultima');
  });

  it('are still listed when their numbers cannot be read', async () => {
    fakeApi().on('GET /stats/exercises', { status: 500, body: {} }).on('GET /exercises', [SQUAT]);
    render(Host, { page: ExercisesPage });
    expect(await screen.findByRole('link', { name: /^Squat Gambe/ })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('invite to add the first one by name, from the one field at the top', async () => {
    fakeApi().on('GET /stats/exercises', []).on('GET /exercises', []);
    render(Host, { page: ExercisesPage });
    expect(await screen.findByText('Nessun esercizio, per ora.')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Cerca o crea un esercizio' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Crea/ })).not.toBeInTheDocument();
  });

  it('have one field at the top, to search and to create, and nothing else that adds', async () => {
    fakeApi().on('GET /stats/exercises', []).on('GET /exercises', [SQUAT]);
    render(Host, { page: ExercisesPage });
    await screen.findByRole('button', { name: 'Modifica Squat' });
    expect(screen.getAllByRole('searchbox')).toHaveLength(1);
    expect(screen.queryByPlaceholderText('Nuovo esercizio')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nuovo' })).not.toBeInTheDocument();
    // the field comes before the list
    const list = screen.getByRole('link', { name: /^Squat/ });
    expect(screen.getByRole('searchbox', { name: 'Cerca o crea un esercizio' }).compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keep their name when corrected: an empty one is refused before asking the server', async () => {
    const api = fakeApi().on('GET /stats/exercises', []).on('GET /exercises', [SQUAT]);
    render(Host, { page: ExercisesPage });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Modifica Squat' }));
    await user.clear(sheet().getByPlaceholderText('Panca piana'));
    await user.tab();
    expect(sheet().getByRole('alert')).toHaveTextContent('L’esercizio ha bisogno di un nome.');
    expect(api.changes()).toEqual([]);
  });

  it('say so when the new name is already used, and keep the window open', async () => {
    fakeApi().on('GET /stats/exercises', []).on('GET /exercises', [PANCA, SQUAT]).on('PATCH /exercises/1', { status: 409, body: { error: 'Esiste già un esercizio con questo nome.' } });
    render(Host, { page: ExercisesPage });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Modifica Squat' }));
    const name = sheet().getByPlaceholderText('Panca piana');
    await user.clear(name);
    await user.type(name, 'panca piana{Enter}');
    expect(await sheet().findByRole('alert')).toHaveTextContent('Esiste già un esercizio con questo nome.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('are corrected from their row', async () => {
    const api = fakeApi().on('GET /stats/exercises', []).on('GET /exercises', [PANCA, SQUAT])
      .on('PATCH /exercises/2', { id: 2, name: 'Panca inclinata', muscleGroup: 'Petto', notes: 'presa media' });
    render(Host, { page: ExercisesPage });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Modifica Panca piana' }));
    const name = sheet().getByPlaceholderText('Panca piana');
    expect(name).toHaveValue('Panca piana');
    expect(sheet().getByPlaceholderText('Presa, sedile, come si esegue')).toHaveValue('presa media');
    await user.clear(name);
    await user.type(name, 'Panca inclinata');
    // each field is saved when you leave it, with what the others say now
    await user.tab();
    await vi.waitFor(() => expect(api.changes()).toHaveLength(1));
    expect(api.changes()[0]).toEqual({ route: 'PATCH /exercises/2', body: { name: 'Panca inclinata', muscleGroup: null, notes: 'presa media' } });
    await user.type(sheet().getByPlaceholderText('Petto'), 'Petto');
    await user.tab();
    await vi.waitFor(() => expect(api.changes()).toHaveLength(2));
    expect(api.changes()[1]).toEqual({ route: 'PATCH /exercises/2', body: { name: 'Panca inclinata', muscleGroup: 'Petto', notes: 'presa media' } });
    expect(sheet().getByRole('status', { name: 'Salvataggio' })).toHaveTextContent('Salvata');
    expect(sheet().queryByRole('button', { name: 'Salva' })).not.toBeInTheDocument();
    expect(names()).toEqual(['Panca inclinata', 'Squat']);
    // leaving a field unchanged sends nothing
    await user.click(sheet().getByPlaceholderText('Presa, sedile, come si esegue'));
    await user.tab();
    expect(api.changes()).toHaveLength(2);
  });

  it('are deleted after saying yes to the question', async () => {
    const api = fakeApi().on('GET /stats/exercises', []).on('GET /exercises', [PANCA, SQUAT]).on('DELETE /exercises/1', { ok: true });
    render(Host, { page: ExercisesPage });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Modifica Squat' }));
    const remove = sheet().getByRole('button', { name: 'Elimina l’esercizio «Squat»' });
    // destructive, so red like every other delete
    expect(remove).toHaveClass('is-danger');
    // at the top right of its window, next to the close
    expect(remove.closest('header')).not.toBeNull();
    await user.click(remove);
    const question = within(await screen.findByRole('alertdialog', { name: 'Eliminare l’esercizio «Squat»?' }));
    expect(api.changes()).toEqual([]);
    await user.click(question.getByRole('button', { name: 'Elimina' }));
    expect(api.changes()).toEqual([{ route: 'DELETE /exercises/1', body: undefined }]);
    expect(names()).toEqual(['Panca piana']);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(toast.message).toBe('Esercizio eliminato.');
  });

  it('in use are not deleted, and the sheet says why', async () => {
    fakeApi().on('GET /stats/exercises', []).on('GET /exercises', [SQUAT])
      .on('DELETE /exercises/1', { status: 409, body: { error: 'Non si può eliminare: è usato in una scheda o in un allenamento.' } });
    render(Host, { page: ExercisesPage });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Modifica Squat' }));
    await user.click(sheet().getByRole('button', { name: 'Elimina l’esercizio «Squat»' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Elimina' }));
    expect(await sheet().findByRole('alert')).toHaveTextContent('Non si può eliminare: è usato in una scheda o in un allenamento.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(names()).toEqual(['Squat']);
  });

  it('are searched by name or group as you type', async () => {
    fakeApi().on('GET /stats/exercises', []).on('GET /exercises', [PANCA, SQUAT, { id: 3, name: 'Affondi', muscleGroup: 'Gambe', notes: null }]);
    render(Host, { page: ExercisesPage });
    const user = userEvent.setup();
    await screen.findByRole('button', { name: 'Modifica Squat' });
    await user.type(screen.getByRole('searchbox', { name: 'Cerca o crea un esercizio' }), 'gambe');
    expect(names()).toEqual(['Affondi', 'Squat']);
    await user.clear(screen.getByRole('searchbox', { name: 'Cerca o crea un esercizio' }));
    await user.type(screen.getByRole('searchbox', { name: 'Cerca o crea un esercizio' }), 'panca');
    expect(names()).toEqual(['Panca piana']);
  });

  it('offer to create what is typed when no exercise has exactly that name, right under the field', async () => {
    fakeApi().on('GET /stats/exercises', []).on('GET /exercises', [PANCA, SQUAT]);
    render(Host, { page: ExercisesPage });
    const user = userEvent.setup();
    await screen.findByRole('button', { name: 'Modifica Squat' });
    await user.type(screen.getByRole('searchbox', { name: 'Cerca o crea un esercizio' }), '  ');
    expect(screen.queryByRole('button', { name: /^Crea/ })).not.toBeInTheDocument();
    await user.type(screen.getByRole('searchbox', { name: 'Cerca o crea un esercizio' }), 'Panca');
    // a part of a name is not that name: it can still be created
    const create = screen.getByRole('button', { name: 'Crea «Panca»' });
    expect(create).toHaveClass('primary');
    expect(names()).toEqual(['Panca piana']);
    await user.clear(screen.getByRole('searchbox', { name: 'Cerca o crea un esercizio' }));
    await user.type(screen.getByRole('searchbox', { name: 'Cerca o crea un esercizio' }), 'SQUAT ');
    // the same name, any case: it is already there, nothing to create
    expect(screen.queryByRole('button', { name: /^Crea/ })).not.toBeInTheDocument();
    expect(names()).toEqual(['Squat']);
  });

  it('are created with «Crea», or Enter, in their place, and the field empties', async () => {
    const api = fakeApi().on('GET /stats/exercises', []).on('GET /exercises', [{ id: 3, name: 'Curl', muscleGroup: 'Bicipiti', notes: null }, SQUAT])
      .on('POST /exercises', (call: Call) => ({ id: 9, name: (call.body as { name: string }).name, muscleGroup: null, notes: null }));
    render(Host, { page: ExercisesPage });
    const user = userEvent.setup();
    await screen.findByRole('button', { name: 'Modifica Squat' });
    await user.type(screen.getByRole('searchbox', { name: 'Cerca o crea un esercizio' }), ' Dip ');
    await user.click(screen.getByRole('button', { name: 'Crea «Dip»' }));
    expect(api.changes()).toEqual([{ route: 'POST /exercises', body: { name: 'Dip', muscleGroup: null, notes: null } }]);
    expect(screen.getByRole('searchbox', { name: 'Cerca o crea un esercizio' })).toHaveValue('');
    expect(names()).toEqual(['Curl', 'Dip', 'Squat']);
    expect(toast.message).toBe('Esercizio aggiunto.');
    await user.type(screen.getByRole('searchbox', { name: 'Cerca o crea un esercizio' }), 'Trazioni{Enter}');
    expect(api.changes().at(-1)).toEqual({ route: 'POST /exercises', body: { name: 'Trazioni', muscleGroup: null, notes: null } });
  });

  it('do not create one that exists, even with Enter', async () => {
    const api = fakeApi().on('GET /stats/exercises', []).on('GET /exercises', [SQUAT]);
    render(Host, { page: ExercisesPage });
    const user = userEvent.setup();
    await screen.findByRole('button', { name: 'Modifica Squat' });
    await user.type(screen.getByRole('searchbox', { name: 'Cerca o crea un esercizio' }), 'squat{Enter}');
    expect(api.changes()).toEqual([]);
  });

  it('say why a new one was refused, and keep what was typed', async () => {
    fakeApi().on('GET /stats/exercises', []).on('GET /exercises', [SQUAT]).on('POST /exercises', { status: 409, body: { error: 'Esiste già un esercizio con questo nome.' } });
    render(Host, { page: ExercisesPage });
    const user = userEvent.setup();
    await screen.findByRole('button', { name: 'Modifica Squat' });
    await user.type(screen.getByRole('searchbox', { name: 'Cerca o crea un esercizio' }), 'Squat bulgaro{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Esiste già un esercizio con questo nome.');
    expect(screen.getByRole('searchbox', { name: 'Cerca o crea un esercizio' })).toHaveValue('Squat bulgaro');
  });

  it('close their window without saving', async () => {
    const api = fakeApi().on('GET /stats/exercises', []).on('GET /exercises', [SQUAT]);
    render(Host, { page: ExercisesPage });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Modifica Squat' }));
    await user.click(sheet().getByRole('button', { name: 'Chiudi' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.changes()).toEqual([]);
  });

  it('say why when the list cannot be read', async () => {
    fakeApi().on('GET /stats/exercises', []).on('GET /exercises', { status: 500, body: {} });
    render(Host, { page: ExercisesPage });
    expect(await screen.findByRole('alert')).toHaveTextContent('Il server si è inceppato mentre rispondeva (codice 500). Riprova fra poco.');
  });

  it('shows the shape of the page while it loads', async () => {
    silentApi();
    render(Host, { page: ExercisesPage });

    // a loader, not a skeleton; and only after a short wait, so a fast load does not flash

    expect(screen.queryByRole('status', { name: 'Caricamento…' })).not.toBeInTheDocument();

    expect(await screen.findByRole('status', { name: 'Caricamento…' })).toBeInTheDocument();

    expect(document.querySelector('.skeleton')).toBeNull();
  });
});

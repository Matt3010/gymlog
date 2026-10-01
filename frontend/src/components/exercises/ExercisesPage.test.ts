import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { toast } from '../../lib/toast.svelte';
import type { Exercise } from '../../lib/types';
import { fakeApi, silentApi } from '../../test/fake-api';
import Host from '../../test/Host.svelte';
import ExercisesPage from './ExercisesPage.svelte';

const SQUAT: Exercise = { id: 1, name: 'Squat', muscleGroup: 'Gambe', notes: null };
const PANCA: Exercise = { id: 2, name: 'Panca piana', muscleGroup: null, notes: 'presa media' };

/** The names in the list, top to bottom. */
const names = () => [...document.querySelectorAll('.row .name')].map((node) => node.textContent);
const sheet = () => within(screen.getByRole('dialog'));

describe('the exercises', () => {
  it('are listed with their group, each with a link to its stats', async () => {
    fakeApi().on('GET /exercises', [PANCA, SQUAT]);
    render(Host, { page: ExercisesPage });
    expect(await screen.findByRole('button', { name: 'Squat Gambe' })).toBeInTheDocument();
    expect(names()).toEqual(['Panca piana', 'Squat']);
    expect(screen.getByRole('link', { name: 'Statistiche dell’esercizio Squat' })).toHaveAttribute('href', '/statistiche/1');
    expect(screen.getByRole('heading', { name: 'Esercizi' }).parentElement).toHaveTextContent('2');
  });

  it('invite to add the first one by name, from the only place that adds', async () => {
    fakeApi().on('GET /exercises', []);
    render(Host, { page: ExercisesPage });
    expect(await screen.findByText('Nessun esercizio, per ora.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Un esercizio nuovo, per nome')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Nuovo|Aggiungi un esercizio/ })).not.toBeInTheDocument();
  });

  it('have one way to add, the row at the bottom, and none in the header', async () => {
    fakeApi().on('GET /exercises', [SQUAT]);
    render(Host, { page: ExercisesPage });
    await screen.findByRole('button', { name: 'Squat Gambe' });
    expect(screen.queryByRole('button', { name: 'Nuovo' })).not.toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('Un esercizio nuovo, per nome')).toHaveLength(1);
  });

  it('keep their name when corrected: an empty one is refused before asking the server', async () => {
    const api = fakeApi().on('GET /exercises', [SQUAT]);
    render(Host, { page: ExercisesPage });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Squat Gambe' }));
    await user.clear(sheet().getByPlaceholderText('Panca piana'));
    await user.click(sheet().getByRole('button', { name: 'Salva' }));
    expect(sheet().getByRole('alert')).toHaveTextContent('L’esercizio ha bisogno di un nome.');
    expect(api.changes()).toEqual([]);
  });

  it('say so when the new name is already used, and keep the window open', async () => {
    fakeApi().on('GET /exercises', [PANCA, SQUAT]).on('PATCH /exercises/1', { status: 409, body: { error: 'Esiste già un esercizio con questo nome.' } });
    render(Host, { page: ExercisesPage });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Squat Gambe' }));
    const name = sheet().getByPlaceholderText('Panca piana');
    await user.clear(name);
    await user.type(name, 'panca piana{Enter}');
    expect(await sheet().findByRole('alert')).toHaveTextContent('Esiste già un esercizio con questo nome.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('are corrected from their row', async () => {
    const api = fakeApi().on('GET /exercises', [PANCA, SQUAT])
      .on('PATCH /exercises/2', { id: 2, name: 'Panca inclinata', muscleGroup: 'Petto', notes: 'presa media' });
    render(Host, { page: ExercisesPage });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Panca piana' }));
    const name = sheet().getByPlaceholderText('Panca piana');
    expect(name).toHaveValue('Panca piana');
    expect(sheet().getByPlaceholderText('Presa, sedile, come si esegue')).toHaveValue('presa media');
    await user.clear(name);
    await user.type(name, 'Panca inclinata');
    await user.type(sheet().getByPlaceholderText('Petto'), 'Petto');
    await user.click(sheet().getByRole('button', { name: 'Salva' }));
    expect(api.changes()).toEqual([{ route: 'PATCH /exercises/2', body: { name: 'Panca inclinata', muscleGroup: 'Petto', notes: 'presa media' } }]);
    expect(names()).toEqual(['Panca inclinata', 'Squat']);
    expect(toast.message).toBe('Esercizio salvato.');
  });

  it('are deleted after saying yes to the question', async () => {
    const api = fakeApi().on('GET /exercises', [PANCA, SQUAT]).on('DELETE /exercises/1', { ok: true });
    render(Host, { page: ExercisesPage });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Squat Gambe' }));
    await user.click(sheet().getByRole('button', { name: 'Elimina' }));
    const question = within(await screen.findByRole('alertdialog', { name: 'Eliminare l’esercizio «Squat»?' }));
    expect(api.changes()).toEqual([]);
    await user.click(question.getByRole('button', { name: 'Elimina' }));
    expect(api.changes()).toEqual([{ route: 'DELETE /exercises/1', body: undefined }]);
    expect(names()).toEqual(['Panca piana']);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(toast.message).toBe('Esercizio eliminato.');
  });

  it('in use are not deleted, and the sheet says why', async () => {
    fakeApi().on('GET /exercises', [SQUAT])
      .on('DELETE /exercises/1', { status: 409, body: { error: 'Non si può eliminare: è usato in una scheda o in un allenamento.' } });
    render(Host, { page: ExercisesPage });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Squat Gambe' }));
    await user.click(sheet().getByRole('button', { name: 'Elimina' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Elimina' }));
    expect(await sheet().findByRole('alert')).toHaveTextContent('Non si può eliminare: è usato in una scheda o in un allenamento.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(names()).toEqual(['Squat']);
  });

  it('are searched by name or group as you type', async () => {
    fakeApi().on('GET /exercises', [PANCA, SQUAT, { id: 3, name: 'Affondi', muscleGroup: 'Gambe', notes: null }]);
    render(Host, { page: ExercisesPage });
    const user = userEvent.setup();
    await screen.findByRole('button', { name: 'Squat Gambe' });
    await user.type(screen.getByRole('searchbox', { name: 'Cerca un esercizio' }), 'gambe');
    expect(names()).toEqual(['Affondi', 'Squat']);
    await user.clear(screen.getByRole('searchbox', { name: 'Cerca un esercizio' }));
    await user.type(screen.getByRole('searchbox', { name: 'Cerca un esercizio' }), 'panca');
    expect(names()).toEqual(['Panca piana']);
  });

  it('are put in order by muscle group, and turned around', async () => {
    fakeApi().on('GET /exercises', [PANCA, SQUAT, { id: 3, name: 'Curl', muscleGroup: 'Bicipiti', notes: null }]);
    render(Host, { page: ExercisesPage });
    const user = userEvent.setup();
    await screen.findByRole('button', { name: 'Squat Gambe' });
    expect(names()).toEqual(['Curl', 'Panca piana', 'Squat']);
    await user.click(screen.getByRole('button', { name: 'Per nome' }));
    await user.click(await screen.findByRole('button', { name: 'Gruppo muscolare' }));
    // without a group last, then by group
    expect(names()).toEqual(['Curl', 'Squat', 'Panca piana']);
    await user.click(screen.getByTitle('In ordine crescente, tocca per girarlo'));
    expect(names()).toEqual(['Squat', 'Curl', 'Panca piana']);
  });

  it('take a new one by name from the row at the bottom', async () => {
    const api = fakeApi().on('GET /exercises', [SQUAT]).on('POST /exercises', { id: 4, name: 'Trazioni', muscleGroup: null, notes: null });
    render(Host, { page: ExercisesPage });
    const user = userEvent.setup();
    await screen.findByRole('button', { name: 'Squat Gambe' });
    await user.type(screen.getByPlaceholderText('Un esercizio nuovo, per nome'), ' Trazioni {Enter}');
    expect(api.changes()).toEqual([{ route: 'POST /exercises', body: { name: 'Trazioni', muscleGroup: null, notes: null } }]);
    expect(names()).toEqual(['Squat', 'Trazioni']);
    expect(screen.getByPlaceholderText('Un esercizio nuovo, per nome')).toHaveValue('');
    expect(toast.message).toBe('Esercizio aggiunto.');
  });

  it('say why the new one from the row was refused, and keep the name', async () => {
    fakeApi().on('GET /exercises', [SQUAT]).on('POST /exercises', { status: 409, body: { error: 'Esiste già un esercizio con questo nome.' } });
    render(Host, { page: ExercisesPage });
    const user = userEvent.setup();
    await screen.findByRole('button', { name: 'Squat Gambe' });
    await user.type(screen.getByPlaceholderText('Un esercizio nuovo, per nome'), 'squat{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Esiste già un esercizio con questo nome.');
    expect(screen.getByPlaceholderText('Un esercizio nuovo, per nome')).toHaveValue('squat');
  });

  it('close their window without saving', async () => {
    const api = fakeApi().on('GET /exercises', [SQUAT]);
    render(Host, { page: ExercisesPage });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Squat Gambe' }));
    await user.click(sheet().getByRole('button', { name: 'Chiudi' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.changes()).toEqual([]);
  });

  it('say why when the list cannot be read', async () => {
    fakeApi().on('GET /exercises', { status: 500, body: {} });
    render(Host, { page: ExercisesPage });
    expect(await screen.findByRole('alert')).toHaveTextContent('Il server si è inceppato mentre rispondeva (codice 500). Riprova fra poco.');
  });

  it('shows the shape of the page while it loads', () => {
    silentApi();
    render(Host, { page: ExercisesPage });
    expect(document.querySelector('.skeleton')).toBeInTheDocument();
  });
});

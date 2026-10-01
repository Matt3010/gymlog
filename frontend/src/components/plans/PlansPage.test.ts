import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { nav } from '../../lib/nav.svelte';
import { toast } from '../../lib/toast.svelte';
import type { Exercise, Plan } from '../../lib/types';
import { type Call, fakeApi, silentApi } from '../../test/fake-api';
import Host from '../../test/Host.svelte';
import PlanEditorPage from './PlanEditorPage.svelte';
import PlansPage from './PlansPage.svelte';

const SQUAT: Exercise = { id: 1, name: 'Squat', muscleGroup: 'Gambe', notes: null };
const PANCA: Exercise = { id: 2, name: 'Panca piana', muscleGroup: null, notes: null };
const REMATORE: Exercise = { id: 3, name: 'Rematore', muscleGroup: null, notes: null };

const planExercise = (id: number, exercise: Exercise, position: number, change = {}) => ({
  id, exerciseId: exercise.id, exerciseName: exercise.name, position, sets: 3, reps: '8', restSeconds: 90, notes: null, ...change,
});

const FORZA: Plan = {
  id: 5, name: 'Forza', notes: '3 volte', archived: false,
  days: [
    { id: 51, name: 'A', position: 0, exercises: [planExercise(511, SQUAT, 0, { sets: 5, reps: '5', restSeconds: 180 }), planExercise(512, PANCA, 1)] },
    { id: 52, name: 'B', position: 1, exercises: [planExercise(521, REMATORE, 0, { notes: 'lento' })] },
  ],
};

/** The changes to plans the server got, as sent. */
const planChanges = (api: ReturnType<typeof fakeApi>) => api.changes().filter((change) => change.route.includes('/plans'));
/** Waits for the pause after typing, and for what the server got. */
const settled = (check: () => void) => vi.waitFor(check, { timeout: 3000 });
const status = () => screen.getByRole('status', { name: 'Salvataggio' });
const pause = () => new Promise((resolve) => setTimeout(resolve, 800));

describe('the plans', () => {
  it('in use are listed first, the archived apart, each with its days and exercises', async () => {
    fakeApi().on('GET /plans', [FORZA, { ...FORZA, id: 6, name: 'Estate', archived: true, days: [] }]);
    render(Host, { page: PlansPage });
    expect(await screen.findByRole('link', { name: 'Forza 2 giorni · 3 esercizi' })).toHaveAttribute('href', '/schede/5');
    const archived = within(screen.getByText('Archiviate').parentElement!);
    expect(archived.getByRole('link', { name: 'Estate 0 giorni · 0 esercizi' })).toHaveAttribute('href', '/schede/6');
    expect(screen.getByRole('link', { name: 'Nuova' })).toHaveAttribute('href', '/schede/nuova');
  });

  it('invite to write the first one', async () => {
    fakeApi().on('GET /plans', []);
    render(Host, { page: PlansPage });
    expect(await screen.findByText('Nessuna scheda in uso.')).toBeInTheDocument();
    expect(screen.queryByText('Archiviate')).not.toBeInTheDocument();
  });
});

describe('a new plan', () => {
  it('is written day by day and sent whole, then opened at its address', async () => {
    const api = fakeApi()
      .on('GET /exercises', [PANCA, SQUAT])
      .on('POST /exercises', REMATORE)
      .on('POST /plans', { ...FORZA, id: 9 })
      .on('PUT /plans/9', (call: Call) => ({ ...FORZA, id: 9, ...(call.body as object) }));
    render(Host, { page: PlanEditorPage, params: { id: null } });
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Forza, autunno'), ' Forza ');
    await user.type(screen.getByPlaceholderText('Quante volte a settimana, cosa curare'), '3 volte');

    // Day A: Squat 5 × 5, recupero 180; then Panca with the proposed 3 × 10, 90.
    await user.click(screen.getByRole('button', { name: 'Aggiungi esercizio' }));
    await user.click(await within(screen.getByRole('dialog', { name: 'Aggiungi al giorno A' })).findByRole('button', { name: 'Squat Gambe' }));
    await user.clear(screen.getByLabelText('Serie'));
    await user.type(screen.getByLabelText('Serie'), '5');
    await user.clear(screen.getByLabelText('Ripetizioni'));
    await user.type(screen.getByLabelText('Ripetizioni'), ' 5 ');
    await user.clear(screen.getByLabelText('Recupero (s)'));
    await user.type(screen.getByLabelText('Recupero (s)'), '180');
    await user.click(screen.getByRole('button', { name: 'Aggiungi esercizio' }));
    const picker = within(screen.getByRole('dialog'));
    // the one already in the day is not proposed again
    expect(picker.queryByRole('button', { name: 'Squat Gambe' })).not.toBeInTheDocument();
    await user.click(await picker.findByRole('button', { name: 'Panca piana' }));

    // Day B, with an exercise made from the picker by typing its name.
    await user.click(screen.getByRole('button', { name: 'Aggiungi giorno' }));
    const addButtons = screen.getAllByRole('button', { name: 'Aggiungi esercizio' });
    await user.click(addButtons[1]!);
    const dayB = within(screen.getByRole('dialog', { name: 'Aggiungi al giorno B' }));
    await user.type(dayB.getByPlaceholderText('Nuovo esercizio'), 'Rematore');
    await user.click(dayB.getByRole('button', { name: 'Crea e aggiungi' }));
    await user.type(screen.getAllByLabelText('Note')[3]!, 'lento');

    // created once, as soon as it has a name, then kept up to date as it changes
    await settled(() => expect(planChanges(api).at(-1)?.body).toMatchObject({ days: [{}, { exercises: [{ notes: 'lento' }] }] }));
    expect(planChanges(api).filter((change) => change.route === 'POST /plans')).toHaveLength(1);
    expect(planChanges(api)[0]).toMatchObject({ route: 'POST /plans', body: { name: 'Forza' } });
    expect(planChanges(api).slice(1).every((change) => change.route === 'PUT /plans/9')).toBe(true);
    expect(api.changes().find((change) => change.route === 'POST /exercises')).toEqual({ route: 'POST /exercises', body: { name: 'Rematore', muscleGroup: null, notes: null } });
    // the latest sent, by POST or by a PUT after it, is the whole plan as written
    expect(planChanges(api).at(-1)).toEqual(
      {
        route: planChanges(api).length === 1 ? 'POST /plans' : 'PUT /plans/9',
        body: {
          name: 'Forza', notes: '3 volte', archived: false,
          days: [
            {
              name: 'A',
              exercises: [
                { exerciseId: 1, sets: 5, reps: '5', restSeconds: 180, notes: null },
                { exerciseId: 2, sets: 3, reps: '10', restSeconds: 90, notes: null },
              ],
            },
            { name: 'B', exercises: [{ exerciseId: 3, sets: 3, reps: '10', restSeconds: 90, notes: 'lento' }] },
          ],
        },
      },
    );
    // the address becomes the plan's, without leaving the page being written
    expect(window.location.pathname).toBe('/schede/9');
    expect(screen.getByPlaceholderText('Forza, autunno')).toHaveValue(' Forza ');
    expect(status()).toHaveTextContent('Salvata');
    expect(screen.queryByRole('button', { name: /Salva/ })).not.toBeInTheDocument();
  });

  it('once created is changed with PUT, never created again', async () => {
    const api = fakeApi().on('POST /plans', { ...FORZA, id: 9 }).on('PUT /plans/9', FORZA);
    render(Host, { page: PlanEditorPage, params: { id: null } });
    const user = userEvent.setup();
    const name = screen.getByPlaceholderText('Forza, autunno');
    await user.type(name, 'Forza');
    await settled(() => expect(status()).toHaveTextContent('Salvata'));
    await user.type(name, ' 2');
    await settled(() => expect(planChanges(api)).toHaveLength(2));
    expect(planChanges(api).map((change) => change.route)).toEqual(['POST /plans', 'PUT /plans/9']);
    expect(planChanges(api)[1]?.body).toMatchObject({ name: 'Forza 2' });
  });

  it('without a name is not sent yet, and asks for nothing', async () => {
    const api = fakeApi();
    render(Host, { page: PlanEditorPage, params: { id: null } });
    await userEvent.setup().type(screen.getByPlaceholderText('Quante volte a settimana, cosa curare'), '3 volte');
    await pause();
    expect(api.changes()).toEqual([]);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('with sets out of range is not sent, and names the exercise', async () => {
    const api = fakeApi().on('GET /exercises', [SQUAT]).on('POST /plans', { ...FORZA, id: 9 }).on('PUT /plans/9', FORZA);
    render(Host, { page: PlanEditorPage, params: { id: null } });
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Forza, autunno'), 'Forza');
    await user.click(screen.getByRole('button', { name: 'Aggiungi esercizio' }));
    await user.click(await screen.findByRole('button', { name: 'Squat Gambe' }));
    await user.clear(screen.getByLabelText('Serie'));
    await user.type(screen.getByLabelText('Serie'), '21');
    expect(await screen.findByRole('alert')).toHaveTextContent('Nel giorno «A» le serie dell’esercizio «Squat» vanno da 1 a 20.');
    await pause();
    expect(planChanges(api).some((change) => JSON.stringify(change.body).includes('"sets":21'))).toBe(false);
  });
});

describe('a saved plan', () => {
  it('opens as it is', async () => {
    fakeApi().on('GET /plans/5', FORZA);
    render(Host, { page: PlanEditorPage, params: { id: 5 } });
    expect(await screen.findByRole('heading', { name: 'Forza' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Forza, autunno')).toHaveValue('Forza');
    expect(screen.getAllByLabelText('Serie').map((input) => (input as HTMLInputElement).value)).toEqual(['5', '3', '3']);
    expect(screen.getAllByLabelText('Ripetizioni').map((input) => (input as HTMLInputElement).value)).toEqual(['5', '8', '8']);
    expect(screen.getAllByLabelText('Recupero (s)').map((input) => (input as HTMLInputElement).value)).toEqual(['180', '90', '90']);
    // the plan's own notes first, then each exercise's
    expect(screen.getAllByLabelText('Note').map((input) => (input as HTMLInputElement).value)).toEqual(['3 volte', '', '', 'lento']);
  });

  it('is saved whole with PUT after moving, removing and archiving', async () => {
    const api = fakeApi().on('GET /plans/5', FORZA).on('PUT /plans/5', (call: Call) => ({ ...FORZA, ...(call.body as object) }));
    render(Host, { page: PlanEditorPage, params: { id: 5 } });
    const user = userEvent.setup();
    await screen.findByRole('heading', { name: 'Forza' });
    // "Sposta su" in page order: day A, Squat, Panca, day B, Rematore.
    // Panca above Squat in day A, then day B above day A, then Squat out.
    await user.click(screen.getAllByRole('button', { name: 'Sposta su' })[2]!);
    await user.click(screen.getAllByRole('button', { name: 'Sposta su' })[3]!);
    await user.click(screen.getAllByRole('button', { name: 'Togli l’esercizio' })[2]!);
    await user.click(screen.getByRole('checkbox', { name: /Archiviata/ }));
    await settled(() => expect(planChanges(api).at(-1)?.body).toMatchObject({ archived: true }));
    expect(planChanges(api).at(-1)).toEqual({
      route: 'PUT /plans/5',
      body: {
        name: 'Forza', notes: '3 volte', archived: true,
        days: [
          { name: 'B', exercises: [{ exerciseId: 3, sets: 3, reps: '8', restSeconds: 90, notes: 'lento' }] },
          { name: 'A', exercises: [{ exerciseId: 2, sets: 3, reps: '8', restSeconds: 90, notes: null }] },
        ],
      },
    });
    expect(status()).toHaveTextContent('Salvata');
  });

  it('opened is not sent back as it was', async () => {
    const api = fakeApi().on('GET /plans/5', FORZA);
    render(Host, { page: PlanEditorPage, params: { id: 5 } });
    await screen.findByRole('heading', { name: 'Forza' });
    await pause();
    expect(api.changes()).toEqual([]);
  });

  it('left right after a change still sends it', async () => {
    const api = fakeApi().on('GET /plans/5', FORZA).on('PUT /plans/5', FORZA);
    const { unmount } = render(Host, { page: PlanEditorPage, params: { id: 5 } });
    await userEvent.setup().type(await screen.findByPlaceholderText('Forza, autunno'), '!');
    unmount();
    expect(planChanges(api)).toEqual([{ route: 'PUT /plans/5', body: expect.objectContaining({ name: 'Forza!' }) }]);
  });

  it('loses a day with its exercises', async () => {
    const api = fakeApi().on('GET /plans/5', FORZA).on('PUT /plans/5', FORZA);
    render(Host, { page: PlanEditorPage, params: { id: 5 } });
    const user = userEvent.setup();
    await screen.findByRole('heading', { name: 'Forza' });
    await user.click(screen.getAllByRole('button', { name: 'Togli il giorno' })[0]!);
    await settled(() => expect(api.changes()).toHaveLength(1));
    expect((api.changes()[0]?.body as { days: { name: string }[] }).days.map((day) => day.name)).toEqual(['B']);
  });

  it('is deleted after saying yes to the question, and the message follows to the list', async () => {
    const api = fakeApi().on('GET /plans/5', FORZA).on('DELETE /plans/5', { ok: true });
    render(Host, { page: PlanEditorPage, params: { id: 5 } });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Elimina scheda' }));
    const question = within(await screen.findByRole('alertdialog', { name: 'Eliminare la scheda «Forza»?' }));
    expect(question.getByText('Gli allenamenti già fatti restano nello storico.')).toBeInTheDocument();
    expect(api.changes()).toEqual([]);
    await user.click(question.getByRole('button', { name: 'Elimina' }));
    expect(api.changes()).toEqual([{ route: 'DELETE /plans/5', body: undefined }]);
    expect(nav.path).toBe('/schede');
    expect(toast.open).toBe(true);
    expect(toast.message).toBe('Scheda eliminata. Gli allenamenti fatti restano nello storico.');
  });

  it('says why it cannot be saved, keeps what is written, and tries again with the next change', async () => {
    const api = fakeApi().on('GET /plans/5', FORZA).on('PUT /plans/5', { status: 400, body: { error: 'Uno degli esercizi non esiste più. Ricarica la pagina.' } });
    render(Host, { page: PlanEditorPage, params: { id: 5 } });
    const user = userEvent.setup();
    const name = await screen.findByPlaceholderText('Forza, autunno');
    await user.type(name, '!');
    expect(await screen.findByRole('alert', {}, { timeout: 3000 })).toHaveTextContent('Uno degli esercizi non esiste più. Ricarica la pagina.');
    expect(name).toHaveValue('Forza!');
    api.on('PUT /plans/5', FORZA);
    await user.type(name, '?');
    await settled(() => expect(status()).toHaveTextContent('Salvata'));
    expect(planChanges(api)).toHaveLength(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });


  it('list shows its shape while it loads', () => {
    silentApi();
    render(Host, { page: PlansPage });
    expect(document.querySelector('.skeleton')).toBeInTheDocument();
  });
});

describe('while it loads, the page', () => {
  it('shows its shape', () => {
    silentApi();
    render(Host, { page: PlanEditorPage, params: { id: 5 } });
    expect(document.querySelector('.skeleton')).toBeInTheDocument();
  });
});

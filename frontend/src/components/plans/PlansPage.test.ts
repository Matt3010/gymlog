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
  id, exerciseId: exercise.id, exerciseName: exercise.name, position, reps: ['8', '8', '8'], restSeconds: 90, notes: null, ...change,
});

/** A plan just created: day A, nothing in it yet. */
const NUOVA: Plan = { id: 9, name: 'Forza', notes: '3 volte', archived: false, days: [{ id: 91, name: 'A', position: 0, exercises: [] }] };

const FORZA: Plan = {
  id: 5, name: 'Forza', notes: '3 volte', archived: false,
  days: [
    { id: 51, name: 'A', position: 0, exercises: [planExercise(511, SQUAT, 0, { reps: ['5', '5', '5', '5', '3'], restSeconds: 180 }), planExercise(512, PANCA, 1)] },
    { id: 52, name: 'B', position: 1, exercises: [planExercise(521, REMATORE, 0, { notes: 'lento' })] },
  ],
};

/** The changes to plans the server got, as sent. */
const planChanges = (api: ReturnType<typeof fakeApi>) => api.changes().filter((change) => change.route.includes('/plans'));
/** Waits for the pause after typing, and for what the server got. */
const settled = (check: () => void) => vi.waitFor(check, { timeout: 3000 });
/** The reps of each set on the page, top to bottom. */
const setReps = () => screen.getAllByLabelText(/^Serie \d+, ripetizioni$/).map((input) => (input as HTMLInputElement).value);
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

  it('with none in use offer one way to write one, and none in the header', async () => {
    fakeApi().on('GET /plans', []);
    render(Host, { page: PlansPage });
    expect(await screen.findByRole('link', { name: 'Scrivi una scheda' })).toHaveAttribute('href', '/schede/nuova');
    expect(screen.getByRole('link', { name: 'Scrivi una scheda' })).toHaveClass('primary');
    expect(screen.queryByRole('link', { name: 'Nuova' })).not.toBeInTheDocument();
  });

  it('archived sit in a section like any other', async () => {
    fakeApi().on('GET /plans', [FORZA, { ...FORZA, id: 6, name: 'Estate', archived: true, days: [] }]);
    render(Host, { page: PlansPage });
    const archived = (await screen.findByText('Archiviate')).closest('.card')!;
    expect(archived).not.toHaveClass('dashed');
    expect(screen.getByRole('link', { name: 'Nuova' })).toBeInTheDocument();
  });

  it('invite to write the first one', async () => {
    fakeApi().on('GET /plans', []);
    render(Host, { page: PlansPage });
    expect(await screen.findByText('Nessuna scheda in uso.')).toBeInTheDocument();
    expect(screen.queryByText('Archiviate')).not.toBeInTheDocument();
  });
});

describe('a new plan', () => {
  it('asks only for a name and notes, and is created with «Crea la scheda», then opened at its address', async () => {
    const api = fakeApi().on('POST /plans', NUOVA);
    render(Host, { page: PlanEditorPage, params: { id: null } });
    const user = userEvent.setup();
    const create = screen.getByRole('button', { name: 'Crea la scheda' });
    expect(create).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Aggiungi giorno' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aggiungi esercizio' })).not.toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('Forza, autunno'), '   ');
    expect(create).toBeDisabled();
    await user.type(screen.getByPlaceholderText('Forza, autunno'), ' Forza ');
    await user.type(screen.getByPlaceholderText('Quante volte a settimana, cosa curare'), '3 volte');
    await pause();
    // nothing goes out until it is asked for
    expect(api.changes()).toEqual([]);
    await user.click(create);
    expect(api.changes()).toEqual([{ route: 'POST /plans', body: { name: 'Forza', notes: '3 volte', archived: false, days: [{ name: 'A', exercises: [] }] } }]);
    expect(nav.path).toBe('/schede/9');
  });

  it('refused at creation says why and stays to be corrected', async () => {
    fakeApi().on('POST /plans', { status: 400, body: { error: 'Nome della scheda: troppo lungo.' } });
    render(Host, { page: PlanEditorPage, params: { id: null } });
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Forza, autunno'), 'Forza');
    await user.click(screen.getByRole('button', { name: 'Crea la scheda' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nome della scheda: troppo lungo.');
    expect(nav.path).toBe('/');
    expect(screen.getByPlaceholderText('Forza, autunno')).toHaveValue('Forza');
  });
});

describe('a plan being written', () => {
  it('is filled day by day and sent whole as it changes, with no save button', async () => {
    const api = fakeApi()
      .on('GET /plans/9', NUOVA)
      .on('GET /exercises', [PANCA, SQUAT])
      .on('POST /exercises', REMATORE)
      .on('PUT /plans/9', (call: Call) => ({ ...NUOVA, ...(call.body as object) }));
    render(Host, { page: PlanEditorPage, params: { id: 9 } });
    const user = userEvent.setup();
    await screen.findByRole('heading', { name: 'Forza' });

    // Day A: Squat 5 × 5, recupero 180; then Panca with the proposed 3 × 10, 90.
    await user.click(screen.getByRole('button', { name: 'Aggiungi esercizio' }));
    await user.click(await within(screen.getByRole('dialog', { name: 'Aggiungi al giorno A' })).findByRole('button', { name: 'Squat Gambe' }));
    // a new exercise comes with three sets of 10; each set has its own reps
    expect(setReps()).toEqual(['10', '10', '10']);
    await user.clear(screen.getByLabelText('Serie 1, ripetizioni'));
    await user.type(screen.getByLabelText('Serie 1, ripetizioni'), ' 5 ');
    await user.click(screen.getByRole('button', { name: 'Togli la serie 3' }));
    await user.clear(screen.getByLabelText('Serie 2, ripetizioni'));
    await user.type(screen.getByLabelText('Serie 2, ripetizioni'), '8');
    // one more, copying the last
    await user.click(screen.getByRole('button', { name: 'Aggiungi una serie a Squat' }));
    expect(setReps()).toEqual([' 5 ', '8', '8']);
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

    await settled(() => expect(planChanges(api).at(-1)?.body).toMatchObject({ days: [{}, { exercises: [{ notes: 'lento' }] }] }));
    expect(planChanges(api).every((change) => change.route === 'PUT /plans/9')).toBe(true);
    expect(api.changes().find((change) => change.route === 'POST /exercises')).toEqual({ route: 'POST /exercises', body: { name: 'Rematore', muscleGroup: null, notes: null } });
    expect(planChanges(api).at(-1)).toEqual(
      {
        route: 'PUT /plans/9',
        body: {
          name: 'Forza', notes: '3 volte', archived: false,
          days: [
            {
              name: 'A',
              exercises: [
                { exerciseId: 1, reps: ['5', '8', '8'], restSeconds: 180, notes: null },
                { exerciseId: 2, reps: ['10', '10', '10'], restSeconds: 90, notes: null },
              ],
            },
            { name: 'B', exercises: [{ exerciseId: 3, reps: ['10', '10', '10'], restSeconds: 90, notes: 'lento' }] },
          ],
        },
      },
    );
    expect(status()).toHaveTextContent('Salvata');
    expect(screen.queryByRole('button', { name: /Salva/ })).not.toBeInTheDocument();
  });

  it('keeps at least one set: the last one cannot be taken away', async () => {
    fakeApi().on('GET /plans/9', NUOVA).on('GET /exercises', [SQUAT]).on('PUT /plans/9', NUOVA);
    render(Host, { page: PlanEditorPage, params: { id: 9 } });
    const user = userEvent.setup();
    await screen.findByRole('heading', { name: 'Forza' });
    await user.click(screen.getByRole('button', { name: 'Aggiungi esercizio' }));
    await user.click(await screen.findByRole('button', { name: 'Squat Gambe' }));
    await user.click(screen.getByRole('button', { name: 'Togli la serie 3' }));
    await user.click(screen.getByRole('button', { name: 'Togli la serie 2' }));
    expect(screen.getByRole('button', { name: 'Togli la serie 1' })).toBeDisabled();
    expect(setReps()).toEqual(['10']);
  });

  it('with a set without reps is not sent, and names the set', async () => {
    const api = fakeApi().on('GET /plans/9', NUOVA).on('GET /exercises', [SQUAT]).on('PUT /plans/9', NUOVA);
    render(Host, { page: PlanEditorPage, params: { id: 9 } });
    const user = userEvent.setup();
    await screen.findByRole('heading', { name: 'Forza' });
    await user.click(screen.getByRole('button', { name: 'Aggiungi esercizio' }));
    await user.click(await screen.findByRole('button', { name: 'Squat Gambe' }));
    await user.clear(screen.getByLabelText('Serie 2, ripetizioni'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nel giorno «A» la serie 2 dell’esercizio «Squat» non ha ripetizioni. Scrivi quante, anche «max».');
    await pause();
    expect(planChanges(api).some((change) => JSON.stringify(change.body).includes('""'))).toBe(false);
  });
});

describe('a saved plan', () => {
  it('opens as it is', async () => {
    fakeApi().on('GET /plans/5', FORZA);
    render(Host, { page: PlanEditorPage, params: { id: 5 } });
    expect(await screen.findByRole('heading', { name: 'Forza' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Forza, autunno')).toHaveValue('Forza');
    expect(setReps()).toEqual(['5', '5', '5', '5', '3', '8', '8', '8', '8', '8', '8']);
    expect(screen.getAllByLabelText('Recupero (s)').map((input) => (input as HTMLInputElement).value)).toEqual(['180', '90', '90']);
    // the plan's own notes first, then each exercise's
    expect(screen.getAllByLabelText('Note').map((input) => (input as HTMLInputElement).value)).toEqual(['3 volte', '', '', 'lento']);
  });

  it('adds sets, exercises and days with primary buttons', async () => {
    fakeApi().on('GET /plans/5', FORZA);
    render(Host, { page: PlanEditorPage, params: { id: 5 } });
    await screen.findByRole('heading', { name: 'Forza' });
    const adds = [
      ...screen.getAllByRole('button', { name: /^Aggiungi una serie a / }),
      ...screen.getAllByRole('button', { name: 'Aggiungi esercizio' }),
      screen.getByRole('button', { name: 'Aggiungi giorno' }),
    ];
    for (const button of adds) expect(button).toHaveClass('primary');
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
          { name: 'B', exercises: [{ exerciseId: 3, reps: ['8', '8', '8'], restSeconds: 90, notes: 'lento' }] },
          { name: 'A', exercises: [{ exerciseId: 2, reps: ['8', '8', '8'], restSeconds: 90, notes: null }] },
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
    // the delete of what the page shows sits in its header, next to the title
    const remove = await screen.findByRole('button', { name: 'Elimina la scheda «Forza»' });
    expect(remove.closest('header')).not.toBeNull();
    await user.click(remove);
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


  it('list shows its shape while it loads', async () => {
    silentApi();
    render(Host, { page: PlansPage });
    // a loader, not a skeleton; and only after a short wait, so a fast load does not flash
    expect(screen.queryByRole('status', { name: 'Caricamento…' })).not.toBeInTheDocument();
    expect(await screen.findByRole('status', { name: 'Caricamento…' })).toBeInTheDocument();
    expect(document.querySelector('.skeleton')).toBeNull();
  });
});

describe('while it loads, the page', () => {
  it('shows its shape', async () => {
    silentApi();
    render(Host, { page: PlanEditorPage, params: { id: 5 } });
    // a loader, not a skeleton; and only after a short wait, so a fast load does not flash
    expect(screen.queryByRole('status', { name: 'Caricamento…' })).not.toBeInTheDocument();
    expect(await screen.findByRole('status', { name: 'Caricamento…' })).toBeInTheDocument();
    expect(document.querySelector('.skeleton')).toBeNull();
  });
});

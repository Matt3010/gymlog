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

const SQUAT: Exercise = { id: 1, name: 'Squat', muscleGroup: 'Gambe', notes: null, bodyweight: false };
const PANCA: Exercise = { id: 2, name: 'Panca piana', muscleGroup: null, notes: null, bodyweight: false };
const REMATORE: Exercise = { id: 3, name: 'Rematore', muscleGroup: null, notes: null, bodyweight: false };

const planExercise = (id: number, exercise: Exercise, position: number, change = {}) => ({
  id, exerciseId: exercise.id, exerciseName: exercise.name, position, reps: ['8', '8', '8'], restSeconds: 90, notes: null, ...change,
});

/** A plan just created: nothing in it yet. */
const NUOVA: Plan = { id: 9, name: 'Forza', notes: '3 volte', exercises: [] };

const FORZA: Plan = {
  id: 5, name: 'Forza', notes: '3 volte',
  exercises: [
    planExercise(511, SQUAT, 0, { reps: ['5', '5', '5', '5', '3'], restSeconds: 180 }),
    planExercise(512, PANCA, 1),
    planExercise(513, REMATORE, 2, { notes: 'lento' }),
  ],
};

const NAME = 'Spinta, Gambe, Total body';

/** The changes to plans the server got, as sent. */
const planChanges = (api: ReturnType<typeof fakeApi>) => api.changes().filter((change) => change.route.includes('/plans'));
/** Waits for the pause after typing, and for what the server got. */
const settled = (check: () => void) => vi.waitFor(check, { timeout: 3000 });
/** The reps of each set on the page, top to bottom. */
const setReps = () => screen.getAllByLabelText(/^Serie \d+, ripetizioni$/).map((input) => (input as HTMLInputElement).value);
const status = () => screen.getByRole('status', { name: 'Salvataggio' });
/** Says yes to the question a removal asks first. */
const confirmTake = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Togli' }));
const pause = () => new Promise((resolve) => setTimeout(resolve, 800));
/** The plan's name field, at the top of the page, once it is loaded. */
const details = (): Promise<HTMLElement> => screen.findByPlaceholderText(NAME);

describe('the plans', () => {
  it('are listed by name, each saying what is in it', async () => {
    fakeApi().on('GET /plans', [FORZA, { ...NUOVA, name: 'Vuota' }]);
    render(Host, { page: PlansPage });
    expect(await screen.findByRole('link', { name: 'Forza Squat, Panca piana, Rematore' })).toHaveAttribute('href', '/plans/5');
    expect(screen.getByRole('link', { name: 'Vuota Nessun esercizio' })).toHaveAttribute('href', '/plans/9');
    expect(screen.queryByText('Archiviate')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nuova' })).toHaveAttribute('href', '/plans/new');
    // in the header, outside the cards: secondary
    expect(screen.getByRole('link', { name: 'Nuova' })).toHaveClass('ghost');
  });

  it('with none offer one way to write one, and none in the header', async () => {
    fakeApi().on('GET /plans', []);
    render(Host, { page: PlansPage });
    expect(await screen.findByText('Nessuna scheda, per ora.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Scrivi una scheda' })).toHaveAttribute('href', '/plans/new');
    expect(screen.getByRole('link', { name: 'Scrivi una scheda' })).toHaveClass('primary');
    expect(screen.queryByRole('link', { name: 'Nuova' })).not.toBeInTheDocument();
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

describe('a new plan', () => {
  it('asks only for a name and notes, and is created with «Crea la scheda», then opened at its address', async () => {
    const api = fakeApi().on('POST /plans', NUOVA);
    render(Host, { page: PlanEditorPage, params: { id: null } });
    const user = userEvent.setup();
    const create = screen.getByRole('button', { name: 'Crea la scheda' });
    expect(create).toBeDisabled();
    expect(screen.queryByLabelText('Dal')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aggiungi esercizio' })).not.toBeInTheDocument();
    await user.type(screen.getByPlaceholderText(NAME), '   ');
    expect(create).toBeDisabled();
    await user.type(screen.getByPlaceholderText(NAME), ' Forza ');
    await user.type(screen.getByPlaceholderText('Quante volte a settimana, cosa curare'), '3 volte');
    await pause();
    // nothing goes out until it is asked for
    expect(api.changes()).toEqual([]);
    await user.click(create);
    expect(api.changes()).toEqual([{ route: 'POST /plans', body: { name: 'Forza', notes: '3 volte', exercises: [] } }]);
    expect(nav.path).toBe('/plans/9');
  });

  it('refused at creation says why and stays to be corrected', async () => {
    fakeApi().on('POST /plans', { status: 400, body: { error: 'Nome della scheda: troppo lungo.' } });
    render(Host, { page: PlanEditorPage, params: { id: null } });
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(NAME), 'Forza');
    await user.click(screen.getByRole('button', { name: 'Crea la scheda' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nome della scheda: troppo lungo.');
    expect(nav.path).toBe('/');
    expect(screen.getByPlaceholderText(NAME)).toHaveValue('Forza');
  });
});

describe('a plan being written', () => {
  it('is filled exercise by exercise and sent whole as it changes, with no save button', async () => {
    const api = fakeApi()
      .on('GET /plans/9', NUOVA)
      .on('GET /exercises', [PANCA, SQUAT])
      .on('POST /exercises', REMATORE)
      .on('PUT /plans/9', (call: Call) => ({ ...NUOVA, ...(call.body as object) }));
    render(Host, { page: PlanEditorPage, params: { id: 9 } });
    const user = userEvent.setup();
    await screen.findByRole('heading', { name: 'Forza' });

    // Squat 5, 8, 8 with recupero 180; then Panca with the proposed 3 × 10, 90.
    await user.click(screen.getByRole('button', { name: 'Aggiungi esercizio' }));
    await user.click(await within(screen.getByRole('dialog', { name: 'Aggiungi alla scheda' })).findByRole('button', { name: 'Squat Gambe' }));
    // a new exercise comes with three sets of 10; each set has its own reps
    expect(setReps()).toEqual(['10', '10', '10']);
    await user.clear(screen.getByLabelText('Serie 1, ripetizioni'));
    await user.type(screen.getByLabelText('Serie 1, ripetizioni'), ' 5 ');
    await user.click(screen.getByRole('button', { name: 'Togli la serie 3' }));
    await confirmTake(user);
    await user.clear(screen.getByLabelText('Serie 2, ripetizioni'));
    await user.type(screen.getByLabelText('Serie 2, ripetizioni'), '8');
    // one more, copying the last
    await user.click(screen.getByRole('button', { name: 'Aggiungi una serie a Squat' }));
    expect(setReps()).toEqual([' 5 ', '8', '8']);
    await user.clear(screen.getByLabelText('Recupero (s)'));
    await user.type(screen.getByLabelText('Recupero (s)'), '180');
    await user.click(screen.getByRole('button', { name: 'Aggiungi esercizio' }));
    const picker = within(screen.getByRole('dialog'));
    // the one already in the plan is proposed again: the same exercise can come back later on
    expect(await picker.findByRole('button', { name: 'Squat Gambe' })).toBeInTheDocument();
    await user.click(await picker.findByRole('button', { name: 'Panca piana' }));

    // An exercise made from the picker by typing its name.
    await user.click(screen.getByRole('button', { name: 'Aggiungi esercizio' }));
    const last = within(screen.getByRole('dialog', { name: 'Aggiungi alla scheda' }));
    await user.type(last.getByPlaceholderText('Nuovo esercizio'), 'Rematore');
    await user.click(last.getByRole('button', { name: 'Crea e aggiungi' }));
    await user.type(screen.getAllByLabelText('Note')[3]!, 'lento');

    await settled(() => expect(planChanges(api).at(-1)?.body).toMatchObject({ exercises: [{}, {}, { notes: 'lento' }] }));
    expect(planChanges(api).every((change) => change.route === 'PUT /plans/9')).toBe(true);
    expect(api.changes().find((change) => change.route === 'POST /exercises')).toEqual({ route: 'POST /exercises', body: { name: 'Rematore', muscleGroup: null, notes: null } });
    expect(planChanges(api).at(-1)).toEqual({
      route: 'PUT /plans/9',
      body: {
        name: 'Forza', notes: '3 volte',
        exercises: [
          { exerciseId: 1, reps: ['5', '8', '8'], restSeconds: 180, notes: null },
          { exerciseId: 2, reps: ['10', '10', '10'], restSeconds: 90, notes: null },
          { exerciseId: 3, reps: ['10', '10', '10'], restSeconds: 90, notes: 'lento' },
        ],
      },
    });
    expect(status()).toHaveTextContent('Salvata');
    expect(screen.queryByRole('button', { name: /Salva/ })).not.toBeInTheDocument();
  });

  it('takes the same exercise twice, each with its own sets', async () => {
    const api = fakeApi().on('GET /plans/9', NUOVA).on('GET /exercises', [SQUAT]).on('PUT /plans/9', (call: Call) => ({ ...NUOVA, ...(call.body as object) }));
    render(Host, { page: PlanEditorPage, params: { id: 9 } });
    const user = userEvent.setup();
    await screen.findByRole('heading', { name: 'Forza' });
    for (const _ of [1, 2]) {
      await user.click(screen.getByRole('button', { name: 'Aggiungi esercizio' }));
      await user.click(await within(screen.getByRole('dialog')).findByRole('button', { name: 'Squat Gambe' }));
    }
    await user.clear(screen.getAllByLabelText('Serie 1, ripetizioni')[1]!);
    await user.type(screen.getAllByLabelText('Serie 1, ripetizioni')[1]!, '20');
    await settled(() => expect(planChanges(api).at(-1)?.body).toMatchObject({
      exercises: [{ exerciseId: 1, reps: ['10', '10', '10'] }, { exerciseId: 1, reps: ['20', '10', '10'] }],
    }));
  });

  it('keeps at least one set: the last one cannot be taken away', async () => {
    fakeApi().on('GET /plans/9', NUOVA).on('GET /exercises', [SQUAT]).on('PUT /plans/9', NUOVA);
    render(Host, { page: PlanEditorPage, params: { id: 9 } });
    const user = userEvent.setup();
    await screen.findByRole('heading', { name: 'Forza' });
    await user.click(screen.getByRole('button', { name: 'Aggiungi esercizio' }));
    await user.click(await screen.findByRole('button', { name: 'Squat Gambe' }));
    await user.click(screen.getByRole('button', { name: 'Togli la serie 3' }));
    await confirmTake(user);
    await user.click(screen.getByRole('button', { name: 'Togli la serie 2' }));
    await confirmTake(user);
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
    expect(await screen.findByRole('alert')).toHaveTextContent('La serie 2 dell’esercizio «Squat» non ha ripetizioni. Scrivi quante, anche «max».');
    await pause();
    expect(planChanges(api).some((change) => JSON.stringify(change.body).includes('""'))).toBe(false);
  });
});

describe('leaving a plan with something not valid', () => {
  it('asks first: what changed after it is not saved yet', async () => {
    fakeApi().on('GET /plans/9', NUOVA).on('GET /exercises', []).on('PUT /plans/9', (call: Call) => ({ ...NUOVA, ...(call.body as object) }));
    nav.go('/plans/9');
    render(Host, { page: PlanEditorPage, params: { id: 9 } });
    const user = userEvent.setup();
    const name = await details();
    await user.clear(name);
    nav.go('/plans');
    const question = within(await screen.findByRole('alertdialog', { name: 'Uscire senza salvare?' }));
    expect(question.getByText(/La scheda ha bisogno di un nome\./)).toBeInTheDocument();
    await user.click(question.getByRole('button', { name: 'Resta' }));
    expect(nav.path).toBe('/plans/9');
    nav.go('/plans');
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Esci' }));
    expect(nav.path).toBe('/plans');
  });

  it('asks first when the last change did not reach the server', async () => {
    fakeApi().on('GET /plans/9', NUOVA).on('GET /exercises', []).on('PUT /plans/9', { status: 503 });
    nav.go('/plans/9');
    render(Host, { page: PlanEditorPage, params: { id: 9 } });
    const user = userEvent.setup();
    const name = await details();
    await user.type(name, ' 2');
    await vi.waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument(), { timeout: 3000 });
    nav.go('/plans');
    const question = within(await screen.findByRole('alertdialog', { name: 'Uscire senza salvare?' }));
    expect(question.getByText(/non è arrivata/)).toBeInTheDocument();
    await user.click(question.getByRole('button', { name: 'Resta' }));
    expect(nav.path).toBe('/plans/9');
  });

  it('does not ask once the plan has been deleted: there is nothing left to save', async () => {
    fakeApi().on('GET /plans/9', NUOVA).on('GET /exercises', []).on('DELETE /plans/9', { ok: true });
    nav.go('/plans/9');
    render(Host, { page: PlanEditorPage, params: { id: 9 } });
    const user = userEvent.setup();
    await user.clear(await details());
    await user.click(screen.getByRole('button', { name: /^Elimina la scheda/ }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Elimina' }));
    await vi.waitFor(() => expect(nav.path).toBe('/plans'));
    expect(screen.queryByRole('alertdialog', { name: 'Uscire senza salvare?' })).not.toBeInTheDocument();
  });

  it('lets go without asking when everything is saved', async () => {
    fakeApi().on('GET /plans/9', NUOVA).on('GET /exercises', []);
    nav.go('/plans/9');
    render(Host, { page: PlanEditorPage, params: { id: 9 } });
    await details();
    nav.go('/plans');
    expect(nav.path).toBe('/plans');
  });
});

describe('taking something out of a plan', () => {
  it('asks first, naming it, and nothing changes until yes', async () => {
    const api = fakeApi().on('GET /plans/5', FORZA).on('PUT /plans/5', FORZA);
    render(Host, { page: PlanEditorPage, params: { id: 5 } });
    const user = userEvent.setup();
    await screen.findByRole('heading', { name: 'Forza' });

    await user.click(screen.getAllByRole('button', { name: 'Togli l’esercizio' })[0]!);
    let question = within(await screen.findByRole('alertdialog', { name: 'Togliere «Squat» dalla scheda?' }));
    await user.click(question.getByRole('button', { name: 'Annulla' }));

    await user.click(screen.getAllByRole('button', { name: 'Togli la serie 5' })[0]!);
    question = within(await screen.findByRole('alertdialog', { name: 'Togliere la serie 5 di «Squat»?' }));
    await user.click(question.getByRole('button', { name: 'Annulla' }));

    expect(setReps()).toEqual(['5', '5', '5', '5', '3', '8', '8', '8', '8', '8', '8']);
    await pause();
    expect(planChanges(api)).toEqual([]);
  });

  it('every button that takes something out is red', async () => {
    fakeApi().on('GET /plans/5', FORZA);
    render(Host, { page: PlanEditorPage, params: { id: 5 } });
    await screen.findByRole('heading', { name: 'Forza' });
    const takers = screen.getAllByRole('button', { name: /^(Togli|Elimina)/ });
    expect(takers.length).toBeGreaterThan(5);
    for (const button of takers) expect(button).toHaveClass('is-danger');
  });
});

describe('a saved plan', () => {
  it('opens as it is', async () => {
    fakeApi().on('GET /plans/5', FORZA);
    render(Host, { page: PlanEditorPage, params: { id: 5 } });
    expect(await screen.findByRole('heading', { name: 'Forza' })).toBeInTheDocument();
    expect(setReps()).toEqual(['5', '5', '5', '5', '3', '8', '8', '8', '8', '8', '8']);
    expect(screen.getAllByLabelText('Recupero (s)').map((input) => (input as HTMLInputElement).value)).toEqual(['180', '90', '90']);
    // the plan's notes first, then each exercise's
    expect(screen.getAllByLabelText('Note').map((input) => (input as HTMLInputElement).value)).toEqual(['3 volte', '', '', 'lento']);
    expect(await details()).toHaveValue('Forza');
  });

  it('shows its name and notes at the top, above the exercises, with no tabs to look behind', async () => {
    fakeApi().on('GET /plans/5', FORZA);
    render(Host, { page: PlanEditorPage, params: { id: 5 } });
    const name = await details();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    const first = screen.getAllByLabelText('Recupero (s)')[0]!;
    expect(name.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('is renamed from the top of the page, and the title follows', async () => {
    const api = fakeApi().on('GET /plans/5', FORZA).on('PUT /plans/5', (call: Call) => ({ ...FORZA, ...(call.body as object) }));
    render(Host, { page: PlanEditorPage, params: { id: 5 } });
    const user = userEvent.setup();
    const name = await details();
    await user.clear(name);
    await user.type(name, 'Gambe');
    expect(screen.getByRole('heading', { name: 'Gambe' })).toBeInTheDocument();
    await settled(() => expect(planChanges(api).at(-1)?.body).toMatchObject({ name: 'Gambe' }));
  });

  it('adds sets inside the exercise card with a primary button; exercises, outside the cards, with a secondary one', async () => {
    fakeApi().on('GET /plans/5', FORZA);
    render(Host, { page: PlanEditorPage, params: { id: 5 } });
    await screen.findByRole('heading', { name: 'Forza' });
    for (const button of screen.getAllByRole('button', { name: /^Aggiungi una serie a / })) expect(button).toHaveClass('primary');
    const add = screen.getByRole('button', { name: 'Aggiungi esercizio' });
    expect(add).toHaveClass('ghost');
    expect(add.closest('.card')).toBeNull();
  });

  it('is saved whole with PUT after moving and removing', async () => {
    const api = fakeApi().on('GET /plans/5', FORZA).on('PUT /plans/5', (call: Call) => ({ ...FORZA, ...(call.body as object) }));
    render(Host, { page: PlanEditorPage, params: { id: 5 } });
    const user = userEvent.setup();
    await screen.findByRole('heading', { name: 'Forza' });
    // Rematore above Panca, then Squat out.
    await user.click(screen.getAllByRole('button', { name: 'Sposta su' })[2]!);
    await user.click(screen.getAllByRole('button', { name: 'Togli l’esercizio' })[0]!);
    await confirmTake(user);
    await settled(() => expect(planChanges(api).at(-1)?.body).toMatchObject({ exercises: [{ exerciseId: 3 }, { exerciseId: 2 }] }));
    expect(planChanges(api).at(-1)).toEqual({
      route: 'PUT /plans/5',
      body: {
        name: 'Forza', notes: '3 volte',
        exercises: [
          { exerciseId: 3, reps: ['8', '8', '8'], restSeconds: 90, notes: 'lento' },
          { exerciseId: 2, reps: ['8', '8', '8'], restSeconds: 90, notes: null },
        ],
      },
    });
    expect(status()).toHaveTextContent('Salvata');
  });

  it('cannot move the first exercise up nor the last one down', async () => {
    fakeApi().on('GET /plans/5', FORZA);
    render(Host, { page: PlanEditorPage, params: { id: 5 } });
    await screen.findByRole('heading', { name: 'Forza' });
    expect(screen.getAllByRole('button', { name: 'Sposta su' }).map((button) => (button as HTMLButtonElement).disabled)).toEqual([true, false, false]);
    expect(screen.getAllByRole('button', { name: 'Sposta giù' }).map((button) => (button as HTMLButtonElement).disabled)).toEqual([false, false, true]);
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
    await userEvent.setup().type(await details(), '!');
    unmount();
    expect(planChanges(api)).toEqual([{ route: 'PUT /plans/5', body: expect.objectContaining({ name: 'Forza!' }) }]);
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
    expect(nav.path).toBe('/plans');
    expect(toast.open).toBe(true);
    expect(toast.message).toBe('Scheda eliminata. Gli allenamenti fatti restano nello storico.');
  });

  it('says why it cannot be saved, keeps what is written, and tries again with the next change', async () => {
    const api = fakeApi().on('GET /plans/5', FORZA).on('PUT /plans/5', { status: 400, body: { error: 'Uno degli esercizi non esiste più. Ricarica la pagina.' } });
    render(Host, { page: PlanEditorPage, params: { id: 5 } });
    const user = userEvent.setup();
    const name = await details();
    await user.type(name, '!');
    expect(await screen.findByRole('alert', {}, { timeout: 3000 })).toHaveTextContent('Uno degli esercizi non esiste più. Ricarica la pagina.');
    expect(name).toHaveValue('Forza!');
    api.on('PUT /plans/5', FORZA);
    await user.type(name, '?');
    await settled(() => expect(status()).toHaveTextContent('Salvata'));
    expect(planChanges(api)).toHaveLength(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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

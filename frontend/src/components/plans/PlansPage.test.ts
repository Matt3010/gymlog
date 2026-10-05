import { fireEvent, render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { fusoDelBrowser, oraIn } from '../../lib/fuso';
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
const NUOVA: Plan = { id: 9, name: 'Forza', notes: '3 volte', startsOn: '2026-10-05', endsOn: null, archived: false, days: [{ id: 91, name: 'A', position: 0, exercises: [] }] };

const FORZA: Plan = {
  id: 5, name: 'Forza', notes: '3 volte', startsOn: '2026-10-05', endsOn: null, archived: false,
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
/** Says yes to the question a removal asks first. */
const confirmTake = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Togli' }));
const pause = () => new Promise((resolve) => setTimeout(resolve, 800));
/** Opens the tab with the plan's own details, once it is loaded; gives back its name field. */
async function details(): Promise<HTMLElement> {
  await userEvent.setup().click(await screen.findByRole('tab', { name: 'Dettagli' }));
  return screen.getByPlaceholderText('Forza, autunno');
}

describe('the plans', () => {
  it('in use are listed first, the archived apart, each with its period, workouts and exercises', async () => {
    fakeApi().on('GET /plans', [FORZA, { ...FORZA, id: 6, name: 'Estate', startsOn: '2026-06-01', endsOn: '2026-10-04', archived: true, days: [{ ...FORZA.days[1]!, exercises: [] }] }]);
    render(Host, { page: PlansPage });
    expect(await screen.findByRole('link', { name: 'Forza dal 5 ott 2026 · 2 allenamenti · 3 esercizi' })).toHaveAttribute('href', '/schede/5');
    const archived = within(screen.getByText('Archiviate').parentElement!);
    expect(archived.getByRole('link', { name: 'Estate 1 giu – 4 ott 2026 · 1 allenamento · 0 esercizi' })).toHaveAttribute('href', '/schede/6');
    expect(screen.getByRole('link', { name: 'Nuova' })).toHaveAttribute('href', '/schede/nuova');
    // in the header, outside the cards: secondary
    expect(screen.getByRole('link', { name: 'Nuova' })).toHaveClass('ghost');
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
  it('asks only for a name, its period and notes, and is created with «Crea la scheda», then opened at its address', async () => {
    const api = fakeApi().on('POST /plans', NUOVA);
    render(Host, { page: PlanEditorPage, params: { id: null } });
    const user = userEvent.setup();
    const create = screen.getByRole('button', { name: 'Crea la scheda' });
    expect(create).toBeDisabled();
    // it starts today, with no end
    expect(screen.getByLabelText('Dal')).toHaveValue(oraIn(fusoDelBrowser()).date);
    expect(screen.getByLabelText('Al')).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Aggiungi allenamento' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aggiungi esercizio' })).not.toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('Forza, autunno'), '   ');
    expect(create).toBeDisabled();
    await user.type(screen.getByPlaceholderText('Forza, autunno'), ' Forza ');
    await user.type(screen.getByPlaceholderText('Quante volte a settimana, cosa curare'), '3 volte');
    await fireEvent.input(screen.getByLabelText('Dal'), { target: { value: '2026-10-05' } });
    await fireEvent.input(screen.getByLabelText('Al'), { target: { value: '2026-11-15' } });
    await pause();
    // nothing goes out until it is asked for
    expect(api.changes()).toEqual([]);
    await user.click(create);
    expect(api.changes()).toEqual([{
      route: 'POST /plans',
      body: { name: 'Forza', notes: '3 volte', startsOn: '2026-10-05', endsOn: '2026-11-15', archived: false, days: [{ name: 'A', exercises: [] }] },
    }]);
    expect(nav.path).toBe('/schede/9');
  });

  it('ending before it starts is not created, and says why', async () => {
    const api = fakeApi().on('POST /plans', NUOVA);
    render(Host, { page: PlanEditorPage, params: { id: null } });
    await userEvent.setup().type(screen.getByPlaceholderText('Forza, autunno'), 'Forza');
    await fireEvent.input(screen.getByLabelText('Dal'), { target: { value: '2026-10-05' } });
    await fireEvent.input(screen.getByLabelText('Al'), { target: { value: '2026-10-04' } });
    expect(screen.getByRole('alert')).toHaveTextContent('La scheda non può finire prima di cominciare.');
    expect(screen.getByRole('button', { name: 'Crea la scheda' })).toBeDisabled();
    await fireEvent.input(screen.getByLabelText('Al'), { target: { value: '' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crea la scheda' })).toBeEnabled();
    expect(api.changes()).toEqual([]);
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
    await user.click(await within(screen.getByRole('dialog', { name: 'Aggiungi all’allenamento A' })).findByRole('button', { name: 'Squat Gambe' }));
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
    // the one already in the workout is proposed again: the same exercise can come back later on
    expect(await picker.findByRole('button', { name: 'Squat Gambe' })).toBeInTheDocument();
    await user.click(await picker.findByRole('button', { name: 'Panca piana' }));

    // Day B, with an exercise made from the picker by typing its name.
    await user.click(screen.getByRole('button', { name: 'Aggiungi allenamento' }));
    const addButtons = screen.getAllByRole('button', { name: 'Aggiungi esercizio' });
    await user.click(addButtons[1]!);
    const dayB = within(screen.getByRole('dialog', { name: 'Aggiungi all’allenamento B' }));
    await user.type(dayB.getByPlaceholderText('Nuovo esercizio'), 'Rematore');
    await user.click(dayB.getByRole('button', { name: 'Crea e aggiungi' }));
    await user.type(screen.getAllByLabelText('Note')[2]!, 'lento');

    await settled(() => expect(planChanges(api).at(-1)?.body).toMatchObject({ days: [{}, { exercises: [{ notes: 'lento' }] }] }));
    expect(planChanges(api).every((change) => change.route === 'PUT /plans/9')).toBe(true);
    expect(api.changes().find((change) => change.route === 'POST /exercises')).toEqual({ route: 'POST /exercises', body: { name: 'Rematore', muscleGroup: null, notes: null } });
    expect(planChanges(api).at(-1)).toEqual(
      {
        route: 'PUT /plans/9',
        body: {
          name: 'Forza', notes: '3 volte', startsOn: '2026-10-05', endsOn: null, archived: false,
          days: [
            {
              id: 91,
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

  it('takes the same exercise twice in a workout, each with its own sets', async () => {
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
      days: [{ exercises: [{ exerciseId: 1, reps: ['10', '10', '10'] }, { exerciseId: 1, reps: ['20', '10', '10'] }] }],
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
    expect(await screen.findByRole('alert')).toHaveTextContent('Nell’allenamento «A» la serie 2 dell’esercizio «Squat» non ha ripetizioni. Scrivi quante, anche «max».');
    await pause();
    expect(planChanges(api).some((change) => JSON.stringify(change.body).includes('""'))).toBe(false);
  });
});

describe('leaving a plan with something not valid', () => {
  it('asks first: what changed after it is not saved yet', async () => {
    fakeApi().on('GET /plans/9', NUOVA).on('GET /exercises', []).on('PUT /plans/9', (call: Call) => ({ ...NUOVA, ...(call.body as object) }));
    nav.go('/schede/9');
    render(Host, { page: PlanEditorPage, params: { id: 9 } });
    const user = userEvent.setup();
    const name = await details();
    await user.clear(name);
    nav.go('/schede');
    const question = within(await screen.findByRole('alertdialog', { name: 'Uscire senza salvare?' }));
    expect(question.getByText(/La scheda ha bisogno di un nome\./)).toBeInTheDocument();
    await user.click(question.getByRole('button', { name: 'Resta' }));
    expect(nav.path).toBe('/schede/9');
    nav.go('/schede');
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Esci' }));
    expect(nav.path).toBe('/schede');
  });

  it('asks first when the last change did not reach the server', async () => {
    fakeApi().on('GET /plans/9', NUOVA).on('GET /exercises', []).on('PUT /plans/9', { status: 503 });
    nav.go('/schede/9');
    render(Host, { page: PlanEditorPage, params: { id: 9 } });
    const user = userEvent.setup();
    const name = await details();
    await user.type(name, ' 2');
    await vi.waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument(), { timeout: 3000 });
    nav.go('/schede');
    const question = within(await screen.findByRole('alertdialog', { name: 'Uscire senza salvare?' }));
    expect(question.getByText(/non è arrivata/)).toBeInTheDocument();
    await user.click(question.getByRole('button', { name: 'Resta' }));
    expect(nav.path).toBe('/schede/9');
  });

  it('does not ask once the plan has been deleted: there is nothing left to save', async () => {
    fakeApi().on('GET /plans/9', NUOVA).on('GET /exercises', []).on('DELETE /plans/9', { ok: true });
    nav.go('/schede/9');
    render(Host, { page: PlanEditorPage, params: { id: 9 } });
    const user = userEvent.setup();
    await user.clear(await details());
    await user.click(screen.getByRole('button', { name: /^Elimina la scheda/ }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Elimina' }));
    await vi.waitFor(() => expect(nav.path).toBe('/schede'));
    expect(screen.queryByRole('alertdialog', { name: 'Uscire senza salvare?' })).not.toBeInTheDocument();
  });

  it('lets go without asking when everything is saved', async () => {
    fakeApi().on('GET /plans/9', NUOVA).on('GET /exercises', []);
    nav.go('/schede/9');
    render(Host, { page: PlanEditorPage, params: { id: 9 } });
    await details();
    nav.go('/schede');
    expect(nav.path).toBe('/schede');
  });
});

describe('a day added to a saved plan', () => {
  it('is sent without an id once, then with the id the server gave it', async () => {
    const api = fakeApi()
      .on('GET /plans/9', NUOVA)
      .on('PUT /plans/9', (call: Call) => {
        const input = call.body as { days: { id?: number; name: string }[] };
        return { ...NUOVA, days: input.days.map((day, position) => ({ id: day.id ?? 92, name: day.name, position, exercises: [] })) };
      });
    render(Host, { page: PlanEditorPage, params: { id: 9 } });
    const user = userEvent.setup();
    await screen.findByRole('heading', { name: 'Forza' });
    await user.click(screen.getByRole('button', { name: 'Aggiungi allenamento' }));
    await settled(() => expect(planChanges(api)).toHaveLength(1));
    expect((planChanges(api)[0]!.body as { days: { id?: number }[] }).days.map((day) => day.id)).toEqual([91, undefined]);
    const names = screen.getAllByLabelText('Allenamento');
    await user.clear(names[1]!);
    await user.type(names[1]!, 'Gambe');
    await user.tab();
    await settled(() => expect(planChanges(api)).toHaveLength(2));
    expect((planChanges(api)[1]!.body as { days: { id?: number; name: string }[] }).days).toMatchObject([{ id: 91 }, { id: 92, name: 'Gambe' }]);
  });
});

describe('taking something out of a plan', () => {
  it('asks first, naming it, and nothing changes until yes', async () => {
    const api = fakeApi().on('GET /plans/5', FORZA).on('PUT /plans/5', FORZA);
    render(Host, { page: PlanEditorPage, params: { id: 5 } });
    const user = userEvent.setup();
    await screen.findByRole('heading', { name: 'Forza' });

    await user.click(screen.getAllByRole('button', { name: 'Togli l’allenamento' })[1]!);
    let question = within(await screen.findByRole('alertdialog', { name: 'Togliere l’allenamento «B»?' }));
    expect(question.getByText('Con i suoi esercizi.')).toBeInTheDocument();
    await user.click(question.getByRole('button', { name: 'Annulla' }));
    expect(screen.getAllByLabelText('Allenamento')).toHaveLength(2);

    await user.click(screen.getAllByRole('button', { name: 'Togli l’esercizio' })[0]!);
    question = within(await screen.findByRole('alertdialog', { name: 'Togliere «Squat» dall’allenamento «A»?' }));
    await user.click(question.getByRole('button', { name: 'Annulla' }));

    await user.click(screen.getAllByRole('button', { name: 'Togli la serie 5' })[0]!);
    question = within(await screen.findByRole('alertdialog', { name: 'Togliere la serie 5 di «Squat»?' }));
    await user.click(question.getByRole('button', { name: 'Annulla' }));

    expect(setReps()).toEqual(['5', '5', '5', '5', '3', '8', '8', '8', '8', '8', '8']);
    await new Promise((resolve) => setTimeout(resolve, 800));
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
    expect(screen.getAllByLabelText('Note').map((input) => (input as HTMLInputElement).value)).toEqual(['', '', 'lento']);
    expect(await details()).toHaveValue('Forza');
    expect(screen.getByLabelText('Note')).toHaveValue('3 volte');
  });

  it('opens on its workouts; its own details sit in a tab of their own, not above them', async () => {
    fakeApi().on('GET /plans/5', FORZA);
    render(Host, { page: PlanEditorPage, params: { id: 5 } });
    await screen.findByRole('heading', { name: 'Forza' });
    expect(screen.getByRole('tab', { name: 'Allenamenti' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByPlaceholderText('Forza, autunno')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Archiviata/ })).not.toBeInTheDocument();
    expect(screen.getAllByLabelText('Allenamento')).toHaveLength(2);
    await details();
    expect(screen.getByRole('tab', { name: 'Dettagli' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('checkbox', { name: /Archiviata/ })).toBeInTheDocument();
    expect(screen.queryByLabelText('Allenamento')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aggiungi allenamento' })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Allenamenti' }));
    expect(screen.getAllByLabelText('Allenamento')).toHaveLength(2);
  });

  it('adds sets inside the exercise card with a primary button; exercises and days, outside the cards, with secondary ones', async () => {
    fakeApi().on('GET /plans/5', FORZA);
    render(Host, { page: PlanEditorPage, params: { id: 5 } });
    await screen.findByRole('heading', { name: 'Forza' });
    for (const button of screen.getAllByRole('button', { name: /^Aggiungi una serie a / })) expect(button).toHaveClass('primary');
    for (const button of screen.getAllByRole('button', { name: 'Aggiungi esercizio' })) expect(button).toHaveClass('ghost');
    expect(screen.getByRole('button', { name: 'Aggiungi allenamento' })).toHaveClass('ghost');
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
    await confirmTake(user);
    await details();
    await user.click(screen.getByRole('checkbox', { name: /Archiviata/ }));
    await settled(() => expect(planChanges(api).at(-1)?.body).toMatchObject({ archived: true }));
    expect(planChanges(api).at(-1)).toEqual({
      route: 'PUT /plans/5',
      body: {
        name: 'Forza', notes: '3 volte', startsOn: '2026-10-05', endsOn: null, archived: true,
        days: [
          { id: 52, name: 'B', exercises: [{ exerciseId: 3, reps: ['8', '8', '8'], restSeconds: 90, notes: 'lento' }] },
          { id: 51, name: 'A', exercises: [{ exerciseId: 2, reps: ['8', '8', '8'], restSeconds: 90, notes: null }] },
        ],
      },
    });
    expect(status()).toHaveTextContent('Salvata');
  });

  it('opens with its period, and sends a change to it', async () => {
    const api = fakeApi().on('GET /plans/5', FORZA).on('PUT /plans/5', (call: Call) => ({ ...FORZA, ...(call.body as object) }));
    render(Host, { page: PlanEditorPage, params: { id: 5 } });
    await details();
    expect(screen.getByLabelText('Dal')).toHaveValue('2026-10-05');
    expect(screen.getByLabelText('Al')).toHaveValue('');
    await fireEvent.input(screen.getByLabelText('Al'), { target: { value: '2026-11-15' } });
    await settled(() => expect(planChanges(api).at(-1)?.body).toMatchObject({ startsOn: '2026-10-05', endsOn: '2026-11-15' }));
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

  it('loses a day with its exercises', async () => {
    const api = fakeApi().on('GET /plans/5', FORZA).on('PUT /plans/5', FORZA);
    render(Host, { page: PlanEditorPage, params: { id: 5 } });
    const user = userEvent.setup();
    await screen.findByRole('heading', { name: 'Forza' });
    await user.click(screen.getAllByRole('button', { name: 'Togli l’allenamento' })[0]!);
    await confirmTake(user);
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

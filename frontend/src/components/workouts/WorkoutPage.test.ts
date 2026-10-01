import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nav } from '../../lib/nav.svelte';
import { toast } from '../../lib/toast.svelte';
import type { WorkoutDetail, WorkoutSet } from '../../lib/types';
import { type Call, fakeApi, silentApi } from '../../test/fake-api';
import Host from '../../test/Host.svelte';
import WorkoutPage from './WorkoutPage.svelte';

const target = (id: number, exerciseId: number, exerciseName: string, sets: number, reps: string, restSeconds: number | null) => ({
  id, exerciseId, exerciseName, position: 0, sets, reps, restSeconds, notes: null,
});

const set = (id: number, exerciseId: number, exerciseName: string, reps: number, weightKg: number): WorkoutSet => ({
  id, exerciseId, exerciseName, reps, weightKg, createdAt: '2026-10-01T17:05:00.000Z',
});

/** Forza · A in progress: Squat with one set done and a last time, Panca still to do. */
const DETAIL: WorkoutDetail = {
  id: 7, planDayId: 11, planName: 'Forza', dayName: 'A',
  startedAt: '2026-10-01T17:00:00.000Z', finishedAt: null, notes: null,
  plan: [target(1, 1, 'Squat', 3, '8-10', 90), target(2, 2, 'Panca piana', 3, '10', null)],
  sets: [set(100, 1, 'Squat', 8, 60)],
  previous: {
    1: { workoutId: 3, startedAt: '2026-09-20T17:00:00.000Z', sets: [{ reps: 8, weightKg: 60 }, { reps: 8, weightKg: 60 }, { reps: 6, weightKg: 62.5 }], note: 'ginocchio un po’ dentro' },
  },
  exerciseNotes: { 1: 'scendere più lento' },
};

/** The server keeping the workout: sets added, changed, removed; the end set and taken back. */
function server(detail: WorkoutDetail = DETAIL) {
  let nextId = 200;
  const names: Record<number, string> = { 1: 'Squat', 2: 'Panca piana', 9: 'Curl' };
  return fakeApi()
    .on('GET /workouts/7', detail)
    .on('POST /workouts/7/sets', (call: Call) => {
      const body = call.body as { exerciseId: number; reps: number; weightKg: number };
      return set(nextId++, body.exerciseId, names[body.exerciseId]!, body.reps, body.weightKg);
    })
    .on('PATCH /sets/100', (call: Call) => ({ ...detail.sets[0], ...(call.body as object) }))
    .on('DELETE /sets/100', { ok: true })
    .on('PATCH /workouts/7', (call: Call) => {
      const body = call.body as { notes?: string | null; finished?: boolean };
      return {
        ...detail,
        ...('notes' in body ? { notes: body.notes } : {}),
        ...('finished' in body ? { finishedAt: body.finished ? '2026-10-01T18:10:00.000Z' : null } : {}),
      };
    });
}

const reps = () => screen.getByLabelText('Ripetizioni', { selector: 'input' });
const kg = () => screen.getByLabelText('Peso', { selector: 'input' });
const doneSets = () => [...document.querySelectorAll('.set .what')].map((node) => node.textContent);

describe('a workout in progress', () => {
  it('shows what the plan asks and what was done the last time', async () => {
    server();
    render(Host, { page: WorkoutPage, params: { id: 7 } });
    expect(await screen.findByRole('heading', { name: 'Forza · A' })).toBeInTheDocument();
    expect(screen.getByText(/in corso/)).toBeInTheDocument();
    expect(screen.getByText('Scheda').parentElement).toHaveTextContent('3 × 8-10 · recupero 1:30');
    expect(screen.getByText('L’ultima volta').parentElement).toHaveTextContent('dom 20 set · 8 × 60 kg, 8 × 60 kg, 6 × 62,5 kg');
    expect(screen.getByRole('button', { name: /^Squat/ })).toHaveTextContent('1/3');
    expect(screen.getByRole('button', { name: /^Panca piana/ })).toHaveTextContent('0/3');
    expect(doneSets()).toEqual(['8 × 60 kg']);
  });

  it('opens the first exercise with sets to do, the next set written as the one before', async () => {
    server();
    render(Host, { page: WorkoutPage, params: { id: 7 } });
    expect(await screen.findByRole('button', { name: /^Squat/ })).toHaveAttribute('aria-expanded', 'true');
    expect(reps()).toHaveValue('8');
    expect(kg()).toHaveValue('60');
    expect(screen.getByRole('button', { name: 'Segna la serie 2' })).toBeInTheDocument();
  });

  it('logs a set changed with the steppers, and counts it', async () => {
    const api = server();
    render(Host, { page: WorkoutPage, params: { id: 7 } });
    const user = userEvent.setup();
    await screen.findByRole('button', { name: 'Segna la serie 2' });
    await user.click(screen.getByRole('button', { name: 'Peso, più 2,5' }));
    await user.click(screen.getByRole('button', { name: 'Ripetizioni, meno 1' }));
    expect(kg()).toHaveValue('62,5');
    expect(reps()).toHaveValue('7');
    await user.click(screen.getByRole('button', { name: 'Segna la serie 2' }));
    expect(api.changes()).toEqual([{ route: 'POST /workouts/7/sets', body: { exerciseId: 1, reps: 7, weightKg: 62.5 } }]);
    expect(await screen.findByRole('button', { name: 'Segna la serie 3' })).toBeInTheDocument();
    expect(doneSets()).toEqual(['8 × 60 kg', '7 × 62,5 kg']);
    expect(screen.getByRole('button', { name: /^Squat/ })).toHaveTextContent('2/3');
  });

  it('takes kg typed with the comma', async () => {
    const api = server();
    render(Host, { page: WorkoutPage, params: { id: 7 } });
    const user = userEvent.setup();
    await screen.findByRole('button', { name: 'Segna la serie 2' });
    await user.clear(kg());
    await user.type(kg(), '61,25');
    await user.click(screen.getByRole('button', { name: 'Segna la serie 2' }));
    expect(api.changes()).toEqual([{ route: 'POST /workouts/7/sets', body: { exerciseId: 1, reps: 8, weightKg: 61.25 } }]);
  });

  it('proposes the plan’s reps for a first set, and asks for the weight before sending', async () => {
    const api = server();
    render(Host, { page: WorkoutPage, params: { id: 7 } });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /^Panca piana/ }));
    expect(reps()).toHaveValue('10');
    expect(kg()).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Segna la serie 1' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Il peso va da 0 a 1000 kg, con la virgola se serve.');
    expect(api.changes()).toEqual([]);
  });

  it('corrects a set from its row', async () => {
    const api = server();
    render(Host, { page: WorkoutPage, params: { id: 7 } });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /8 × 60 kg/ }));
    const sheet = within(screen.getByRole('dialog', { name: 'Serie 1 di Squat' }));
    expect(sheet.getByText('Scritta come 8 × 60 kg.')).toBeInTheDocument();
    await user.click(sheet.getByRole('button', { name: 'Ripetizioni, più 1' }));
    await user.click(sheet.getByRole('button', { name: 'Salva' }));
    expect(api.changes()).toEqual([{ route: 'PATCH /sets/100', body: { reps: 9, weightKg: 60 } }]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(doneSets()).toEqual(['9 × 60 kg']);
  });

  it('takes a set away from its row, after saying yes', async () => {
    const api = server();
    render(Host, { page: WorkoutPage, params: { id: 7 } });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /8 × 60 kg/ }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Togli' }));
    expect(api.changes()).toEqual([]);
    await user.click(within(await screen.findByRole('alertdialog', { name: 'Togliere la serie 1 di Squat?' })).getByRole('button', { name: 'Togli' }));
    expect(api.changes()).toEqual([{ route: 'DELETE /sets/100', body: undefined }]);
    expect(doneSets()).toEqual([]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Squat/ })).toHaveTextContent('0/3');
  });

  it('adds an exercise that is not in the plan, opened and ready for its first set', async () => {
    const api = server().on('GET /exercises', [
      { id: 1, name: 'Squat', muscleGroup: null, notes: null },
      { id: 9, name: 'Curl', muscleGroup: 'Bicipiti', notes: null },
    ]);
    render(Host, { page: WorkoutPage, params: { id: 7 } });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Aggiungi un esercizio' }));
    const picker = within(screen.getByRole('dialog', { name: 'Aggiungi un esercizio' }));
    // the ones already on the page are not proposed again
    await picker.findByRole('button', { name: 'Curl Bicipiti' });
    expect(picker.queryByRole('button', { name: 'Squat' })).not.toBeInTheDocument();
    await user.click(await picker.findByRole('button', { name: 'Curl Bicipiti' }));
    expect(screen.getByRole('button', { name: /^Curl/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /^Curl/ })).toHaveTextContent('0 serie');
    await user.type(kg(), '12');
    await user.type(reps(), '12');
    await user.click(screen.getByRole('button', { name: 'Segna la serie 1' }));
    expect(api.changes()).toEqual([{ route: 'POST /workouts/7/sets', body: { exerciseId: 9, reps: 12, weightKg: 12 } }]);
    expect(await screen.findByRole('button', { name: /^Curl/ })).toHaveTextContent('1 serie');
  });

  it('saves the notes when you leave the field, and only if they changed', async () => {
    const api = server();
    render(Host, { page: WorkoutPage, params: { id: 7 } });
    const user = userEvent.setup();
    const notes = await screen.findByPlaceholderText('Come è andata, cosa cambiare');
    await user.click(notes);
    await user.tab();
    expect(api.changes()).toEqual([]);
    await user.type(notes, '  stanco  ');
    await user.tab();
    expect(api.changes()).toEqual([{ route: 'PATCH /workouts/7', body: { notes: 'stanco' } }]);
  });

  it('ends with Termina, closing the form, and opens again with Riapri', async () => {
    const api = server();
    render(Host, { page: WorkoutPage, params: { id: 7 } });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Termina' }));
    expect(api.changes()).toEqual([{ route: 'PATCH /workouts/7', body: { finished: true } }]);
    expect(toast.message).toBe('Allenamento terminato.');
    expect(screen.queryByRole('button', { name: /Segna la serie/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aggiungi un esercizio' })).not.toBeInTheDocument();
    expect(screen.getByText(/· 1 h 10 min/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Riapri' }));
    expect(api.changes().at(-1)).toEqual({ route: 'PATCH /workouts/7', body: { finished: false } });
    expect(await screen.findByRole('button', { name: 'Termina' })).toBeInTheDocument();
  });

  it('is deleted after saying yes, going home with the message', async () => {
    const api = server().on('DELETE /workouts/7', { ok: true });
    render(Host, { page: WorkoutPage, params: { id: 7 } });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Elimina' }));
    const question = within(await screen.findByRole('alertdialog', { name: 'Eliminare questo allenamento?' }));
    expect(question.getByText('Si porta via le sue serie, e le statistiche non le contano più.')).toBeInTheDocument();
    expect(api.changes()).toEqual([]);
    await user.click(question.getByRole('button', { name: 'Elimina' }));
    expect(api.changes()).toEqual([{ route: 'DELETE /workouts/7', body: undefined }]);
    expect(nav.path).toBe('/');
    expect(toast.open).toBe(true);
    expect(toast.message).toBe('Allenamento eliminato.');
  });

});

describe('a workout already finished', () => {
  it('shows its sets without the form to add more', async () => {
    server({ ...DETAIL, finishedAt: '2026-10-01T18:00:00.000Z', planName: null, dayName: null, plan: [] });
    render(Host, { page: WorkoutPage, params: { id: 7 } });
    expect(await screen.findByRole('heading', { name: 'Allenamento libero' })).toBeInTheDocument();
    expect(doneSets()).toEqual(['8 × 60 kg']);
    expect(screen.queryByRole('button', { name: /Segna la serie/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Riapri' })).toBeInTheDocument();
  });

  it('says why when it is not there', async () => {
    fakeApi().on('GET /workouts/7', { status: 404, body: { error: 'Non trovato.' } });
    render(Host, { page: WorkoutPage, params: { id: 7 } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Non trovato.');
  });
});

describe('the rest after a set', () => {
  afterEach(() => vi.useRealTimers());

  /** Fake clock for the countdown only: testing-library keeps its own timeouts. */
  const fakeClock = () => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'], now: new Date('2026-10-01T17:10:00Z') });
  const bar = () => screen.queryByRole('timer', { name: 'Recupero' });

  async function logSquat() {
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Segna la serie 2' }));
    await screen.findByRole('button', { name: 'Segna la serie 3' });
    return user;
  }

  it('starts after a set of an exercise with a rest in the plan, and counts down', async () => {
    server();
    fakeClock();
    render(Host, { page: WorkoutPage, params: { id: 7 } });
    expect(bar()).not.toBeInTheDocument();
    await logSquat();
    expect(bar()).toHaveTextContent('Recupero 1:30');
    vi.advanceTimersByTime(18_000);
    expect(await screen.findByText('1:12')).toBeInTheDocument();
  });

  it('takes 15 seconds more or less, and stops on request', async () => {
    server();
    fakeClock();
    render(Host, { page: WorkoutPage, params: { id: 7 } });
    const user = await logSquat();
    await user.click(screen.getByRole('button', { name: 'Aggiungi 15 secondi' }));
    expect(bar()).toHaveTextContent('1:45');
    await user.click(screen.getByRole('button', { name: 'Togli 15 secondi' }));
    await user.click(screen.getByRole('button', { name: 'Togli 15 secondi' }));
    expect(bar()).toHaveTextContent('1:15');
    await user.click(screen.getByRole('button', { name: 'Ferma il recupero' }));
    expect(bar()).not.toBeInTheDocument();
  });

  it('vibrates at the end, and goes', async () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    server();
    fakeClock();
    render(Host, { page: WorkoutPage, params: { id: 7 } });
    await logSquat();
    vi.advanceTimersByTime(90_000);
    await vi.waitFor(() => expect(bar()).not.toBeInTheDocument());
    expect(vibrate).toHaveBeenCalledOnce();
    delete (navigator as { vibrate?: unknown }).vibrate;
  });

  it('ends quietly on a phone that cannot vibrate', async () => {
    server();
    fakeClock();
    render(Host, { page: WorkoutPage, params: { id: 7 } });
    await logSquat();
    vi.advanceTimersByTime(90_000);
    await vi.waitFor(() => expect(bar()).not.toBeInTheDocument());
  });

  it('starts again from the top with the next set', async () => {
    server();
    fakeClock();
    render(Host, { page: WorkoutPage, params: { id: 7 } });
    const user = await logSquat();
    vi.advanceTimersByTime(60_000);
    await user.click(screen.getByRole('button', { name: 'Segna la serie 3' }));
    await screen.findByRole('button', { name: 'Segna la serie 4' });
    expect(bar()).toHaveTextContent('Recupero 1:30');
  });

  it('does not start for an exercise without a rest', async () => {
    server();
    render(Host, { page: WorkoutPage, params: { id: 7 } });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /^Panca piana/ }));
    await user.type(kg(), '40');
    await user.click(screen.getByRole('button', { name: 'Segna la serie 1' }));
    await screen.findByRole('button', { name: 'Segna la serie 2' });
    expect(bar()).not.toBeInTheDocument();
  });

  it('stops when the workout ends', async () => {
    server();
    fakeClock();
    render(Host, { page: WorkoutPage, params: { id: 7 } });
    const user = await logSquat();
    await user.click(screen.getByRole('button', { name: 'Termina' }));
    await screen.findByRole('button', { name: 'Riapri' });
    expect(bar()).not.toBeInTheDocument();
  });
});

describe('while it loads, the page', () => {
  it('shows its shape', () => {
    silentApi();
    render(Host, { page: WorkoutPage, params: { id: 7 } });
    expect(document.querySelector('.skeleton')).toBeInTheDocument();
  });
});

describe('a note on an exercise', () => {
  const note = (name: string) => within(screen.getByRole('button', { name: new RegExp(`^${name}`) }).closest('.card') as HTMLElement).getByLabelText('Nota');

  it('shows what was written last time under it, and today’s in the field', async () => {
    server();
    render(Host, { page: WorkoutPage, params: { id: 7 } });
    expect(await screen.findByText('«ginocchio un po’ dentro»')).toBeInTheDocument();
    expect(note('Squat')).toHaveValue('scendere più lento');
    await userEvent.setup().click(screen.getByRole('button', { name: /^Panca piana/ }));
    expect(note('Panca piana')).toHaveValue('');
    expect(note('Panca piana')).toHaveAttribute('placeholder', 'Come è andato, cosa cambiare la prossima volta');
  });

  it('is saved when you leave the field, only if changed, and says so quietly', async () => {
    const api = server().on('PUT /workouts/7/exercises/1/note', (call: Call) => ({ exerciseId: 1, note: (call.body as { note: string }).note }));
    render(Host, { page: WorkoutPage, params: { id: 7 } });
    const user = userEvent.setup();
    await screen.findByText('«ginocchio un po’ dentro»');
    await user.click(note('Squat'));
    await user.tab();
    expect(api.changes()).toEqual([]);
    await user.clear(note('Squat'));
    await user.type(note('Squat'), '  più lento  ');
    await user.tab();
    expect(api.changes()).toEqual([{ route: 'PUT /workouts/7/exercises/1/note', body: { note: 'più lento' } }]);
    expect(await screen.findByText('Salvata')).toBeInTheDocument();
  });

  it('emptied is removed', async () => {
    const api = server().on('PUT /workouts/7/exercises/1/note', { exerciseId: 1, note: null });
    render(Host, { page: WorkoutPage, params: { id: 7 } });
    const user = userEvent.setup();
    await screen.findByText('«ginocchio un po’ dentro»');
    await user.clear(note('Squat'));
    await user.tab();
    expect(api.changes()).toEqual([{ route: 'PUT /workouts/7/exercises/1/note', body: { note: null } }]);
  });

  it('refused keeps the text and says why', async () => {
    server().on('PUT /workouts/7/exercises/1/note', { status: 400, body: { error: 'Testo della nota: troppo lungo.' } });
    render(Host, { page: WorkoutPage, params: { id: 7 } });
    const user = userEvent.setup();
    await screen.findByText('«ginocchio un po’ dentro»');
    await user.type(note('Squat'), ' e poi');
    await user.tab();
    expect(await screen.findByRole('alert')).toHaveTextContent('Testo della nota: troppo lungo.');
    expect(note('Squat')).toHaveValue('scendere più lento e poi');
    expect(screen.queryByText('Salvata')).not.toBeInTheDocument();
  });

  it('of last time is not shown when there was none', async () => {
    server({ ...DETAIL, previous: { 1: { ...DETAIL.previous[1]!, note: null } } });
    render(Host, { page: WorkoutPage, params: { id: 7 } });
    await screen.findByText('L’ultima volta');
    expect(document.querySelector('.last-note')).toBeNull();
  });
});

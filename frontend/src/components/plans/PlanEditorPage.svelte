<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Autosave } from '../../lib/autosave.svelte';
  import { plansApi } from '../../lib/endpoints';
  import { nav } from '../../lib/nav.svelte';
  import { addDay, addSet, draftOf, learnDayIds, move, newKey, problemOf, removeSet, toInput, type Draft, type DraftDay } from '../../lib/plan-draft';
  import { planPath, PLANS_PATH } from '../../lib/routing';
  import { toast } from '../../lib/toast.svelte';
  import type { Exercise, PlanInput } from '../../lib/types';
  import Alert from '../Alert.svelte';
  import Button from '../Button.svelte';
  import Icon from '../Icon.svelte';
  import PageCard from '../PageCard.svelte';
  import PageShell from '../PageShell.svelte';
  import Loader from '../Loader.svelte';
  import SaveStatus from '../SaveStatus.svelte';
  import Switch from '../Switch.svelte';
  import TextField from '../TextField.svelte';
  import { ui } from '../../lib/ui.svelte';
  import ExercisePicker from '../exercises/ExercisePicker.svelte';

  /**
   * Una scheda da scrivere: il nome, i giorni, e in ogni giorno gli esercizi
   * in ordine con serie, ripetizioni e recupero.
   *
   * Una scheda nuova si crea su richiesta: nome, note e «Crea la scheda».
   * Creata, la pagina diventa la sua, e da lì si salva da sé mentre la
   * scrivi, tutta insieme (`Autosave`): nessun tasto «Salva». Quello che il
   * server rifiuterebbe si dice prima, e non parte.
   */
  let { id }: { id: number | null } = $props();

  let draft = $state<Draft | null>(null);
  let error = $state('');
  let working = $state(false);
  /** L'ultima versione mandata, o quella aperta: uguale, non si rimanda. */
  let sent = '';

  /* una scheda nuova: solo il nome e le note, finché non la si crea */
  let newName = $state('');
  let newNotes = $state('');

  async function create(): Promise<void> {
    working = true;
    error = '';
    try {
      const created = await plansApi.create(toInput({ ...draftOf(null), name: newName, notes: newNotes }));
      nav.go(planPath(created.id), { replace: true });
    } catch (failure) {
      error = (failure as Error).message;
      working = false;
    }
  }

  /** Quello che parte, con i giorni com'erano allora: la risposta dà l'id ai nuovi. */
  interface Sending { json: string; days: DraftDay[] }
  const saver = new Autosave<Sending>(async ({ json, days }) => {
    const input = JSON.parse(json) as PlanInput;
    const saved = await plansApi.save(id!, input);
    learnDayIds(days, input, saved);
    // Se nient'altro è cambiato intanto, gli id imparati non sono una modifica da rimandare.
    if (sent === json && draft) sent = JSON.stringify(toInput(draft));
  });
  // lasciando la pagina parte quello che aspettava
  onDestroy(() => void saver.flush());

  function opened(next: Draft): void {
    sent = JSON.stringify(toInput(next));
    draft = next;
  }

  $effect(() => {
    if (id !== null) plansApi.get(id).then((plan) => opened(draftOf(plan)), (failure: Error) => (error = failure.message));
  });

  const problem = $derived(draft ? problemOf(draft) : null);

  /* Con un campo non valido la scheda non si salva: quello cambiato dopo andrebbe perso
     uscendo, e prima di uscire lo si chiede, accanto al motivo. */
  $effect(() => ui.trattieni(() => {
    if (!draft || !problem || JSON.stringify(toInput(draft)) === sent) return null;
    const anchor = document.querySelector<HTMLElement>('.page [role="alert"]') ?? document.body;
    return { anchor, detail: `${problem} Quello che hai cambiato non è ancora salvato.` };
  }));

  $effect(() => {
    if (!draft) return;
    const now = JSON.stringify(toInput(draft));
    if (now === sent || problem) return;
    sent = now;
    saver.change({ json: now, days: [...draft.days] });
  });

  /** Un esercizio da aggiungere a un giorno, scelto in una finestra. */
  function pickFor(day: DraftDay): void {
    ui.openModal({
      title: `Aggiungi al giorno ${day.name.trim() || 'senza nome'}`,
      view: ExercisePicker,
      props: {
        exclude: day.exercises.map((one) => one.exerciseId),
        onpick: (exercise: Exercise) =>
          day.exercises.push({ key: newKey(), exerciseId: exercise.id, exerciseName: exercise.name, reps: ['10', '10', '10'], restSeconds: 90, notes: '' }),
      },
    });
  }

  /** Un numero scritto in un campo: vuoto o illeggibile è niente, il resto è il numero intero che c'è. */
  const whole = (text: string): number | null => {
    const value = Number(text.trim());
    return text.trim() === '' || !Number.isFinite(value) ? null : Math.trunc(value);
  };

  /** Prima si chiede, accanto al tasto: una scheda eliminata non torna. */
  /** Togliere un pezzo della scheda chiede prima, come eliminarla: tutto ciò che è rosso chiede. */
  function askTake(anchor: HTMLElement, title: string, onYes: () => void, detail?: string): void {
    ui.askSure(anchor, { title, ...(detail === undefined ? {} : { detail }), verb: 'Togli', onYes });
  }

  const dayName = (day: DraftDay): string => day.name.trim() || 'senza nome';

  function askRemove(anchor: HTMLElement): void {
    ui.askSure(anchor, {
      title: `Eliminare la scheda «${draft?.name.trim() || 'senza nome'}»?`,
      detail: 'Gli allenamenti già fatti restano nello storico.',
      verb: 'Elimina',
      onYes: () => void remove(),
    });
  }

  async function remove(): Promise<void> {
    if (id === null) return;
    working = true;
    try {
      await plansApi.remove(id);
      toast.show('Scheda eliminata. Gli allenamenti fatti restano nello storico.');
      nav.go(PLANS_PATH, { replace: true });
    } catch (failure) {
      error = (failure as Error).message;
    } finally {
      working = false;
    }
  }

  /** Il ritorno in cima alla pagina: un oggetto qui e non nel markup, che Stryker non sa leggere. */
  const back = { href: PLANS_PATH, label: 'Schede' };
</script>

<PageShell title={id === null ? 'Nuova scheda' : (draft?.name || 'Scheda')} {back}>
  {#snippet meta()}{#if id !== null}<SaveStatus {saver} />{/if}{/snippet}
  {#snippet tools()}
    {#if id !== null && draft}
      <Button
        look="icon"
        tone="danger"
        title="Elimina la scheda"
        aria-label="Elimina la scheda «{draft.name.trim() || 'senza nome'}»"
        disabled={working}
        onclick={(event: MouseEvent) => askRemove(event.currentTarget as HTMLElement)}
      >
        <Icon name="trash" />
      </Button>
    {/if}
  {/snippet}
  {#if id === null}
    <PageCard>
      <label class="field">
        <span class="eyebrow">Nome</span>
        <TextField bind:value={newName} placeholder="Forza, autunno" maxlength={100} />
      </label>
      <label class="field">
        <span class="eyebrow">Note</span>
        <TextField kind="multiline" bind:value={newNotes} maxlength={1000} placeholder="Quante volte a settimana, cosa curare" />
      </label>
      {#if error}<Alert message={error} />{/if}
      <span class="create">
        <Button look="primary" disabled={working || newName.trim() === ''} onclick={() => void create()}>
          <Icon name="plus" /> Crea la scheda
        </Button>
      </span>
    </PageCard>
  {:else if !draft && !error}
    <Loader />
  {:else if draft}
    <PageCard>
      <label class="field">
        <span class="eyebrow">Nome</span>
        <TextField bind:value={draft.name} placeholder="Forza, autunno" maxlength={100} />
      </label>
      <label class="field">
        <span class="eyebrow">Note</span>
        <TextField kind="multiline" bind:value={draft.notes} maxlength={1000} placeholder="Quante volte a settimana, cosa curare" />
      </label>
      <Switch
        checked={draft.archived}
        onchange={(value) => draft && (draft.archived = value)}
        label="Archiviata"
        note="Non compare fra quelle da cui iniziare un allenamento."
      />
    </PageCard>

    {#each draft.days as day, dayIndex (day.key)}
      <!-- un giorno è un gruppo: la sua card, una card per esercizio, e il tasto per aggiungerne -->
      <div class="day" role="group" aria-label="Giorno {dayName(day)}">
      <PageCard>
        <div class="day-head">
          <label class="field day-name">
            <span class="eyebrow">Giorno</span>
            <TextField bind:value={day.name} placeholder="A" maxlength={100} />
          </label>
          <span class="tools">
            <Button look="icon" title="Sposta su" disabled={dayIndex === 0} onclick={() => draft && (draft.days = move(draft.days, dayIndex, -1))}>
              <Icon name="up" />
            </Button>
            <Button look="icon" title="Sposta giù" disabled={dayIndex === draft.days.length - 1} onclick={() => draft && (draft.days = move(draft.days, dayIndex, 1))}>
              <Icon name="down" />
            </Button>
            <Button look="icon" tone="danger" title="Togli il giorno" onclick={(event: MouseEvent) => askTake(event.currentTarget as HTMLElement, `Togliere il giorno «${dayName(day)}»?`, () => draft && (draft.days = draft.days.filter((one) => one !== day)), 'Con i suoi esercizi.')}>
              <Icon name="trash" />
            </Button>
          </span>
        </div>
      </PageCard>

        {#each day.exercises as exercise, index (exercise.key)}
          <PageCard>
          <div class="exercise">
            <div class="exercise-head">
              <span class="exercise-name">{exercise.exerciseName}</span>
              <span class="tools">
                <Button look="icon" size="sm" title="Sposta su" disabled={index === 0} onclick={() => (day.exercises = move(day.exercises, index, -1))}>
                  <Icon name="up" />
                </Button>
                <Button look="icon" size="sm" title="Sposta giù" disabled={index === day.exercises.length - 1} onclick={() => (day.exercises = move(day.exercises, index, 1))}>
                  <Icon name="down" />
                </Button>
                <Button look="icon" size="sm" tone="danger" title="Togli l’esercizio" onclick={(event: MouseEvent) => askTake(event.currentTarget as HTMLElement, `Togliere «${exercise.exerciseName}» dal giorno «${dayName(day)}»?`, () => (day.exercises = day.exercises.filter((one) => one !== exercise)))}>
                  <Icon name="close" />
                </Button>
              </span>
            </div>
            <!-- le serie una per una, ognuna con le sue ripetizioni: «12, 10, 8» -->
            <ol class="sets">
              {#each exercise.reps as _, at (at)}
                <li class="set">
                  <span class="set-name">Serie {at + 1}</span>
                  <TextField bind:value={exercise.reps[at]} label="Serie {at + 1}, ripetizioni" placeholder="8-10" maxlength={20} />
                  <Button look="icon" size="sm" tone="danger" title="Togli la serie {at + 1}" aria-label="Togli la serie {at + 1}" disabled={exercise.reps.length === 1} onclick={(event: MouseEvent) => askTake(event.currentTarget as HTMLElement, `Togliere la serie ${at + 1} di «${exercise.exerciseName}»?`, () => removeSet(exercise, at))}>
                    <Icon name="close" />
                  </Button>
                </li>
              {/each}
            </ol>
            <span class="add-set">
              <Button look="primary" disabled={exercise.reps.length >= 20} aria-label="Aggiungi una serie a {exercise.exerciseName}" onclick={() => addSet(exercise)}>
                <Icon name="plus" /> Serie
              </Button>
            </span>
            <div class="numbers">
              <label class="field">
                <span class="eyebrow">Recupero (s)</span>
                <input
                  type="text"
                  inputmode="numeric"
                  value={exercise.restSeconds === null ? '' : String(exercise.restSeconds)}
                  oninput={(event) => (exercise.restSeconds = whole(event.currentTarget.value))}
                />
              </label>
            </div>
            <TextField bind:value={exercise.notes} placeholder="Note, per esempio il tempo o la presa" maxlength={1000} label="Note" />
          </div>
          </PageCard>
        {/each}

        <span class="add">
          <Button look="ghost" onclick={() => pickFor(day)}>
            <Icon name="plus" /> Aggiungi esercizio
          </Button>
        </span>
      </div>
    {/each}

    <div class="bottom">
      <Button look="ghost" onclick={() => draft && addDay(draft)}>
        <Icon name="plus" /> Aggiungi giorno
      </Button>
    </div>

    {#if problem}<Alert message={problem} />{/if}
    {#if saver.status === 'error'}<Alert message={saver.error} />{/if}
    {#if error}<Alert message={error} />{/if}

  {:else if error}
    <Alert message={error} />
  {/if}
</PageShell>


<style>
  .create { display: block; }

  @media (min-width: 601px) { .create { justify-self: end; } }

  .day-head {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }

  .day-name { flex: 1; min-width: 0; }

  .tools { display: flex; align-items: center; gap: 2px; flex: none; }

  /* un giorno: la sua card, le card degli esercizi e il tasto, con lo stesso spazio della pagina */
  .day { display: grid; gap: 14px; }

  /* ogni esercizio è una card sua */
  .exercise { display: grid; gap: 8px; }

  .exercise-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .exercise-name { font-weight: 580; min-width: 0; overflow-wrap: anywhere; }

  .numbers {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }

  .sets { display: grid; margin: 0; padding: 0; list-style: none; }

  /* una serie per riga, piatta, separata dal tratto come le righe di ogni elenco */
  .set {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    border-bottom: 1px solid var(--hairline-soft);
  }

  .set-name { font-size: 12.5px; color: var(--ink-2); }

  .set :global(.text-field) { text-align: center; font-variant-numeric: tabular-nums; }

  /* «+ Serie» chiude le serie: «Recupero» sotto è un'altra cosa, e lo dice lo spazio */
  .add-set { display: block; margin-bottom: 14px; }

  @media (min-width: 601px) { .add-set { justify-self: start; } }

  .numbers input { text-align: center; font-variant-numeric: tabular-nums; }

  .bottom { margin: 0; }



  /* «Aggiungi esercizio» sta sotto le card del giorno, fuori da ogni card */
  .add { display: block; }
</style>

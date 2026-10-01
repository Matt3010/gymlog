<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import { Autosave } from '../../lib/autosave.svelte';
  import { workoutsApi } from '../../lib/endpoints';
  import { formatClock, formatDay, formatDuration, formatKg, formatRest } from '../../lib/format';
  import { nav } from '../../lib/nav.svelte';
  import { HOME_PATH } from '../../lib/routing';
  import { RestTimer } from '../../lib/rest-timer.svelte';
  import { toast } from '../../lib/toast.svelte';
  import { ui } from '../../lib/ui.svelte';
  import type { Exercise, WorkoutDetail, WorkoutSet } from '../../lib/types';
  import { blocksOf, describeSets, prefill, readSet, type Block } from '../../lib/workout';
  import Alert from '../Alert.svelte';
  import Button from '../Button.svelte';
  import Icon from '../Icon.svelte';
  import PageCard from '../PageCard.svelte';
  import PageShell from '../PageShell.svelte';
  import SaveStatus from '../SaveStatus.svelte';
  import PanelSkeleton from '../PanelSkeleton.svelte';
  import Stepper from '../Stepper.svelte';
  import TextField from '../TextField.svelte';
  import ExercisePicker from '../exercises/ExercisePicker.svelte';
  import ExerciseNote from './ExerciseNote.svelte';
  import RestBar from './RestBar.svelte';
  import SetForm from './SetForm.svelte';

  /**
   * L'allenamento, esercizio per esercizio.
   *
   * Uno solo è aperto alla volta, con il modulo per la prossima serie già
   * scritto: la serie di prima da ripetere, o quella dell'ultima volta. Gli
   * altri restano chiusi su una riga con il conto delle serie fatte, perché
   * fra una serie e l'altra si guarda una cosa sola. Si scrive col pollice:
   * più e meno, e il tasto grande.
   */
  let { id }: { id: number } = $props();

  let detail = $state<WorkoutDetail | null>(null);
  let error = $state('');
  /** Esercizi aggiunti da qui che non hanno ancora una serie. */
  let added = $state<{ id: number; name: string }[]>([]);
  let active = $state<number | null>(null);
  let reps = $state('');
  let kg = $state('');
  let notes = $state('');
  let working = $state(false);

  /* Il recupero che chiede la scheda, dopo ogni serie. A zero il telefono
     vibra, se sa farlo: in tasca o sulla panca non lo si guarda. */
  const rest = new RestTimer(() => {
    if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
  });
  onDestroy(() => rest.stop());

  const blocks = $derived(detail ? blocksOf(detail, added) : []);
  const finished = $derived(detail?.finishedAt != null);
  const title = $derived(detail ? (detail.dayName ? `${detail.planName} · ${detail.dayName}` : 'Allenamento libero') : 'Allenamento');

  $effect(() => {
    workoutsApi.get(id).then(
      (loaded) => {
        detail = loaded;
        notes = loaded.notes ?? '';
        // si apre il primo esercizio con delle serie ancora da fare
        const all = blocksOf(loaded);
        const next = all.find((block) => block.sets.length < (block.target?.sets ?? 1)) ?? all[0];
        if (next && loaded.finishedAt === null) untrack(() => open(next));
      },
      (failure: Error) => (error = failure.message),
    );
  });

  function open(block: Block): void {
    active = block.exerciseId;
    const proposed = prefill(block);
    reps = proposed.reps === null ? '' : String(proposed.reps);
    kg = proposed.weightKg === null ? '' : String(proposed.weightKg).replace('.', ',');
    error = '';
  }

  async function addSet(block: Block): Promise<void> {
    const typed = readSet(reps, kg);
    if ('error' in typed) {
      error = typed.error;
      return;
    }
    working = true;
    error = '';
    try {
      const done = await workoutsApi.addSet(id, { exerciseId: block.exerciseId, ...typed });
      detail?.sets.push(done);
      added = added.filter((one) => one.id !== block.exerciseId);
      if (block.target?.restSeconds) rest.start(block.target.restSeconds);
    } catch (failure) {
      error = (failure as Error).message;
    } finally {
      working = false;
    }
  }

  /** Un esercizio fuori scheda, scelto in una finestra. */
  function pickExercise(): void {
    ui.openModal({ title: 'Aggiungi un esercizio', view: ExercisePicker, props: { exclude: blocks.map((block) => block.exerciseId), onpick: pick } });
  }

  function pick(exercise: Exercise): void {
    if (!blocks.some((block) => block.exerciseId === exercise.id)) added = [...added, { id: exercise.id, name: exercise.name }];
    const block = blocksOf(detail!, added).find((one) => one.exerciseId === exercise.id);
    if (block) open(block);
  }

  /* la nota dell'allenamento si salva lasciando il campo, come ogni altra */
  const noteSaver = new Autosave<string | null>(async (text) => (detail = await workoutsApi.update(id, { notes: text })), 0);

  function saveNotes(): Promise<void> {
    if (!detail || (detail.notes ?? '') === notes.trim()) return Promise.resolve();
    noteSaver.change(notes.trim() === '' ? null : notes.trim());
    return noteSaver.flush();
  }

  async function setFinished(value: boolean): Promise<void> {
    working = true;
    try {
      await saveNotes();
      detail = await workoutsApi.update(id, { finished: value });
      if (value) {
        active = null;
        rest.stop();
        toast.show('Allenamento terminato.');
        window.scrollTo({ top: 0 });
      }
    } catch (failure) {
      error = (failure as Error).message;
    } finally {
      working = false;
    }
  }

  /** Prima si chiede, accanto al tasto: un allenamento eliminato si porta via le sue serie. */
  function askRemove(anchor: HTMLElement): void {
    ui.askSure(anchor, {
      title: 'Eliminare questo allenamento?',
      detail: 'Si porta via le sue serie, e le statistiche non le contano più.',
      verb: 'Elimina',
      onYes: () => void remove(),
    });
  }

  async function remove(): Promise<void> {
    working = true;
    try {
      await workoutsApi.remove(id);
      toast.show('Allenamento eliminato.');
      nav.go(HOME_PATH, { replace: true });
    } catch (failure) {
      error = (failure as Error).message;
      working = false;
    }
  }

  /** Una serie da correggere, o da togliere, in una finestra. */
  function editSet(set: WorkoutSet, number: number): void {
    ui.openModal({
      title: `Serie ${number} di ${set.exerciseName}`,
      view: SetForm,
      props: {
        set,
        number,
        onsaved: (saved: WorkoutSet) => detail && (detail.sets = detail.sets.map((one) => (one.id === saved.id ? saved : one))),
        ondeleted: (setId: number) => detail && (detail.sets = detail.sets.filter((one) => one.id !== setId)),
      },
    });
  }

  /** Il ritorno in cima alla pagina: un oggetto qui e non nel markup, che Stryker non sa leggere. */
  const back = { href: HOME_PATH, label: 'Allenati' };
</script>

<PageShell {title} {back}>
  {#snippet meta()}
    {#if detail}
      <p class="meta">
        {formatDay(detail.startedAt)} alle {formatClock(detail.startedAt)}
        {#if detail.finishedAt}· {formatDuration(detail.startedAt, detail.finishedAt)}{:else}· in corso{/if}
      </p>
    {/if}
  {/snippet}

  {#if !detail && !error}
    <PageCard><PanelSkeleton /></PageCard>
  {:else if detail}
    {#each blocks as block (block.exerciseId)}
      {@const isOpen = active === block.exerciseId}
      <PageCard>
        <button type="button" class="head" aria-expanded={isOpen} onclick={() => (isOpen ? (active = null) : open(block))}>
          <span class="name">{block.name}</span>
          <span class="count" class:done={block.target !== null && block.sets.length >= block.target.sets}>
            {block.target ? `${block.sets.length}/${block.target.sets}` : block.sets.length === 1 ? '1 serie' : `${block.sets.length} serie`}
          </span>
          <Icon name={isOpen ? 'collapse' : 'expand'} />
        </button>

        {#if isOpen || block.sets.length > 0}
          {#if block.target}
            <p class="line">
              <span class="eyebrow">Scheda</span>
              {block.target.sets} × {block.target.reps}{block.target.restSeconds ? ` · recupero ${formatRest(block.target.restSeconds)}` : ''}{block.target.notes ? ` · ${block.target.notes}` : ''}
            </p>
          {/if}
          {#if block.previous}
            <p class="line">
              <span class="eyebrow">L’ultima volta</span>
              {formatDay(block.previous.startedAt)} · {describeSets(block.previous.sets)}
            </p>
            {#if block.previous.note}<p class="last-note">«{block.previous.note}»</p>{/if}
          {/if}

          {#if block.sets.length > 0}
            <ol class="sets">
              {#each block.sets as done, index (done.id)}
                <li>
                  <button type="button" class="set" onclick={() => editSet(done, index + 1)}>
                    <span class="nr">{index + 1}</span>
                    <span class="what">{done.reps} × {formatKg(done.weightKg)}</span>
                    <Icon name="edit" />
                  </button>
                </li>
              {/each}
            </ol>
          {/if}
        {/if}

        {#if isOpen || block.sets.length > 0 || detail.exerciseNotes[block.exerciseId]}
          <ExerciseNote workoutId={id} exerciseId={block.exerciseId} note={detail.exerciseNotes[block.exerciseId] ?? ''} />
        {/if}
        {#if isOpen && !finished}
          <div class="add">
            <div class="pair">
              <Stepper label="Ripetizioni" step={1} min={1} bind:value={reps} />
              <Stepper label="Peso" unit="kg" step={2.5} decimals bind:value={kg} />
            </div>
            {#if error}<Alert message={error} />{/if}
            <Button look="primary" extra="log" disabled={working} onclick={() => void addSet(block)}>
              <Icon name="check" /> Segna la serie {block.sets.length + 1}
            </Button>
          </div>
        {/if}
      </PageCard>
    {/each}

    {#if !finished}
      <span class="more">
        <Button look="ghost" onclick={pickExercise}>
          <Icon name="plus" /> Aggiungi un esercizio
        </Button>
      </span>
    {/if}

    <PageCard>
      <label class="field">
        <span class="eyebrow">Note <SaveStatus saver={noteSaver} /></span>
        <TextField kind="multiline" bind:value={notes} maxlength={1000} placeholder="Come è andata, cosa cambiare" onblur={() => void saveNotes()} />
      </label>
      {#if noteSaver.status === 'error'}<Alert message={noteSaver.error} />{/if}
    </PageCard>

    {#if error && active === null}<Alert message={error} />{/if}

    <div class="actions">
      <Button look="danger" disabled={working} onclick={(event: MouseEvent) => askRemove(event.currentTarget as HTMLElement)}>
        <Icon name="trash" /> Elimina
      </Button>
      {#if finished}
        <Button look="ghost" disabled={working} onclick={() => void setFinished(false)}>
          <Icon name="reopen" /> Riapri
        </Button>
      {:else}
        <Button look="primary" disabled={working} onclick={() => void setFinished(true)}>
          <Icon name="finish" /> Termina
        </Button>
      {/if}
    </div>
  {:else if error}
    <Alert message={error} />
  {/if}
</PageShell>


{#if rest.running}
  <RestBar timer={rest} />
{/if}


<style>
  .last-note { margin: -4px 0 0; font-size: 12.5px; font-style: italic; color: var(--ink-2); overflow-wrap: anywhere; }

  .meta { margin: 0; font-size: 12.5px; color: var(--ink-3); }

  .head {
    display: flex;
    align-items: center;
    gap: 10px;
    width: calc(100% + 16px);
    min-height: 44px;
    margin: -8px;
    padding: 8px;
    border: 0;
    border-radius: var(--r-md);
    background: transparent;
    text-align: left;
    transition: background 0.15s;
  }

  .head:hover { background: var(--sunken); }

  .head :global(.ico) { color: var(--ink-3); }

  .name { flex: 1; min-width: 0; font-size: 15px; font-weight: 600; letter-spacing: -0.01em; overflow-wrap: anywhere; }

  .count {
    padding: 2px 8px;
    border-radius: 99px;
    background: var(--sunken);
    font-size: 12px;
    font-weight: 560;
    font-variant-numeric: tabular-nums;
    color: var(--ink-2);
  }

  /* fatte tutte quelle che la scheda chiede: il verde dell'app, quello di «va bene» */
  .count.done {
    background: color-mix(in srgb, var(--ok) 16%, transparent);
    color: color-mix(in srgb, var(--ok) 80%, var(--ink));
  }

  .line {
    display: grid;
    gap: 2px;
    margin: 0;
    font-size: 13px;
    color: var(--ink-2);
  }

  .sets {
    display: grid;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .set {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 40px;
    padding: 6px 8px;
    border: 0;
    border-radius: var(--r-sm);
    background: transparent;
    text-align: left;
    font-variant-numeric: tabular-nums;
    transition: background 0.15s;
  }

  .set:hover { background: var(--sunken); }

  .nr {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--sunken-hover);
    font-size: 11px;
    font-weight: 600;
    color: var(--ink-2);
  }

  .set .what { flex: 1; font-weight: 560; }

  .set :global(.ico) { width: 14px; height: 14px; color: var(--ink-3); }

  .add {
    display: grid;
    gap: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--hairline-soft);
  }

  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

  /* il tasto che si preme dopo ogni serie: largo e alto quanto un pollice */
  .add :global(.btn.log) { padding: 13px 18px; font-size: 14.5px; }

  .more { display: block; margin: 0 0 14px; }

  .actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 10px;
  }

  .actions :global(.btn.primary), .actions :global(.btn.ghost) { padding: 12px 20px; }
</style>

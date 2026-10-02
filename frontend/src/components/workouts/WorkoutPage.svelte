<script lang="ts">
  import { untrack } from 'svelte';
  import { workoutsApi } from '../../lib/endpoints';
  import { formatClock, formatDay, formatDuration, formatKg, formatRest } from '../../lib/format';
  import { nav } from '../../lib/nav.svelte';
  import { HOME_PATH } from '../../lib/routing';
  import { current } from '../../lib/current.svelte';
  import { rest } from '../../lib/rest.svelte';
  import { toast } from '../../lib/toast.svelte';
  import { ui } from '../../lib/ui.svelte';
  import type { Exercise, WorkoutDetail, WorkoutSet } from '../../lib/types';
  import { trendOf } from '../../lib/trend';
  import { warmupFor } from '../../lib/warmup';
  import { blocksOf, describeTarget, prefill, readSet, type Block } from '../../lib/workout';
  import Alert from '../Alert.svelte';
  import Button from '../Button.svelte';
  import Tabs from '../Tabs.svelte';
  import Trend from '../Trend.svelte';
  import Icon from '../Icon.svelte';
  import PageCard from '../PageCard.svelte';
  import PageShell from '../PageShell.svelte';
  import SaveStatus from '../SaveStatus.svelte';
  import Loader from '../Loader.svelte';
  import Stepper from '../Stepper.svelte';
  import TextField from '../TextField.svelte';
  import ExercisePicker from '../exercises/ExercisePicker.svelte';
  import NoteField from './NoteField.svelte';
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

  /*
   * Il riscaldamento: una linguetta sua nell'esercizio aperto, prima delle
   * serie finché non se n'è fatta nessuna. È solo un consiglio, calcolato dal
   * peso scritto per la prima serie: non si segna e non si salva.
   */
  type Tab = 'warmup' | 'sets';
  const TABS: { id: Tab; label: string }[] = [{ id: 'warmup', label: 'Riscaldamento' }, { id: 'sets', label: 'Serie' }];
  let tab = $state<Tab>('sets');
  const workingKg = (): number | null => Number(kg.replace(',', '.')) || null;

  let working = $state(false);

  /* Il recupero che chiede la scheda, dopo ogni serie. A zero il telefono
     vibra, se sa farlo: in tasca o sulla panca non lo si guarda. */
  /* Il recupero è uno per tutta l'app (lib/rest): uscendo da qui continua,
     e la barra «In corso» lo conta dalle altre pagine. */

  const blocks = $derived(detail ? blocksOf(detail, added) : []);
  const finished = $derived(detail?.finishedAt != null);
  const title = $derived(detail ? (detail.dayName ? `${detail.planName} · ${detail.dayName}` : 'Allenamento libero') : 'Allenamento');

  /* La barra «In corso» sa da qui quello che succede, subito: una serie
     segnata, l'allenamento terminato o riaperto. Uno già terminato, aperto
     dallo storico, non tocca quello in corso. */
  $effect(() => {
    if (!detail) return;
    const open = detail.finishedAt === null ? { id, title, startedAt: detail.startedAt, sets: detail.sets.length } : null;
    untrack(() => {
      if (open || current.workout?.id === id) current.set(open);
    });
  });

  $effect(() => {
    workoutsApi.get(id).then(
      (loaded) => {
        detail = loaded;
        // si apre il primo esercizio con delle serie ancora da fare
        const all = blocksOf(loaded);
        const next = all.find((block) => block.sets.length < (block.target?.reps.length ?? 1)) ?? all[0];
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
    tab = block.sets.length === 0 && warmupFor(proposed.weightKg ?? 0).length > 0 ? 'warmup' : 'sets';
    error = '';
  }

  /* segnata una serie, il tasto resta spento un momento anche dopo la risposta: il secondo tocco
     di un doppio tocco cade su un tasto spento, e due serie in mezzo secondo non si fanno */
  let cooling = $state(false);

  async function addSet(block: Block): Promise<void> {
    const typed = readSet(reps, kg);
    if ('error' in typed) {
      error = typed.error;
      return;
    }
    working = true;
    cooling = true;
    setTimeout(() => (cooling = false), 600);
    error = '';
    try {
      const done = await workoutsApi.addSet(id, { exerciseId: block.exerciseId, ...typed });
      detail?.sets.push(done);
      added = added.filter((one) => one.id !== block.exerciseId);
      // la prossima serie si propone da capo: quello che chiede la scheda per lei
      const now = blocksOf(detail!, added).find((one) => one.exerciseId === block.exerciseId);
      if (now) reps = String(prefill(now).reps ?? reps);
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

  async function setFinished(value: boolean): Promise<void> {
    working = true;
    try {
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
      rest.stop();
      if (current.workout?.id === id) current.set(null);
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
  {#snippet tools()}
    {#if detail}
      <Button
        look="icon"
        tone="danger"
        title="Elimina l’allenamento"
        aria-label="Elimina l’allenamento"
        disabled={working}
        onclick={(event: MouseEvent) => askRemove(event.currentTarget as HTMLElement)}
      >
        <Icon name="trash" />
      </Button>
    {/if}
  {/snippet}
  {#snippet meta()}
    {#if detail}
      <p class="meta">
        {formatDay(detail.startedAt)} alle {formatClock(detail.startedAt)}
        {#if detail.finishedAt}· {formatDuration(detail.startedAt, detail.finishedAt)}{:else}· in corso{/if}
      </p>
    {/if}
  {/snippet}

  {#if !detail && !error}
    <Loader />
  {:else if detail}
    {#each blocks as block (block.exerciseId)}
      {@const isOpen = active === block.exerciseId}
      <PageCard>
        <button type="button" class="head" aria-expanded={isOpen} onclick={() => (isOpen ? (active = null) : open(block))}>
          <span class="name">{block.name}</span>
          <span class="count" class:done={block.target !== null && block.sets.length >= block.target.reps.length}>
            {block.target ? `${block.sets.length}/${block.target.reps.length}` : block.sets.length === 1 ? '1 serie' : `${block.sets.length} serie`}
          </span>
          <Icon name={isOpen ? 'collapse' : 'expand'} />
        </button>

        {#if isOpen && !finished}
          <Tabs value={tab} options={TABS} label="Riscaldamento o serie di {block.name}" onpick={(picked) => (tab = picked)} />
        {/if}
        {#if isOpen && !finished && tab === 'warmup'}
          {@const ramp = warmupFor(workingKg() ?? 0)}
          {#if ramp.length === 0}
            <p class="hint">Scrivi il peso della prima serie: il riscaldamento si calcola da lì.</p>
          {:else}
            <ol class="sets warmup" aria-label="Riscaldamento verso {formatKg(workingKg()!)}">
              {#each ramp as step, index (index)}
                <li class="set"><span class="nr">{index + 1}</span> <span class="what">{step.reps} × {formatKg(step.weightKg)}</span></li>
              {/each}
            </ol>
            <p class="hint">Un consiglio, a salire verso i {formatKg(workingKg()!)} della prima serie.</p>
          {/if}
        {:else}
          {#if isOpen || block.sets.length > 0}
            {#if block.target}
              <p class="line">
                <span class="eyebrow">Scheda</span>
                {describeTarget(block.target)}
              </p>
            {/if}
            {#if block.previous}
              <!-- una serie per pezzo, mai spezzata a metà fra due righe -->
              <div class="line">
                <span class="eyebrow" id="past-{block.exerciseId}">L’ultima volta · {formatDay(block.previous.startedAt)}</span>
                <ol class="past" aria-labelledby="past-{block.exerciseId}">
                  {#each block.previous.sets as set, index (index)}
                    <li><span class="nr">{index + 1}</span> {set.reps} × {formatKg(set.weightKg)} <Trend trend={trendOf(set, block.previous.before[index])} against="before" /></li>
                  {/each}
                </ol>
              </div>
            {/if}

            {#if block.sets.length > 0}
              <ol class="sets">
                {#each block.sets as done, index (done.id)}
                  <li>
                    <button type="button" class="set" onclick={() => editSet(done, index + 1)}>
                      <span class="nr">{index + 1}</span>
                      <span class="what">{done.reps} × {formatKg(done.weightKg)}</span>
                      <Trend trend={trendOf(done, block.previous?.sets[index])} />
                      <Icon name="edit" />
                    </button>
                  </li>
                {/each}
              </ol>
            {/if}
          {/if}

          {#if isOpen || block.sets.length > 0 || detail.exerciseNotes[block.exerciseId]}
            <div class="note">
              <NoteField
                label="Nota"
                fieldLabel="Nota"
                placeholder="Come è andato, cosa cambiare la prossima volta"
                note={detail.exerciseNotes[block.exerciseId] ?? ''}
                previous={block.previous?.note ? { note: block.previous.note } : null}
                save={(text) => workoutsApi.saveNote(id, block.exerciseId, text)}
              />
            </div>
          {/if}
          {#if isOpen && !finished}
            <div class="add">
              <div class="steppers">
                <Stepper label="Ripetizioni" step={1} min={1} bind:value={reps} />
                <Stepper label="Peso" unit="kg" step={2.5} decimals bind:value={kg} />
              </div>
              {#if error}<Alert message={error} />{/if}
              <Button look="primary" extra="log" disabled={working || cooling} onclick={() => void addSet(block)}>
                <Icon name="check" /> Segna la serie {block.sets.length + 1}
              </Button>
            </div>
          {/if}
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
      <NoteField
        label="Note"
        placeholder="Come è andata, cosa cambiare"
        note={detail.notes ?? ''}
        previous={detail.previousNote}
        save={(text) => workoutsApi.update(id, { notes: text })}
      />
    </PageCard>

    {#if error && active === null}<Alert message={error} />{/if}

    <div class="actions">
      {#if finished}
        <Button look="ghost" disabled={working} onclick={() => void setFinished(false)}>
          <Icon name="reopen" /> Riapri
        </Button>
      {:else}
        <Button look="ghost" disabled={working} onclick={() => void setFinished(true)}>
          <Icon name="finish" /> Termina
        </Button>
      {/if}
    </div>
  {:else if error}
    <Alert message={error} />
  {/if}
</PageShell>


<!-- il recupero sta nella barra «In corso», la stessa di ogni pagina (NowBar, in App) -->


<style>

  .meta { margin: 0; font-size: 12.5px; color: var(--ink-3); }

  .head:active { background: var(--sunken); }

  /* la luce della pressione esce di 10px dal testo, che resta allineato alla card */
  .head {
    display: flex;
    align-items: center;
    gap: 10px;
    width: calc(100% + 20px);
    min-height: 44px;
    margin: 0 -10px;
    padding: 0 10px;
    border: 0;
    border-radius: var(--r-md);
    background: transparent;
    text-align: left;
    transition: background 0.15s;
  }

  @media (hover: hover) {
  .head:hover { background: var(--sunken); }
}

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

  /* le serie dell'ultima volta: un pezzo ciascuna, che va a capo intero */
  .hint { margin: 0; font-size: 12.5px; color: var(--ink-3); }

  /* il riscaldamento si legge e basta: le righe delle serie, ma più leggere */
  .warmup .set { cursor: default; background: transparent; }
  .warmup .what { font-weight: 500; color: var(--ink-2); }

  .past {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 4px 0 0;
    padding: 0;
    list-style: none;
  }

  .past li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px 3px 3px;
    border-radius: 999px;
    background: var(--sunken);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: var(--ink);
  }

  .past .nr { width: 20px; height: 20px; }

  /* la freccia chiude il pezzo, più piccola del numero che lo apre */
  .past li :global(.trend) { width: 18px; height: 18px; margin-right: -6px; }
  .past li :global(.trend .ico) { width: 12px; height: 12px; }

  .sets {
    display: grid;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* dentro la card di un esercizio ogni parte — le serie fatte, la nota, la
     prossima serie — è separata dal tratto, come le righe di un elenco */
  .sets, .note { padding-top: 8px; border-top: 1px solid var(--hairline-soft); }

  .note { display: grid; gap: 8px; }

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

  @media (hover: hover) {
  .set:hover { background: var(--sunken); }
}

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

  .steppers { display: grid; gap: 10px; }

  /* il tasto che si preme dopo ogni serie: largo e alto quanto un pollice */
  .add :global(.btn.log) { padding: 13px 18px; font-size: 14.5px; }

  .more { display: block; margin: 0; }

  .actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 10px;
  }

  .actions :global(.btn.primary), .actions :global(.btn.ghost) { padding: 12px 20px; }
</style>

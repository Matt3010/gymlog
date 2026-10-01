<script lang="ts">
  import { exercisesApi, statsApi } from '../../lib/endpoints';
  import { formatDay, formatKg } from '../../lib/format';
  import { exercisePath } from '../../lib/routing';
  import type { Exercise, ExerciseOverview } from '../../lib/types';
  import { perNome, Vista } from '../../lib/vista.svelte';
  import AddRow from '../AddRow.svelte';
  import Alert from '../Alert.svelte';
  import Button from '../Button.svelte';
  import EmptyState from '../EmptyState.svelte';
  import Icon from '../Icon.svelte';
  import PageCard from '../PageCard.svelte';
  import PageShell from '../PageShell.svelte';
  import PanelSkeleton from '../PanelSkeleton.svelte';
  import Row from '../Row.svelte';
  import TextField from '../TextField.svelte';
  import { toast } from '../../lib/toast.svelte';
  import { ui } from '../../lib/ui.svelte';
  import ExerciseForm from './ExerciseForm.svelte';

  /**
   * I tuoi esercizi, e come va ognuno: sotto il nome la media, il massimo e
   * l'ultima volta, per quelli fatti almeno una volta. La riga apre le sue
   * statistiche, perché è da qui che si cerca «come va la panca»; la matita
   * a destra lo corregge.
   */
  let exercises = $state<Exercise[] | null>(null);
  let numbers = $state(new Map<number, ExerciseOverview>());
  let error = $state('');

  $effect(() => {
    exercisesApi.list().then((list) => (exercises = list), (failure: Error) => (error = failure.message));
    // i numeri sono un di più: se non arrivano, l'elenco resta lo stesso
    statsApi.exercises().then(
      (rows) => (numbers = new Map(rows.map((row) => [row.exerciseId, row]))),
      () => undefined,
    );
  });

  const howItGoes = (row: ExerciseOverview): string =>
    `media ${formatKg(row.avgWeight)} · max ${formatKg(row.maxWeight)} · ${row.sessions === 1 ? '1 sessione' : `${row.sessions} sessioni`} · l’ultima ${formatDay(row.lastAt).toLowerCase()}`;

  /*
   * Si cerca per nome o per gruppo, con la vista di restaurant-index; l'ordine
   * è uno solo, per nome, e uno nuovo va al suo posto. Niente comando per
   * cambiarlo: in un elenco così corto non serviva.
   */
  const vista = new Vista<Exercise>({
    chiave: 'esercizi',
    criteri: [{ id: 'nome', label: 'Nome', per: perNome }],
    testoDi: (exercise) => [exercise.name, exercise.muscleGroup ?? ''],
  });
  const shown = $derived(vista.applica(exercises ?? []));

  let nuovo = $state('');
  let addError = $state('');

  /** Uno nuovo dal suo nome, dalla riga in fondo: il resto si scrive dopo, se serve. */
  async function quickAdd(name: string): Promise<void> {
    addError = '';
    try {
      saved(await exercisesApi.create({ name, muscleGroup: null, notes: null }));
      toast.show('Esercizio aggiunto.');
      nuovo = '';
    } catch (failure) {
      addError = (failure as Error).message;
    }
  }

  function saved(exercise: Exercise): void {
    exercises = [...(exercises ?? []).filter((one) => one.id !== exercise.id), exercise];
  }

  function deleted(id: number): void {
    exercises = (exercises ?? []).filter((one) => one.id !== id);
  }

  /** Un esercizio da correggere, in una finestra. Uno nuovo si aggiunge dalla riga in fondo, e basta il nome. */
  function open(exercise: Exercise): void {
    ui.openModal({ title: 'Esercizio', view: ExerciseForm, props: { exercise, onsaved: saved, ondeleted: deleted } });
  }
</script>

<PageShell title="Esercizi" count={exercises?.length}>
  {#if error}<Alert message={error} />{/if}

  {#if exercises === null}
    {#if !error}<PageCard><PanelSkeleton /></PageCard>{/if}
  {:else}
    <PageCard>
      {#if exercises.length === 0}
        <EmptyState title="Nessun esercizio, per ora." line="Scrivi qui sotto quelli che fai, poi li metti nelle schede e ne segui i pesi." />
      {:else}
        <div class="find">
          <TextField kind="search" bind:value={vista.cerca} placeholder="Cerca per nome o gruppo" label="Cerca un esercizio" />
        </div>
        <ul class="rows">
          {#each shown as exercise (exercise.id)}
            {@const row = numbers.get(exercise.id)}
            <li>
              <Row flat>
                <a class="open" href={exercisePath(exercise.id)}>
                  <span class="name">{exercise.name}</span>
                  {#if exercise.muscleGroup}<span class="group">{exercise.muscleGroup}</span>{/if}
                  {#if row}<span class="numbers">{howItGoes(row)}</span>{/if}
                </a>
                {#snippet trail()}
                  <Button look="icon" title="Modifica {exercise.name}" aria-label="Modifica {exercise.name}" onclick={() => open(exercise)}>
                    <Icon name="edit" />
                  </Button>
                {/snippet}
              </Row>
            </li>
          {:else}
            <li class="none">Nessun esercizio risponde a «{vista.cerca.trim()}».</li>
          {/each}
        </ul>
      {/if}
      <AddRow flat label="Crea" placeholder="Nuovo esercizio" title="Crea l’esercizio" bind:value={nuovo} onadd={quickAdd} />
      {#if addError}<Alert message={addError} />{/if}
    </PageCard>
  {/if}
</PageShell>


<style>
  .find { display: flex; align-items: center; gap: 8px; }

  .find :global(.text-field) { flex: 1; min-width: 0; }

  .rows {
    display: grid;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* il nome tocca tutta la riga che avanza: si apre per correggerlo */
  .open {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 1px;
    min-height: 40px;
    padding: 4px 6px;
    border: 0;
    border-radius: var(--r-sm);
    background: transparent;
    text-align: left;
    color: inherit;
    text-decoration: none;
  }

  .name { font-weight: 560; }

  .group { font-size: 12px; color: var(--ink-3); }

  .numbers { font-size: 12px; color: var(--ink-2); font-variant-numeric: tabular-nums; }

  .none { padding: 10px 6px; font-size: 12.5px; color: var(--ink-3); }
</style>

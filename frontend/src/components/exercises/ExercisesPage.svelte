<script lang="ts">
  import { exercisesApi } from '../../lib/endpoints';
  import { exerciseStatsPath } from '../../lib/routing';
  import type { Exercise } from '../../lib/types';
  import { perNome, perTesto, Vista } from '../../lib/vista.svelte';
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
  import ViewControls from '../ViewControls.svelte';
  import { toast } from '../../lib/toast.svelte';
  import { ui } from '../../lib/ui.svelte';
  import ExerciseForm from './ExerciseForm.svelte';

  /**
   * I tuoi esercizi. Si toccano per correggerli; le statistiche di ognuno
   * stanno a destra della sua riga, perché è da qui che si cerca «come va la
   * panca».
   */
  let exercises = $state<Exercise[] | null>(null);
  let error = $state('');

  $effect(() => {
    exercisesApi.list().then((list) => (exercises = list), (failure: Error) => (error = failure.message));
  });

  /*
   * Si cerca per nome o per gruppo, e si mette in fila per l'uno o per
   * l'altro: la vista è quella di restaurant-index, e si ricorda come
   * l'hai lasciata. Senza gruppo si va in fondo, quando si ordina per gruppo.
   */
  const vista = new Vista<Exercise>({
    chiave: 'esercizi',
    criteri: [
      { id: 'nome', label: 'Nome', per: perNome },
      {
        id: 'gruppo',
        label: 'Gruppo muscolare',
        per: (a, b) => perTesto(a.muscleGroup ?? '', b.muscleGroup ?? '') || perNome(a, b),
        inFondo: (exercise) => !exercise.muscleGroup,
      },
    ],
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
          <ViewControls {vista} />
        </div>
        <ul class="rows">
          {#each shown as exercise (exercise.id)}
            <li>
              <Row>
                <button type="button" class="open" onclick={() => open(exercise)}>
                  <span class="name">{exercise.name}</span>
                  {#if exercise.muscleGroup}<span class="group">{exercise.muscleGroup}</span>{/if}
                </button>
                {#snippet trail()}
                  <Button look="icon" href={exerciseStatsPath(exercise.id)} title="Statistiche" aria-label="Statistiche dell’esercizio {exercise.name}">
                    <Icon name="stats" />
                  </Button>
                {/snippet}
              </Row>
            </li>
          {:else}
            <li class="none">Nessun esercizio risponde a «{vista.cerca.trim()}».</li>
          {/each}
        </ul>
      {/if}
      <AddRow placeholder="Un esercizio nuovo, per nome" title="Aggiungi" bind:value={nuovo} onadd={quickAdd} />
      {#if addError}<Alert message={addError} />{/if}
    </PageCard>
  {/if}
</PageShell>


<style>
  .find { display: flex; align-items: center; gap: 8px; }

  .find :global(.text-field) { flex: 1; min-width: 0; }

  .rows {
    display: grid;
    gap: 6px;
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
  }

  .name { font-weight: 560; }

  .group { font-size: 12px; color: var(--ink-3); }

  .none { padding: 10px 6px; font-size: 12.5px; color: var(--ink-3); }
</style>

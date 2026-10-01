<script lang="ts">
  import { onMount } from 'svelte';
  import { workoutsApi } from '../../lib/endpoints';
  import type { WorkoutSummary } from '../../lib/types';
  import Alert from '../Alert.svelte';
  import Button from '../Button.svelte';
  import EmptyState from '../EmptyState.svelte';
  import PageCard from '../PageCard.svelte';
  import PageShell from '../PageShell.svelte';
  import Loader from '../Loader.svelte';
  import WorkoutRow from './WorkoutRow.svelte';

  /** Tutti gli allenamenti, dal più recente, venti alla volta. */
  const PAGE = 20;

  let workouts = $state<WorkoutSummary[] | null>(null);
  /** Se l'ultima pagina era piena, ce n'è forse un'altra. */
  let more = $state(false);
  let loading = $state(false);
  let error = $state('');

  async function load(): Promise<void> {
    loading = true;
    error = '';
    try {
      const page = await workoutsApi.list(PAGE, workouts?.length ?? 0);
      workouts = [...(workouts ?? []), ...page];
      more = page.length === PAGE;
    } catch (failure) {
      error = (failure as Error).message;
    } finally {
      loading = false;
    }
  }

  // All'apertura, una volta. Non in un $effect: load legge quanti ne ha già
  // per sapere da dove ripartire, e l'effetto ripartiva a ogni pagina
  // arrivata, chiedendo tutto lo storico da solo e poi l'ultima all'infinito.
  onMount(() => void load());
</script>

<PageShell title="Storico">
  {#if workouts === null}
    {#if !error}<Loader />{/if}
  {:else}
    <PageCard>
      {#if workouts.length === 0}
        <EmptyState title="Nessun allenamento, per ora." line="Quelli che fai compaiono qui, dal più recente." />
      {:else}
        <ul class="rows">
          {#each workouts as workout (workout.id)}<WorkoutRow {workout} />{/each}
        </ul>
      {/if}
    </PageCard>
    {#if more}
      <Button look="ghost" disabled={loading} onclick={() => void load()}>{loading ? 'Un attimo…' : 'Carica altri'}</Button>
    {/if}
  {/if}

  {#if error}<Alert message={error} />{/if}
</PageShell>

<style>
  .rows { display: grid; margin: 0; padding: 0; list-style: none; }
</style>

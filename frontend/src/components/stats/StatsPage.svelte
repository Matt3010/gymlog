<script lang="ts">
  import Row from '../Row.svelte';
  import { statsApi } from '../../lib/endpoints';
  import { formatDay, formatKg } from '../../lib/format';
  import { exerciseStatsPath } from '../../lib/routing';
  import type { Overview } from '../../lib/types';
  import Alert from '../Alert.svelte';
  import EmptyState from '../EmptyState.svelte';
  import Icon from '../Icon.svelte';
  import PageCard from '../PageCard.svelte';
  import PageShell from '../PageShell.svelte';
  import PanelSkeleton from '../PanelSkeleton.svelte';

  /**
   * Il riassunto: quanti allenamenti, quanti nell'ultimo mese e quanto peso
   * spostato; sotto, ogni esercizio con la sua media e il suo massimo, dal
   * più recente. Una riga apre le statistiche di quell'esercizio.
   */
  let overview = $state<Overview | null>(null);
  let error = $state('');

  $effect(() => {
    statsApi.overview().then((result) => (overview = result), (failure: Error) => (error = failure.message));
  });
</script>

<PageShell title="Statistiche">
  {#if error}<Alert message={error} />{/if}

  {#if !overview}
    {#if !error}<PageCard><PanelSkeleton /></PageCard>{/if}
  {:else}
    <PageCard>
      <dl class="tiles">
        <div><dt class="eyebrow">Allenamenti</dt><dd>{overview.workouts}</dd></div>
        <div><dt class="eyebrow">Ultimi 30 giorni</dt><dd>{overview.workoutsLast30Days}</dd></div>
        <div><dt class="eyebrow">Volume 30 giorni</dt><dd>{formatKg(overview.volumeLast30Days)}</dd></div>
      </dl>
    </PageCard>

    <PageCard>
      <span class="eyebrow">Esercizi</span>
      {#if overview.exercises.length === 0}
        <EmptyState title="Nessuna serie, per ora." line="Gli esercizi compaiono qui dopo la prima serie segnata." />
      {:else}
        <ul class="rows">
          {#each overview.exercises as exercise (exercise.exerciseId)}
            <li>
              <Row>
                <a class="go" href={exerciseStatsPath(exercise.exerciseId)}>
                  <span class="name">{exercise.name}</span>
                  <span class="numbers">
                    media {formatKg(exercise.avgWeight)} · max {formatKg(exercise.maxWeight)}
                  </span>
                  <span class="when">
                    {exercise.sessions === 1 ? '1 sessione' : `${exercise.sessions} sessioni`} · l’ultima {formatDay(exercise.lastAt).toLowerCase()}
                  </span>
                  <Icon name="next" />
                </a>
              </Row>
            </li>
          {/each}
        </ul>
      {/if}
    </PageCard>
  {/if}
</PageShell>

<style>
  .tiles {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin: 0;
  }

  .tiles div { display: grid; gap: 3px; min-width: 0; }

  dd {
    margin: 0;
    font-size: 19px;
    font-weight: 620;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }

  .rows { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }

  /* il collegamento prende tutta la riga che gli dà Row */
  .go {
    flex: 1;
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas: "name go" "numbers go" "when go";
    align-items: center;
    gap: 1px 10px;
    min-height: 56px;
    padding: 4px 4px;
    border-radius: var(--r-sm);
    color: inherit;
    text-decoration: none;
  }

  .name { grid-area: name; font-weight: 560; overflow-wrap: anywhere; }

  .numbers { grid-area: numbers; font-size: 12.5px; color: var(--ink-2); font-variant-numeric: tabular-nums; }

  .when { grid-area: when; font-size: 12px; color: var(--ink-3); }

  .go :global(.ico) { grid-area: go; width: 16px; height: 16px; color: var(--ink-3); }
</style>

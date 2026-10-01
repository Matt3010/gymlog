<script lang="ts">
  import Row from '../Row.svelte';
  import { formatDay, formatKg } from '../../lib/format';
  import { workoutPath } from '../../lib/routing';
  import type { WorkoutSummary } from '../../lib/types';

  /** Un allenamento in un elenco: quando, cosa, quanto. Lo stesso in home e nello storico. */
  let { workout }: { workout: WorkoutSummary } = $props();

  const what = $derived(workout.dayName ? `${workout.planName} · ${workout.dayName}` : 'Allenamento libero');
</script>

<li>
  <Row>
    <a class="go" href={workoutPath(workout.id)}>
      <span class="day">{formatDay(workout.startedAt)}</span>
      <span class="what">{what}{workout.finishedAt === null ? ' · in corso' : ''}</span>
      <span class="numbers">
        {workout.sets === 1 ? '1 serie' : `${workout.sets} serie`} · {formatKg(workout.volume)}
      </span>
    </a>
  </Row>
</li>

<style>
  /* il collegamento prende tutta la riga che gli dà Row */
  .go {
    flex: 1;
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas: "what day" "numbers numbers";
    gap: 2px 10px;
    min-height: 52px;
    padding: 4px 4px;
    border-radius: var(--r-sm);
    color: inherit;
    text-decoration: none;
  }

  .what { grid-area: what; font-weight: 560; overflow-wrap: anywhere; }

  .day { grid-area: day; font-size: 12px; color: var(--ink-3); white-space: nowrap; }

  .numbers { grid-area: numbers; font-size: 12px; color: var(--ink-3); font-variant-numeric: tabular-nums; }
</style>

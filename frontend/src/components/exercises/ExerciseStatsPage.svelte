<script lang="ts">
  import { statsApi } from '../../lib/endpoints';
  import { formatDay, formatKg, formatNumber } from '../../lib/format';
  import { EXERCISES_PATH, workoutPath } from '../../lib/routing';
  import type { ExerciseStats } from '../../lib/types';
  import Alert from '../Alert.svelte';
  import EmptyState from '../EmptyState.svelte';
  import PageCard from '../PageCard.svelte';
  import PageShell from '../PageShell.svelte';
  import Loader from '../Loader.svelte';
  import Table from '../Table.svelte';
  import Trend from '../Trend.svelte';
  import { trendOf } from '../../lib/trend';
  import LineChart from './LineChart.svelte';
  import type { Column } from '../../lib/table';

  /**
   * Come va un esercizio: i numeri di sempre in cima, e sotto ogni sessione,
   * dalla più recente. La media è quella dei chili delle serie; il massimale
   * è stimato dalla serie migliore (formula di Epley).
   */
  let { id }: { id: number } = $props();

  /* le colonne della tabella delle sessioni: i numeri a destra, si leggono in colonna */
  const COLUMNS: Column[] = [
    { label: 'Data' },
    { label: 'Serie', align: 'end', width: 'fit' },
    { label: 'Rip.', align: 'end', width: 'fit' },
    { label: 'Volume', align: 'end', width: 'fit' },
    { label: 'Media', align: 'end', width: 'fit' },
    { label: 'Max', align: 'end', width: 'fit' },
    { label: '1RM', align: 'end', width: 'fit' },
    // la freccia ha una colonna sua: così «1RM» sta sopra ai suoi numeri, con la freccia o senza
    { label: '', width: 'fit' },
  ];

  let stats = $state<ExerciseStats | null>(null);
  let error = $state('');

  $effect(() => {
    statsApi.exercise(id).then((result) => (stats = result), (failure: Error) => (error = failure.message));
  });

  const bodyweight = $derived(stats !== null && stats.sessions.every((session) => session.maxWeight === 0));

  /** Il ritorno in cima alla pagina: un oggetto qui e non nel markup, che Stryker non sa leggere. */
  const back = { href: EXERCISES_PATH, label: 'Esercizi' };
</script>

<PageShell title={stats?.exercise.name ?? 'Statistiche'} {back}>
  {#if error}<Alert message={error} />{/if}

  {#if !stats}
    {#if !error}<Loader />{/if}
  {:else}
    {#if stats.overall.sessions === 0}
      <PageCard>
        <EmptyState title="Nessuna serie, per ora." line="Le statistiche compaiono dopo il primo allenamento con questo esercizio." />
      </PageCard>
    {:else}
      <PageCard>
        <dl class="tiles">
          <div><dt class="eyebrow">Massimo</dt><dd>{formatKg(stats.overall.maxWeight)}</dd></div>
          <div><dt class="eyebrow">Media</dt><dd>{formatKg(stats.overall.avgWeight)}</dd></div>
          <div><dt class="eyebrow">1RM stimato</dt><dd>{formatKg(stats.overall.bestE1rm)}</dd></div>
          <div><dt class="eyebrow">Sessioni</dt><dd>{stats.overall.sessions}</dd></div>
          <div><dt class="eyebrow">Serie</dt><dd>{stats.overall.sets}</dd></div>
          <div><dt class="eyebrow">Volume</dt><dd>{formatKg(stats.overall.volume)}</dd></div>
        </dl>
      </PageCard>

      {#if stats.sessions.length > 1}
        <PageCard>
          <span class="eyebrow">Andamento</span>
          <!-- le sessioni arrivano dalla più recente: il grafico le vuole in ordine di tempo -->
          <LineChart name={stats.exercise.name} sessions={[...stats.sessions].reverse()} />
        </PageCard>
      {/if}

      <PageCard>
        <span class="eyebrow">Sessione per sessione</span>
        <!-- senza peso (trazioni) il massimale è sempre zero: la freccia guarda le ripetizioni -->
        {@const measure = (one: { reps: number; bestE1rm: number }) => (bodyweight ? one.reps : one.bestE1rm)}
        <Table inRiga columns={COLUMNS} rows={stats.sessions.map((session, index) => {
          const before = stats!.sessions[index + 1];
          return { ...session, id: String(session.workoutId), now: measure(session), before: before && measure(before) };
        })} label="Le sessioni di {stats.exercise.name}">
          {#snippet row(session)}
            <td><a href={workoutPath(session.workoutId)}>{formatDay(session.startedAt)}</a></td>
            <!-- i numeri a destra, come le loro intestazioni: uno più corto finisce lo stesso sotto di lei -->
            <td class="end">{session.sets}</td>
            <td class="end">{session.reps}</td>
            <td class="end">{formatNumber(session.volume)}</td>
            <td class="end">{formatNumber(session.avgWeight)}</td>
            <td class="end">{formatNumber(session.maxWeight)}</td>
            <td class="end">{formatNumber(session.bestE1rm)}</td>
            <!-- la freccia dice se il massimale stimato è salito dalla sessione prima -->
            <td class="trend-cell"><Trend trend={trendOf(session.now, session.before)} against="before" /></td>
          {/snippet}
        </Table>
        <p class="unit">Pesi e volume in kg.</p>
      </PageCard>
    {/if}
  {/if}
</PageShell>

<style>
  .tiles {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px 10px;
    margin: 0;
  }

  .tiles div { display: grid; gap: 3px; min-width: 0; }

  dd {
    margin: 0;
    font-size: 17px;
    font-weight: 620;
    letter-spacing: -0.015em;
    font-variant-numeric: tabular-nums;
  }

  td a { color: var(--ink); text-decoration: none; font-weight: 540; }

  @media (hover: hover) {
  td a:hover { text-decoration: underline; }
}

  .trend-cell :global(.trend) { width: 18px; height: 18px; vertical-align: middle; }
  .trend-cell :global(.trend .ico) { width: 12px; height: 12px; }

  .unit { margin: 0; font-size: 11.5px; color: var(--ink-3); }
</style>

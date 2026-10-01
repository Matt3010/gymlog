<script lang="ts">
  import { session } from '../../lib/client';
  import { plansApi, workoutsApi } from '../../lib/endpoints';
  import { formatClock, formatDay } from '../../lib/format';
  import { nav } from '../../lib/nav.svelte';
  import { HISTORY_PATH, planPath, workoutPath } from '../../lib/routing';
  import type { Plan, WorkoutSummary } from '../../lib/types';
  import { inProgress } from '../../lib/workout';
  import Alert from '../Alert.svelte';
  import Button from '../Button.svelte';
  import EmptyState from '../EmptyState.svelte';
  import Icon from '../Icon.svelte';
  import InstallHint from '../InstallHint.svelte';
  import PageCard from '../PageCard.svelte';
  import PageShell from '../PageShell.svelte';
  import PanelSkeleton from '../PanelSkeleton.svelte';
  import WorkoutRow from '../workouts/WorkoutRow.svelte';

  /**
   * Dove si comincia, in palestra: l'allenamento lasciato aperto da
   * riprendere, i giorni delle schede da cui partire, e gli ultimi fatti.
   */
  let plans = $state<Plan[] | null>(null);
  let recent = $state<WorkoutSummary[] | null>(null);
  let error = $state('');
  let starting = $state(false);

  $effect(() => {
    Promise.all([plansApi.list(), workoutsApi.list(6)]).then(
      ([allPlans, workouts]) => {
        plans = allPlans.filter((plan) => !plan.archived);
        recent = workouts;
      },
      (failure: Error) => (error = failure.message),
    );
  });

  const open = $derived(recent ? inProgress(recent) : undefined);
  const done = $derived((recent ?? []).filter((workout) => workout !== open).slice(0, 5));

  async function start(planDayId: number | null): Promise<void> {
    starting = true;
    error = '';
    try {
      const workout = await workoutsApi.start(planDayId);
      nav.go(workoutPath(workout.id));
    } catch (failure) {
      error = (failure as Error).message;
      starting = false;
    }
  }
</script>

<PageShell title="Allenati">
  {#snippet tools()}
    <Button look="icon" title="Esci ({session.user?.username})" onclick={() => void session.logout()}>
      <Icon name="logout" />
    </Button>
  {/snippet}

  <!-- in palestra l'app si apre dalla schermata Home: lo si propone qui, e «non ora» non lo ripete -->
  <InstallHint chiudibile />

  {#if error}<Alert message={error} />{/if}

  {#if plans === null || recent === null}
    {#if !error}<PageCard><PanelSkeleton /></PageCard>{/if}
  {:else}
    {#if open}
      <PageCard>
        <span class="eyebrow">In corso</span>
        <div class="open">
          <div class="what">
            <span class="title">{open.dayName ? `${open.planName} · ${open.dayName}` : 'Allenamento libero'}</span>
            <span class="when">Iniziato {formatDay(open.startedAt).toLowerCase()} alle {formatClock(open.startedAt)} · {open.sets === 1 ? '1 serie' : `${open.sets} serie`}</span>
          </div>
          <Button look="primary" href={workoutPath(open.id)}>
            <Icon name="play" /> Riprendi
          </Button>
        </div>
      </PageCard>
    {/if}

    <PageCard>
      <span class="eyebrow">Inizia un allenamento</span>
      {#if plans.length === 0}
        <EmptyState title="Nessuna scheda, per ora." line="Scrivi una scheda con i suoi giorni, o allenati senza.">
          <Button look="ghost" href={planPath(null)}>Scrivi una scheda</Button>
        </EmptyState>
      {/if}
      {#each plans as plan (plan.id)}
        <div class="plan">
          <span class="plan-name">{plan.name}</span>
          <div class="days">
            {#each plan.days as day (day.id)}
              <button type="button" class="day" disabled={starting} onclick={() => void start(day.id)}>
                <span class="day-name">{day.name}</span>
                <span class="day-count">{day.exercises.length === 1 ? '1 esercizio' : `${day.exercises.length} esercizi`}</span>
              </button>
            {/each}
          </div>
        </div>
      {/each}
      <span class="free">
        <Button look="ghost" disabled={starting} onclick={() => void start(null)}>
          <Icon name="plus" /> Allenamento libero
        </Button>
      </span>
    </PageCard>

    {#if done.length > 0}
      <PageCard>
        <span class="eyebrow">Gli ultimi</span>
        <ul class="rows">
          {#each done as workout (workout.id)}<WorkoutRow {workout} />{/each}
        </ul>
        <a class="more" href={HISTORY_PATH}>Tutto lo storico</a>
      </PageCard>
    {/if}
  {/if}
</PageShell>

<style>
  .open {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .what { display: grid; gap: 2px; min-width: 0; }

  .title { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; overflow-wrap: anywhere; }

  .when { font-size: 12px; color: var(--ink-3); }

  .plan { display: grid; gap: 8px; }

  .plan-name { font-weight: 600; }

  .days {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 8px;
  }

  /* un giorno è un tasto grande: si preme col pollice, in piedi, fra due macchine */
  .day {
    display: grid;
    gap: 2px;
    min-height: 60px;
    padding: 10px 12px;
    border: 1px solid var(--hairline);
    border-radius: var(--r-md);
    background: var(--sunken);
    text-align: left;
    transition: background 0.15s, border-color 0.15s, transform 0.12s var(--ease);
  }

  .day:hover { background: var(--sunken-hover); border-color: color-mix(in srgb, var(--accent) 25%, transparent); }

  .day:active { transform: scale(0.98); }

  .day:disabled { opacity: 0.6; pointer-events: none; }

  .day-name { font-size: 15px; font-weight: 620; letter-spacing: -0.01em; overflow-wrap: anywhere; }

  .day-count { font-size: 11.5px; color: var(--ink-3); }

  .free { justify-self: start; }

  .rows { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }

  .more { justify-self: start; font-size: 12.5px; color: var(--ink-2); }
</style>

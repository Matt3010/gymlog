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
  import Loader from '../Loader.svelte';
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
    {#if !error}<Loader />{/if}
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
          <Button look="primary" href={planPath(null)}>Scrivi una scheda</Button>
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
                <Icon name="next" />
              </button>
            {/each}
          </div>
        </div>
      {/each}
      <span class="free">
        <Button look="primary" disabled={starting} onclick={() => void start(null)}>
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

  /* sul telefono il testo prima, intero, e «Riprendi» sotto, largo quanto la card */
  @media (max-width: 600px) {
    .open { flex-direction: column; align-items: stretch; }
  }

  .what { display: grid; gap: 2px; min-width: 0; }

  .title { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; overflow-wrap: anywhere; }

  .when { font-size: 12px; color: var(--ink-3); }

  .plan { display: grid; gap: 8px; }

  .plan-name { font-weight: 600; }

  .days { display: grid; }

  /* un giorno è una riga della sezione, alta quanto un pollice: si preme in
     piedi, fra due macchine. Piatta, perché la card è già la sezione. */
  .day {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 52px;
    padding: 6px 0;
    border: 0;
    border-bottom: 1px solid var(--hairline-soft);
    border-radius: 0;
    background: transparent;
    text-align: left;
  }

  .day:active { background: var(--sunken); }

  .day:disabled { opacity: 0.6; pointer-events: none; }

  .day-name { font-size: 15px; font-weight: 620; letter-spacing: -0.01em; overflow-wrap: anywhere; }

  .day-count { flex: 1; font-size: 12.5px; color: var(--ink-3); }

  .day :global(.ico) { width: 16px; height: 16px; color: var(--ink-3); }

  .free { display: block; }

  @media (min-width: 601px) { .free { justify-self: start; } }

  .rows { display: grid; margin: 0; padding: 0; list-style: none; }

  .more { justify-self: start; font-size: 12.5px; color: var(--ink-2); }
</style>

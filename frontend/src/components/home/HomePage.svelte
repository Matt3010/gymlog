<script lang="ts">
  import { session } from '../../lib/client';
  import { current } from '../../lib/current.svelte';
  import { plansApi, workoutsApi } from '../../lib/endpoints';
  import { nav } from '../../lib/nav.svelte';
  import { planPath, workoutPath } from '../../lib/routing';
  import type { Plan } from '../../lib/types';
  import Alert from '../Alert.svelte';
  import Button from '../Button.svelte';
  import EmptyState from '../EmptyState.svelte';
  import Icon from '../Icon.svelte';
  import InstallHint from '../InstallHint.svelte';
  import PageCard from '../PageCard.svelte';
  import PageShell from '../PageShell.svelte';
  import Loader from '../Loader.svelte';

  /**
   * Dove si comincia, in palestra: le schede da cui partire, ognuna un
   * allenamento. Quelli fatti stanno nello Storico, una sezione sua.
   */
  let plans = $state<Plan[] | null>(null);
  let error = $state('');
  let starting = $state(false);

  $effect(() => {
    plansApi.list().then((list) => (plans = list), (failure: Error) => (error = failure.message));
  });

  /* uno alla volta: con un allenamento in corso (la barra sopra le sezioni) non se ne comincia un altro */
  const busy = $derived(current.workout !== null);
  const blocked = $derived(starting || busy);

  async function start(planId: number | null): Promise<void> {
    starting = true;
    error = '';
    try {
      const workout = await workoutsApi.start(planId);
      nav.go(workoutPath(workout.id));
    } catch (failure) {
      error = (failure as Error).message;
      starting = false;
    }
  }
</script>

<PageShell title="Allenati">
  <!-- in palestra l'app si apre dalla schermata Home: lo si propone qui, e «non ora» non lo ripete -->
  <InstallHint chiudibile />

  {#if error}<Alert message={error} />{/if}

  {#if plans === null}
    {#if !error}<Loader />{/if}
  {:else}

    {#if plans.length === 0}
      <PageCard>
        <EmptyState title="Nessuna scheda, per ora." line="Scrivi una scheda con i suoi esercizi, o allenati senza.">
          <Button look="primary" href={planPath(null)}>Scrivi una scheda</Button>
        </EmptyState>
      </PageCard>
    {/if}
    <!-- ogni scheda è un allenamento: si tocca e si parte -->
    {#if plans.length > 0}
      <PageCard>
        <span class="eyebrow">Inizia un allenamento</span>
        {#if busy}<p class="busy">Hai un allenamento in corso: terminalo per iniziarne un altro.</p>{/if}
        <div class="plans">
          {#each plans as plan (plan.id)}
            <button type="button" class="plan" disabled={blocked} onclick={() => void start(plan.id)}>
              <span class="plan-text">
                <span class="plan-name">{plan.name}</span>
                <span class="plan-what">{plan.exercises.length === 0 ? 'Nessun esercizio' : plan.exercises.map((exercise) => exercise.exerciseName).join(', ')}</span>
              </span>
              <Icon name="next" />
            </button>
          {/each}
        </div>
      </PageCard>
    {/if}
    <!-- fuori dalle card, secondario: è l'eccezione, non la prima scelta -->
    <span class="free">
      <Button disabled={blocked} onclick={() => void start(null)}>
        <Icon name="plus" /> Allenamento libero
      </Button>
    </span>

  {/if}
</PageShell>

<style>

  .busy { margin: 0; font-size: 13px; color: var(--ink-2); }

  .plans { display: grid; }

  /* una scheda è una riga della sezione, alta quanto un pollice: si preme in
     piedi, fra due macchine. Piatta, perché la card è già la sezione. */
  .plan {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 52px;
    /* come le righe degli elenchi (Row flat): la luce esce di 10px ai lati,
       con gli angoli tondi, e il testo resta sul bordo della card */
    margin: 0 -10px;
    padding: 6px 10px;
    border: 0;
    color: inherit;
    border-radius: var(--r-md);
    background: transparent;
    text-align: left;
  }

  /* il tratto fra una scheda e l'altra sta a parte, dritto, sotto gli angoli tondi */
  .plan::after {
    content: "";
    position: absolute;
    left: 10px;
    right: 10px;
    bottom: 0;
    height: 1px;
    background: var(--hairline-soft);
  }

  /* l'ultima scheda chiude la card: niente tratto sotto */
  .plan:last-child::after { content: none; }

  @media (hover: hover) {
    .plan:hover { background: var(--sunken); }
  }

  .plan:active { background: var(--sunken); }

  .plan:disabled { opacity: 0.6; pointer-events: none; }

  .plan-text { flex: 1; display: grid; gap: 1px; min-width: 0; }

  .plan-name { font-size: 15px; font-weight: 620; letter-spacing: -0.01em; overflow-wrap: anywhere; }

  /* gli esercizi su una riga sola: si riconosce la scheda, non serve leggerli tutti */
  .plan-what { font-size: 12.5px; color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .plan :global(.ico) { width: 16px; height: 16px; color: var(--ink-3); }

  .free { display: block; }

  @media (min-width: 601px) { .free { justify-self: start; } }

</style>

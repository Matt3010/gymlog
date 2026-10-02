<script lang="ts">
  import { session } from '../../lib/client';
  import { current } from '../../lib/current.svelte';
  import { plansApi, workoutsApi } from '../../lib/endpoints';
  import { nav } from '../../lib/nav.svelte';
  import { planPath, workoutPath } from '../../lib/routing';
  import type { Plan, WorkoutSummary } from '../../lib/types';
  import { ui } from '../../lib/ui.svelte';
  import Alert from '../Alert.svelte';
  import Button from '../Button.svelte';
  import EmptyState from '../EmptyState.svelte';
  import Icon from '../Icon.svelte';
  import InstallHint from '../InstallHint.svelte';
  import PageCard from '../PageCard.svelte';
  import PageShell from '../PageShell.svelte';
  import PickField from '../PickField.svelte';
  import { readJSON, writeJSON } from '../../lib/storage';
  import Loader from '../Loader.svelte';

  /**
   * Dove si comincia, in palestra: l'allenamento lasciato aperto da
   * riprendere e i giorni delle schede da cui partire. Quelli fatti stanno
   * nello Storico, una sezione sua.
   */
  let plans = $state<Plan[] | null>(null);
  let error = $state('');
  let starting = $state(false);

  $effect(() => {
    plansApi.list().then(
      (allPlans) => (plans = allPlans.filter((plan) => !plan.archived)),
      (failure: Error) => (error = failure.message),
    );
  });

  /** La scheda che si sta facendo: si ricorda, perché in palestra si riapre sempre la stessa. */
  const PLAN_KEY = 'gymlog.home.plan';
  let chosen = $state(readJSON<number | null>(PLAN_KEY, null));
  const plan = $derived(plans?.find((one) => one.id === chosen) ?? plans?.[0]);

  function choose(id: string): void {
    chosen = Number(id);
    writeJSON(PLAN_KEY, chosen);
  }


  /** «A» da sola non dice niente: un nome di una o due lettere è un giorno. */
  const dayLabel = (name: string): string => (name.length <= 2 ? `Giorno ${name}` : name);

  /* uno alla volta: con un allenamento in corso (la barra sopra le sezioni) non se ne comincia un altro */
  const busy = $derived(current.workout !== null);
  const blocked = $derived(starting || busy);

  /** Uscire chiede prima, come ogni tasto rosso: un tocco per sbaglio in palestra costa un nuovo accesso. */
  function askOut(anchor: HTMLElement): void {
    ui.askSure(anchor, { title: 'Uscire da gymlog?', verb: 'Esci', onYes: () => void session.logout() });
  }

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
    <Button look="icon" tone="danger" title="Esci ({session.user?.username})" onclick={(event: MouseEvent) => askOut(event.currentTarget as HTMLElement)}>
      <Icon name="logout" />
    </Button>
  {/snippet}

  <!-- in palestra l'app si apre dalla schermata Home: lo si propone qui, e «non ora» non lo ripete -->
  <InstallHint chiudibile />

  {#if error}<Alert message={error} />{/if}

  {#if plans === null}
    {#if !error}<Loader />{/if}
  {:else}

    {#if plans.length === 0}
      <PageCard>
        <EmptyState title="Nessuna scheda, per ora." line="Scrivi una scheda con i suoi giorni, o allenati senza.">
          <Button look="primary" href={planPath(null)}>Scrivi una scheda</Button>
        </EmptyState>
      </PageCard>
    {/if}
    <!-- una scheda alla volta: si sceglie dal menu, e sotto ci sono i suoi giorni -->
    {#if plan}
      <PageCard>
        <div class="plan-head">
          <span class="eyebrow">Inizia un allenamento</span>
          {#if plans.length > 1}
            <span class="pick">
              <PickField value={String(plan.id)} options={plans.map((one) => ({ id: String(one.id), label: one.name }))} label="Scheda" drop onpick={choose} />
            </span>
          {:else}
            <h2>{plan.name}</h2>
          {/if}
        </div>
        {#if busy}<p class="busy">Hai un allenamento in corso: terminalo per iniziarne un altro.</p>{/if}
        <div class="days">
          {#each plan.days as day (day.id)}
            <button type="button" class="day" disabled={blocked} onclick={() => void start(day.id)}>
              <span class="day-text">
                <span class="day-name">{dayLabel(day.name)}</span>
                <span class="day-what">{day.exercises.length === 0 ? 'Nessun esercizio' : day.exercises.map((exercise) => exercise.exerciseName).join(', ')}</span>
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

  .plan-head { display: grid; gap: 6px; }

  .busy { margin: 0; font-size: 13px; color: var(--ink-2); }

  /* il menu della scheda è largo quanto la card: si tocca col pollice, e il nome ci sta intero */
  .pick :global(.pick-field) {
    width: 100%;
    justify-content: space-between;
    min-height: 44px;
    font-size: 17px;
    font-weight: 650;
    letter-spacing: -0.015em;
  }

  .pick :global(.pick-field .ico) { width: 18px; height: 18px; }

  .plan-head h2 { margin: 0; font-size: 17px; font-weight: 650; letter-spacing: -0.015em; overflow-wrap: anywhere; }

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
    color: inherit;
    border-radius: 0;
    background: transparent;
    text-align: left;
  }

  /* l'ultimo giorno chiude la card: niente tratto sotto */
  .day:last-child { border-bottom: 0; }

  .day:active { background: var(--sunken); }

  .day:disabled { opacity: 0.6; pointer-events: none; }

  .day-text { flex: 1; display: grid; gap: 1px; min-width: 0; }

  .day-name { font-size: 15px; font-weight: 620; letter-spacing: -0.01em; overflow-wrap: anywhere; }

  /* gli esercizi del giorno su una riga sola: si riconosce il giorno, non serve leggerli tutti */
  .day-what { font-size: 12.5px; color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .day :global(.ico) { width: 16px; height: 16px; color: var(--ink-3); }

  .free { display: block; }

  @media (min-width: 601px) { .free { justify-self: start; } }

</style>

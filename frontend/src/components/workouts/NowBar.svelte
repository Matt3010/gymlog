<script lang="ts">
  import { workoutsApi } from '../../lib/endpoints';
  import { formatDuration, formatRest } from '../../lib/format';
  import { nav } from '../../lib/nav.svelte';
  import { rest } from '../../lib/rest.svelte';
  import { workoutPath } from '../../lib/routing';
  import type { WorkoutSummary } from '../../lib/types';
  import { inProgress } from '../../lib/workout';

  /**
   * L'allenamento in corso, da ogni pagina: una barra sopra le sezioni, come
   * il «in riproduzione» di un lettore. Dice cosa è, quante serie e da quanto;
   * durante il recupero, quanto manca. Toccandola si riprende. Sulla pagina
   * di quell'allenamento si fa da parte: lì c'è già tutto.
   *
   * Si guarda di nuovo a ogni cambio di pagina: un allenamento cominciato,
   * terminato o tolto altrove si vede qui al passaggio successivo.
   */
  let open = $state<WorkoutSummary | null>(null);
  let now = $state(Date.now());

  $effect(() => {
    void nav.path;
    workoutsApi.list(6).then(
      (workouts) => (open = inProgress(workouts) ?? null),
      () => undefined, // senza rete resta quello che si sapeva
    );
  });

  // i minuti passano anche senza cambiare pagina
  $effect(() => {
    const ticker = setInterval(() => (now = Date.now()), 30_000);
    return () => clearInterval(ticker);
  });

  const here = $derived(open !== null && nav.route.kind === 'workout' && nav.route.id === open.id);
  const title = $derived(open?.dayName ? `${open.planName} · ${open.dayName}` : 'Allenamento libero');
</script>

{#if open && !here}
  <a class="now surface" href={workoutPath(open.id)}>
    <span class="dot" aria-hidden="true"></span>
    <span class="what">
      <span class="eyebrow">In corso</span>
      <span class="title">{title}</span>
    </span>
    {#if rest.running}
      <span class="how resting">Recupero <strong>{formatRest(rest.remaining)}</strong></span>
    {:else}
      <span class="how">{open.sets === 1 ? '1 serie' : `${open.sets} serie`} · {formatDuration(open.startedAt, new Date(now).toISOString())}</span>
    {/if}
  </a>
{/if}

<style>
  /* appoggiata sopra le sezioni, nello spazio che ogni pagina lascia libero in fondo */
  .now {
    position: fixed;
    left: max(12px, env(safe-area-inset-left));
    right: max(12px, env(safe-area-inset-right));
    bottom: calc(var(--tab-bar) + 10px);
    z-index: var(--z-bar);
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 54px;
    padding: 8px 14px;
    color: var(--ink);
    text-decoration: none;
    -webkit-tap-highlight-color: transparent;
  }

  .now:active { background: var(--sunken-hover); }

  /* il pallino verde che pulsa: qualcosa sta andando */
  .dot {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--ok);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--ok) 20%, transparent);
  }

  .what { flex: 1; display: grid; gap: 1px; min-width: 0; }

  .what .eyebrow { font-size: 10.5px; }

  .title { font-size: 14.5px; font-weight: 620; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .how { flex: none; font-size: 12.5px; color: var(--ink-2); font-variant-numeric: tabular-nums; }

  .resting strong { font-size: 15px; color: var(--ink); }
</style>

<script lang="ts">
  import { untrack } from 'svelte';
  import { current } from '../../lib/current.svelte';
  import { formatDuration, formatRest } from '../../lib/format';
  import { nav } from '../../lib/nav.svelte';
  import { rest } from '../../lib/rest.svelte';
  import { workoutPath } from '../../lib/routing';
  import Icon from '../Icon.svelte';

  /**
   * L'allenamento in corso, da ogni pagina: un banner sopra le sezioni, come
   * il «in riproduzione» di un lettore. Dice cosa è, quante serie e da quanto.
   * Durante il recupero gliene sta sopra un altro, uguale: quanto manca, ±15 s
   * e la ✕, e una linea che si svuota. Fuori dall'allenamento lo si tocca per
   * riprenderlo; sulla sua pagina c'è lo stesso, solo non porta da nessuna parte.
   *
   * Si guarda di nuovo a ogni cambio di pagina: un allenamento cominciato,
   * terminato o tolto altrove si vede qui al passaggio successivo.
   *
   * Alti 58px a 10px dalla barra: stanno dentro lo spazio che ogni pagina
   * lascia libero in fondo (--sopra-alla-barra, più largo con due banner),
   * quindi non coprono gli ultimi tasti.
   */
  let now = $state(Date.now());

  $effect(() => {
    void nav.path;
    // solo il cambio di pagina la fa ripartire: la richiesta legge lo stato della rete e
    // della sessione, e se l'effetto la seguisse ripartirebbe a ogni risposta
    untrack(() => void current.refresh());
  });

  // i minuti passano anche senza cambiare pagina
  $effect(() => {
    const ticker = setInterval(() => (now = Date.now()), 30_000);
    return () => clearInterval(ticker);
  });

  const open = $derived(current.workout);
  const here = $derived(open !== null && nav.route.kind === 'workout' && nav.route.id === open.id);
  // con due banner le pagine lasciano più spazio in fondo, se no coprirebbero gli ultimi tasti
  $effect(() => {
    document.body.classList.toggle('two-banners', open !== null && rest.running);
    return () => document.body.classList.remove('two-banners');
  });

  const left = $derived(rest.total > 0 ? rest.remaining / rest.total : 0);
</script>

{#snippet what()}
  <span class="text">
    <span class="eyebrow">In corso</span>
    <span class="main">{open!.title}</span>
  </span>
  <span class="how">{open!.sets === 1 ? '1 serie' : `${open!.sets} serie`} · {formatDuration(open!.startedAt, new Date(now).toISOString())}</span>
{/snippet}

{#if open}
  <div class="stack">
    <!-- il recupero, un banner suo sopra quello dell'allenamento: tutti e due a vista -->
    {#if rest.running}
      <div class="banner surface has-tools">
        <span class="what"><span class="main" role="timer" aria-label="Recupero">Recupero <strong>{formatRest(rest.remaining)}</strong></span></span>
        <span class="tools">
          <button type="button" aria-label="Togli 15 secondi" onclick={() => rest.add(-15)}>−15 s</button>
          <button type="button" aria-label="Aggiungi 15 secondi" onclick={() => rest.add(15)}>+15 s</button>
          <button type="button" class="stop" aria-label="Ferma il recupero" onclick={() => rest.stop()}>
            <Icon name="close" />
          </button>
        </span>
        <!-- quanto manca: si svuota da destra verso sinistra -->
        <span class="track" aria-hidden="true"><span class="fill" style:transform="scaleX({left})"></span></span>
      </div>
    {/if}
    <section class="banner surface" aria-label="In corso">
      {#if here}
        <span class="what">{@render what()}</span>
      {:else}
        <a class="what" href={workoutPath(open.id)}>{@render what()}</a>
      {/if}
    </section>
  </div>
{/if}

<style>
  /* appoggiati sopra le sezioni, uno sull'altro */
  .stack {
    position: fixed;
    /* larghi quanto l'isola delle sezioni, e allineati a lei */
    left: var(--island-side);
    right: var(--island-side);
    bottom: calc(var(--tab-bar) + 8px);
    z-index: var(--z-bar);
    max-width: 520px;
    margin: 0 auto;
    display: grid;
    gap: 8px;
  }

  .banner {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 58px;
    padding: 0;
    overflow: hidden;
    /* tondi come l'isola delle sezioni, su cui si appoggiano */
    border-radius: 22px;
    animation: rise 0.24s var(--ease);
  }

  /* la parte che dice cosa è: tutta da toccare, fuori dall'allenamento */
  .what {
    flex: 1;
    align-self: stretch;
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    padding: 0 6px 0 16px;
    color: var(--ink);
    text-decoration: none;
    -webkit-tap-highlight-color: transparent;
  }

  /* lo spazio a destra serve ai tasti del recupero; senza tasti è del testo,
     e la luce di chi preme arriva fino al bordo */
  .banner.has-tools { padding-right: 8px; }

  .banner:not(.has-tools) .what { padding-right: 14px; }

  a.what:active { background: var(--sunken-hover); }

  @media (hover: hover) {
    a.what:hover { background: var(--sunken-hover); }
  }

  .text { flex: 1; display: grid; gap: 1px; min-width: 0; }

  .text .eyebrow { font-size: 10.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .main { font-size: 14.5px; font-weight: 620; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .main[role='timer'] { flex: 1; font-size: 12.5px; font-weight: 500; color: var(--ink-2); }

  strong {
    margin-left: 4px;
    font-size: 20px;
    font-weight: 640;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    color: var(--ink);
  }

  .how { flex: none; padding-right: 6px; font-size: 12.5px; color: var(--ink-2); font-variant-numeric: tabular-nums; }

  .tools { display: flex; gap: 6px; }

  button {
    min-width: 44px;
    height: 38px;
    padding: 0 10px;
    border: 0;
    border-radius: var(--r-sm);
    background: var(--sunken);
    font-size: 12.5px;
    font-weight: 560;
    font-variant-numeric: tabular-nums;
    transition: background 0.15s;
  }

  @media (hover: hover) {
    button:hover { background: var(--sunken-hover); }
  }

  .stop { display: grid; place-items: center; min-width: 38px; padding: 0; color: var(--ink-2); }

  .stop :global(.ico) { width: 16px; height: 16px; }

  .track { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: var(--hairline-soft); }

  .fill {
    display: block;
    height: 100%;
    background: var(--ink);
    transform-origin: left;
    transition: transform 0.25s linear;
  }
</style>

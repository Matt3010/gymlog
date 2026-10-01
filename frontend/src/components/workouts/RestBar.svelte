<script lang="ts">
  import { formatRest } from '../../lib/format';
  import type { RestTimer } from '../../lib/rest-timer.svelte';
  import Icon from '../Icon.svelte';

  /**
   * Il recupero che scorre, sopra la barra delle sezioni.
   *
   * Si guarda da lontano, col telefono appoggiato sulla panca: i secondi
   * grandi e una barra che si svuota. Si allunga o si accorcia di quindici
   * secondi alla volta, e si ferma con la ✕.
   *
   * Alta 54px a 10px dalla barra: sta dentro lo spazio che ogni pagina lascia
   * libero in fondo (--sopra-alla-barra), quindi non copre gli ultimi tasti.
   * Un messaggio non la incrocia: in un allenamento gli errori stanno nella
   * pagina, e «terminato» la ferma.
   */
  let { timer }: { timer: RestTimer } = $props();

  const left = $derived(timer.total > 0 ? timer.remaining / timer.total : 0);
</script>

<div class="rest surface" role="timer" aria-label="Recupero">
  <span class="label">Recupero <strong>{formatRest(timer.remaining)}</strong></span>
  <span class="tools">
    <button type="button" aria-label="Togli 15 secondi" onclick={() => timer.add(-15)}>−15 s</button>
    <button type="button" aria-label="Aggiungi 15 secondi" onclick={() => timer.add(15)}>+15 s</button>
    <button type="button" class="stop" aria-label="Ferma il recupero" onclick={() => timer.stop()}>
      <Icon name="close" />
    </button>
  </span>
  <span class="track" aria-hidden="true"><span class="fill" style:transform="scaleX({left})"></span></span>
</div>

<style>
  .rest {
    position: fixed;
    left: max(12px, env(safe-area-inset-left));
    right: max(12px, env(safe-area-inset-right));
    bottom: calc(var(--tab-bar) + 10px);
    z-index: var(--z-bar);
    max-width: 616px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    gap: 10px;
    height: 54px;
    padding: 0 8px 0 16px;
    overflow: hidden;
    border-radius: var(--r-md);
    animation: rise 0.24s var(--ease);
  }

  .label { flex: 1; min-width: 0; font-size: 12.5px; color: var(--ink-2); }

  strong {
    margin-left: 4px;
    font-size: 20px;
    font-weight: 640;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    color: var(--ink);
  }

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

  button:hover { background: var(--sunken-hover); }

  .stop { display: grid; place-items: center; min-width: 38px; padding: 0; color: var(--ink-2); }

  .stop :global(.ico) { width: 16px; height: 16px; }

  /* quanto manca: si svuota da destra verso sinistra */
  .track { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: var(--hairline-soft); }

  .fill {
    display: block;
    height: 100%;
    background: var(--ink);
    transform-origin: left;
    transition: transform 0.25s linear;
  }
</style>

<script lang="ts">
  import { alCentro } from '../lib/centra';
  import Icon from './Icon.svelte';
  import Popover from './Popover.svelte';

  /**
   * Un'ora, scelta a mano.
   *
   * Il campo orario del browser apre un elenco che non è dell'app: colori
   * suoi, misure sue, e su ogni sistema un disegno diverso. In mezzo a una
   * scheda fatta di pastiglie scure è la cosa più vistosa dello schermo, e
   * l'unica che non abbiamo scritto noi.
   *
   * Qui sono due colonne — le ore e i minuti — con lo scatto sotto il dito e
   * il valore di adesso già sotto gli occhi quando si apre. I minuti vanno di
   * cinque in cinque: una scena che chiude le tende non ha bisogno del minuto
   * spaccato, e ventiquattro righe per le ore sono già abbastanza da scorrere.
   */
  let {
    value,
    onchange,
    label = 'A che ora',
  }: {
    /** Come si scrive su un orologio: `07:30`. */
    value: string;
    onchange: (next: string) => void;
    label?: string;
  } = $props();

  const ORE = Array.from({ length: 24 }, (_, at) => String(at).padStart(2, '0'));
  const MINUTI = Array.from({ length: 12 }, (_, at) => String(at * 5).padStart(2, '0'));

  const ora = $derived(value.split(':')[0] ?? '00');
  const minuto = $derived(value.split(':')[1] ?? '00');

  let open = $state(false);
  let anchor = $state<HTMLButtonElement | null>(null);

  const set = (h: string, m: string) => onchange(`${h}:${m}`);

  /**
   * Quando si apre, il valore di adesso si porta sotto gli occhi: un elenco
   * che parte da mezzanotte fa cercare le sette di sera a mano.
   */
  const reveal = alCentro;
</script>

<button
  type="button"
  class="time-btn"
  class:is-open={open}
  aria-label={label}
  aria-expanded={open}
  bind:this={anchor}
  onclick={() => (open = !open)}
>
  <span class="letto">{value}</span>
  <Icon name="expand" />
</button>

{#if open && anchor}
  <Popover {anchor} width={188} height={248} id="time-pop" onclose={() => (open = false)}>
    <div class="colonne">
      <div class="colonna" use:reveal>
        {#each ORE as one (one)}
          <button type="button" class="voce" class:is-on={one === ora} onclick={() => set(one, minuto)}>
            {one}
          </button>
        {/each}
      </div>

      <span class="due" aria-hidden="true">:</span>

      <div class="colonna" use:reveal>
        {#each MINUTI as one (one)}
          <button type="button" class="voce" class:is-on={one === minuto} onclick={() => set(ora, one)}>
            {one}
          </button>
        {/each}
      </div>
    </div>
  </Popover>
{/if}

<style>
  .time-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px 5px 10px;
    border: 1px solid var(--hairline);
    border-radius: var(--r-sm);
    background: var(--sunken);
    color: var(--ink);
    font: inherit;
    font-size: 12.5px;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    transition: background 0.14s, border-color 0.14s;
  }

  .time-btn:hover, .time-btn.is-open {
    background: var(--sunken-hover);
    border-color: color-mix(in srgb, var(--accent) 45%, transparent);
  }

  .letto { letter-spacing: 0.01em; }

  .time-btn :global(.ico) { width: 12px; height: 12px; color: var(--ink-3); }

  .colonne { display: flex; align-items: stretch; gap: 6px; }

  /* lo scatto: una colonna di numeri che si ferma dove capita si rilegge tre
     volte prima di trovare quello giusto */
  .colonna {
    flex: 1;
    display: grid;
    gap: 1px;
    max-height: 216px;
    overflow: auto;
    overscroll-behavior: contain;
    scroll-snap-type: y proximity;
    scrollbar-width: none;
  }

  .colonna::-webkit-scrollbar { display: none; }

  .due {
    align-self: center;
    font-size: 13px;
    color: var(--ink-3);
  }

  .voce {
    padding: 7px 0;
    border: 0;
    border-radius: var(--r-sm);
    background: transparent;
    color: var(--ink-2);
    font: inherit;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    text-align: center;
    cursor: pointer;
    scroll-snap-align: center;
    transition: background 0.12s, color 0.12s;
  }

  .voce:hover { background: var(--sunken); color: var(--ink); }

  .voce.is-on {
    background: color-mix(in srgb, var(--accent) 22%, transparent);
    color: var(--ink);
    font-weight: 600;
  }
</style>

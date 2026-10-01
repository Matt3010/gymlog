<script lang="ts">
  import type { Choice } from '../lib/table';
  import Icon from './Icon.svelte';
  import PickList from './PickList.svelte';
  import Popover from './Popover.svelte';

  /**
   * Un valore scelto da un elenco corto.
   *
   * È il tasto che dice cosa c'è adesso — «dopo un minuto», «domani» — e si
   * apre su un foglietto con le voci possibili. Era scritto tre volte: il
   * giorno di una scena, l'attesa fra due righe, e la scelta del luogo di un
   * agente, ognuna con il suo tasto e il suo elenco.
   *
   * Due vestiti, perché due sono i posti dove serve: `field` accanto a un
   * campo di testo, `pill` dentro a una riga, dove deve pesare meno di
   * quello che la riga dice.
   */
  let {
    value,
    options,
    onpick,
    title,
    label,
    look = 'field',
    width = 210,
  }: {
    value: string;
    options: Choice[];
    onpick: (id: string) => void;
    /** La domanda in cima al foglietto: «Quando parte questa riga?» */
    title?: string;
    /** Come si chiama questo tasto, per chi non lo vede. */
    label?: string;
    look?: 'field' | 'pill';
    width?: number;
  } = $props();

  let open = $state(false);
  let anchor = $state<HTMLButtonElement | null>(null);

  const scelto = $derived(options.find((one) => one.id === value));

  function choose(id: string): void {
    open = false;
    onpick(id);
  }
</script>

<button
  type="button"
  class="pick-field {look}"
  class:is-open={open}
  aria-label={label}
  aria-expanded={open}
  title={label}
  bind:this={anchor}
  onclick={() => (open = !open)}
>
  <span class="letto">{scelto?.label ?? value}</span>
  {#if look === 'field'}<Icon name="expand" />{/if}
</button>

{#if open && anchor}
  <Popover {anchor} {width} height={248} onclose={() => (open = false)}>
    <PickList {options} current={value} {title} onpick={choose} />
  </Popover>
{/if}

<style>
  .pick-field {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 0;
    color: var(--ink);
    font: inherit;
    cursor: pointer;
    transition: background 0.14s, border-color 0.14s, color 0.14s;
  }

  /* accanto a un campo di testo: stessa altezza, stesso bordo */
  .pick-field.field {
    height: 26px;
    padding: 0 8px 0 10px;
    border: 1px solid var(--hairline);
    border-radius: var(--r-sm);
    background: var(--sunken);
    font-size: 12.5px;
  }

  .pick-field.field:hover, .pick-field.field.is-open {
    background: var(--sunken-hover);
    border-color: color-mix(in srgb, var(--accent) 45%, transparent);
  }

  /* dentro a una riga: pesa meno di quello che la riga dice */
  .pick-field.pill {
    justify-content: center;
    flex: none;
    height: 26px;
    min-width: 74px;
    padding: 0 9px;
    border-radius: 99px;
    background: var(--sunken);
    color: var(--ink-3);
    font-size: 10.5px;
    font-variant-numeric: tabular-nums;
  }

  .pick-field.pill:hover, .pick-field.pill.is-open {
    background: var(--sunken-hover);
    color: var(--ink-2);
  }

  .pick-field :global(.ico) { width: 12px; height: 12px; color: var(--ink-3); }
</style>

<script lang="ts">
  import { stepValue } from '../lib/stepper';
  import Icon from './Icon.svelte';

  /**
   * Un numero da cambiare col pollice: meno, il valore, più.
   *
   * In palestra si scrive con una mano sola e spesso sudata, e il passo tipico
   * è sempre quello — una ripetizione, due chili e mezzo — quindi i tasti sono
   * grandi e il campo in mezzo resta scrivibile per i salti più lunghi. Il
   * conto lo fa `stepValue`; chi lo usa legge il testo (`parseKg`).
   */
  let {
    value = $bindable(''),
    step,
    min = 0,
    label,
    unit,
    decimals = false,
  }: {
    value?: string;
    step: number;
    min?: number;
    /** Il nome sopra, e per chi non vede. */
    label: string;
    /** Scritta piccola accanto al valore: «kg». */
    unit?: string;
    /** Se il numero può avere la virgola. */
    decimals?: boolean;
  } = $props();

  function nudge(direction: 1 | -1): void {
    value = stepValue(value, direction, { step, min, decimals });
  }
</script>

<div class="stepper is-line">
  <span class="eyebrow">{label}</span>
  <div class="controls">
    <button type="button" class="nudge" aria-label="{label}, meno {String(step).replace('.', ',')}" onclick={() => nudge(-1)}>
      <Icon name="minus" />
    </button>
    <span class="value">
      <input
        class:has-unit={!!unit}
        type="text"
        inputmode={decimals ? 'decimal' : 'numeric'}
        aria-label={label}
        bind:value
        maxlength="7"
      />
      {#if unit}<span class="unit">{unit}</span>{/if}
    </span>
    <button type="button" class="nudge" aria-label="{label}, più {String(step).replace('.', ',')}" onclick={() => nudge(1)}>
      <Icon name="plus" />
    </button>
  </div>
</div>

<style>
  /* una riga per numero, larga quanto la card: il nome a sinistra, poi
     meno, il valore e più, grandi per il pollice. In due affiancati, sei
     tasti in 358px, il pollice prendeva quello accanto. */
  .stepper.is-line {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .controls {
    display: grid;
    grid-template-columns: 48px 104px 48px;
    align-items: center;
    gap: 8px;
  }

  .nudge {
    display: grid;
    place-items: center;
    height: 48px;
    padding: 0;
    border: 1px solid var(--hairline);
    border-radius: var(--r-md);
    background: transparent;
    color: var(--ink-2);
    transition: background 0.15s, color 0.15s, transform 0.12s var(--ease);
  }

  @media (hover: hover) {
  .nudge:hover { background: var(--sunken); color: var(--ink); }
}
  .nudge:active { transform: scale(0.94); }

  .value { position: relative; display: block; }

  .value input {
    height: 48px;
    padding: 0 10px;
    text-align: center;
    font-size: 17px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
  }

  /* con l'unità il numero si sposta di quanto lei occupa, se no le finisce sopra */
  .value input.has-unit { padding: 0 26px 0 12px; }

  /* l'unità sta dentro al campo, a destra, e non si scrive: si legge */
  .unit {
    position: absolute;
    right: 9px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 11px;
    color: var(--ink-3);
    pointer-events: none;
  }
</style>

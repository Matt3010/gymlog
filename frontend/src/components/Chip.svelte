<script lang="ts">
  type Look = 'on' | 'off' | 'sel';

  let {
    color,
    emoji,
    label,
    count,
    look = 'on',
    size,
    disabled = false,
    onclick,
    title,
    ...rest
  }: {
    color?: string;
    emoji?: string;
    label: string;
    count?: number;
    look?: Look;
    /** Più piccola del normale: dentro a una card, in mezzo ad altri controlli. */
    size?: 'sm';
    disabled?: boolean;
    onclick?: (event: MouseEvent) => void;
    /** Cosa fa, detto a chi ci passa sopra. */
    title?: string;
    /* quello che non sappiamo ancora di dover passare: aria, dati */
    [key: string]: unknown;
  } = $props();

  /*
   * Un nome troppo lungo si taglia coi puntini dentro la pastiglia, e allora
   * il nome intero si legge passandoci sopra. Si misura quando ci si arriva,
   * col puntatore o col fuoco, perché solo lì serve saperlo.
   */
  let nome = $state<HTMLElement>();
  let tagliato = $state(false);
  const misura = () => (tagliato = !!nome && nome.scrollWidth > nome.clientWidth);
  const detto = $derived(tagliato ? (title ? `${label}. ${title}` : label) : title);
</script>

<button
  type="button"
  class="chip {look} {size === 'sm' ? 'is-sm' : ''}"
  style:--c={color}
  {disabled}
  {onclick}
  title={detto}
  onpointerenter={misura}
  onfocus={misura}
  {...rest}
>
  {#if emoji}<span class="emo">{emoji}</span>{/if}
  <span class="name" bind:this={nome}>{label}</span>
  {#if count !== undefined}<span class="count">{count}</span>{/if}
</button>

<style>
/* spento vuol dire spento: niente clic e niente passaggio col tasto tab */
.chip:disabled { opacity: 0.45; pointer-events: none; }

/* chips ------------------------------------------------------------------- */

.chip {
  --c: var(--ink-2);
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 30px;
  padding: 0 11px 0 9px;
  border: 1px solid var(--hairline);
  border-radius: 99px;
  background: transparent;
  color: var(--ink-2);
  font-size: 12.5px;
  font-weight: 500;
  white-space: nowrap;
  /* mai più larga di chi la ospita: il nome si taglia dentro (vedi .name) */
  max-width: 100%;
  min-width: 0;
  user-select: none;
  transition: background 0.16s, border-color 0.16s, color 0.16s, opacity 0.16s, transform 0.14s var(--ease);
}

.chip:hover { transform: translateY(-1px); }

/* Dove si tocca, una pastiglia è alta quanto un dito. Trenta pixel bastano a
   un puntatore che arriva preciso; un polpastrello ne copre quaranta, e fra
   due filtri vicini prende quello sbagliato. */
/* La misura piccola. Sta qui e non in chi la ospita, se no ogni schermata si
   inventa la sua e poi divergono di un pixel per volta. */
.chip.is-sm { height: 26px; padding: 0 10px 0 9px; font-size: 11.5px; }

/* Dove si tocca, anche la piccola è alta quanto un dito. Scritta dopo e non
   prima: stava sopra alla misura piccola, che a parità di peso vinceva lei,
   e «Apri, Ferma, Chiudi» di una tenda restavano alti ventisei pixel. */
@media (hover: none) {
  .chip { height: 40px; }
  .chip.is-sm { height: 36px; }
}

/* il segno dentro alla pillola: un disegno prende il colore del testo, e
   un'emoji di quelle vecchie si porta ancora i suoi */
.chip .emo { display: inline-grid; place-items: center; line-height: 1; }

/* a stringersi è solo il nome: il segno, il pallino e il numero restano interi */
.chip > :global(:not(.name)) { flex-shrink: 0; }

.chip .name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chip .count {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--ink-3);
}

.chip.on {
  background: color-mix(in srgb, var(--c) 13%, transparent);
  border-color: color-mix(in srgb, var(--c) 38%, transparent);
  color: var(--ink);
}

.chip.on .count { color: color-mix(in srgb, var(--c) 65%, var(--ink-2)); }

/* a scope chip is picked, not toggled: unpicked stays legible */
.chip.sel {
  background: color-mix(in srgb, var(--ink) 9%, transparent);
  border-color: color-mix(in srgb, var(--ink) 26%, transparent);
  color: var(--ink);
  font-weight: 540;
}

.chip.off { opacity: 0.55; }

.chip.off .emo { filter: grayscale(1); }

</style>

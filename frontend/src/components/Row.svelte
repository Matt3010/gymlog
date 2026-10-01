<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * La riga-card delle schede: categorie, gruppi, mappe, e la riga con cui se
   * ne aggiunge una. La geometria sta qui una volta sola — il segno a sinistra,
   * il nome che si allarga, i comandi a destra — perché scritta tre volte
   * ricomincia a divergere di qualche pixel per volta.
   *
   *   lead     il segno a sinistra: un'emoji, un pin, un'etichetta
   *   children il nome: un campo che si prende quello che avanza
   *   trail    i comandi a destra: colore, conteggio, cestino
   *   under    quello che sta sotto la riga (le mappe hanno tre righe in più)
   */
  let {
    lead,
    children,
    trail,
    under,
    active = false,
    dashed = false,
    flat = false,
    class: extra = '',
    ...rest
  }: {
    lead?: Snippet;
    children: Snippet;
    trail?: Snippet;
    under?: Snippet;
    /** La card che stai guardando: porta il segno, non una parola in più. */
    active?: boolean;
    /** La riga con cui si aggiunge: un posto vuoto da riempire. */
    dashed?: boolean;
    /**
     * Piatta, per stare dentro una card: niente fondo, bordo né ombra suoi,
     * solo il tratto sottile che la separa dalla prossima. Una card dentro
     * una card è un livello di troppo: la sezione è la card, le righe no.
     */
    flat?: boolean;
    /** Una classe in più da fuori: si aggiunge a "row", non la sostituisce. */
    class?: string;
    [key: string]: unknown;
  } = $props();
</script>

<div
  class="row {extra}"
  class:is-on={active}
  class:is-dashed={dashed}
  class:is-flat={flat}
  class:has-under={under}
  {...rest}
>
  <div class="line">
    {#if lead}<span class="lead">{@render lead()}</span>{/if}
    {@render children()}
    {#if trail}<span class="trail">{@render trail()}</span>{/if}
  </div>
  {@render under?.()}
</div>

<style>
  .row {
    display: grid;
    gap: 6px;
    padding: 5px 6px;
    border-radius: var(--r-md);
    background: var(--sunken);
    box-shadow: inset 0 0 0 1px var(--hairline-soft);
    transition: background 0.16s, box-shadow 0.16s, border-color 0.16s;
  }

  @media (hover: hover) {
  .row:hover { background: var(--sunken-hover); }
}

  /* una riga che ha delle righe sotto non è più una riga: è una card, e una
     card respira un po' di più */
  .row.has-under { padding: 8px 8px 9px; }

  /* quella selezionata porta il segno, non una parola in più */
  .row.is-on {
    background: var(--sunken-hover);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ink) 20%, transparent);
  }

  /* la riga con cui si aggiunge: il tratteggio dice che è un posto vuoto */
  .row.is-dashed {
    background: none;
    box-shadow: none;
    /* il bordo occupa un pixel: il padding lo restituisce, così i comandi
       cadono nelle stesse colonne delle righe piene */
    padding: 5px;
    border: 1px dashed var(--hairline);
  }

  @media (hover: hover) {
  .row.is-dashed:hover { background: none; }
}

  .row.is-dashed:focus-within {
    border-style: solid;
    border-color: color-mix(in srgb, var(--accent) 40%, transparent);
    box-shadow: 0 0 0 3.5px color-mix(in srgb, var(--accent) 10%, transparent);
  }

  /* niente spazio fra i pezzi: ognuno si porta il proprio, e così le colonne
     cadono dove cadono nelle righe qui sopra */
  .line {
    display: flex;
    align-items: center;
    gap: 0;
  }

  /* il segno sta in mezzo al posto che si prende: la misura è sua */
  .lead {
    display: grid;
    place-items: center;
    flex: none;
  }

  .trail {
    display: flex;
    align-items: center;
    gap: 0;
  }

  /* il nome è un titolo finché non lo tocchi */
  .row :global(input) {
    flex: 1;
    min-width: 0;
    padding: 5px 6px 5px 5px;
    background: none;
    border-color: transparent;
    box-shadow: none;
    font-size: 13.5px;
    font-weight: 560;
    letter-spacing: -0.012em;
  }

  @media (hover: hover) {
  .row :global(input:hover) { background: var(--glass-strong); }
}
  .row :global(input:focus) { background: var(--glass-strong); box-shadow: 0 0 0 1px var(--hairline); }

  /* nella riga vuota il fuoco lo mostra la riga intera: il campo non ne fa un
     secondo, e sta un po' più largo perché lì il nome non c'è ancora */
  .row.is-dashed :global(input) { padding: 6px 8px; }

  @media (hover: hover) {
  .row.is-dashed :global(input:hover), .row.is-dashed :global(input:focus) {
      background: none;
      box-shadow: none;
    }
}

  /* il conteggio ha una larghezza sua, se no le colonne ballano da riga a riga */
  .row :global(.count) {
    min-width: 22px;
    padding: 0 4px;
    font-size: 11.5px;
    font-variant-numeric: tabular-nums;
    text-align: right;
    color: var(--ink-3);
    white-space: nowrap;
  }

  /* Dove si tocca, il nome si prende col dito: trentadue pixel si vedono e
     si mancano. Lo spazio si aggiunge dentro al campo, così la riga cresce
     di poco e il nome resta allineato al segno accanto. */
  @media (hover: none) {
    .row :global(input) { padding-top: 10px; padding-bottom: 10px; }
  }

  /* piatta, dentro una card: il tratto la separa, la pressione la accende */
  .row.is-flat,
  .row.is-flat.is-dashed {
    position: relative;
    padding: 4px 0;
    border: 0;
    /* la pressione si accende con gli angoli tondi, mai a spigolo vivo */
    border-radius: var(--r-md);
    background: transparent;
    box-shadow: none;
  }

  /* il tratto fra una riga e l'altra sta a parte, dritto, sotto gli angoli tondi */
  .row.is-flat::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 1px;
    background: var(--hairline-soft);
  }

  /* l'ultima riga di un elenco che chiude la card non ha niente da cui
     separarsi: il tratto lì sarebbe un bordo in più. Se sotto c'è altro
     («Tutto lo storico», il campo per crearne uno) il tratto resta. */
  :global(ul.rows:last-child > li:last-child) > .row.is-flat::after { content: none; }

  @media (hover: hover) {
  .row.is-flat:hover { background: transparent; }
}

  .row.is-flat:active { background: var(--sunken); }

  /* la riga che aggiunge chiude l'elenco: sotto non serve un tratto */
  .row.is-flat.is-dashed::after { content: none; }

  .row.is-flat.is-dashed:focus-within { border: 0; box-shadow: none; }
</style>

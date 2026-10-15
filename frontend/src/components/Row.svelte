<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * La riga-card: `lead` il segno a sinistra, `children` il nome che si allarga,
   * `trail` i comandi a destra, `under` quello che sta sotto.
   */
  let {
    lead,
    children,
    trail,
    under,
    active = false,
    dashed = false,
    flat = false,
    top = false,
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
    /** Piatta, dentro una card: solo il tratto sottile che la separa dalla prossima. */
    flat?: boolean;
    /** Il segno e i comandi in cima, alla prima riga: sotto il nome c'è del testo, su più righe. */
    top?: boolean;
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
  class:is-top={top}
  {...rest}
>
  <div class="line" class:is-top={top}>
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
    border-radius: var(--r-in);
    background: var(--sunken);
    box-shadow: inset 0 0 0 1px var(--hairline-soft);
    transition: background 0.16s, box-shadow 0.16s, border-color 0.16s;
  }

  @media (hover: hover) {
  .row:hover { background: var(--sunken-hover); }
}

  /* con delle righe sotto è una card, e respira un po' di più */
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
    /* il pixel del bordo tolto al padding: i comandi restano nelle colonne delle righe piene */
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

  /* niente spazio fra i pezzi: ognuno si porta il proprio, e le colonne si allineano */
  .line {
    display: flex;
    align-items: center;
    gap: 0;
  }

  .line.is-top { align-items: flex-start; }

  .lead {
    display: grid;
    place-items: center;
    flex: none;
  }

  .trail {
    display: flex;
    align-items: center;
    /* due tasti-icona vicini non si toccano: col dito si prende quello giusto */
    gap: 6px;
    /* né toccano il testo accanto, che va a capo prima */
    margin-left: 10px;
  }

  /* la luce della pressione esce di 10px dal testo, che resta allineato alla card */
  .row.is-flat,
  .row.is-flat.is-dashed {
    position: relative;
    margin: 0 -10px;
    padding: 4px 10px;
    border: 0;
    /* la pressione si accende con gli angoli tondi, mai a spigolo vivo */
    border-radius: var(--r-flat);
    background: transparent;
    box-shadow: none;
  }

  /* il tratto fra una riga e l'altra sta a parte, dritto, sotto gli angoli tondi */
  .row.is-flat::after {
    content: "";
    position: absolute;
    left: 10px;
    right: 10px;
    bottom: 0;
    height: 1px;
    background: var(--hairline-soft);
  }

  /* niente tratto sotto l'ultima riga, se l'elenco chiude la card */
  :global(ul.rows:last-child > li:last-child) > .row.is-flat::after { content: none; }

  /* ai bordi della card la luce della pressione esce anche in alto e in basso, come ai lati */
  :global(ul.rows:first-child > li:first-child) > .row.is-flat { margin-top: -10px; }

  :global(ul.rows:last-child > li:last-child) > .row.is-flat { margin-bottom: -10px; }

  @media (hover: hover) {
  .row.is-flat:hover { background: transparent; }
}

  .row.is-flat:active { background: var(--sunken); }

  /* coi comandi in cima, sopra e sotto lo stesso spazio che di lato: dal bordo della card stanno a pari distanza */
  .row.is-flat.is-top { padding: 10px; }

  /* la riga che aggiunge chiude l'elenco: sotto non serve un tratto */
  .row.is-flat.is-dashed::after { content: none; }

  .row.is-flat.is-dashed:focus-within { border: 0; box-shadow: none; }
</style>

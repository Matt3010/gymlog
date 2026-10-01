<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * Una scheda nella colonna di una pagina di servizio.
   *
   * Il riquadro di vetro con il bordo sottile: è lo stesso in ogni pagina, e
   * scritto una volta sola non può più venire di due grigi diversi a seconda
   * di dove guardi. Le pagine che hanno bisogno di un'altra scheda — quella
   * tratteggiata del «creane un altro» — se la disegnano da sé: è un'altra
   * cosa, e fingere che sia la stessa costerebbe più di quanto risparmia.
   */
  let {
    wide = false,
    dashed = false,
    bare = false,
    children,
  }: {
    /**
     * Attraverso tutte le colonne invece che dentro una.
     *
     * Una tabella è fatta di righe che si leggono per intero: in trecento
     * pixel ogni riga va a capo due volte e le colonne non si incolonnano
     * più — tanto vale un elenco. Chi ha bisogno di larghezza la chiede.
     */
    wide?: boolean;
    /**
     * Tratteggiata invece che piena.
     *
     * È il vestito di quello che non è ancora niente — il campo per creare
     * un altro agente, un'altra mappa — e di quello che sta di contorno:
     * una nota, un elenco di cose altrui. Il tratteggio dice «qui non c'è
     * una cosa tua, c'è un posto per farla».
     */
    dashed?: boolean;
    /**
     * Senza vestito: il posto nella colonna e basta.
     *
     * La scheda di un agente, di una scena, di una mappa ha già il suo
     * riquadro, e un bordo intorno a un bordo è una cornice alla cornice. Il
     * resto — non spezzarsi fra due colonne, lo spazio sotto, la griglia —
     * è lo stesso, e ogni pagina lo riscriveva per conto suo.
     */
    bare?: boolean;
    children: Snippet;
  } = $props();
</script>

<section class="card" class:wide class:dashed class:bare>
  {@render children()}
</section>

<style>
  .card {
    /* non si spezza fra due colonne: si sposta intera */
    break-inside: avoid;
    display: grid;
    /* In riga le schede prendono tutte l'altezza della più alta, ed è giusto
       cosi': il bordo di sotto dev'essere uno solo. Ma quell'altezza in più
       è della scheda, non delle righe che ha dentro — senza questo lo spazio
       che avanza si infilava fra un rigo e l'altro, e una levetta finiva a
       mezz'aria fra la sua etichetta e la sua spiegazione. */
    align-content: start;
    gap: 10px;
    min-width: 0;
    /* lo spazio sotto è suo, non della colonna */
    margin: 0 0 14px;
    padding: var(--card-pad);
    border: 1px solid var(--hairline);
    border-radius: var(--r-lg);
    background: var(--glass-strong);
  }

  /* attraverso tutte le colonne, in tutti e due i modi di disporle */
  .card.wide {
    column-span: all;
    grid-column: 1 / -1;
  }

  .card.bare {
    padding: 0;
    border: 0;
    border-radius: 0;
    background: none;
  }

  .card.dashed {
    padding: 14px;
    border-style: dashed;
    border-radius: var(--r-md);
    background: none;
  }
</style>

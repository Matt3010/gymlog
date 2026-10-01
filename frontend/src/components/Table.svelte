<script lang="ts" generics="T extends { id: string }">
  import type { Snippet } from 'svelte';
  import type { Column } from '../lib/table';
  import type { Vista } from '../lib/vista.svelte';
  import Icon from './Icon.svelte';

  /**
   * Una tabella di righe corte.
   *
   * Quando le cose da mostrare sono tante e ognuna dice poco — un'ora, un
   * nome, tre parole — le schede sono il modo sbagliato: fanno occupare mezza
   * pagina a cinque righe di testo, e per confrontarle bisogna leggerle una
   * per una. In colonna invece l'occhio scende dritto e i dati si incolonnano
   * da soli.
   *
   * Chi la usa passa le colonne e disegna le celle: la tabella tiene
   * l'intestazione, le larghezze e il colpo d'occhio, e non sa cosa c'è
   * dentro. Una cella allineata a destra si scrive `<td class="end">`.
   */
  let {
    columns,
    rows,
    row,
    empty,
    foot,
    label,
    vista,
    inRiga = false,
  }: {
    columns: Column[];
    rows: T[];
    /** Le celle di una riga: `<td>` e basta. */
    row: Snippet<[T]>;
    /** Cosa si legge quando non c'è niente. Il vuoto è una risposta. */
    empty?: Snippet;
    /**
     * Sotto l'ultima riga: di solito le frecce.
     *
     * La tabella non pagina da sé apposta. Un elenco corto sta in memoria e
     * uno lungo arriva dal server un pezzo per volta, e una tabella che
     * decidesse lei quale dei due è obbligherebbe il secondo a scaricare
     * tutto per mostrarne otto.
     */
    foot?: Snippet;
    /** Come si chiama questa tabella, per chi non la vede. */
    label?: string;
    /**
     * In che ordine stanno le righe, e con cosa si cambia.
     *
     * La tabella non mette in fila niente da sé, come non pagina da sé: le
     * righe arrivano già in ordine. Qui tocca l'intestazione e dice alla
     * vista cosa è stato scelto, e chi ha le righe le rimette in fila — in
     * memoria, o chiedendole di nuovo al server.
     */
    vista?: Vista<T>;
    /**
     * In righe anche sul telefono, con l'intestazione una volta sola.
     *
     * Per le tabelle di numeri corti — le sessioni di un esercizio, sette
     * colonne di due o tre cifre — che in 358px ci stanno: impilate, ogni
     * riga diventava sette righe col nome davanti, e la pagina non finiva più.
     */
    inRiga?: boolean;
  } = $props();

  /** Il verso di una colonna, per chi legge lo schermo ad alta voce. */
  const versoDi = (column: Column): 'ascending' | 'descending' | undefined =>
    vista && column.ordina === vista.ordine
      ? vista.verso === 'asc'
        ? 'ascending'
        : 'descending'
      : undefined;

  /*
   * Il nome della colonna scritto su ogni cella, per il telefono.
   *
   * Lì la tabella non scorre di lato: cinque colonne non stanno in 390
   * pixel, e quella che finiva fuori era proprio la frase che si voleva
   * leggere. Ogni riga diventa un blocco, una cella sotto l'altra, e davanti
   * a ogni cella si legge di quale colonna è. Le celle le disegna chi usa la
   * tabella, quindi il nome lo mette qui chi conosce le colonne.
   */
  function etichette(corpo: HTMLTableSectionElement): void {
    $effect(() => {
      void rows;
      const nomi = columns.map((column) => column.label);
      for (const riga of corpo.rows) {
        [...riga.cells].forEach((cella, at) => (cella.dataset.colonna = nomi[at] ?? ''));
      }
    });
  }
</script>

{#if rows.length}
  <!-- Le colonne non si tolgono quando lo schermo è stretto: quella che
       sparisce è sempre quella che a qualcuno serviva. Su uno schermo medio
       scorre di lato; su un telefono ogni riga si mette in colonna, con il
       nome davanti a ogni cella (vedi `etichette`). -->
  <div class="scorre" class:in-riga={inRiga}>
    <table aria-label={label}>
      <colgroup>
        {#each columns as column, at (at)}
          <!-- `1%` non è una larghezza: è il modo di dire a una tabella di
               stringere quella colonna a quello che c'è dentro -->
          <col style={column.width ? `width: ${column.width === 'fit' ? '1%' : column.width}` : undefined} />
        {/each}
      </colgroup>

      <thead>
        <tr>
          {#each columns as column, at (at)}
            <th
              scope="col"
              class:end={column.align === 'end'}
              class:fit={column.width === 'fit'}
              class:is-vuota={!column.label}
              aria-sort={versoDi(column)}
            >
              {#if vista && column.ordina}
                <button
                  type="button"
                  class="ordina"
                  class:is-on={column.ordina === vista.ordine}
                  onclick={() => vista.ordina(column.ordina as string)}
                >
                  {column.label}
                  <!-- la freccia c'è solo sulla colonna scelta: sulle altre
                       direbbe un verso che non stanno seguendo -->
                  {#if column.ordina === vista.ordine}
                    <Icon name={vista.verso === 'asc' ? 'sortAsc' : 'sortDesc'} />
                  {/if}
                </button>
              {:else}
                {column.label}
              {/if}
            </th>
          {/each}
        </tr>
      </thead>

      <tbody use:etichette>
        {#each rows as one (one.id)}
          <tr>{@render row(one)}</tr>
        {/each}
      </tbody>
    </table>
  </div>

  <!-- le frecce restano ferme: scorrono le righe, non i comandi -->
  {@render foot?.()}
{:else if empty}
  {@render empty()}
{/if}

<style>
  /* La finestra da cui si guarda: quello che non ci sta si raggiunge
     scorrendo, invece di restare tagliato dal bordo della scheda. */
  .scorre {
    overflow-x: auto;
    /* lo slancio del dito, come in ogni altra cosa che scorre sul telefono */
    -webkit-overflow-scrolling: touch;
    /* la riga si ferma dove finisce una colonna, non a metà di una parola */
    scroll-snap-type: x proximity;
    /* il filo sotto le celle arriva fino in fondo anche quando si scorre */
    padding-bottom: 1px;
  }

  /* su un telefono la barra ruba due righe di tabella: si vede mentre scorri
     e poi se ne va, come fa il sistema da solo */
  .scorre::-webkit-scrollbar { height: 4px; }

  .scorre::-webkit-scrollbar-thumb {
    border-radius: 99px;
    background: color-mix(in srgb, var(--ink-3) 40%, transparent);
  }

  table {
    width: 100%;
    border-collapse: separate;
    /* le righe si toccano: la linea la mette la cella, non il bordo */
    border-spacing: 0;
    font-size: 12px;
    /* le cifre stanno in colonna anche quando cambiano */
    font-variant-numeric: tabular-nums;
  }

  /* l'intestazione e' un'etichetta, non una riga: piccola, in alto, e separata
     da quello che c'e' sotto da una linea sola */
  th {
    padding: 0 10px 9px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-align: left;
    color: var(--ink-3);
    white-space: nowrap;
    border-bottom: 1px solid var(--hairline);
  }

  tbody :global(td) {
    padding: 10px;
    /* Una riga sta su una riga. Da quando la tabella scorre, mandare a capo
       non fa stare niente in più: stringe la colonna libera e spezza «ha
       smesso di rispondere» su cinque righe, alzando la riga di quattro. */
    white-space: nowrap;
    border-bottom: 1px solid var(--hairline-soft);
    color: var(--ink-2);
    line-height: 1.35;
    vertical-align: middle;
  }

  /* l'ultima riga non ha niente sotto da separare: la linea la' sembrerebbe
     l'inizio di un'altra tabella */
  tbody tr:last-child :global(td) { border-bottom: 0; }

  /* le celle ai bordi si allineano al filo della scheda: una tabella che
     rientra di dieci pixel sembra appoggiata sopra invece che dentro */
  th:first-child,
  tbody :global(td:first-child) { padding-left: 2px; }

  th:last-child,
  tbody :global(td:last-child) { padding-right: 2px; }

  tbody tr :global(td) { transition: background 0.14s; }

  @media (hover: hover) {
  /* Una fascia dritta, senza angoli tondi. La linea che separa le righe sta
       sulle stesse celle, e con gli angoli tondi si piegava anche lei ai due
       capi, come un nastro invece che un filo. */
    tbody tr:hover :global(td) { background: var(--sunken); }
}

  th.end,
  tbody :global(td.end) { text-align: right; }

  /* una colonna stretta al contenuto non deve mandare a capo: sarebbe
     stringerla fino alla parola più lunga e poi spezzare le altre */
  th.fit,
  tbody :global(td.fit) { white-space: nowrap; }

  /* L'intestazione che si tocca resta un'intestazione: stesse lettere
     maiuscole e smorte delle altre, e solo quella scelta si accende. Un
     tasto vestito da tasto in cima a ogni colonna farebbe della testata
     una fila di comandi. */
  .ordina {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    letter-spacing: inherit;
    text-transform: inherit;
    color: inherit;
    cursor: pointer;
    transition: color 0.14s;
  }

  @media (hover: hover) {
  .ordina:hover,
    .ordina.is-on { color: var(--ink); }
}

  .ordina :global(.ico) { width: 12px; height: 12px; }

  th.end .ordina { flex-direction: row-reverse; }

  /*
   * Sul telefono niente scorre di lato: ogni riga è un blocco e le celle
   * vanno una sotto l'altra, col nome della colonna davanti. L'intestazione
   * resta, in fila e senza le celle vuote, perché è lei che mette in ordine.
   * Scritto dopo le regole di sopra, che a parità di peso vincerebbero.
   */
  @media (max-width: 600px) {
    .scorre:not(.in-riga) { overflow-x: visible; scroll-snap-type: none; }

    .scorre:not(.in-riga) table,
    .scorre:not(.in-riga) thead,
    .scorre:not(.in-riga) tbody,
    .scorre:not(.in-riga) table,
    .scorre:not(.in-riga) thead,
    .scorre:not(.in-riga) tbody,
    .scorre:not(.in-riga) tr { display: block; }

    .scorre:not(.in-riga) colgroup { display: none; }

    .scorre:not(.in-riga) thead tr {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 14px;
      padding-bottom: 9px;
      border-bottom: 1px solid var(--hairline);
    }

    .scorre:not(.in-riga) th { display: block; padding: 0; border: 0; }

    .scorre:not(.in-riga) th.is-vuota { display: none; }

    .scorre:not(.in-riga) tbody tr { padding: 8px 0; border-bottom: 1px solid var(--hairline-soft); }

    .scorre:not(.in-riga) tbody tr:last-child { border-bottom: 0; }

    .scorre:not(.in-riga) tbody :global(td),
    .scorre:not(.in-riga) tbody :global(td:first-child),
    .scorre:not(.in-riga) tbody :global(td),
    .scorre:not(.in-riga) tbody :global(td:first-child),
    .scorre:not(.in-riga) tbody :global(td:last-child) {
      /* il nome sta nel rientro a sinistra, e la cella è alta almeno quanto
         lui anche quando va a capo («Ti avviso quando») */
      display: flow-root;
      padding: 2px 0 2px 86px;
      border: 0;
      text-align: left;
      /* a capo, anche in mezzo a una parola che non ci sta */
      white-space: normal;
      overflow-wrap: anywhere;
    }

    .scorre:not(.in-riga) tbody :global(td)::before {
      content: attr(data-colonna);
      float: left;
      width: 78px;
      margin: 2px 0 0 -86px;
      line-height: 1.3;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--ink-3);
    }

    /* la cella senza nome è quella dei tasti: sta a filo, senza rientro */
    .scorre:not(.in-riga) tbody :global(td[data-colonna=''])::before { content: none; }

    .scorre:not(.in-riga) tbody :global(td[data-colonna='']) { padding-left: 0; }

    .scorre:not(.in-riga) tbody tr:hover :global(td) { background: none; }

    /* in righe: piccola e fitta, i numeri a destra, nessuno scorrimento */
    .scorre.in-riga table { font-size: 12px; }

    .scorre.in-riga :global(td),
    .scorre.in-riga th { padding: 8px 4px; white-space: nowrap; }

    .scorre.in-riga :global(td:first-child),
    .scorre.in-riga th:first-child { padding-left: 0; }

    .scorre.in-riga :global(td:last-child),
    .scorre.in-riga th:last-child { padding-right: 0; }
  }

  /* dove si tocca, l'intestazione è alta quanto un dito senza spostare la
     riga: lo spazio si aggiunge dentro e si toglie fuori */
  @media (hover: none) {
    .ordina { padding: 12px 0; margin: -12px 0; }
  }
</style>

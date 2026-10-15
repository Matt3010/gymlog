<script lang="ts" generics="T extends { id: string }">
  import type { Snippet } from 'svelte';
  import type { Column } from '../lib/table';
  import type { Vista } from '../lib/vista.svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import Button from './Button.svelte';
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
    striped = false,
    fitta = false,
    figli,
    nomeFigli = 'righe',
  }: {
    columns: Column[];
    rows: T[];
    /** Le celle di una riga: `<td>` e basta. */
    /**
     * Con `figli`, il secondo argomento è il chevron della riga (o il pallino di una riga sotto): la riga lo mette
     * in testa alla sua prima cella. Una riga senza righe sotto non ne ha, e non lascia spazio.
     */
    row: Snippet<[T, Snippet | undefined]>;
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
    /** Una riga sì e una no ombreggiata: in una tabella larga l'occhio segue la riga fino in fondo. */
    striped?: boolean;
    /** Le celle strette: tante colonne di poche cifre che su un telefono stanno senza scorrere. */
    fitta?: boolean;
    /**
     * Le righe che stanno sotto una riga, in ordine: con un chevron in testa alla sua prima cella la riga si apre su
     * di loro, disegnate con le stesse celle e unite da una linea con un pallino ciascuna, come una cronologia.
     * Chiusa, la riga mostra l'ultima di loro: com'è andata a finire.
     */
    figli?: (row: T) => T[];
    /** Come si chiamano, per il tasto che le apre: «Mostra 2 riprogrammati». */
    nomeFigli?: string;
  } = $props();

  /** Le righe chiuse, per id: aperte da sole, la loro cronologia è quello che c'è da vedere; chiuse restano chiuse cambiando pagina o ordine. */
  const chiuse = new SvelteSet<string>();
  function apri(id: string): void {
    if (chiuse.has(id)) chiuse.delete(id);
    else chiuse.add(id);
  }

  /** Il verso di una colonna, per chi legge lo schermo ad alta voce. */
  const versoDi = (column: Column): 'ascending' | 'descending' | undefined =>
    vista && column.ordina === vista.ordine
      ? vista.verso === 'asc'
        ? 'ascending'
        : 'descending'
      : undefined;

</script>

<!-- nella riga sotto, al posto del chevron: largo quanto lui, così il pallino sta sotto di lui -->
{#snippet pallino()}<span class="pallino" aria-hidden="true"></span>{/snippet}

{#if rows.length}
  <!-- Le colonne non si tolgono quando lo schermo è stretto: quella che
       sparisce è sempre quella che a qualcuno serviva. Una riga resta una riga
       anche sul telefono, e la tabella scorre di lato. -->
  <div class="scorre" class:is-fitta={fitta}>
    <table aria-label={label} class:is-striped={striped}>
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
                    <Icon name={vista.verso === 'asc' ? 'sortAsc' : 'sortDesc'} size="sm" />
                  {/if}
                </button>
              {:else}
                {column.label}
              {/if}
            </th>
          {/each}
        </tr>
      </thead>

      <tbody>
        {#each rows as one, pos (one.id)}
          {@const sotto = figli?.(one) ?? []}
          {@const aperta = sotto.length > 0 && !chiuse.has(one.id)}
          <!-- a righe alterne conta la riga con le sue: aperta, le sue righe hanno la sua fascia -->
          {#snippet chevron()}
            <Button
              look="icon"
              aria-expanded={aperta}
              aria-label="{aperta ? 'Nascondi' : 'Mostra'} {sotto.length} {nomeFigli}"
              title="{aperta ? 'Nascondi' : 'Mostra'} {sotto.length} {nomeFigli}"
              onclick={() => apri(one.id)}
            >
              <Icon name={aperta ? 'expand' : 'next'} />
            </Button>
          {/snippet}
          <tr class:is-even={pos % 2 === 1} class:is-open={aperta}>
            {@render row(aperta || sotto.length === 0 ? one : sotto.at(-1)!, sotto.length > 0 ? chevron : undefined)}
          </tr>
          {#if aperta}
            {#each sotto as figlio, at (figlio.id)}
              <tr class="is-sub" class:is-even={pos % 2 === 1} class:is-last={at === sotto.length - 1}>
                {@render row(figlio, pallino)}
              </tr>
            {/each}
          {/if}
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

  /* La tabella si appoggia ai bordi della scheda, su ogni schermo: esce di
     tutto il suo margine interno, e le celle ai bordi rientrano di altrettanto
     (più due pixel), così la fascia e il filo arrivano al bordo e il testo
     resta allineato al titolo e al resto della scheda. */
  .scorre { margin: 0 calc(-1 * var(--card-pad)); }

  /* l'ultima cosa della scheda (niente frecce sotto): a filo anche in fondo, con l'angolo della scheda
     meno il suo bordo, così una riga ombreggiata non esce dalla curva */
  .scorre:last-child {
    margin-bottom: calc(-1 * var(--card-pad));
    /* l'ultima riga non ha filo da mostrare: il pixel sotto sarebbe una riga di sfondo sotto quella ombreggiata */
    padding-bottom: 0;
    border-radius: 0 0 calc(var(--r-lg) - 1px) calc(var(--r-lg) - 1px);
  }

  /* in fondo alla scheda i tasti dell'ultima riga stanno a 13px dal bordo anche sotto: l'angolo segue il suo */
  .scorre:last-child tbody tr:last-child :global(td) { padding-bottom: var(--card-pad); }

  th:first-child,
  tbody :global(td:first-child) { padding-left: calc(var(--card-pad) + 2px); }

  th:last-child,
  tbody :global(td:last-child) { padding-right: var(--card-pad); }

  tbody tr :global(td) { transition: background 0.14s; }

  /* a righe alterne la riga la dice lo sfondo: la linea sotto non serve più */
  .is-striped tbody tr.is-even :global(td) { background: var(--sunken); }

  /* La cronologia di una riga aperta: dal suo chevron una linea scende di riga in riga, con un pallino per ognuna,
     e si ferma sull'ultima. Il chevron e il pallino sono in testa alla prima cella: la linea passa per il loro centro. */
  tbody tr.is-open :global(td:first-child),
  tbody tr.is-sub :global(td:first-child) { position: relative; }

  tbody tr.is-open :global(td:first-child)::after,
  tbody tr.is-sub :global(td:first-child)::before {
    content: '';
    position: absolute;
    left: calc(var(--card-pad) + 2px + 15px);
    width: 1.5px;
    margin-left: -0.75px;
    background: var(--hairline);
    pointer-events: none;
  }

  /* sotto il chevron, fino in fondo alla riga */
  tbody tr.is-open :global(td:first-child)::after { top: calc(50% + 15px); bottom: 0; }

  tbody tr.is-sub :global(td:first-child)::before { top: 0; bottom: 0; }

  tbody tr.is-sub.is-last :global(td:first-child)::before { bottom: 50%; }

  /* largo quanto il chevron, con il pallino al centro */
  .pallino {
    position: relative;
    display: inline-flex;
    flex: none;
    width: 30px;
    height: 30px;
  }

  .pallino::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    width: 7px;
    height: 7px;
    margin: -3.5px 0 0 -3.5px;
    border-radius: 50%;
    background: var(--ink-3);
  }

  /* la riga aperta e le sue sono un blocco: niente filo fra loro, solo dopo l'ultima */
  tbody tr.is-open :global(td),
  tbody tr.is-sub:not(.is-last) :global(td) { border-bottom-color: transparent; }

  .is-striped tbody :global(td) { border-bottom-color: transparent; }

  @media (hover: hover) {
    /* sotto il mouse, anche su una riga ombreggiata, si vede */
    .is-striped tbody tr:hover :global(td) { background: var(--sunken-hover); }
  }

  @media (hover: hover) {
  /* Una fascia dritta, da un bordo all'altro della scheda come le righe alterne:
       senza angoli tondi, che su una riga che tocca i bordi non seguono niente. */
    tbody tr:hover :global(td) { background: var(--sunken); }
}

  @media (hover: hover) {
    /* la linea sotto la riga sparisce finché c'è la fascia */
    tbody tr:hover :global(td) { border-bottom-color: transparent; }
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

  th.end .ordina { flex-direction: row-reverse; }


  /* dove si tocca, l'intestazione è alta quanto un dito senza spostare la
     riga: lo spazio si aggiunge dentro e si toglie fuori */
  @media (hover: none) {
    .ordina { padding: 12px 0; margin: -12px 0; }
  }

  /* fitta: fra una colonna e l'altra 8px invece di 20; i bordi restano allineati alla scheda */
  .is-fitta th:not(:first-child):not(:last-child),
  .is-fitta tbody :global(td:not(:first-child):not(:last-child)) { padding-left: 4px; padding-right: 4px; }

  .is-fitta th:first-child,
  .is-fitta tbody :global(td:first-child) { padding-right: 4px; }

  .is-fitta th:last-child,
  .is-fitta tbody :global(td:last-child) { padding-left: 4px; }
</style>

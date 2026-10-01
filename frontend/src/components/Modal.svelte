<script lang="ts">
  import { tick } from 'svelte';
  import { offriIlFondo } from '../lib/fondo.svelte';
  import { ui, type ModalAction, type ModalRequest } from '../lib/ui.svelte';
  import { swipeToClose } from '../lib/swipe';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';

  /**
   * La finestra che si apre davanti a tutto.
   *
   * È un guscio e basta: la testa con il titolo e la chiusura, il corpo, e
   * in fondo i tasti. Dentro non ci sta del contenuto scritto qui — ci sta
   * **un componente**, quello che chi la apre le passa. È il punto di tutto:
   * lo stesso componente può stare dentro a un pannello o dentro a una
   * finestra e non se ne accorge, perché non sa dove sta.
   *
   * Su uno schermo grande si apre di lato, come ha sempre fatto la scheda di
   * un luogo: c'è una mappa dietro, e coprirla tutta per due righe sarebbe
   * togliere il contesto a chi sta lavorando. Su un telefono dietro non c'è
   * niente, e allora prende lo schermo: appoggiata in fondo restava alta
   * quanto quello che aveva dentro, e lasciava sopra di sé mezzo schermo di
   * nero con gli angoli tondi a disegnare una cornice intorno al niente.
   *
   * I tasti in fondo sono i tasti dell'app, non dei suoi: chi la apre dice
   * cosa scrivono e cosa fanno, e il vestito — quale è quello importante,
   * quale porta via qualcosa — lo sceglie con le stesse parole che userebbe
   * ovunque.
   */
  let {
    request,
    davanti = true,
  }: {
    request: ModalRequest;
    /** Sotto a un'altra resta montata e nascosta, con tutto quello che ha dentro. */
    davanti?: boolean;
  } = $props();

  /*
   * I tasti in fondo, che può dettare anche chi sta dentro.
   *
   * Chi apre la finestra ne passa una lista se li conosce già. Ma i tasti di
   * una scheda cambiano con lei — «Elimina» compare solo su un luogo che
   * esiste — e quelli li detta il componente, con un modo di ricavarli che
   * qui si richiama ogni volta che qualcosa dentro si muove.
   */
  let dettati = $state<(() => ModalAction[]) | null>(null);

  /* il guscio si fa conoscere, così chi apre da qui dentro ci si appoggia
     sopra e chiusa quella il fuoco torna qui */
  let guscio = $state<HTMLElement>();
  $effect(() => {
    if (guscio) ui.registra(request, guscio);
  });
  offriIlFondo({
    detta: (azioni) => (dettati = azioni),
    chiudi: () => ui.closeModal(request),
    // chi ci sta dentro dice se ha del lavoro in sospeso, e la crocetta chiede
    modifiche: (quando) => ui.segnaModifiche(request, quando),
  });

  const azioni = $derived(dettati ? dettati() : (request.actions ?? []));
  const inTesta = $derived(azioni.filter((azione) => azione.place === 'head'));
  const inFondo = $derived(azioni.filter((azione) => azione.place !== 'head'));

  /*
   * Il fuoco entra quando si apre.
   *
   * Aperta con Invio, il fuoco restava sul tasto della pagina dietro, e il
   * primo Tab girava fra le cose che la finestra copre. Se chi ci sta
   * dentro l'ha già messo su un suo campo lo si lascia lì, se no va sulla
   * finestra stessa, e da lì Tab comincia dal primo tasto.
   */
  let entrata = false;
  $effect(() => {
    if (!davanti || !guscio || entrata) return;
    entrata = true;
    const qui = guscio;
    void tick().then(() => {
      if (!qui.contains(document.activeElement)) qui.focus({ preventScroll: true });
    });
  });

  /** Quello su cui Tab si ferma, dentro alla finestra e visibile. */
  const TAPPE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  /*
   * E resta dentro finché la finestra è davanti: dall'ultimo tasto Tab torna
   * al primo, e al contrario. Dietro c'è una pagina che la finestra dichiara
   * coperta (`aria-modal`), e il fuoco che ci finisce dentro è un fuoco che
   * non si vede. Un foglietto aperto da qui sta fuori dalla finestra ed è
   * suo, e lì Tab fa il suo giro.
   */
  function trattieni(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !davanti || !guscio) return;
    const attivo = document.activeElement;
    if (attivo instanceof Element && attivo.closest('[data-pop]')) return;

    const tappe = [...guscio.querySelectorAll<HTMLElement>(TAPPE)].filter((one) => one.getClientRects().length > 0);
    const primo = tappe[0];
    const ultimo = tappe.at(-1);
    const fuori = !(attivo instanceof Node) || !guscio.contains(attivo);
    if (!primo || !ultimo) {
      event.preventDefault();
      guscio.focus();
    } else if (event.shiftKey && (fuori || attivo === primo || attivo === guscio)) {
      event.preventDefault();
      ultimo.focus();
    } else if (!event.shiftKey && (fuori || attivo === ultimo)) {
      event.preventDefault();
      primo.focus();
    }
  }

  /** Un tasto che risponde «no» chiude e basta; gli altri lo dicono loro. */
  async function press(at: number, anchor: HTMLElement): Promise<void> {
    const azione = inFondo[at] ?? inTesta[at - inFondo.length];
    if (!azione) return;

    const resta = await azione.onpick(anchor);
    // questa, non quella davanti: mentre si aspettava poteva essersene aperta un'altra
    if (resta !== false) ui.closeModal(request);
  }
</script>

<svelte:window onkeydown={trattieni} />

<!-- `div` e non `aside`: una finestra che copre tutto non è «contenuto a
     lato», e chi legge lo schermo ad alta voce deve sentirsi dire che è
     una finestra, non un margine della pagina -->
<div
  class="surface modal"
  class:is-full={request.intera}
  role="dialog"
  aria-modal="true"
  aria-label={request.title}
  hidden={!davanti}
  tabindex="-1"
  bind:this={guscio}
  use:swipeToClose={() => ui.lascia(request)}
>
  <header>
    <h2>{request.title}</h2>
    <!-- chiudere di qui chiede, se dentro c'è qualcosa di non salvato; la
         domanda si attacca a questo tasto (`data-chiudi`) -->
    {#each inTesta as azione, at (azione.label)}
      <Button
        look="icon"
        tone={azione.tone}
        title={azione.label}
        aria-label={azione.label}
        disabled={azione.disabled}
        extra="head-action"
        onclick={(event: MouseEvent) => void press(inFondo.length + at, event.currentTarget as HTMLElement)}
      >
        <Icon name={azione.icon ?? 'trash'} />
      </Button>
    {/each}
    <Button look="icon" title="Chiudi" data-chiudi onclick={() => ui.lascia(request)}>
      <Icon name="close" />
    </Button>
  </header>

  <!-- quello che c'è dentro: un componente, che non sa di essere qui -->
  <div class="modal-body">
    {#if request.view}
      {@const Vista = request.view}
      <Vista {...request.props ?? {}} />
    {/if}
  </div>

  {#if inFondo.length}
    <div class="modal-foot">
      {#each inFondo as azione, at (azione.label)}
        <Button
          look={azione.look ?? 'ghost'}
          tone={azione.tone}
          disabled={azione.disabled}
          onclick={(event: MouseEvent) => void press(at, event.currentTarget as HTMLElement)}
        >
          {#if azione.icon}<Icon name={azione.icon} />{/if}
          {azione.label}
        </Button>
      {/each}
    </div>
  {/if}
</div>

<style>
  /* Dove sta, quanto è larga e cosa le succede su un telefono lo dice la
     scatola in base.css, che è la stessa della scheda di un luogo. Qui c'è
     solo come è fatta dentro: tre fasce, e quella di mezzo è l'unica che
     scorre. */
  .modal {
    display: flex;
    flex-direction: column;
    gap: 12px;
    /* la scatola la lascia scorrere tutta; qui scorre solo il corpo, se no
       il tasto che conferma se ne va mentre scrivi */
    overflow: hidden;
  }

  /* il fuoco ci torna quando si chiude quella sopra, ma è un posto di
     passaggio e non un campo: nessun anello intorno a tutta la finestra */
  .modal:focus { outline: none; }

  /* quella sotto a un'altra: `display: flex` qui sopra vincerebbe su `hidden` */
  .modal[hidden] {
    display: none;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex: none;
  }

  /* «Elimina» in testa sta accanto alla chiusura, a destra */
  header :global(.head-action) { margin-left: auto; margin-right: -6px; }

  h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 620;
    letter-spacing: -0.015em;
    color: var(--ink);
  }

  .modal-body {
    flex: 1;
    min-height: 0;
    overflow: auto;
    display: grid;
    /* una colonna larga quanto la finestra e non quanto la cosa più larga
       che ci sta dentro: una pastiglia col nome lungo allargava la colonna,
       e la finestra scorreva di lato */
    grid-template-columns: minmax(0, 1fr);
    align-content: start;
    gap: 10px;
    /*
     * Un po' di aria intorno, e ripresa fuori.
     *
     * Quello che scorre taglia quello che sporge, e a sporgere sono le
     * ombre: la riga di una categoria ha la sua, e contro il bordo del
     * corpo si vedeva mozzata di netto su tutti e quattro i lati. Il
     * riempimento le lascia il posto, il margine negativo rimette il
     * contenuto in riga con il titolo qui sopra.
     */
    margin: -6px;
    padding: 6px;
  }

  /* i tasti in fondo, a destra come ovunque nell'app */
  .modal-foot {
    flex: none;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding-top: 12px;
    border-top: 1px solid var(--hairline-soft);
  }

  /*
   * A tutto schermo: nero intorno, e il titolo con la chiusura sopra
   * all'immagine, su una sfumatura. Sopra a un'inquadratura chiara il bianco
   * su bianco non si legge, e una testata piena ruberebbe una fascia
   * all'immagine. Tre classi per vincere sulla scatola di base.css, che su
   * un telefono ne ha due.
   */
  .modal.is-full {
    position: fixed;
    inset: 0;
    z-index: var(--z-sheet);
    width: auto;
    height: 100dvh;
    max-width: none;
    max-height: none;
    gap: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: #000;
    box-shadow: none;
    backdrop-filter: none;
    animation: none;
  }

  /* da installata su iPhone anche lei ha bisogno di `lvh` per arrivare in
     fondo (vedi base.css) */
  @media (display-mode: standalone) {
    .modal.is-full { height: 100lvh; }
  }

  /* la maniglia da trascinare che la scatola mette su un telefono */
  .modal.is-full::before { display: none; }

  .modal.is-full header {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1;
    padding: max(10px, env(safe-area-inset-top)) 12px 18px;
    background: linear-gradient(180deg, rgb(0 0 0 / 0.55), transparent);
  }

  .modal.is-full h2 {
    min-width: 0;
    font-size: 13px;
    font-weight: 600;
    color: #fff;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .modal.is-full header :global(.btn) { color: #fff; }

  .modal.is-full .modal-body {
    display: block;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }

  @media (max-width: 600px) {
    /* in fondo i tasti si allargano, perché un dito non mira e qui sotto non
       c'è nient'altro da premere per sbaglio */
    .modal-foot :global(.btn) { flex: 1; justify-content: center; }

    /* Quello che porta via qualcosa no. Allargato sembrava uno dei due
       grandi, e la sua scritta — «Elimina luogo» — andava a capo. */
    .modal-foot :global(.btn.danger) { flex: none; white-space: nowrap; }
  }
</style>

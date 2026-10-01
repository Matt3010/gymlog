import { tick, type Component } from 'svelte';
import type { IconName } from './icons';
import type { Choice } from './table';

/*
 * Quello che si apre davanti alle pagine: le finestre, una sopra l'altra, e
 * le domande a foglietto attaccate al tasto che le ha fatte nascere.
 *
 * Viene da restaurant-index, dove teneva anche la scheda di un luogo,
 * categorie e gruppi, i segni e i colori: qui resta la macchina, che non
 * sa niente di quello che ci si mette dentro.
 */

/** Scegliere una voce da un elenco corto, accanto al tasto che l'ha chiesto. */
export interface PickRequest {
  anchor: HTMLElement;
  /** Cosa si sta scegliendo: «Ordina per». */
  title: string;
  /**
   * Le voci, già in ordine di come vanno lette. Come funzione quando possono
   * cambiare mentre l'elenco è aperto.
   */
  options: Choice[] | (() => Choice[]);
  /** Quella di adesso, che si segna e non si ripropone come novità. */
  current?: string;
  onPick: (id: string) => void;
}

/**
 * Una domanda attaccata al tasto che l'ha fatta nascere. Di solito prima di
 * una cosa che non torna indietro — e allora il tasto è rosso. Ma a volte è
 * solo un bivio (`tone: 'plain'`): lì il rosso direbbe una cosa falsa, e le
 * due strade vanno avanti entrambe.
 */
export interface SureRequest {
  anchor: HTMLElement;
  /** Cosa succede, detto con il suo nome. */
  title: string;
  /** Cosa si porta dietro: si scrive solo se si porta dietro qualcosa. */
  detail?: string;
  /** Il verbo sul tasto di conferma: "Elimina", "Togli". */
  verb: string;
  onYes: () => void;
  /** Il tasto di sinistra. "Annulla" se non lo dici. */
  no?: string;
  /** Cosa fare scegliendo quello: niente, se non lo dici — e allora si chiude e basta. */
  onNo?: () => void;
  /** Rosso solo quando porta via qualcosa. */
  tone?: 'danger' | 'plain';
  /**
   * Il fuoco sul «no» appena si apre. Serve a chi usa la tastiera, che
   * altrimenti la domanda la vede e non la raggiunge.
   */
  fuoco?: boolean;
}

/**
 * Un tasto in fondo a una finestra.
 *
 * Sono i tasti dell'app: chi apre la finestra dice cosa scrivono e cosa
 * fanno, e sceglie il vestito con le stesse parole che userebbe ovunque —
 * quello importante, quello che porta via qualcosa, quello che annulla.
 */
export interface ModalAction {
  label: string;
  look?: 'primary' | 'ghost' | 'danger' | 'danger-solid' | 'link';
  tone?: 'danger';
  /** Un disegno prima della scritta, per i tasti che si riconoscono da quello. */
  icon?: IconName;
  disabled?: boolean;
  /**
   * In testa, accanto alla chiusura, come icona sola (`label` la dice a chi
   * non vede): è il posto di «Elimina», che porta via la cosa che la
   * finestra mostra. Senza, il tasto sta in fondo.
   */
  place?: 'head';
  /**
   * Cosa fa, e da quale tasto è partita.
   *
   * L'elemento serve a chi deve chiedere conferma: la domanda si apre
   * accanto al tasto che l'ha fatta nascere, e il tasto qui lo disegna la
   * finestra, non chi ha scritto l'azione.
   *
   * Torna `false` per lasciarla aperta — serve quando quello che hai scritto
   * non va bene e la finestra deve dirtelo restando dov'è.
   */
  onpick: (anchor: HTMLElement) => boolean | void | Promise<boolean | void>;
}

/**
 * Una finestra che si apre davanti a tutto.
 *
 * Dentro non ci va del testo: ci va **un componente**, lo stesso che
 * potrebbe stare dentro a una pagina. È il motivo per cui esiste questa
 * forma — il contenuto non sa dove sta, e spostarlo da una parte all'altra
 * non lo tocca.
 */
export interface ModalRequest {
  title: string;
  /** Il componente da mostrare. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  view: Component<any>;
  /** Quello che gli serve per disegnarsi. */
  props?: Record<string, unknown>;
  /** I tasti in fondo. Senza, in fondo non c'è niente. */
  actions?: ModalAction[];
  /**
   * Cosa fare quando si chiude, comunque la si chiuda.
   *
   * Una finestra si chiude dalla crocetta, con Esc, spingendola via col dito
   * o premendo un tasto in fondo. Chi l'ha aperta ha quasi sempre qualcosa da
   * rimettere a posto, e scriverlo su ognuna di quelle quattro strade vuol
   * dire dimenticarsene su una.
   */
  onclose?: () => void;
  /**
   * Se si appoggia sulla finestra davanti invece di prenderne il posto:
   * chiusa questa, si torna a quella con tutto com'era.
   *
   * Di solito non lo dice nessuno, e lo decide `openModal` guardando da dove
   * è partita: da dentro la finestra davanti ci si appoggia sopra, da fuori
   * se ne prende il posto. Lo si scrive solo per cambiare quella scelta.
   */
  sopra?: boolean;
  /** A tutto schermo invece che di lato. */
  intera?: boolean;
}

class Ui {
  sure = $state<SureRequest | null>(null);
  pick = $state<PickRequest | null>(null);
  /**
   * Le finestre aperte, una sopra l'altra, e si vede solo l'ultima.
   *
   * Una finestra aperta da dentro un'altra ci si appoggia sopra, e quella
   * sotto resta montata e nascosta: quando la nuova si chiude si torna a
   * quella di prima con quello che c'era scritto. Sostituendola, il lavoro
   * fatto dentro se ne andava con lei.
   *
   * `raw` perché qui dentro si cercano le richieste per identità, e un
   * elenco vivo le avvolgerebbe in un'altra cosa.
   */
  modals = $state.raw<ModalRequest[]>([]);

  /** Quella davanti, l'unica che si vede. */
  get modal(): ModalRequest | null {
    return this.modals.at(-1) ?? null;
  }

  /** Il guscio di ogni finestra, per sapere cosa ci sta dentro. */
  #gusci = new WeakMap<ModalRequest, HTMLElement>();
  /**
   * Da dove è stata aperta ogni finestra, per tornarci col fuoco quando si
   * chiude. Il tasto e tutto quello che gli sta intorno, fino in cima,
   * presi quando si apre: se alla chiusura il tasto non c'è più si torna al
   * più vicino fra quelli rimasti, invece di perdere il fuoco in fondo alla
   * pagina.
   */
  #origini = new WeakMap<ModalRequest, Element[]>();

  /**
   * Quello che si è aperto sopra a tutto il resto e si chiude con Esc: un
   * elenco da cui scegliere, un menu, un foglietto. L'ultimo della fila è
   * quello davanti.
   *
   * Lo tiene chi lo apre, con uno stato suo, e qui si fa conoscere con
   * `sopra()`. Senza, un Esc con l'elenco aperto passava dritto alla
   * finestra sotto e la chiudeva, perché qui non si sapeva che l'elenco c'era.
   */
  #sopra: (() => void)[] = [];

  /**
   * Si dice che qualcosa si è aperto sopra, con il modo di chiuderlo. Torna
   * la funzione da chiamare quando si chiude per conto suo.
   */
  sopra(chiudi: () => void): () => void {
    this.#sopra.push(chiudi);
    return () => {
      const at = this.#sopra.lastIndexOf(chiudi);
      if (at >= 0) this.#sopra.splice(at, 1);
    };
  }

  /** Lo dice il guscio quando si disegna: `Modal.svelte`. */
  registra(request: ModalRequest, guscio: HTMLElement): void {
    this.#gusci.set(request, guscio);
  }

  /**
   * Chi dentro a ogni finestra sa dire se c'è qualcosa di scritto e non
   * salvato (`modifiche()` in `fondo.svelte.ts`). Basta un sì.
   */
  #modifiche = new WeakMap<ModalRequest, Set<() => boolean>>();

  /**
   * Le finestre di cui si è già detto «butta»: chi ha risposto non deve
   * sentirsi rifare la stessa domanda dal passo dopo — la pagina che cambia,
   * la finestra che se ne va — per le stesse modifiche.
   */
  #lasciate = new WeakSet<ModalRequest>();

  /** Lo dice `Modal.svelte` per conto di chi ci sta dentro. Torna come smettere. */
  segnaModifiche(request: ModalRequest, quando: () => boolean): () => void {
    const tutte = this.#modifiche.get(request) ?? new Set();
    tutte.add(quando);
    this.#modifiche.set(request, tutte);
    return () => tutte.delete(quando);
  }

  /** Se dentro a questa finestra c'è qualcosa di scritto e non salvato. */
  #sporca(request: ModalRequest): boolean {
    if (this.#lasciate.has(request)) return false;
    for (const quando of this.#modifiche.get(request) ?? []) {
      try {
        if (quando()) return true;
      } catch {
        /* un componente a metà dello smontarsi non ha più niente da dire */
      }
    }
    return false;
  }

  /** Se fra tutte quelle aperte ce n'è una con del lavoro in sospeso. */
  get conModifiche(): boolean {
    return this.modals.some((one) => this.#sporca(one));
  }

  /**
   * Prima di buttare quello che si stava scrivendo, si chiede.
   *
   * Torna `false` quando non c'è niente da chiedere, e chi chiama va avanti
   * da sé. Se no apre la domanda accanto alla crocetta della finestra
   * davanti e torna `true`: `poi` parte solo con un «Butta», e le finestre
   * di cui si è risposto non la rifanno.
   */
  chiediPrima(quali: ModalRequest[], poi: () => void): boolean {
    const sporche = quali.filter((one) => this.#sporca(one));
    if (!sporche.length) return false;

    const davanti = this.modal ? this.#gusci.get(this.modal) : undefined;
    const anchor = davanti?.querySelector<HTMLElement>('[data-chiudi]') ?? davanti;
    if (!anchor) return false;

    // si torna a scrivere dove si era
    const era = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.#fuocoPrima = era;
    this.askSure(anchor, {
      title: 'Buttare le modifiche?',
      detail: 'Quello che hai scritto qui non è ancora salvato.',
      verb: 'Butta',
      no: 'Continua a scrivere',
      fuoco: true,
      onYes: () => {
        for (const one of sporche) this.#lasciate.add(one);
        poi();
      },
      onNo: () => era?.focus(),
    });
    this.#domanda = this.sure;
    return true;
  }

  /**
   * Chiude la domanda senza rispondere, che è quello che fa Esc. Quella
   * sulle modifiche rende il fuoco al campo da cui era partita: si era lì a
   * scrivere, e lì si torna.
   */
  lasciaDomanda(): void {
    const torna = this.inDubbio ? this.#fuocoPrima : null;
    this.sure = null;
    torna?.focus();
  }

  /** La domanda su cosa buttare, finché è aperta, e dove era il fuoco prima. */
  #domanda: SureRequest | null = null;
  #fuocoPrima: HTMLElement | null = null;

  /**
   * Se in questo momento si sta chiedendo se buttare le modifiche.
   *
   * Un campo che consegna quello che hai scritto quando lo lasci lo lascia
   * anche per rispondere alla domanda: consegnarlo allora salverebbe proprio
   * quello che stai per buttare. Finché la domanda è aperta aspetta.
   */
  get inDubbio(): boolean {
    return !!this.sure && this.sure === this.#domanda;
  }

  /**
   * Chiude chiedendo, se c'è da chiedere: è la strada di Esc, della crocetta
   * e del dito che spinge via. I tasti in fondo chiudono con `closeModal`,
   * perché lì chi preme ha già detto cosa vuole — salvare, o annullare.
   */
  lascia(which: ModalRequest | undefined = this.modal ?? undefined): void {
    const at = which ? this.modals.indexOf(which) : -1;
    if (at < 0) return;
    if (this.chiediPrima(this.modals.slice(at), () => this.closeModal(which))) return;
    this.closeModal(which);
  }

  /** Il guscio della finestra davanti, per chi deve cercarci dentro. */
  get guscioDavanti(): HTMLElement | undefined {
    return this.modal ? this.#gusci.get(this.modal) : undefined;
  }

  /** Chiede conferma accanto al tasto che l'ha chiesta. */
  askSure(anchor: HTMLElement, question: Omit<SureRequest, 'anchor'>): void {
    this.pick = null;
    this.sure = { anchor, ...question };
  }

  /** Fa scegliere una voce accanto al tasto che l'ha chiesta. */
  askPick(anchor: HTMLElement, question: Omit<PickRequest, 'anchor'>): void {
    this.sure = null;
    this.pick = { anchor, ...question };
  }

  /**
   * Apre una finestra su un componente.
   *
   * Si chiama da dove serve, senza che chi chiama debba tenersi uno stato
   * suo e un `{#if}` da qualche parte: è lo stesso modo in cui si chiede una
   * conferma o si fa scegliere una voce.
   *
   * Con `sopra` si appoggia su quella davanti; senza, prende il posto di
   * tutte, e quelle che se ne vanno hanno le loro cose da rimettere a posto
   * come se le avessi chiuse tu.
   */
  openModal(request: ModalRequest): void {
    /*
     * Da dove parte la si guarda qui, e non la dice chi chiama: chi apre una
     * finestra da un pezzo che sta anche dentro un'altra non sa dove sta, e
     * ogni volta che se n'è dimenticato la finestra nuova ha preso il posto
     * di quella sotto, portandosi via quello che c'era scritto.
     */
    const origine = daDove();
    const sopra = request.sopra ?? (!!origine && !!this.guscioDavanti?.contains(origine));
    if (origine) this.#origini.set(request, risalendo(origine));

    // un foglietto aperto resta attaccato a quello che adesso finisce coperto
    this.#chiudiFoglietti(() => true);

    if (sopra) {
      this.modals = [...this.modals.filter((one) => one !== request), request];
      return;
    }
    // prende il posto di quelle aperte: se una aveva del lavoro in sospeso, si chiede
    const via = this.modals.filter((one) => one !== request);
    // ripresa dopo il «Butta», parte dal tasto della domanda: senza dirlo si
    // appoggerebbe sopra a quella che doveva sostituire
    if (this.chiediPrima(via, () => this.openModal(Object.assign(request, { sopra: false })))) return;
    const prima = via.reverse();
    this.modals = [request];
    for (const chiusa of prima) chiusa.onclose?.();
  }

  /**
   * Chiude quella davanti, o quella che dici e quelle che le stanno sopra.
   *
   * Chi chiude dopo aver aspettato qualcosa dice quale: nel frattempo
   * poteva essersene aperta un'altra, e sarebbe stata lei a sparire. Una
   * finestra già chiusa non chiude niente.
   */
  closeModal(which: ModalRequest | undefined = this.modal ?? undefined): void {
    const at = which ? this.modals.indexOf(which) : -1;
    if (at < 0) return;
    const chiuse = this.modals.slice(at).reverse();
    this.modals = this.modals.slice(0, at);
    for (const chiusa of chiuse) {
      const guscio = this.#gusci.get(chiusa);
      this.#chiudiFoglietti((anchor) => !!guscio?.contains(anchor));
      chiusa.onclose?.();
    }
    if (which) this.#rendiIlFuoco(which);
  }

  /**
   * Il fuoco torna dove si era, quando una finestra si chiude.
   *
   * Sul tasto che l'ha aperta, se c'è ancora e sta nella finestra che torna
   * davanti; se no sulla finestra stessa. Lasciato sul guscio appena
   * smontato, finiva in fondo alla pagina, e con la tastiera si
   * ricominciava da capo.
   */
  #rendiIlFuoco(chiusa: ModalRequest): void {
    const strada = this.#origini.get(chiusa) ?? [];
    const davanti = this.modal;
    void tick().then(() => {
      // nel frattempo se n'è aperta un'altra: il fuoco è suo
      if (this.modal !== davanti) return;
      const guscio = davanti ? this.#gusci.get(davanti) : undefined;
      const vicino = strada.find(
        (one) => one.isConnected && focalizzabile(one) && (!guscio || guscio.contains(one)),
      );
      const torna = vicino ?? guscio;
      if (torna instanceof HTMLElement) torna.focus({ preventScroll: true });
    });
  }

  /** Chiude le domande a foglietto attaccate a un tasto che `via` sceglie. */
  #chiudiFoglietti(via: (anchor: HTMLElement) => boolean): void {
    if (this.sure && via(this.sure.anchor)) this.sure = null;
    if (this.pick && via(this.pick.anchor)) this.pick = null;
  }

  /**
   * Tutto, per chi cambia pagina: sopra a un'altra schermata non c'entra più
   * niente. Anche i foglietti e gli elenchi, che non stanno dentro a nessuna
   * finestra: una conferma rimasta aperta dopo il tasto indietro aveva
   * ancora il suo «Elimina», e premuto eliminava una cosa della pagina di
   * prima.
   */
  closeAll(): void {
    this.#chiudiFoglietti(() => true);
    for (const chiudi of this.#sopra.splice(0).reverse()) chiudi();
    if (this.modals.length) this.closeModal(this.modals[0]);
  }

  /** Esc toglie quello che sta davanti, uno strato alla volta, dal più in alto. */
  escape(): boolean {
    /*
     * Si toglie quello che sta davvero davanti, e l'ordine è quello in cui le
     * cose si sovrappongono sullo schermo: le domande a foglietto stanno
     * sopra a tutto perché nascono da un tasto che è dentro a qualcos'altro.
     */
    // prima l'ultimo aperto sopra a tutto, chiunque sia stato ad aprirlo
    const ultimo = this.#sopra.pop();
    if (ultimo) return ultimo(), true;
    if (this.sure) return this.lasciaDomanda(), true;
    if (this.pick) return (this.pick = null), true;
    if (this.modal) return this.lascia(), true;
    return false;
  }
}

export const ui = new Ui();

/**
 * Da dove è partita l'ultima cosa fatta: un tocco, un clic, un tasto.
 *
 * Serve a `openModal` per sapere se chi apre sta dentro la finestra
 * davanti. Il fuoco da solo non basta, perché un tasto premuto col dito su
 * un telefono non lo prende. E una voce scelta da un foglietto conta come
 * il tasto a cui il foglietto è attaccato: il foglietto sta fuori da tutto,
 * ma la domanda è nata lì.
 */
let tocco: Element | null = null;

function segna(event: Event): void {
  if (!(event.target instanceof Element)) return;
  const foglietto = event.target.closest('[data-pop]') ? (ui.sure ?? ui.pick) : null;
  tocco = foglietto?.anchor ?? event.target;
}

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', segna, true);
  window.addEventListener('keydown', segna, true);

  /*
   * Chiudere la scheda del browser, ricaricare, andare su un altro sito: lì
   * la domanda non si può fare noi, la fa il browser con le sue parole. Si
   * chiede solo se c'è davvero qualcosa di scritto e non salvato.
   */
  window.addEventListener('beforeunload', (event) => {
    if (!ui.conModifiche) return;
    event.preventDefault();
    event.returnValue = '';
  });
}

/** Un elemento e quelli che lo contengono, dal più vicino al più lontano. */
function risalendo(from: Element): Element[] {
  const strada: Element[] = [];
  for (let one: Element | null = from; one; one = one.parentElement) strada.push(one);
  return strada;
}

/** Se il fuoco ci può andare: un tasto, un campo, o chi lo chiede con `tabindex`. */
function focalizzabile(one: Element): boolean {
  return one instanceof HTMLElement && one.tabIndex >= 0 && !one.hasAttribute('disabled') && !one.closest('[hidden]');
}

/** L'ultimo tocco se c'è ancora, se no quello che ha il fuoco. */
function daDove(): Element | null {
  if (tocco?.isConnected) return tocco;
  return typeof document !== 'undefined' ? document.activeElement : null;
}

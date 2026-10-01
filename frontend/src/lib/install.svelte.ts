import { readJSON, writeJSON } from './storage';

/** L'offerta di installazione di Chrome, Edge e Android. Safari non la fa. */
interface OffertaDiInstallazione extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const NO = 'gymlog.installa.no';

/**
 * Se l'app si può installare, e come.
 *
 * In palestra l'app si apre col pollice dalla schermata Home, a tutto
 * schermo e anche senza rete, non cercando una scheda del browser. Su iPhone
 * non esiste un tasto che la installi, si può solo dire dove toccare. Sugli
 * altri browser che la sanno installare il tasto c'è, e lo si offre.
 *
 * Chi ha detto «non ora» non se lo sente ripetere su questo browser.
 */
class Install {
  /** Già installata: da qui non c'è niente da proporre. */
  readonly installata =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true);

  /** iPhone o iPad, anche quando l'iPad dice di essere un Mac. */
  readonly iPhone =
    typeof navigator !== 'undefined' &&
    (/iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

  offerta = $state<OffertaDiInstallazione | null>(null);
  nonOra = $state<boolean>(readJSON(NO, false));

  constructor() {
    if (typeof window === 'undefined') return;
    // il browser la offre una volta sola e presto: va presa al volo, e il
    // suo foglietto automatico si ferma per offrirla quando serve a noi
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.offerta = event as OffertaDiInstallazione;
    });
    window.addEventListener('appinstalled', () => (this.offerta = null));
  }

  /** Si può proporre: non è installata, e c'è un modo di installarla. */
  get possibile(): boolean {
    return !this.installata && (this.iPhone || this.offerta !== null);
  }

  async installa(): Promise<void> {
    const offerta = this.offerta;
    if (!offerta) return;
    await offerta.prompt();
    // si usa una volta: rifiutata o accettata, quella non si ripropone
    this.offerta = null;
  }

  lascia(): void {
    this.nonOra = true;
    writeJSON(NO, true);
  }
}

export const install = new Install();

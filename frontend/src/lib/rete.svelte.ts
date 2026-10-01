/**
 * Se il telefono ha la rete, detto dal browser.
 *
 * Senza rete l'app sembrava viva: si scriveva, si premeva «Segna la serie»,
 * e solo dopo arrivava un errore. Qui si tiene un sì o un no che la pagina
 * mostra finché dura (`SenzaRete.svelte`). Lo dice il browser, con `online`
 * e `offline`, appena il wi-fi o i dati se ne vanno o tornano.
 *
 * (In restaurant-index lo confermava anche il filo aperto verso il server,
 * e sapeva dire quando era il server a non rispondere: gymlog quel filo non
 * ce l'ha, e un server che non risponde lo dice la porta, `Gate`.)
 */
class Rete {
  #collegata = $state(typeof navigator === 'undefined' ? true : navigator.onLine);

  constructor() {
    if (typeof window === 'undefined') return;
    window.addEventListener('offline', () => (this.#collegata = false));
    window.addEventListener('online', () => (this.#collegata = true));
  }

  /** Vero quando la rete del telefono manca. */
  get manca(): boolean {
    return !this.#collegata;
  }
}

export const rete = new Rete();

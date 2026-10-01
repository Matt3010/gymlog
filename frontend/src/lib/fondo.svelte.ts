import { getContext, onDestroy, setContext } from 'svelte';
import type { ModalAction } from './ui.svelte';

/**
 * I tasti in fondo, detti da chi sta dentro.
 *
 * Una finestra ha una fascia in fondo per i tasti, e chi la apre può
 * riempirla al momento. Ma i tasti di una scheda dipendono da com'è messa la
 * scheda in quel momento — «Elimina luogo» c'è solo se quel luogo esiste
 * già, e chi guarda la mappa di qualcun altro non ha né «Salva» né
 * «Annulla», ha «Chiudi» — e chi la apre queste cose non le sa: le sa il
 * componente che ci sta dentro, e le sa mentre cambiano.
 *
 * Quindi non si consegna una lista, si consegna un modo di ricavarla. Il
 * guscio la richiama ogni volta che qualcosa dentro si muove, e i tasti in
 * fondo seguono.
 *
 * L'altra metà del patto è che il contenuto resta capace di stare altrove.
 * Se sopra di lui non c'è nessun guscio con un fondo da riempire, `tasti`
 * risponde di no e il componente se li disegna da sé, dove preferisce. È la
 * ragione per cui una scheda può passare da un pannello a una finestra senza
 * accorgersene.
 */
const CHIAVE = Symbol('tasti in fondo');

interface Fondo {
  detta: (azioni: () => ModalAction[]) => void;
  /** Chiude questa finestra, e non quella che le si è aperta sopra. */
  chiudi: () => void;
  /** Si fa dire se c'è qualcosa di scritto e non salvato; torna come smettere. */
  modifiche: (quando: () => boolean) => () => void;
}

/** Lo apre il guscio, che di cosa ci finirà dentro non sa niente. */
export function offriIlFondo(fondo: Fondo): void {
  setContext(CHIAVE, fondo);
}

/** Torna `false` quando nessuno sopra ha un fondo, e te li disegni tu. */
export function tasti(azioni: () => ModalAction[]): boolean {
  const fondo = getContext<Fondo | undefined>(CHIAVE);
  if (!fondo) return false;

  fondo.detta(azioni);
  return true;
}

/**
 * Come chiudere la finestra in cui si sta.
 *
 * Chi si chiude da sé dopo aver aspettato qualcosa — un salvataggio, una
 * scena sparita — non può chiudere «quella davanti»: nel frattempo gliene
 * può essere comparsa un'altra sopra, e se ne andrebbe lei. Fuori da una
 * finestra non c'è niente da chiudere, e la risposta non fa niente.
 */
export function chiusura(): () => void {
  const fondo = getContext<Fondo | undefined>(CHIAVE);
  return fondo ? fondo.chiudi : () => undefined;
}

/**
 * Dire alla finestra che qui dentro c'è qualcosa di scritto e non salvato.
 *
 * Esc, la crocetta, un cambio di pagina chiudevano la scheda di un luogo con
 * dentro un nome a metà, e quello che avevi scritto se ne andava senza una
 * parola. Chi sa se c'è del lavoro in sospeso è il componente, non il
 * guscio: lo dice con una domanda che la finestra si rifà ogni volta che sta
 * per chiudersi, e se la risposta è sì prima di chiudersi chiede.
 *
 * Ce ne possono essere quante servono — ogni campo di testo dice la sua, e
 * la scheda di un luogo aggiunge le pastiglie — e basta un sì. Fuori da una
 * finestra non c'è niente da chiudere, e non fa niente.
 */
export function modifiche(quando: () => boolean): void {
  const fondo = getContext<Fondo | undefined>(CHIAVE);
  if (!fondo) return;
  onDestroy(fondo.modifiche(quando));
}

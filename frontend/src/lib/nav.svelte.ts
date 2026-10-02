import { canonical, readRoute } from './routing';
import { toast } from './toast.svelte';

/**
 * Dove siamo, e come ci si sposta senza ricaricare.
 *
 * Le pagine sono indirizzi veri — si aprono in un'altra scheda, si tengono
 * fra i preferiti — ma passare dalle schede allo storico non è uscire
 * dall'app: l'indirizzo cambia e la pagina si ridisegna da sé.
 *
 * Nessun router: un oggetto che sa il percorso, e un ascolto solo sui clic.
 * Chi scrive un link scrive un link — `href` e via — e il clic col tasto
 * centrale, con ctrl o cmd, «apri in un'altra scheda» restano del browser.
 *
 * Un messaggio parla della pagina dove è nato. Se sei tu ad andartene — un
 * link, il tasto indietro — se ne va con lei: «Scheda salvata» sopra a un
 * allenamento copriva i suoi tasti e non diceva più niente. Se è la pagina a
 * mandarti altrove dopo quello che hai fatto («Scheda eliminata», poi
 * l'elenco) il messaggio è proprio per la pagina dove arrivi, e resta.
 */
class Nav {
  path = $state(window.location.pathname);

  route = $derived(readRoute(this.path));

  constructor() {
    // un indirizzo scritto in un altro modo si apre lo stesso, ma nella barra ci va quello buono
    const buono = canonical(this.path);
    if (buono !== this.path) {
      // Stryker disable next-line StringLiteral: the second argument is a title browsers ignore
      history.replaceState({}, '', buono);
      this.path = buono;
    }
    // anche il tasto indietro (e la strisciata indietro dell'iPhone) passa da chi deve dire la sua:
    // se trattiene, l'indirizzo torna dov'era; se poi dice di andare, si va
    window.addEventListener('popstate', () => {
      const dove = window.location.pathname;
      if (this.#prima?.(() => this.go(dove))) {
        // Stryker disable next-line StringLiteral: the second argument is a title browsers ignore
        history.pushState({}, '', this.path);
        return;
      }
      toast.hide();
      this.path = dove;
    });
    document.addEventListener('click', (event) => this.#maybe(event));
  }

  /**
   * Chi deve dire la sua prima di lasciare la pagina: una finestra con
   * dentro qualcosa di scritto e non salvato. Torna `true` quando ha chiesto
   * e la pagina resta; `vai` riprende il cammino se la risposta è «butta».
   */
  #prima: ((vai: () => void) => boolean) | undefined;

  custodisci(prima: (vai: () => void) => boolean): void {
    this.#prima = prima;
  }

  /**
   * Va a un indirizzo dell'app senza ricaricare niente. `replace` non lascia
   * un passo indietro; `user` dice che sei tu ad andartene, e il messaggio
   * della pagina che lasci se ne va con lei.
   */
  go(path: string, { replace = false, user = false } = {}): void {
    const dove = canonical(path);
    if (dove === this.path) return;
    if (this.#prima?.(() => this.go(path, { replace, user }))) return;
    if (user) toast.hide();
    // Stryker disable next-line StringLiteral: the second argument is a title browsers ignore
    if (replace) history.replaceState({}, '', dove);
    // Stryker disable next-line StringLiteral: as above
    else history.pushState({}, '', dove);
    this.path = dove;
    // una pagina nuova si legge dall'alto, non da dove stava l'altra
    window.scrollTo({ top: 0 });
  }

  #maybe(event: MouseEvent): void {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    // a click always has a target; plain text has no `closest`
    const link = (event.target as Partial<Element>).closest?.('a');
    if (!link || link.target === '_blank' || link.hasAttribute('download')) return;

    const url = new URL(link.href, window.location.origin);
    if (url.origin !== window.location.origin) return;

    event.preventDefault();
    this.go(url.pathname, { user: true });
  }
}

export const nav = new Nav();

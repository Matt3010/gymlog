/**
 * Appende il nodo al corpo della pagina, fuori da ogni ritaglio.
 *
 * Una scatola col vetro sfocato fa da cornice anche a quello che dentro di
 * lei è `position: fixed`, e se non lascia uscire niente dai bordi lo taglia.
 * Un foglietto aperto dentro una finestra spariva così. Appeso al corpo, sta
 * dove dice il suo conto.
 */
export function portal(node: HTMLElement): { destroy: () => void } {
  document.body.appendChild(node);
  return { destroy: () => node.remove() };
}

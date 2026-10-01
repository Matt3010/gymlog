/**
 * Porta al centro di un elenco che scorre la voce scelta.
 *
 * `scrollIntoView` fa scorrere anche tutto quello che sta intorno all'elenco,
 * fino alla pagina, e dentro una finestra la spostava di lato. Qui scorre
 * l'elenco e basta.
 */
export function centra(list: HTMLElement, selector = '.is-on'): void {
  const on = list.querySelector<HTMLElement>(selector);
  if (!on) return;
  const dentro = on.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop;
  list.scrollTop = dentro - (list.clientHeight - on.offsetHeight) / 2;
}

/**
 * Come azione su un elenco appena aperto. Aspetta un fotogramma, perché un
 * foglietto nasce staccato dalla pagina e prima di esserci appeso non ha
 * misure.
 */
export function alCentro(list: HTMLElement): void {
  requestAnimationFrame(() => centra(list));
}

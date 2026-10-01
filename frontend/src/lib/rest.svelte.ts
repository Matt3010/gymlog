import { RestTimer } from './rest-timer.svelte';

/**
 * Il recupero, uno per tutta l'app: continua se si esce dall'allenamento a
 * guardare una scheda, e la barra «In corso» lo conta da ogni pagina. A zero
 * il telefono vibra, se sa farlo: in tasca o sulla panca non lo si guarda.
 */
export const rest = new RestTimer(() => {
  if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
});

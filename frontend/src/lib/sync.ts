import { session } from './client';
import { Outbox } from './outbox.svelte';
import { toast } from './toast.svelte';

/*
 * La coda delle modifiche dell'app, una sola (lib/outbox). Quello che il
 * server rifiuta si dice con un messaggio; uscendo, la coda di chi esce se
 * ne va con lui.
 */
export const outbox = new Outbox((message) => toast.show(message));

session.whenLeaving(() => outbox.forget());

/**
 * La coda parte da sé: subito, quando la rete torna, e ogni mezzo minuto
 * finché c'è qualcosa che aspetta (la rete può tornare senza che il browser
 * lo dica). Restituisce come fermarla.
 */
export function startSync(): () => void {
  const flush = () => void outbox.flush();
  window.addEventListener('online', flush);
  const ticker = setInterval(() => outbox.pending > 0 && flush(), 30_000);
  flush();
  return () => {
    window.removeEventListener('online', flush);
    clearInterval(ticker);
  };
}

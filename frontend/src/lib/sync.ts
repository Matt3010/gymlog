import { session } from './client';
import { Outbox } from './outbox.svelte';
import { toast } from './toast.svelte';

/*
 * La coda delle modifiche dell'app, una sola (lib/outbox). Quello che il
 * server rifiuta si dice con un messaggio. La coda è di chi è entrato:
 * resta anche uscendo, e parte quando rientra lui.
 */
export const outbox = new Outbox((message) => toast.show(message));

// la coda è di chi è entrato: resta sul telefono anche uscendo, e se entra un altro si butta
session.whenEntering((user) => outbox.claim(user.id));

/**
 * La coda parte da sé: subito, quando la rete torna, e ogni mezzo minuto
 * finché c'è qualcosa che aspetta (la rete può tornare senza che il browser
 * lo dica). Restituisce come fermarla.
 */
export function startSync(): () => void {
  const flush = () => void outbox.flush();
  window.addEventListener('online', flush);
  // il telefono può dire «senza rete» sbagliando: il controllo periodico prova lo stesso
  const ticker = setInterval(() => outbox.pending > 0 && void outbox.flush({ evenOffline: true }), 30_000);
  flush();
  return () => {
    window.removeEventListener('online', flush);
    clearInterval(ticker);
  };
}

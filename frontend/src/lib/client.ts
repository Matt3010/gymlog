import { createClient } from './api';
import { settled } from './autosave.svelte';
import { Session } from './session.svelte';

/*
 * Il client e la sessione dell'app, uno solo per tutti. Quando il server
 * chiude la porta per davvero (il rinnovo rifiutato) la sessione lo sa, e
 * l'app torna alla porta da sé.
 */
export const api = createClient({
  // una lettura aspetta i salvataggi in viaggio: si legge quello che si è appena scritto
  fetch: async (url, init) => {
    if ((init?.method ?? 'GET') === 'GET') await settled();
    return fetch(url, init);
  },
  onSignedOut: () => session.signedOut(),
});

export const session = new Session(api);

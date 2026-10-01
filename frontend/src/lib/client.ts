import { createClient } from './api';
import { Session } from './session.svelte';

/*
 * Il client e la sessione dell'app, uno solo per tutti. Quando il server
 * chiude la porta per davvero (il rinnovo rifiutato) la sessione lo sa, e
 * l'app torna alla porta da sé.
 */
export const api = createClient({
  fetch: (url, init) => fetch(url, init),
  onSignedOut: () => session.signedOut(),
});

export const session = new Session(api);

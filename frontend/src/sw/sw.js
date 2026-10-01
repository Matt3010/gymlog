/*
 * Il service worker di gymlog: l'app si apre anche senza rete.
 *
 * In palestra il segnale va e viene. Il guscio dell'app — la pagina, i
 * bundle, le icone — sta in una copia sul telefono, e si apre da lì quando
 * la rete non c'è. I dati no: ogni chiamata a /api va al server così com'è,
 * perché un allenamento vecchio servito da una copia è peggio di un errore
 * che dice che manca la rete.
 *
 * - i bundle (/assets/, col loro hash nel nome) e il resto del guscio: prima
 *   la copia, perché un file con lo stesso nome non cambia mai
 * - le pagine: prima la rete, per avere l'app più nuova; senza rete la copia
 *   di index.html, che apre qualunque indirizzo dell'app
 * - /api, le richieste che non sono GET e gli altri siti: non le tocca
 *
 * L'elenco del guscio e la versione li scrive la build (src/sw/build.ts, dal
 * plugin in vite.config.ts): a ogni versione nuova la copia si rifà da capo
 * e quelle vecchie si buttano. Il file finisce nella radice del sito, perché
 * un service worker parla solo per le pagine che stanno sotto di lui.
 */

const SHELL = __SHELL__;
const VERSION = __VERSION__;
const CACHE = `gymlog-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name.startsWith('gymlog-') && name !== CACHE).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/index.html')));
  } else if (url.pathname.startsWith('/assets/') || SHELL.includes(url.pathname)) {
    event.respondWith(fromCopy(request));
  }
});

/** La copia se c'è; se no la rete, e quello che arriva si tiene per la prossima volta. */
async function fromCopy(request) {
  const kept = await caches.match(request);
  if (kept) return kept;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

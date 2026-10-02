/**
 * L'app tenuta aperta in sottofondo resta a una versione vecchia finché
 * l'iPhone non la chiude: qui, ogni volta che torna davanti, si chiede se
 * ce n'è una nuova; se il service worker nuovo prende il posto, la si
 * carica andando in sottofondo — mai sotto gli occhi, e senza perdere
 * niente (la coda delle modifiche e il recupero stanno sul telefono).
 * La primissima installazione no: quella pagina è già la nuova.
 */
export function keepUpToDate(sw: ServiceWorkerContainer, page: Document, reload: () => void): void {
  let controlled = sw.controller !== null;
  let fresh = false;
  page.addEventListener('visibilitychange', () => {
    // senza rete il controllo fallisce: si riprova la prossima volta, senza dire niente
    if (page.visibilityState === 'visible') sw.ready.then((registration) => registration.update()).catch(() => undefined);
    else if (fresh) reload();
  });
  sw.addEventListener('controllerchange', () => {
    if (controlled) fresh = true;
    controlled = true;
  });
}

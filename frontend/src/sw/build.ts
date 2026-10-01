/*
 * Quello che la build scrive nel service worker: l'elenco del guscio
 * dell'app e una versione. Il plugin in vite.config.ts legge i file e chiama
 * queste; qui solo i conti, che si provano senza fare una build.
 */

/**
 * Il guscio: la pagina, i bundle e i file pubblici, come indirizzi. Non le
 * mappe dei sorgenti, e non il service worker, che si aggiorna da sé.
 */
export function shellOf(bundle: string[], publicFiles: string[]): string[] {
  const page = bundle.filter((file) => file === 'index.html');
  const built = bundle.filter((file) => file !== 'index.html' && !file.endsWith('.map'));
  const kept = publicFiles.filter((file) => file !== 'sw.js').sort();
  return [...page, ...built, ...kept].map((file) => `/${file}`);
}

/**
 * Una versione che cambia quando cambia qualcosa del guscio (FNV-1a). I
 * bundle hanno già l'hash del contenuto nel nome; per i file pubblici chi
 * chiama passa anche il loro contenuto.
 */
export function versionOf(parts: string[]): string {
  let hash = 0x811c9dc5;
  for (const char of parts.join('\n')) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36).padStart(7, '0');
}

export function renderServiceWorker(template: string, shell: string[], version: string): string {
  if (!template.includes('__SHELL__') || !template.includes('__VERSION__')) throw new Error('sw.js must contain __SHELL__ and __VERSION__');
  return template.replace('__SHELL__', JSON.stringify(shell)).replace('__VERSION__', JSON.stringify(version));
}

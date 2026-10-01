/**
 * Una voce per chiave: la prima, e le altre uguali a lei se ne vanno.
 *
 * Esiste per gli elenchi che non scriviamo noi. I valori di una tenda, i
 * campi di un modulo, le marche di un catalogo arrivano da un agente, e un
 * agente può ripetere una voce. Un `{#each}` con la chiave che si ripete non
 * disegna due volte la stessa cosa: fa cadere la scheda intera, anche in
 * produzione. E due pastiglie uguali che fanno la stessa cosa sono comunque
 * una di troppo, quindi non si cambia la chiave: si tiene la voce una volta.
 */
export function unici<T>(voci: readonly T[] | null | undefined, chiave: (voce: T) => unknown): T[] {
  if (!Array.isArray(voci)) return [];
  const viste = new Set<unknown>();
  return voci.filter((voce) => {
    const quale = chiave(voce);
    if (viste.has(quale)) return false;
    viste.add(quale);
    return true;
  });
}

/**
 * Che giorno è, in un fuso.
 *
 * Viene da restaurant-index, dove le scene partivano nel fuso dell'account e
 * servivano anche i conti per dire «le 19 di giovedì, là»; qui restano quelli
 * che usano `timing.ts` per dire un giorno: oggi, domani, giovedì 25. Senza
 * librerie: `Intl` li sa fare tutti.
 */

/** Il fuso di questo browser. */
export const fusoDelBrowser = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Rome';

/** Che data, che ora e che giorno è, in quel fuso. */
export function oraIn(tz: string, at = new Date()): { date: string; clock: string; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  }).formatToParts(at);
  const bit = (what: Intl.DateTimeFormatPartTypes): string => parts.find((part) => part.type === what)?.value ?? '';
  const ora = bit('hour') === '24' ? '00' : bit('hour');
  return {
    date: `${bit('year')}-${bit('month')}-${bit('day')}`,
    clock: `${ora}:${bit('minute')}`,
    day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(bit('weekday')),
  };
}

/** La data di tanti giorni dopo, scritta come un calendario. */
export function dopoGiorni(date: string, quanti: number): string {
  const [anno, mese, giorno] = date.split('-').map(Number) as [number, number, number];
  const d = new Date(Date.UTC(anno, mese - 1, giorno + quanti));
  return d.toISOString().slice(0, 10);
}

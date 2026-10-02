/* Come si scrivono numeri, pesi, tempi e giorni: in italiano, una volta sola. */

/** Fatti quando servono, non al caricamento: un formato costa poco, e così ogni modo di scrivere si prova. */
const number = (): Intl.NumberFormat => new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 });

/** «62,5 kg»: la virgola, e niente decimali che non dicono niente. */
export const formatKg = (kg: number): string => `${number().format(kg)} kg`;

export const formatNumber = (value: number): string => number().format(value);

/**
 * Un peso scritto da chi si allena: con la virgola o col punto, come viene.
 * Mentre si scrive «22,» vale 22: il separatore in fondo aspetta i decimali,
 * e un numero a metà non è un errore. Quello che non è un numero — due
 * separatori, il separatore da solo, una lettera — o è sotto zero, non è un peso.
 */
export function parseKg(text: string): number | null {
  const clean = text.trim();
  if (!/^\d*[.,]?\d*$/.test(clean) || !/\d/.test(clean)) return null;
  return Number(clean.replace(',', '.').replace(/\.$/, ''));
}

/** «1:30»: il recupero come lo mostra un cronometro. */
export function formatRest(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** Quanto è durato un allenamento: «42 min», «1 h 05 min». */
export function formatDuration(from: string, to: string): string {
  // mai sotto zero: l'orologio del server può essere un po' avanti rispetto a quello del telefono
  const minutes = Math.max(0, Math.floor((Date.parse(to) - Date.parse(from)) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}

const startOfDay = (date: Date): number => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();


/**
 * Il giorno di un allenamento, come si dice a voce: «Oggi», «Ieri», poi
 * «lun 28 set». L'anno solo quando non è questo.
 */
export function formatDay(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days === 0) return 'Oggi';
  if (days === 1) return 'Ieri';
  const year = date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' as const };
  // qualche browser mette la virgola dopo il giorno della settimana («lun, 28 set»): una sola
  return new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short', ...year }).format(date).replace(',', '');
}

export const formatClock = (iso: string): string =>
  new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

/** Senza accenti e senza maiuscole: quello che la ricerca confronta. */
export const normalise = (value: string): string =>
  value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

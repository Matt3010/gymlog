/* Come si scrivono numeri, pesi, tempi e giorni: in italiano, una volta sola. */

const number = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 });

/** «62,5 kg»: la virgola, e niente decimali che non dicono niente. */
export const formatKg = (kg: number): string => `${number.format(kg)} kg`;

export const formatNumber = (value: number): string => number.format(value);

/**
 * Un peso scritto da chi si allena: con la virgola o col punto, come viene.
 * Quello che non è un numero, o è sotto zero, non è un peso.
 */
export function parseKg(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'));
  return text.trim() === '' || !Number.isFinite(value) || value < 0 ? null : value;
}

/** «1:30»: il recupero come lo mostra un cronometro. */
export function formatRest(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** Quanto è durato un allenamento: «42 min», «1 h 05 min». */
export function formatDuration(from: string, to: string): string {
  const minutes = Math.floor((Date.parse(to) - Date.parse(from)) / 60_000);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}

const startOfDay = (date: Date): number => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const weekday = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
const withYear = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Il giorno di un allenamento, come si dice a voce: «Oggi», «Ieri», poi
 * «lun 28 set». L'anno solo quando non è questo.
 */
export function formatDay(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days === 0) return 'Oggi';
  if (days === 1) return 'Ieri';
  return (date.getFullYear() === now.getFullYear() ? weekday : withYear).format(date).replace(/,/g, '');
}

const clock = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' });

export const formatClock = (iso: string): string => clock.format(new Date(iso));

/** Senza accenti e senza maiuscole: quello che la ricerca confronta. */
export const normalise = (value: string): string =>
  value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

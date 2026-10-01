import { dopoGiorni, fusoDelBrowser, oraIn } from './fuso';

/**
 * Le parole del tempo: un giorno, quanto manca, un'attesa.
 *
 * Vengono da restaurant-index, dove dicevano gli orari delle scene; qui
 * restano quelle generiche, che servono a `DateField` e a `StepRail`. Il
 * fuso è quello del telefono: gymlog non ha un fuso per account, e un
 * allenamento è di chi lo fa dove lo fa.
 */

/** I giorni, come si abbreviano parlando. L'indice è quello di `getDay()`. */
export const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'] as const;

const FERIALI = [1, 2, 3, 4, 5];
const FESTIVI = [0, 6];

const uguali = (days: number[], other: number[]): boolean =>
  days.length === other.length && other.every((day) => days.includes(day));

/** I mesi, come si dicono parlando. */
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

/**
 * Una data come la si direbbe: «oggi», «domani», «giovedì 25 settembre».
 *
 * «Oggi» è quello del fuso del telefono.
 */
export function saysDay(iso: string, tz = fusoDelBrowser(), now = new Date()): string {
  const oggi = oraIn(tz, now).date;
  const giorni = Math.round((Date.parse(`${iso}T12:00:00Z`) - Date.parse(`${oggi}T12:00:00Z`)) / 86_400_000);

  if (giorni === 0) return 'oggi';
  if (giorni === 1) return 'domani';
  if (giorni === 2) return 'dopodomani';

  // la data scritta non ha un fuso: letta a mezzogiorno di Greenwich è quella
  const quando = new Date(`${iso}T12:00:00Z`);
  const esteso = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'][quando.getUTCDay()];
  // l'anno si dice solo quando non e' questo: dirlo sempre e' burocrazia
  const anno = iso.slice(0, 4) === oggi.slice(0, 4) ? '' : ` ${quando.getUTCFullYear()}`;
  return `${esteso} ${quando.getUTCDate()} ${MESI[quando.getUTCMonth()]}${anno}`;
}

/**
 * Un giorno detto in poco spazio: «oggi», «domani», «gio 25». Per le righe
 * strette, dove «giovedì 25 settembre» andrebbe a capo.
 */
export function saysShortDay(at: number, tz: string, now = new Date()): string {
  const quando = oraIn(tz, new Date(at));
  const oggi = oraIn(tz, now).date;
  if (quando.date === oggi) return 'oggi';
  if (quando.date === dopoGiorni(oggi, 1)) return 'domani';
  return `${GIORNI[quando.day]} ${Number(quando.date.slice(8, 10))}`;
}

/** Dei giorni della settimana a parole: «ogni giorno», «dal lunedì al venerdì», «lun mer ven». */
export function saysDays(giorni: number[]): string {
  const days = [...giorni].sort();
  if (!days.length || days.length === 7) return 'ogni giorno';
  if (uguali(days, FERIALI)) return 'dal lunedì al venerdì';
  if (uguali(days, FESTIVI)) return 'sabato e domenica';
  return days.map((day) => GIORNI[day]).join(' ');
}

/** Oggi nel fuso del telefono, come lo scrive un calendario: `2026-09-25`. */
export function today(tz = fusoDelBrowser()): string {
  return oraIn(tz).date;
}

/** I prossimi giorni, da oggi, per chi deve sceglierne uno solo. */
export function nextDays(quanti = 30, tz = fusoDelBrowser()): string[] {
  const oggi = today(tz);
  return Array.from({ length: quanti }, (_, at) => dopoGiorni(oggi, at));
}

/**
 * Quanto manca, da leggere mentre passa: «42 s», «4:05», «1 h 20». Corto
 * perché cambia ogni secondo, e una frase che si riscrive sotto gli occhi
 * si legge male.
 */
export function saysLeft(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`;
}

/**
 * Un'attesa detta a parole.
 *
 * Zero non è un'attesa ed è il caso normale, e «insieme» dice quello che
 * succede, mentre «0 secondi» fa contare a chi legge.
 */
export function saysWait(seconds: number | undefined): string {
  const s = Math.round(seconds ?? 0);
  return s > 0 ? `dopo ${durata(s)}` : 'insieme';
}

/**
 * Una durata a parole, per qualunque numero di secondi: «1 ora», «1 ora e
 * 30 minuti», «1 minuto e 30 secondi».
 *
 * Arrotondare a ore diceva «dopo 0 ore» di un minuto e mezzo e «dopo 1
 * ore» di un'ora.
 */
export function durata(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const ore = Math.floor(s / 3600);
  const minuti = Math.floor((s % 3600) / 60);
  const secondi = s % 60;
  const pezzi = [
    ore ? `${ore} ${ore === 1 ? 'ora' : 'ore'}` : '',
    minuti ? `${minuti} ${minuti === 1 ? 'minuto' : 'minuti'}` : '',
    secondi ? `${secondi} ${secondi === 1 ? 'secondo' : 'secondi'}` : '',
  ].filter(Boolean);
  if (pezzi.length < 2) return pezzi[0] ?? '0 secondi';
  return `${pezzi.slice(0, -1).join(', ')} e ${pezzi.at(-1)}`;
}

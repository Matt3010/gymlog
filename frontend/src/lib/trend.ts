/*
 * Meglio o peggio dell'ultima volta. Chili e ripetizioni contano insieme,
 * nel massimale stimato (formula di Epley, la stessa delle statistiche):
 * 9 × 60 batte 10 × 57,5, e contare solo i chili non lo saprebbe dire.
 * Senza peso contano le ripetizioni; a cedimento senza ripetizioni non si
 * confronta.
 */

export interface DoneSet {
  reps: number | null;
  weightKg: number | null;
}

interface Counted {
  reps: number;
  weightKg: number;
}

export type Trend = 'up' | 'down' | 'same';

/** Il massimale stimato di una serie, al centesimo come quello del server. */
export const estimatedMax = ({ reps, weightKg }: Counted): number =>
  reps === 1 ? weightKg : Math.round(weightKg * (1 + reps / 30) * 100) / 100;

/** Una serie contro quella di prima (o due massimali già fatti); niente, se prima non c'era. */
export function trendOf(now: DoneSet | number, before: DoneSet | number | undefined): Trend | undefined {
  if (before === undefined) return undefined;
  const delta = typeof now === 'number' || typeof before === 'number'
    ? (typeof now === 'number' && typeof before === 'number' ? now - before : undefined)
    : setDelta(now, before);
  if (delta === undefined) return undefined;
  return delta > 0 ? 'up' : delta < 0 ? 'down' : 'same';
}

/** Quanto è meglio una serie dell'altra; niente se non si possono confrontare. */
function setDelta(now: DoneSet, before: DoneSet): number | undefined {
  if (now.reps === null || before.reps === null) return undefined;
  // senza peso (o 0 kg) il massimale stimato è sempre zero: contano le ripetizioni;
  // con la zavorra da una parte sola vince il massimale, il peso che manca vale 0
  if (!now.weightKg && !before.weightKg) return now.reps - before.reps;
  return estimatedMax({ reps: now.reps, weightKg: now.weightKg ?? 0 }) - estimatedMax({ reps: before.reps, weightKg: before.weightKg ?? 0 });
}

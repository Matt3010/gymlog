/*
 * Meglio o peggio dell'ultima volta. Chili e ripetizioni contano insieme,
 * nel massimale stimato (formula di Epley, la stessa delle statistiche):
 * 9 × 60 batte 10 × 57,5, e contare solo i chili non lo saprebbe dire.
 */

export interface DoneSet {
  reps: number;
  weightKg: number;
}

export type Trend = 'up' | 'down' | 'same';

/** Il massimale stimato di una serie, al centesimo come quello del server. */
export const estimatedMax = ({ reps, weightKg }: DoneSet): number =>
  reps === 1 ? weightKg : Math.round(weightKg * (1 + reps / 30) * 100) / 100;

/** Una serie contro quella di prima (o due massimali già fatti); niente, se prima non c'era. */
export function trendOf(now: DoneSet | number, before: DoneSet | number | undefined): Trend | undefined {
  if (before === undefined) return undefined;
  // a corpo libero (0 kg) il massimale stimato è sempre zero: contano le ripetizioni
  const bodyweight = typeof now !== 'number' && typeof before !== 'number' && now.weightKg === 0 && before.weightKg === 0;
  const value = (one: DoneSet | number) => (typeof one === 'number' ? one : bodyweight ? one.reps : estimatedMax(one));
  const delta = value(now) - value(before);
  return delta > 0 ? 'up' : delta < 0 ? 'down' : 'same';
}

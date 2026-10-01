/*
 * Il riscaldamento specifico: lo stesso esercizio, a carico crescente e
 * ripetizioni calanti, fino a poco sotto il peso di lavoro. Le percentuali
 * sono quelle più comuni (40% × 8, 60% × 5, 80% × 3): abbastanza per provare
 * il movimento e scaldare, poco per stancarsi prima delle serie vere. Da
 * 100 kg in su un singolo al 90%, perché vicino a un carico pesante i salti
 * devono essere più piccoli.
 */

export interface WarmupSet {
  reps: number;
  weightKg: number;
}

const STEPS = [
  { share: 0.4, reps: 8 },
  { share: 0.6, reps: 5 },
  { share: 0.8, reps: 3 },
];
const HEAVY = { from: 100, step: { share: 0.9, reps: 1 } };

/** Al 2,5 sotto: quello che dischi e manubri permettono. */
const PLATE = 2.5;

/** Le serie di riscaldamento per arrivare a `working` kg; nessuna senza un peso. */
export function warmupFor(working: number | null): WarmupSet[] {
  if (!working) return [];
  const steps = working >= HEAVY.from ? [...STEPS, HEAVY.step] : STEPS;
  const sets: WarmupSet[] = [];
  for (const { share, reps } of steps) {
    const weightKg = Math.floor((working * share) / PLATE) * PLATE;
    // vuota, o uguale a quella prima: non scalda niente in più
    if (weightKg > 0 && weightKg !== sets.at(-1)?.weightKg) sets.push({ reps, weightKg });
  }
  return sets;
}

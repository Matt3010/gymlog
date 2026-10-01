import { formatKg, formatRest, parseKg } from './format';
import type { DoneSet, PlanExercise, PreviousSets, WorkoutDetail, WorkoutSet, WorkoutSummary } from './types';

/**
 * Un esercizio della pagina di un allenamento: cosa chiede la scheda, le
 * serie fatte oggi e quelle dell'ultima volta.
 */
export interface Block {
  exerciseId: number;
  name: string;
  /** Cosa chiede il giorno della scheda; `null` per un esercizio fuori scheda. */
  target: PlanExercise | null;
  sets: WorkoutSet[];
  previous: PreviousSets | null;
}

/**
 * La pagina di un allenamento, esercizio per esercizio.
 *
 * Prima quelli del giorno della scheda, nel loro ordine, anche senza serie:
 * sono la lista di quello che resta da fare. Poi quelli fatti fuori scheda,
 * nell'ordine in cui sono comparsi, e in fondo quelli appena aggiunti che
 * non hanno ancora una serie. Un esercizio compare una volta sola.
 */
export function blocksOf(detail: WorkoutDetail, added: { id: number; name: string }[] = []): Block[] {
  const blocks = new Map<number, Block>();
  const open = (exerciseId: number, name: string, target: PlanExercise | null) => {
    if (blocks.has(exerciseId)) return;
    blocks.set(exerciseId, { exerciseId, name, target, sets: [], previous: detail.previous[String(exerciseId)] ?? null });
  };

  for (const exercise of detail.plan) open(exercise.exerciseId, exercise.exerciseName, exercise);
  for (const done of detail.sets) {
    open(done.exerciseId, done.exerciseName, null);
    blocks.get(done.exerciseId)!.sets.push(done);
  }
  for (const exercise of added) open(exercise.id, exercise.name, null);
  return [...blocks.values()];
}

/** Le ripetizioni che chiede la scheda, da proporre: il primo numero scritto («8-10» → 8), se c'è. */
export function targetReps(reps: string): number | null {
  const first = /\d+/.exec(reps);
  return first ? Number(first[0]) : null;
}

/**
 * La prossima serie, già scritta. Le ripetizioni sono quelle che la scheda
 * chiede per quella serie, quando dice un numero («8-10» → 8); se no si
 * ripete quella di prima, o si riparte da dove si era arrivati l'ultima
 * volta. Il peso è quello dell'ultima serie, o della prima dell'ultima
 * volta: non si inventa, e la prima volta in assoluto resta da scrivere.
 */
export function prefill(block: Block): { reps: number | null; weightKg: number | null } {
  const last = block.sets.at(-1) ?? block.previous?.sets[0];
  const planned = block.target?.reps[block.sets.length];
  const reps = (planned === undefined ? null : targetReps(planned)) ?? last?.reps ?? null;
  return { reps, weightKg: last?.weightKg ?? null };
}

/** «12 · 10 · 8 · recupero 1:30 · lento»: quello che chiede la scheda, serie per serie. */
export function describeTarget(target: PlanExercise): string {
  return [...target.reps, target.restSeconds ? `recupero ${formatRest(target.restSeconds)}` : '', target.notes ?? '']
    .filter(Boolean)
    .join(' · ');
}


/** L'allenamento ancora aperto più recente, fra quelli dal più recente. */
export const inProgress = (workouts: WorkoutSummary[]): WorkoutSummary | undefined =>
  workouts.find((workout) => workout.finishedAt === null);

/**
 * Una serie come la scrive chi si allena: le ripetizioni intere, i chili con
 * la virgola o col punto. Quello che il server rifiuterebbe si dice qui, con
 * le parole di chi sta scrivendo.
 */
export function readSet(reps: string, kg: string): { reps: number; weightKg: number } | { error: string } {
  const repsValue = /^\d+$/.test(reps.trim()) ? Number(reps.trim()) : NaN;
  if (!(repsValue >= 1 && repsValue <= 100)) return { error: 'Le ripetizioni vanno da 1 a 100.' };
  const weightKg = parseKg(kg);
  if (weightKg === null || weightKg > 1000) return { error: 'Il peso va da 0 a 1000 kg, con la virgola se serve.' };
  if (Math.round(weightKg * 100) / 100 !== weightKg) return { error: 'Il peso ha al più due decimali.' };
  return { reps: repsValue, weightKg };
}

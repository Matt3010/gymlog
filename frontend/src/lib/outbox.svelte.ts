import { ApiError } from './api';
import { workoutsApi } from './endpoints';
import { readJSON, writeJSON } from './storage';
import type { WorkoutDetail } from './types';

/**
 * Le modifiche di un allenamento in attesa di arrivare al server.
 *
 * In palestra la rete va e viene: una serie segnata non può aspettarla. Ogni
 * modifica si mostra subito e si mette in coda, sul telefono; la coda parte
 * in ordine appena si può. Senza rete aspetta (anche se l'app si ricarica);
 * quello che il server rifiuta si toglie, dicendo perché, e il resto va avanti.
 *
 * Una serie segnata senza rete non ha ancora il suo numero: ne prende uno
 * provvisorio (negativo), e quando arriva al server si sa quello vero. Le
 * modifiche dopo — correggerla, toglierla — la seguono lì. Quello che non è
 * ancora partito si ripiega: una serie corretta prima di partire parte già
 * corretta, una tolta prima di partire non parte proprio.
 *
 * Quello che si vede è la copia del server più le modifiche ancora in coda
 * (`applyPending`): niente sparisce e niente compare due volte.
 */
export type Op =
  | { kind: 'addSet'; workoutId: number; setId: number; exerciseName: string; body: { exerciseId: number; reps: number; weightKg: number; key?: string } }
  | { kind: 'updateSet'; workoutId: number; setId: number; body: { reps: number; weightKg: number } }
  | { kind: 'deleteSet'; workoutId: number; setId: number }
  | { kind: 'note'; workoutId: number; exerciseId: number; note: string | null }
  | { kind: 'workout'; workoutId: number; change: { notes?: string | null; finished?: boolean } }
  | { kind: 'deleteWorkout'; workoutId: number };

interface Kept {
  ops: Op[];
  /** Già arrivate, ma la copia del server che le contiene non c'è ancora. */
  sent: Op[];
  /** Numero provvisorio → numero vero, per le serie già arrivate. */
  ids: Record<string, number>;
  /** Il prossimo numero provvisorio. */
  next: number;
}

const KEY = 'gymlog.outbox';

type Synced = (workoutId: number, fresh: WorkoutDetail) => void;

export class Outbox {
  ops = $state<Op[]>([]);
  sent = $state<Op[]>([]);
  #ids: Record<string, number>;
  #next: number;
  #onRejected: (message: string) => void;
  #listeners = new Set<Synced>();
  #running: Promise<void> | null = null;
  /** La prima della coda è in viaggio: non la si ripiega più. */
  #inFlight = false;
  /* cambia a ogni `forget`: un invio partito prima, quando torna, non tocca più niente */
  #era = 0;

  constructor(onRejected: (message: string) => void = () => undefined) {
    const kept = readJSON<Kept>(KEY, { ops: [], sent: [], ids: {}, next: -1 });
    this.ops = kept.ops;
    this.sent = kept.sent ?? [];
    this.#ids = kept.ids;
    this.#next = kept.next;
    this.#onRejected = onRejected;
  }

  /** Quante modifiche aspettano di partire. */
  get pending(): number {
    return this.ops.length;
  }

  /** Un numero per una serie che il server non ha ancora visto. */
  tempId(): number {
    const id = this.#next;
    this.#next -= 1;
    this.#keep();
    return id;
  }

  /**
   * Il nome di una serie per il server: se la risposta si perde per strada e
   * la serie riparte, il server la riconosce e non la segna due volte.
   */
  newKey(): string {
    return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }

  /** Il numero vero di una serie, se è già arrivata; se no quello che si ha. */
  realId(id: number): number {
    return this.#ids[id] ?? id;
  }

  add(op: Op): void {
    // la prima, se è in viaggio, resta com'è: si ripiega solo quello che non è partito
    const from = this.#inFlight ? 1 : 0;
    const waiting = (index: number) => index >= from;
    const ops = [...this.ops];
    const findIndex = (match: (one: Op) => boolean) => ops.findIndex((one, index) => waiting(index) && match(one));
    const removeAll = (match: (one: Op) => boolean) => {
      for (let index = ops.length - 1; index >= from; index -= 1) if (match(ops[index]!)) ops.splice(index, 1);
    };
    const sameSet = (setId: number) => (one: Op) => (one.kind === 'updateSet' || one.kind === 'deleteSet' || one.kind === 'addSet') && one.setId === setId;

    if (op.kind === 'updateSet') {
      const added = findIndex((one) => one.kind === 'addSet' && one.setId === op.setId);
      if (added >= 0) {
        const pending = ops[added] as Extract<Op, { kind: 'addSet' }>;
        ops[added] = { ...pending, body: { ...pending.body, ...op.body } };
        return this.#replace(ops);
      }
      removeAll((one) => one.kind === 'updateSet' && one.setId === op.setId);
    } else if (op.kind === 'deleteSet') {
      const added = findIndex((one) => one.kind === 'addSet' && one.setId === op.setId);
      if (added >= 0) {
        removeAll(sameSet(op.setId));
        return this.#replace(ops);
      }
      removeAll((one) => one.kind === 'updateSet' && one.setId === op.setId);
    } else if (op.kind === 'note') {
      removeAll((one) => one.kind === 'note' && one.workoutId === op.workoutId && one.exerciseId === op.exerciseId);
    } else if (op.kind === 'deleteWorkout') {
      removeAll((one) => one.workoutId === op.workoutId);
    }
    ops.push(op);
    this.#replace(ops);
    void this.flush();
  }

  /**
   * Un allenamento come va mostrato: la copia, con sopra quello che è in
   * coda e quello già partito che la copia non ha ancora.
   */
  shown(detail: WorkoutDetail): WorkoutDetail {
    return applyPending(detail, [...this.sent, ...this.ops], this.#ids);
  }

  /** Chi mostra un allenamento sa quando la sua copia è di nuovo quella vera. */
  onSynced(listener: Synced): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Manda la coda; una sola alla volta, chi chiama mentre va aspetta quella. */
  flush(): Promise<void> {
    this.#running ??= this.#drain().finally(() => (this.#running = null));
    return this.#running;
  }

  /** Uscendo, la coda di chi esce se ne va con lui. */
  forget(): void {
    this.#era += 1;
    this.#running = null;
    this.#inFlight = false;
    this.sent = [];
    this.#replace([]);
    this.#ids = {};
    this.#keep();
  }

  async #drain(): Promise<void> {
    // il telefono dice che la rete non c'è: non si prova nemmeno, si aspetta che torni
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    const era = this.#era;
    const touched = new Set<number>();
    const gone = new Set<number>();
    while (this.ops.length > 0) {
      const op = this.ops[0]!;
      this.#inFlight = true;
      try {
        await this.#send(op);
        if (era !== this.#era) return;
        if (op.kind === 'deleteWorkout') gone.add(op.workoutId);
        else touched.add(op.workoutId);
        this.sent = [...this.sent, op];
      } catch (error) {
        if (era !== this.#era) return;
        // senza risposta: la rete manca, si riprova dopo, nello stesso ordine
        if (error instanceof ApiError && error.status === undefined) break;
        this.#onRejected(`Una modifica non è stata salvata: ${(error as Error).message}`);
      } finally {
        if (era === this.#era) this.#inFlight = false;
      }
      if (era !== this.#era) return;
      this.#replace(this.ops.slice(1));
    }
    this.sent = this.sent.filter((op) => !gone.has(op.workoutId));
    this.#keep();
    for (const workoutId of touched) {
      if (gone.has(workoutId)) continue;
      try {
        const fresh = await workoutsApi.get(workoutId);
        if (era !== this.#era) return;
        // la copia nuova le contiene: non servono più sopra
        this.sent = this.sent.filter((op) => op.workoutId !== workoutId);
        this.#keep();
        for (const listener of this.#listeners) listener(workoutId, fresh);
      } catch {
        /* la copia resta quella che era: la prossima lettura la rifà */
      }
    }
  }

  async #send(op: Op): Promise<void> {
    switch (op.kind) {
      case 'addSet':
        this.#ids[op.setId] = (await workoutsApi.addSet(op.workoutId, op.body)).id;
        this.#keep();
        return;
      case 'updateSet':
        await workoutsApi.updateSet(this.realId(op.setId), op.body);
        return;
      case 'deleteSet':
        await gone(workoutsApi.removeSet(this.realId(op.setId)));
        return;
      case 'note':
        await workoutsApi.saveNote(op.workoutId, op.exerciseId, op.note);
        return;
      case 'workout':
        await workoutsApi.update(op.workoutId, op.change);
        return;
      case 'deleteWorkout':
        await gone(workoutsApi.remove(op.workoutId));
    }
  }

  #replace(ops: Op[]): void {
    this.ops = ops;
    this.#keep();
  }

  #keep(): void {
    writeJSON(KEY, { ops: $state.snapshot(this.ops), sent: $state.snapshot(this.sent), ids: this.#ids, next: this.#next } satisfies Kept);
  }
}

/** Togliere quello che non c'è più è fatto: era già partito, ed è la risposta che si è persa. */
async function gone(removal: Promise<unknown>): Promise<void> {
  try {
    await removal;
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) throw error;
  }
}

/** Un allenamento come sta sul telefono: la copia del server, con sopra le modifiche ancora in coda. */
export function applyPending(detail: WorkoutDetail, ops: Op[], ids: Record<string, number> = {}): WorkoutDetail {
  const shown: WorkoutDetail = { ...detail, sets: [...detail.sets], exerciseNotes: { ...detail.exerciseNotes } };
  const isSet = (id: number, setId: number) => id === setId || id === ids[setId];
  for (const op of ops) {
    if (op.workoutId !== detail.id) continue;
    if (op.kind === 'addSet') {
      // già nella copia col suo numero vero: non due volte
      if (shown.sets.some((one) => one.id === ids[op.setId])) continue;
      shown.sets.push({ id: op.setId, exerciseName: op.exerciseName, createdAt: new Date().toISOString(), ...op.body });
    } else if (op.kind === 'updateSet') {
      shown.sets = shown.sets.map((one) => (isSet(one.id, op.setId) ? { ...one, ...op.body } : one));
    } else if (op.kind === 'deleteSet') {
      shown.sets = shown.sets.filter((one) => !isSet(one.id, op.setId));
    } else if (op.kind === 'note') {
      if (op.note === null || op.note === '') delete shown.exerciseNotes[op.exerciseId];
      else shown.exerciseNotes[op.exerciseId] = op.note;
    } else if (op.kind === 'workout') {
      if (op.change.notes !== undefined) shown.notes = op.change.notes;
      if (op.change.finished !== undefined) shown.finishedAt = op.change.finished ? (shown.finishedAt ?? new Date().toISOString()) : null;
    }
  }
  return shown;
}

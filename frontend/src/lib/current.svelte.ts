import { copies } from './copies';
import { workoutsApi } from './endpoints';
import { inProgress } from './workout';

/** Dove sta, fra le copie del telefono. */
const KEPT = 'in-corso';

/** L'allenamento in corso, come lo mostra la barra sopra le sezioni. */
export interface OpenWorkout {
  id: number;
  title: string;
  startedAt: string;
  sets: number;
}

/**
 * L'allenamento aperto, uno per tutta l'app. Dalle altre pagine lo si chiede
 * al server a ogni cambio di pagina; la pagina dell'allenamento lo tiene
 * aggiornato lei, serie per serie, così la barra non aspetta.
 */
class Current {
  /* sul telefono anche lui, fra le copie: senza rete, riaprendo l'app, la barra c'è ancora */
  workout = $state<OpenWorkout | null>((copies.read(KEPT) as OpenWorkout | null | undefined) ?? null);

  /* quante volte la pagina dell'allenamento l'ha cambiato: una risposta del
     server partita prima di una serie segnata non la cancella */
  #changes = 0;

  /** Dalla pagina dell'allenamento: quello che sa lei è il più fresco. */
  set(workout: OpenWorkout | null): void {
    this.#changes += 1;
    this.#keep(workout);
  }

  #keep(workout: OpenWorkout | null): void {
    this.workout = workout;
    copies.write(KEPT, workout);
  }

  async refresh(): Promise<void> {
    const asked = this.#changes;
    try {
      const open = inProgress(await workoutsApi.latest(6));
      if (asked !== this.#changes) return;
      this.#keep(open === undefined ? null : {
        id: open.id,
        title: open.dayName ? `${open.planName} · ${open.dayName}` : 'Allenamento libero',
        startedAt: open.startedAt,
        sets: open.sets,
      });
    } catch {
      // senza rete resta quello che si sapeva
    }
  }
}

export const current = new Current();

import { session } from './client';
import { workoutsApi } from './endpoints';
import { inProgress } from './workout';

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
  workout = $state<OpenWorkout | null>(null);

  /* cambia a ogni volta che la pagina dell'allenamento lo cambia: una risposta del
     server partita prima di una serie segnata non la cancella */
  #version = {};

  /** Dalla pagina dell'allenamento: quello che sa lei è il più fresco. */
  set(workout: OpenWorkout | null): void {
    this.#version = {};
    this.workout = workout;
  }

  async refresh(): Promise<void> {
    const asked = this.#version;
    try {
      const open = inProgress(await workoutsApi.list(6));
      if (asked !== this.#version) return;
      this.workout = open === undefined ? null : {
        id: open.id,
        title: open.dayName ? `${open.planName} · ${open.dayName}` : 'Allenamento libero',
        startedAt: open.startedAt,
        sets: open.sets,
      };
    } catch {
      // senza rete resta quello che si sapeva
    }
  }
}

export const current = new Current();

// uscendo, la barra di chi esce non resta a chi entra dopo sullo stesso telefono
session.whenLeaving(() => current.set(null));

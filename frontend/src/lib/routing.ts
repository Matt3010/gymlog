export type Route =
  /** Dove si comincia: l'allenamento in corso, quelli da fare, gli ultimi. */
  | { kind: 'home' }
  | { kind: 'exercises' }
  | { kind: 'plans' }
  /** Una scheda da scrivere: `null` è quella nuova. */
  | { kind: 'plan'; id: number | null }
  /** Un allenamento, in corso o finito. */
  | { kind: 'workout'; id: number }
  | { kind: 'history' }
  /** Un esercizio: come va, sessione per sessione. */
  | { kind: 'exercise'; id: number }
  /** Come usano l'app tutti: solo per chi la amministra. */
  | { kind: 'admin' };

export const HOME_PATH = '/';
export const EXERCISES_PATH = '/exercises';
export const PLANS_PATH = '/plans';
export const HISTORY_PATH = '/history';
export const ADMIN_PATH = '/admin';
const WORKOUTS_PATH = '/workouts';

/**
 * Gli indirizzi di prima, in italiano: si leggono ancora, per i segnalibri e
 * le pagine rimaste aperte, e `canonical` li riscrive in inglese.
 */
const OLD_SECTIONS: Record<string, string> = {
  esercizi: 'exercises', schede: 'plans', storico: 'history', allenamenti: 'workouts', statistiche: 'exercises',
};

/** Un id in un indirizzo: un numero intero sopra lo zero, o niente. */
function id(text: string | undefined): number | null {
  const value = Number(text);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** Nessun router: un percorso, e la pagina che gli corrisponde. Quello che non si riconosce porta a casa. */
export function readRoute(path: string): Route {
  const clean = path.length > 1 ? path.replace(/\/$/, '') : path;
  const [, written = '', rest, ...more] = clean.split('/');
  const old = OLD_SECTIONS[written];
  const section = old ?? written;
  // «nuova» con la sezione di prima, «new» con quella di adesso: mescolati non sono un indirizzo
  const fresh = old === undefined ? 'new' : 'nuova';
  if (more.length > 0) return { kind: 'home' };
  if (rest === undefined) {
    if (section === 'exercises' && written !== 'statistiche') return { kind: 'exercises' };
    if (section === 'plans') return { kind: 'plans' };
    if (section === 'history') return { kind: 'history' };
    if (written === 'admin') return { kind: 'admin' };
    return { kind: 'home' };
  }
  if (section === 'plans' && rest === fresh) return { kind: 'plan', id: null };
  const found = id(rest);
  if (found === null) return { kind: 'home' };
  if (section === 'plans') return { kind: 'plan', id: found };
  if (section === 'workouts') return { kind: 'workout', id: found };
  if (section === 'exercises') return { kind: 'exercise', id: found };
  return { kind: 'home' };
}

export const planPath = (planId: number | null): string => `${PLANS_PATH}/${planId ?? 'new'}`;
export const workoutPath = (workoutId: number): string => `${WORKOUTS_PATH}/${workoutId}`;
export const exercisePath = (exerciseId: number): string => `${EXERCISES_PATH}/${exerciseId}`;

/** L'indirizzo buono di una pagina, dato uno qualsiasi che porti lì: chi lo copia dalla barra copia sempre lo stesso. */
export function canonical(path: string): string {
  const route = readRoute(path);
  switch (route.kind) {
    case 'home': return HOME_PATH;
    case 'exercises': return EXERCISES_PATH;
    case 'plans': return PLANS_PATH;
    case 'plan': return planPath(route.id);
    case 'workout': return workoutPath(route.id);
    case 'history': return HISTORY_PATH;
    case 'exercise': return exercisePath(route.id);
    case 'admin': return ADMIN_PATH;
  }
}

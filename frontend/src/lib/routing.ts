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
  | { kind: 'exercise'; id: number };

export const HOME_PATH = '/';
export const EXERCISES_PATH = '/esercizi';
export const PLANS_PATH = '/schede';
export const HISTORY_PATH = '/storico';

/** Un id in un indirizzo: un numero intero sopra lo zero, o niente. */
function id(text: string | undefined): number | null {
  const value = Number(text);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** Nessun router: un percorso, e la pagina che gli corrisponde. Quello che non si riconosce porta a casa. */
export function readRoute(path: string): Route {
  const clean = path.length > 1 ? path.replace(/\/$/, '') : path;
  if (clean === EXERCISES_PATH) return { kind: 'exercises' };
  if (clean === PLANS_PATH) return { kind: 'plans' };
  if (clean === `${PLANS_PATH}/nuova`) return { kind: 'plan', id: null };
  if (clean === HISTORY_PATH) return { kind: 'history' };

  const [, section, rest, ...more] = clean.split('/');
  const found = more.length === 0 ? id(rest) : null;
  if (found !== null && section === 'schede') return { kind: 'plan', id: found };
  if (found !== null && section === 'allenamenti') return { kind: 'workout', id: found };
  if (found !== null && section === 'esercizi') return { kind: 'exercise', id: found };
  // il vecchio indirizzo delle statistiche di un esercizio, per i segnalibri
  if (found !== null && section === 'statistiche') return { kind: 'exercise', id: found };
  return { kind: 'home' };
}

export const planPath = (planId: number | null): string => `${PLANS_PATH}/${planId ?? 'nuova'}`;
export const workoutPath = (workoutId: number): string => `/allenamenti/${workoutId}`;
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
  }
}

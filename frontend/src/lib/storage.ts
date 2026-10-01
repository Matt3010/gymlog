/** Preferences that belong to this browser and nowhere else. */
export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Dimenticare del tutto: non «scriverci dentro niente», proprio toglierla. */
export function forgetJSON(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* private mode: non c'era niente da togliere */
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: preferences just don't persist */
  }
}

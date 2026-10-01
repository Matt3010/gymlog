import { forgetJSON, readJSON, writeJSON } from './storage';
import type { Copies } from './api';

/*
 * Le copie delle letture, sul telefono: quello che si mostra quando la rete
 * manca (lib/api). Sono dati di chi è entrato, quindi uscendo se ne vanno
 * tutte, e solo loro.
 */
const PREFIX = 'gymlog.copy:';

export const copies: Copies & { forgetAll(): void } = {
  read: (path) => readJSON<unknown>(PREFIX + path, undefined),
  write: (path, value) => writeJSON(PREFIX + path, value),
  forgetAll() {
    try {
      for (const key of Object.keys(localStorage)) if (key.startsWith(PREFIX)) forgetJSON(key);
    } catch {
      /* niente storage: niente copie */
    }
  },
};

import { forgetJSON, readJSON, writeJSON } from './storage';
import type { Copies } from './api';

/*
 * Le copie delle letture, sul telefono: quello che si mostra quando la rete
 * manca (lib/api). Sono dati di chi è entrato, quindi uscendo se ne vanno
 * tutte, e solo loro.
 *
 * Solo le ultime: ogni allenamento aperto, ogni pagina dello storico lascia
 * la sua, e in qualche mese riempirebbero lo spazio del telefono — anche
 * quello della coda delle modifiche, che invece serve. Va via la scritta da
 * più tempo; una riletta torna in fondo.
 */
const PREFIX = 'gymlog.copy:';
const ORDER = 'gymlog.copy-order';
const MAX = 80;

export const copies: Copies & { forgetAll(): void } = {
  read: (path) => readJSON<unknown>(PREFIX + path, undefined),
  write(path, value) {
    const order = readJSON<string[]>(ORDER, []).filter((one) => one !== path);
    order.push(path);
    while (order.length > MAX) forgetJSON(PREFIX + order.shift()!);
    writeJSON(ORDER, order);
    writeJSON(PREFIX + path, value);
  },
  forgetAll() {
    try {
      for (const key of Object.keys(localStorage)) if (key.startsWith(PREFIX)) forgetJSON(key);
    } catch {
      /* niente storage: niente copie */
    }
    forgetJSON(ORDER);
  },
};

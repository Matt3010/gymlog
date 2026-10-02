/**
 * Un errore del server con il suo codice, o senza quando la risposta non è
 * arrivata. Il messaggio è già da mostrare: quello del server, o il nostro.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export interface Client {
  /** `fresh`: solo la risposta del server, mai la copia (per chi deve sapere com'è adesso). */
  get<T>(path: string, options?: { fresh?: boolean }): Promise<T>;
  post<T>(path: string, payload?: unknown): Promise<T>;
  put<T>(path: string, payload: unknown): Promise<T>;
  patch<T>(path: string, payload: unknown): Promise<T>;
  delete<T>(path: string): Promise<T>;
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/** Dove stanno le copie delle letture, per indirizzo. */
export interface Copies {
  read(path: string): unknown;
  write(path: string, value: unknown): void;
}

/**
 * Cosa dire quando il server non ha scritto il motivo. «errore 500» e
 * «Failed to fetch» sullo schermo non dicono quale pezzo manca; qui sì.
 */
function motivo(status: number): string {
  if (status === 404) return 'Quello che cercavi non c’è più. Ricarica la pagina per vedere com’è adesso.';
  if (status === 502 || status === 503 || status === 504) return 'Il server non si raggiunge adesso. Riprova fra poco.';
  if (status >= 500) return `Il server si è inceppato mentre rispondeva (codice ${status}). Riprova fra poco.`;
  return `Il server ha rifiutato la richiesta senza dire perché (codice ${status}).`;
}

/** Quando la richiesta non è nemmeno arrivata: la rete del telefono, o il server. */
const senzaRisposta = (): string =>
  typeof navigator !== 'undefined' && navigator.onLine === false
    ? 'Il telefono è senza rete, e la richiesta non è partita.'
    : 'Il server non risponde, e la richiesta non è arrivata. Controlla la rete e riprova.';

/**
 * Ogni chiamata all'API, in un posto solo.
 *
 * L'accesso dura un quarto d'ora e si rinnova da sé: una richiesta che torna
 * con 401 chiede un rinnovo e riprova una volta. Se ne tornano tre insieme —
 * la pagina di un allenamento chiede più cose all'apertura — il rinnovo è uno
 * solo e lo aspettano tutte, perché ogni rinnovo cambia il biglietto e il
 * secondo troverebbe già usato quello del primo. Se il rinnovo è rifiutato si
 * torna alla porta (`onSignedOut`).
 *
 * Le modifiche portano l'header `x-gymlog`: il server rifiuta quelle senza,
 * così un modulo su un altro sito non può scrivere a nome tuo.
 */
export function createClient({ fetch, onSignedOut, copies }: { fetch: Fetch; onSignedOut: () => void; copies?: Copies }): Client {
  let renewing: Promise<'renewed' | 'refused' | 'unreachable'> | null = null;

  async function send(path: string, method: string, payload?: unknown): Promise<Response> {
    const headers: Record<string, string> = {};
    if (method !== 'GET') headers['x-gymlog'] = '1';
    if (payload !== undefined) headers['content-type'] = 'application/json';
    try {
      return await fetch(`/api${path}`, {
        method,
        headers,
        credentials: 'same-origin',
        body: payload === undefined ? undefined : JSON.stringify(payload),
      });
    } catch {
      throw new ApiError(senzaRisposta());
    }
  }

  /**
   * Uno solo alla volta: chi arriva mentre è in corso aspetta quello. Dice
   * `refused` solo se il server rifiuta davvero (401): senza risposta, o col
   * server fermo, non si sa ancora niente (`unreachable`), e chi è entrato
   * resta dentro: uscire per un buco di rete butterebbe via il lavoro.
   */
  function renew(): Promise<'renewed' | 'refused' | 'unreachable'> {
    renewing ??= send('/auth/refresh', 'POST')
      .then(
        (response) => (response.ok ? 'renewed' : response.status === 401 ? 'refused' : 'unreachable'),
        () => 'unreachable' as const,
      )
      .finally(() => (renewing = null));
    return renewing;
  }

  async function failure(response: Response): Promise<ApiError> {
    const detail = (await response.json().catch(() => ({}))) as { error?: string };
    return new ApiError(detail.error ?? motivo(response.status), response.status);
  }

  async function request<T>(path: string, method: string, payload?: unknown): Promise<T> {
    let response = await send(path, method, payload);
    // la porta stessa non si rinnova: una password sbagliata è solo un errore
    if (response.status === 401 && !path.startsWith('/auth/')) {
      const renewal = await renew();
      // come una richiesta senza risposta: chi aspetta (la coda delle modifiche) riprova dopo
      if (renewal === 'unreachable') throw new ApiError(senzaRisposta());
      if (renewal === 'renewed') response = await send(path, method, payload);
      if (response.status === 401) {
        onSignedOut();
        throw await failure(response);
      }
    }
    if (!response.ok) throw await failure(response);
    return (await response.json()) as T;
  }

  /*
   * In palestra la rete va e viene: ogni lettura che arriva lascia una copia,
   * e quando la rete manca (nessuna risposta, non un errore del server) si
   * mostra quella. Le porte (/auth) no: chi è entrato lo dice il server.
   */
  async function read<T>(path: string, fresh: boolean): Promise<T> {
    const keep = copies !== undefined && !path.startsWith('/auth/');
    try {
      const value = await request<T>(path, 'GET');
      if (keep) copies.write(path, value);
      return value;
    } catch (error) {
      const copy = keep && !fresh && error instanceof ApiError && error.status === undefined ? copies.read(path) : undefined;
      if (copy === undefined) throw error;
      return copy as T;
    }
  }

  return {
    get: (path, options) => read(path, options?.fresh ?? false),
    post: (path, payload) => request(path, 'POST', payload),
    put: (path, payload) => request(path, 'PUT', payload),
    patch: (path, payload) => request(path, 'PATCH', payload),
    delete: (path) => request(path, 'DELETE'),
  };
}

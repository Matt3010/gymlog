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
  get<T>(path: string): Promise<T>;
  post<T>(path: string, payload?: unknown): Promise<T>;
  put<T>(path: string, payload: unknown): Promise<T>;
  patch<T>(path: string, payload: unknown): Promise<T>;
  delete<T>(path: string): Promise<T>;
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

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
  navigator.onLine === false
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
export function createClient({ fetch, onSignedOut }: { fetch: Fetch; onSignedOut: () => void }): Client {
  let renewing: Promise<boolean | null> | null = null;

  async function send(path: string, method: string, payload?: unknown): Promise<Response> {
    const headers: Record<string, string> = {};
    if (method !== 'GET') headers['x-gymlog'] = '1';
    if (payload !== undefined) headers['content-type'] = 'application/json';
    try {
      return await fetch(`/api${path}`, {
        method,
        headers,
        credentials: 'same-origin',
        // nessun corpo resta nessun corpo: JSON.stringify(undefined) è undefined
        body: JSON.stringify(payload),
      });
    } catch {
      throw new ApiError(senzaRisposta());
    }
  }

  /**
   * Uno solo alla volta: chi arriva mentre è in corso aspetta quello. Dice
   * «rifiutato» solo se il server rifiuta davvero (401): senza risposta, o col
   * server fermo, non si sa ancora niente (null), e chi è entrato
   * resta dentro: uscire per un buco di rete butterebbe via il lavoro.
   */
  function renew(): Promise<boolean | null> {
    // vero: rinnovato; falso: rifiutato; null: non si sa (senza risposta o server fermo)
    renewing ??= send('/auth/refresh', 'POST')
      .then(
        (response) => (response.ok ? true : response.status === 401 ? false : null),
        () => null,
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
      // come una richiesta senza risposta: si dice che manca la rete, senza far uscire nessuno
      if (renewal === null) throw new ApiError(senzaRisposta());
      if (renewal) response = await send(path, method, payload);
      if (response.status === 401) {
        onSignedOut();
        throw await failure(response);
      }
    }
    if (!response.ok) throw await failure(response);
    return (await response.json()) as T;
  }

  return {
    get: (path) => request(path, 'GET'),
    post: (path, payload) => request(path, 'POST', payload),
    put: (path, payload) => request(path, 'PUT', payload),
    patch: (path, payload) => request(path, 'PATCH', payload),
    delete: (path) => request(path, 'DELETE'),
  };
}

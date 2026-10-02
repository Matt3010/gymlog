/** I salvataggi in viaggio, di tutta l'app. */
const inFlight = new Set<Promise<void>>();

/**
 * Quando i salvataggi in viaggio sono arrivati, rifiutati o no. Chi legge dal
 * server aspetta questo (`client.ts`): lasciata una scheda appena cambiata,
 * l'elenco delle schede si leggeva prima che il cambiamento arrivasse, e
 * mostrava il nome di prima.
 */
export async function settled(): Promise<void> {
  while (inFlight.size) await Promise.all(inFlight);
}

/**
 * Salvare mentre si scrive, senza un tasto «Salva».
 *
 * Ogni cambiamento si annuncia con `change`; dopo una pausa (`delay`) parte
 * l'ultimo valore, non tutti quelli di mezzo. Ne va uno alla volta: quello
 * che cambia mentre uno è in viaggio aspetta, e dopo parte solo il più
 * recente — così un valore vecchio non arriva mai dopo uno nuovo. `flush`
 * manda subito quello che aspetta e attende che arrivi: si chiama lasciando
 * un campo o la pagina, perché niente vada perso.
 *
 * Se il server rifiuta, lo si dice (`status` e `error`) e il valore resta a
 * chi lo sta scrivendo: si riprova al prossimo cambiamento.
 */
export class Autosave<T> {
  status = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
  error = $state('');

  #save: (value: T) => Promise<unknown>;
  #delay: number;
  #pending: { value: T } | null = null;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #running: Promise<void> | null = null;

  constructor(save: (value: T) => Promise<unknown>, delay = 600) {
    this.#save = save;
    this.#delay = delay;
  }

  change(value: T): void {
    this.#pending = { value };
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => void this.#run(), this.#delay);
  }

  flush(): Promise<void> {
    clearTimeout(this.#timer);
    return this.#run();
  }

  #run(): Promise<void> {
    if (!this.#running) {
      const running = this.#drain().finally(() => {
        this.#running = null;
        inFlight.delete(running);
      });
      this.#running = running;
      inFlight.add(running);
    }
    return this.#running;
  }

  async #drain(): Promise<void> {
    while (this.#pending) {
      const { value } = this.#pending;
      this.#pending = null;
      this.status = 'saving';
      try {
        await this.#save(value);
        this.error = '';
        this.status = 'saved';
      } catch (failure) {
        this.error = failure instanceof Error ? failure.message : String(failure);
        this.status = 'error';
      }
    }
  }
}

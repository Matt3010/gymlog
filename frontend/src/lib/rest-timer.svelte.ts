/**
 * Il recupero fra una serie e l'altra.
 *
 * Conta sull'ora e non sui battiti: un telefono che si spegne in tasca ferma
 * gli intervalli, e quando si riaccende il recupero dev'essere andato avanti
 * quanto il tempo vero, non quanto i battiti che ha sentito. Alla fine lo
 * dice una volta (`onDone`), per una vibrazione.
 */
export class RestTimer {
  running = $state(false);
  /** Secondi ancora da aspettare: un secondo cominciato conta intero. */
  remaining = $state(0);
  /** Quanto era lungo, per disegnare la barra. */
  total = $state(0);

  #endsAt = 0;
  #ticker: ReturnType<typeof setInterval> | undefined;
  #onDone: () => void;

  constructor(onDone: () => void = () => undefined) {
    this.#onDone = onDone;
  }

  start(seconds: number): void {
    this.#halt();
    if (seconds <= 0) return;
    this.total = seconds;
    this.#endsAt = Date.now() + seconds * 1000;
    this.running = true;
    this.#tick();
    this.#ticker = setInterval(() => this.#tick(), 250);
  }

  /** Qualche secondo in più, o in meno: sotto zero è finito. */
  add(seconds: number): void {
    if (!this.running) return;
    this.#endsAt += seconds * 1000;
    this.total = Math.max(0, this.total + seconds);
    this.#tick();
  }

  stop(): void {
    this.#halt();
  }

  #tick(): void {
    this.remaining = Math.max(0, Math.ceil((this.#endsAt - Date.now()) / 1000));
    if (this.remaining > 0) return;
    this.#halt();
    this.#onDone();
  }

  #halt(): void {
    clearInterval(this.#ticker);
    this.running = false;
    this.remaining = 0;
  }
}

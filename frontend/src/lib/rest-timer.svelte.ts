/**
 * Il recupero fra una serie e l'altra.
 *
 * Conta sull'ora e non sui battiti: un telefono che si spegne in tasca ferma
 * gli intervalli, e quando si riaccende il recupero dev'essere andato avanti
 * quanto il tempo vero, non quanto i battiti che ha sentito. Alla fine lo
 * dice una volta (`onDone`), per una vibrazione.
 *
 * Con un nome (`key`) si tiene anche sul telefono: un'app in sottofondo
 * l'iPhone la ricarica spesso, e il recupero deve ritrovarsi dov'era. Uno
 * finito mentre il telefono era spento non torna, e non vibra in ritardo.
 */
import { forgetJSON, readJSON, writeJSON } from './storage';

export class RestTimer {
  running = $state(false);
  /** Secondi ancora da aspettare: un secondo cominciato conta intero. */
  remaining = $state(0);
  /** Quanto era lungo, per disegnare la barra. */
  total = $state(0);

  #endsAt = 0;
  #ticker: ReturnType<typeof setInterval> | undefined;
  #onDone: () => void;
  #key: string | undefined;

  constructor(onDone: () => void = () => undefined, key?: string) {
    this.#onDone = onDone;
    this.#key = key;
    const kept = key === undefined ? null : readJSON<{ endsAt: number; total: number } | null>(key, null);
    if (kept && kept.endsAt > Date.now()) this.#run(kept.endsAt, kept.total);
    else if (key !== undefined) forgetJSON(key);
  }

  start(seconds: number): void {
    this.#halt();
    if (seconds <= 0) return;
    this.#run(Date.now() + seconds * 1000, seconds);
  }

  #run(endsAt: number, total: number): void {
    this.total = total;
    this.#endsAt = endsAt;
    this.running = true;
    this.#keep();
    this.#tick();
    this.#ticker = setInterval(() => this.#tick(), 250);
  }

  #keep(): void {
    if (this.#key !== undefined) writeJSON(this.#key, { endsAt: this.#endsAt, total: this.total });
  }

  /** Qualche secondo in più, o in meno: sotto zero è finito. */
  add(seconds: number): void {
    if (!this.running) return;
    this.#endsAt += seconds * 1000;
    this.total = Math.max(0, this.total + seconds);
    this.#keep();
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
    if (this.#key !== undefined) forgetJSON(this.#key);
  }
}

const PLAIN_MS = 2600;

class Toast {
  message = $state('');
  /** Bumped on every show so the entrance animation restarts on a repeat. */
  nonce = $state(0);
  open = $state(false);

  #timer: ReturnType<typeof setTimeout> | undefined;

  show(message: string): void {
    this.message = message;
    this.nonce += 1;
    this.open = true;
    clearTimeout(this.#timer);
    // un messaggio lungo resta quanto serve a leggerlo
    this.#timer = setTimeout(() => this.hide(), Math.max(PLAIN_MS, message.length * 55));
  }

  hide(): void {
    clearTimeout(this.#timer);
    this.open = false;
  }
}

export const toast = new Toast();

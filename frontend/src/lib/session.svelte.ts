import { ApiError, type Client } from './api';
import { forgetJSON, readJSON, writeJSON } from './storage';
import type { User } from './types';

/** Chi era entrato l'ultima volta: senza rete si riapre con lui. */
const LAST_USER = 'gymlog.user';

/**
 * Chi è entrato.
 *
 * All'apertura non si sa ancora (`checking`): si chiede al server. L'accesso
 * dura un quarto d'ora e chi riapre l'app dopo un'ora lo trova scaduto, ma il
 * rinnovo vale un mese, quindi prima di mostrare la porta si prova quello.
 * Un server che non risponde non è «non sei entrato»: è un'altra schermata,
 * con il suo motivo (`unreachable`). Ma se è il telefono a non avere rete
 * (nessuna risposta) e qualcuno era entrato, si entra con lui: in palestra
 * l'app deve aprirsi anche nel seminterrato, con quello che ha sul telefono.
 */
export class Session {
  user = $state<User | null>(null);
  status = $state<'checking' | 'in' | 'out' | 'unreachable'>('checking');
  /** Perché non si è potuto sapere, quando `unreachable`. */
  problem = $state('');

  #api: Client;
  #onLeave: () => void;
  #leaving: (() => void)[] = [];
  #entering: ((user: User) => void)[] = [];

  /** `onLeave`: uscendo, quello che va dimenticato con lui (le copie dei suoi dati). */
  constructor(api: Client, onLeave: () => void = () => undefined) {
    this.#api = api;
    this.#onLeave = onLeave;
  }

  async check(): Promise<void> {
    try {
      this.#enter((await this.#api.get<{ user: User }>('/auth/me')).user);
    } catch (error) {
      const last = readJSON<User | null>(LAST_USER, null);
      if (error instanceof ApiError && error.status === undefined && last) return this.#enter(last);
      if (!(error instanceof ApiError) || error.status !== 401) return this.#unreachable(error);
      try {
        this.#enter((await this.#api.post<{ user: User }>('/auth/refresh')).user);
      } catch (again) {
        if (again instanceof ApiError && again.status === 401) this.signedOut();
        else this.#unreachable(again);
      }
    }
  }

  /** Rifiutato, lo rilancia: il messaggio lo mostra la porta. */
  async login(username: string, password: string): Promise<void> {
    this.#enter((await this.#api.post<{ user: User }>('/auth/login', { username, password })).user);
  }

  /** Un account nuovo, ed entrati subito. Rifiutato, lo rilancia: il motivo lo mostra la porta. */
  async register(username: string, password: string): Promise<void> {
    this.#enter((await this.#api.post<{ user: User }>('/auth/register', { username, password })).user);
  }

  /** Se ci si può registrare. Senza risposta no: la porta resta quella di sempre. */
  async signupOpen(): Promise<boolean> {
    try {
      return (await this.#api.get<{ open: boolean }>('/auth/signup')).open;
    } catch {
      return false;
    }
  }

  /** Fuori comunque: se il server non si raggiunge, il biglietto scade da sé. */
  async logout(): Promise<void> {
    await this.#api.post('/auth/logout').catch(() => undefined);
    this.signedOut();
  }

  /** Chi deve sapere chi è entrato (la coda delle modifiche è sua). */
  whenEntering(listener: (user: User) => void): void {
    this.#entering.push(listener);
  }

  /** Qualcos'altro da dimenticare uscendo (l'allenamento in corso della barra). */
  whenLeaving(forget: () => void): void {
    this.#leaving.push(forget);
  }

  signedOut(): void {
    forgetJSON(LAST_USER);
    this.#onLeave();
    for (const forget of this.#leaving) forget();
    this.user = null;
    this.status = 'out';
  }

  #enter(user: User): void {
    writeJSON(LAST_USER, user);
    this.user = user;
    for (const listener of this.#entering) listener(user);
    this.status = 'in';
    this.problem = '';
  }

  #unreachable(error: unknown): void {
    this.status = 'unreachable';
    this.problem = error instanceof Error ? error.message : String(error);
  }
}

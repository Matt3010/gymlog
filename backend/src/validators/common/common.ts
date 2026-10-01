/** A request the app sent wrong: answered 400 with the message, in Italian. */
export class InputError extends Error {}

export type Body = Record<string, unknown>;

/** Field names as the app shows them, for error messages. */
const FIELD_LABELS: Record<string, string> = {
  username: "Utente", name: "Nome", muscleGroup: "Gruppo muscolare", notes: "Note", archived: "Archiviata",
  days: "Giorni", exercises: "Esercizi", exerciseId: "Esercizio", sets: "Serie", reps: "Ripetizioni",
  restSeconds: "Recupero", planDayId: "Giorno", finished: "Terminato", weightKg: "Peso",
};

export const field = (key: string): string => FIELD_LABELS[key] ?? key;

/** The largest id Postgres' integer columns hold. */
const MAX_ID = 2_147_483_647;

export function object(value: unknown): Body {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new InputError("Richiesta non valida.");
  return value as Body;
}

export function text(body: Body, key: string, max = 100): string {
  const value = typeof body[key] === "string" ? body[key].trim() : "";
  if (value === "" || value.length > max) throw new InputError(`${field(key)}: manca o è troppo lungo.`);
  return value;
}

/** Missing, null or blank is nothing. */
export function optionalText(body: Body, key: string, max = 1000): string | null {
  const value = body[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.trim().length > max) throw new InputError(`${field(key)}: troppo lungo.`);
  return value.trim() === "" ? null : value.trim();
}

export function bool(body: Body, key: string): boolean {
  if (typeof body[key] !== "boolean") throw new InputError(`${field(key)}: valore non valido.`);
  return body[key];
}

export function number(body: Body, key: string, min: number, max: number, integer = false): number {
  const value = body[key];
  if (typeof value !== "number" || !(value >= min && value <= max) || (integer && !Number.isInteger(value))) {
    throw new InputError(`${field(key)}: numero tra ${min} e ${max}${integer ? " (intero)" : ""}.`);
  }
  return value;
}

/** Missing or null is nothing. */
export function optionalNumber(body: Body, key: string, min: number, max: number, integer: boolean): number | null {
  return body[key] === undefined || body[key] === null ? null : number(body, key, min, max, integer);
}

export function id(body: Body, key: string): number {
  return number(body, key, 1, MAX_ID, true);
}

export function list(body: Body, key: string): unknown[] {
  const value = body[key];
  if (!Array.isArray(value)) throw new InputError(`${field(key)}: elenco non valido.`);
  return value;
}

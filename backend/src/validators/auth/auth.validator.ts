import { InputError, object, text } from "../common";
import { MIN_PASSWORD_LENGTH } from "../../services";

export function parseLogin(value: unknown): { username: string; password: string } {
  const body = object(value);
  // Names are kept lower-case: "Anna" and "anna" are one account.
  const username = text(body, "username").toLowerCase();
  // Taken as typed: spaces may be part of it.
  const password = body.password;
  if (typeof password !== "string" || password === "" || password.length > 200) throw new InputError("Password: manca.");
  return { username, password };
}

const USERNAME = /^[a-z0-9._-]{3,30}$/;

/** A new account: a name others could not mistake for another, and a password long enough. */
export function parseRegister(value: unknown): { username: string; password: string } {
  const body = object(value);
  // Stryker disable next-line StringLiteral: anything that is not a name fails the pattern below the same way
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  if (!USERNAME.test(username)) {
    throw new InputError("Utente: da 3 a 30 caratteri, solo lettere, numeri, punto, trattino e trattino basso.");
  }
  const password = body.password;
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw new InputError(`Password: almeno ${MIN_PASSWORD_LENGTH} caratteri.`);
  }
  if (password.length > 200) throw new InputError("Password: al più 200 caratteri.");
  return { username, password };
}

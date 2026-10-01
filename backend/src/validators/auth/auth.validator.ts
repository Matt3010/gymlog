import { InputError, object, text } from "../common";

export function parseLogin(value: unknown): { username: string; password: string } {
  const body = object(value);
  const username = text(body, "username");
  // Taken as typed: spaces may be part of it.
  const password = body.password;
  if (typeof password !== "string" || password === "" || password.length > 200) throw new InputError("Password: manca.");
  return { username, password };
}

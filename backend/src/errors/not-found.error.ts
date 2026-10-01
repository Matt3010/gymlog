/** What was asked for is not there, or not the user's: the API answers 404. */
export class NotFoundError extends Error {
  constructor(message = "Non trovato.") {
    super(message);
  }
}

export function found<T>(value: T | undefined): T {
  if (value === undefined) throw new NotFoundError();
  return value;
}

export function foundIf(done: boolean): void {
  if (!done) throw new NotFoundError();
}

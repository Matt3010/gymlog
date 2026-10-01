/** A request that cannot be served: answered with this status and message (Italian, for the app). */
export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

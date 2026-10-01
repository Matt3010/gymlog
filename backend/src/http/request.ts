import type { IncomingMessage } from "node:http";
import { InputError } from "../validators";
import { HttpError } from "./http.errors";
import type { Context } from "./router";

/** A whole plan is the largest thing the app sends: far below this. */
const MAX_BODY_BYTES = 256 * 1024;

/** The largest id Postgres' integer columns hold. */
const MAX_ID = 2_147_483_647;

export function readBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      // Too big: the rest is read and dropped, not cut off, so the answer reaches the app.
      if (size > MAX_BODY_BYTES) return reject(new HttpError(413, "Richiesta troppo grande."));
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (size === 0) return resolve(undefined);
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new InputError("JSON non valido."));
      }
    });
    // Stryker disable next-line all: a broken connection has no one left to answer
    request.on("error", reject);
  });
}

export function readCookie(request: IncomingMessage, name: string): string | undefined {
  // Stryker disable next-line StringLiteral: any text without the name finds nothing
  for (const part of (request.headers.cookie ?? "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return undefined;
}

export function cookieHeader(name: string, path: string, value: string, maxAgeSeconds: number, secure: boolean): string {
  return [`${name}=${value}`, `Path=${path}`, "HttpOnly", "SameSite=Strict", `Max-Age=${maxAgeSeconds}`, ...(secure ? ["Secure"] : [])].join("; ");
}

/** A whole-number query parameter, kept within bounds. */
export function intParam(context: Context, key: string, fallback: number, min: number, max: number): number {
  const raw = context.url.searchParams.get(key);
  const value = raw === null ? fallback : Number(raw);
  return Number.isInteger(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

/** The numeric id captured by the route. Out of range: nothing has it. */
export function idParam(context: Context): number {
  const value = Number(context.params[0]);
  // The route takes digits only: anything past the largest id, however long, is out.
  if (value <= 0 || value > MAX_ID) throw new HttpError(404, "Non trovato.");
  return value;
}

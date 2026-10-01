import { randomBytes, randomUUID, scrypt as scryptCallback, type ScryptOptions, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, length: number, options: ScryptOptions) => Promise<Buffer>;

/** scrypt with Node's defaults raised a step: slow enough to guess, quick enough on a Pi. */
const COST = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LENGTH = 32;

export const MIN_PASSWORD_LENGTH = 10;

export function checkNewPassword(password: string): string | undefined {
  return password.length < MIN_PASSWORD_LENGTH ? `Password: almeno ${MIN_PASSWORD_LENGTH} caratteri.` : undefined;
}

/** `scrypt$N$r$p$salt$key`, base64 parts: the cost travels with the hash, so it can be raised later. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LENGTH, COST);
  return ["scrypt", COST.N, COST.r, COST.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts[0] !== "scrypt" || parts.length !== 6) return false;
  const [, n, r, p, salt, key] = parts as [string, string, string, string, string, string];
  const expected = Buffer.from(key, "base64");
  const actual = await scrypt(password, Buffer.from(salt, "base64"), expected.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: COST.maxmem,
  });
  return timingSafeEqual(actual, expected);
}

/** A hash to check against when the user does not exist, so both cases take as long. */
export const DUMMY_HASH = hashPassword(randomUUID());

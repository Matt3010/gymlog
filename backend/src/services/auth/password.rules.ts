import { randomBytes, randomUUID, scrypt as scryptCallback, type ScryptOptions, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, length: number, options: ScryptOptions) => Promise<Buffer>;

/** scrypt with Node's defaults raised a step: slow enough to guess, quick enough on a Pi. */
const COST = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LENGTH = 32;

export const MIN_PASSWORD_LENGTH = 10;

const EASY = "Password: troppo facile da indovinare. Prova con qualche parola a caso, o una frase.";

/** What everybody tries first, written in lower case: a password made mostly of these is guessed in a minute. */
const COMMON = [
  "password", "passw0rd", "p4ssword", "gymlog", "palestra", "iloveyou", "1q2w3e4r5t", "1qaz2wsx", "welcome", "letmein",
  "admin", "qwerty", "juventus", "forzajuve", "forzainter", "forzamilan", "forzaroma", "forzanapoli", "ciao",
];
/** Runs along a keyboard or a count: any four or more in a row of these are no secret. */
const SEQUENCES = ["0123456789", "9876543210", "1234567890", "0987654321", "abcdefghijklmnopqrstuvwxyz", "qwertyuiop", "asdfghjkl", "zxcvbnm"];
/** What is left once the common words, the runs and the username are taken out: less than this is too little. */
const MIN_LEFT = 6;

/**
 * Long enough, and not one that a list of common passwords finds: not
 * four letters over and over, not a word everybody uses with a number
 * after it, not the username with something added.
 */
export function checkNewPassword(password: string, username?: string): string | undefined {
  if (password.length < MIN_PASSWORD_LENGTH) return `Password: almeno ${MIN_PASSWORD_LENGTH} caratteri.`;
  const plain = password.toLowerCase();
  if (new Set(plain).size < 4) return EASY;
  let left = plain;
  for (const word of [...COMMON, ...(username ? [username.toLowerCase()] : [])]) left = left.split(word).join("");
  for (const run of SEQUENCES) {
    for (let length = run.length; length >= 4; length--) {
      for (let at = 0; at + length <= run.length; at++) left = left.split(run.slice(at, at + length)).join("");
    }
  }
  return left.length < MIN_LEFT ? EASY : undefined;
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

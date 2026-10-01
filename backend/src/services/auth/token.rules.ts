import { createHash, randomBytes } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";

export interface TokenUser {
  readonly id: number;
  readonly username: string;
}

/** Short access JWTs: checked without touching the database. */
export interface TokenManager {
  sign(user: TokenUser): Promise<string>;
  /** The user a token was issued to, if it is genuine and not expired. */
  verify(token: string): Promise<TokenUser | undefined>;
}

/** A JWT cannot be taken back, so it lives briefly; the refresh token renews it. */
export const ACCESS_SECONDS = 15 * 60;

const ISSUER = "gymlog";
const AUDIENCE = "gymlog-app";

/**
 * The signing key from JWT_SECRET (hex or base64, 32 bytes or more). Without
 * it, a random key: everyone is logged out at each restart, which is safe,
 * only inconvenient.
 */
export function jwtSecret(value: string | undefined): { secret: Uint8Array; generated: boolean } {
  if (value === undefined) return { secret: new Uint8Array(randomBytes(32)), generated: true };
  const bytes = new Uint8Array(/^[0-9a-f]+$/i.test(value) ? Buffer.from(value, "hex") : Buffer.from(value, "base64"));
  if (bytes.length < 32) throw new Error("JWT_SECRET must be at least 32 bytes: openssl rand -hex 32");
  return { secret: bytes, generated: false };
}

export function createTokenManager(secret: Uint8Array): TokenManager {
  if (secret.length < 32) throw new Error("The JWT secret must be at least 32 bytes.");

  return {
    sign(user) {
      return new SignJWT({ name: user.username })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(String(user.id))
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(`${ACCESS_SECONDS}s`)
        .sign(secret);
    },

    async verify(token) {
      const payload = await jwtVerify(token, secret, { issuer: ISSUER, audience: AUDIENCE, algorithms: ["HS256"] }).then(
        (verified) => verified.payload,
        () => undefined,
      );
      if (payload === undefined) return undefined;
      const id = Number(payload.sub);
      if (!Number.isInteger(id) || typeof payload.name !== "string") return undefined;
      return { id, username: payload.name };
    },
  };
}

/** A refresh token: random, given to the browser once. */
export function newRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Only the hash of a refresh token is stored: a copy of the database renews nothing. */
export function refreshTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

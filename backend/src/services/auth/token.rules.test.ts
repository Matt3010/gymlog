import { createHash } from "node:crypto";
import { decodeJwt, SignJWT } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ACCESS_SECONDS, createTokenManager, jwtSecret, newRefreshToken, refreshTokenHash } from "./token.rules";

const SECRET = new Uint8Array(32).fill(1);
const USER = { id: 7, username: "mario" };

function jwt(claims: Record<string, unknown>, { issuer = "gymlog", audience = "gymlog-app", alg = "HS256", secret = SECRET } = {}) {
  return new SignJWT(claims).setProtectedHeader({ alg }).setIssuer(issuer).setAudience(audience).setIssuedAt().setExpirationTime("1h").sign(secret);
}

afterEach(() => void vi.useRealTimers());

describe("the signing secret", () => {
  it("needs 32 bytes", () => {
    expect(() => createTokenManager(new Uint8Array(31))).toThrow("The JWT secret must be at least 32 bytes.");
    expect(() => createTokenManager(new Uint8Array(32))).not.toThrow();
  });

  it("is read from hex or base64, 32 bytes at least", () => {
    expect(jwtSecret("ab".repeat(32))).toEqual({ secret: new Uint8Array(32).fill(0xab), generated: false });
    expect(jwtSecret(Buffer.alloc(32, 2).toString("base64"))).toEqual({ secret: new Uint8Array(32).fill(2), generated: false });
    expect(() => jwtSecret("ab".repeat(31))).toThrow("JWT_SECRET must be at least 32 bytes: openssl rand -hex 32");
  });

  it("tells base64 from hex by the whole text, not its end", () => {
    // 33 bytes of 0x1a are "Ghoa" eleven times: base64 that ends in a hex digit.
    const value = Buffer.alloc(33, 0x1a).toString("base64");
    expect(value.endsWith("a")).toBe(true);
    expect(jwtSecret(value).secret).toEqual(new Uint8Array(33).fill(0x1a));
  });

  it("is random when not set: logins end at each restart", () => {
    const first = jwtSecret(undefined);
    expect(first.generated).toBe(true);
    expect(first.secret).toHaveLength(32);
    expect(first.secret).not.toEqual(jwtSecret(undefined).secret);
  });
});

describe("an access token", () => {
  it("carries the user", async () => {
    const tokens = createTokenManager(SECRET);
    expect(await tokens.verify(await tokens.sign(USER))).toEqual(USER);
  });

  it("names gymlog as issuer and the app as audience", async () => {
    const claims = decodeJwt(await createTokenManager(SECRET).sign(USER));
    expect(claims).toMatchObject({ iss: "gymlog", aud: "gymlog-app", sub: "7", name: "mario" });
  });

  it("lasts fifteen minutes", async () => {
    expect(ACCESS_SECONDS).toBe(900);
    const tokens = createTokenManager(SECRET);
    vi.useFakeTimers({ now: new Date("2026-01-01T00:00:00Z") });
    const access = await tokens.sign(USER);
    vi.setSystemTime(new Date("2026-01-01T00:14:59Z"));
    expect(await tokens.verify(access)).toEqual(USER);
    vi.setSystemTime(new Date("2026-01-01T00:15:01Z"));
    expect(await tokens.verify(access)).toBeUndefined();
  });

  it("is refused when signed with another secret", async () => {
    const access = await createTokenManager(new Uint8Array(32).fill(2)).sign(USER);
    expect(await createTokenManager(SECRET).verify(access)).toBeUndefined();
  });

  it.each([
    ["another issuer", { issuer: "someone" }],
    ["another audience", { audience: "someone" }],
    ["another algorithm", { alg: "HS512" }],
  ])("is refused from %s", async (_name, options) => {
    const access = await jwt({ sub: "7", name: "mario" }, options);
    expect(await createTokenManager(SECRET).verify(access)).toBeUndefined();
  });

  it.each([
    ["no subject", { name: "mario" }],
    ["a subject that is not a number", { sub: "x", name: "mario" }],
    ["no name", { sub: "7" }],
  ])("is refused with %s", async (_name, claims) => {
    expect(await createTokenManager(SECRET).verify(await jwt(claims))).toBeUndefined();
  });

  it("is refused when it is not a token", async () => {
    expect(await createTokenManager(SECRET).verify("nonsense")).toBeUndefined();
  });
});

describe("a refresh token", () => {
  it("is 32 random bytes, base64url", () => {
    expect(newRefreshToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newRefreshToken()).not.toBe(newRefreshToken());
  });

  it("is stored as its sha256", () => {
    expect(refreshTokenHash("abc")).toBe(createHash("sha256").update("abc").digest("hex"));
  });
});

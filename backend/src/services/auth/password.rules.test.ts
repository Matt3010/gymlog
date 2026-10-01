import { describe, expect, it } from "vitest";
import { checkNewPassword, DUMMY_HASH, hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "./password.rules";

describe("a password hash", () => {
  it("says scrypt, its cost, a salt and the key", async () => {
    expect(await hashPassword("correct horse")).toMatch(/^scrypt\$32768\$8\$1\$[A-Za-z0-9+/]{22}==\$[A-Za-z0-9+/]{43}=$/);
  });

  it("is salted: the same password hashes differently", async () => {
    expect(await hashPassword("correct horse")).not.toBe(await hashPassword("correct horse"));
  });

  it("matches its password only", async () => {
    const hash = await hashPassword("correct horse");
    expect(await verifyPassword("correct horse", hash)).toBe(true);
    expect(await verifyPassword("correct horsE", hash)).toBe(false);
  });

  it("is checked with the cost it carries", async () => {
    const cheaper = (await hashPassword("x")).replace("$32768$", "$16384$");
    // Same salt and key, another cost: a different key comes out.
    expect(await verifyPassword("x", cheaper)).toBe(false);
  });

  it.each(["", "bcrypt$1$2$3$4$5", "scrypt$1$2$3$4"])("never matches something that is not one: %j", async (stored) => {
    expect(await verifyPassword("x", stored)).toBe(false);
  });

  it("has a stand-in for missing users that matches nothing typed", async () => {
    expect(await verifyPassword("", await DUMMY_HASH)).toBe(false);
  });
});

describe("a new password", () => {
  it("needs ten characters", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(10);
    expect(checkNewPassword("x".repeat(9))).toBe("Password: almeno 10 caratteri.");
    expect(checkNewPassword("x".repeat(10))).toBeUndefined();
  });
});

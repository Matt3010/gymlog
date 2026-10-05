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
    expect(checkNewPassword("abcdefgh9")).toBe("Password: almeno 10 caratteri.");
    expect(checkNewPassword("tre gatti blu")).toBeUndefined();
  });

  const EASY = "Password: troppo facile da indovinare. Prova con qualche parola a caso, o una frase.";

  it.each([
    "password12", "Password123", "PASSWORD1234", "passw0rd!!", "1234567890", "0987654321", "12345678901",
    "qwertyuiop", "QwErTy1234", "asdfghjkl1", "zxcvbnm123", "1q2w3e4r5t", "iloveyou12", "abcdefghij",
    "xxxxxxxxxx", "1212121212", "aaaabbbbcc", "gymlog2026!", "forzajuve1",
  ])("is refused when it is one everybody tries: %s", (password) => {
    expect(checkNewPassword(password)).toBe(EASY);
  });

  it("is refused when it is little more than the username", () => {
    expect(checkNewPassword("anna.rossi1", "anna.rossi")).toBe(EASY);
    expect(checkNewPassword("ANNA.ROSSI!!", "anna.rossi")).toBe(EASY);
    expect(checkNewPassword("anna rossi va in palestra", "anna.rossi")).toBeUndefined();
  });

  it("is taken when it is long and not a pattern", () => {
    for (const good of ["correct horse battery", "Panca-82,5kg!", "il mio cane fido", "x7#Lm9qPz2"]) expect(checkNewPassword(good)).toBeUndefined();
  });
});

export interface LoginLimiter {
  blocked(key: string): boolean;
  fail(key: string): void;
  succeed(key: string): void;
}

/**
 * Failed logins per key (an address, a username from an address), in memory.
 * After `max` failures in `windowMs` that key waits out the window: enough to
 * stop guessing, and a restart forgiving everyone is fine.
 */
export function createLoginLimiter(max = 5, windowMs = 15 * 60_000, now = () => Date.now()): LoginLimiter {
  const failures = new Map<string, number[]>();
  const recent = (key: string) => failures.get(key)?.filter((at) => now() - at < windowMs) ?? [];

  return {
    blocked(key) {
      return recent(key).length >= max;
    },
    fail(key) {
      const next = [...recent(key), now()];
      failures.delete(key);
      failures.set(key, next);
      // Full: the longest untouched keys go, never everyone at once.
      while (failures.size > 10_000) failures.delete(failures.keys().next().value!);
    },
    succeed(key) {
      failures.delete(key);
    },
  };
}

export interface Slowdown {
  /** How long to wait before trying this key once more, in ms. */
  delayFor(key: string): number;
  fail(key: string): void;
  succeed(key: string): void;
}

/**
 * Failed logins per username, from anywhere, in memory. The first `free`
 * in `windowMs` cost nothing; after them each try waits twice as long as the
 * one before (1 s, 2 s, 4 s…) up to `maxDelayMs`. Never a no: the owner, at
 * the right password, always gets in — only guessing thousands of passwords
 * from thousands of addresses becomes too slow to be worth it.
 */
export function createSlowdown(free = 10, windowMs = 60 * 60_000, maxDelayMs = 30_000, now = () => Date.now()): Slowdown {
  const failures = new Map<string, number[]>();
  const recent = (key: string) => failures.get(key)?.filter((at) => now() - at < windowMs) ?? [];

  return {
    delayFor(key) {
      const over = recent(key).length - free;
      return over < 0 ? 0 : Math.min(maxDelayMs, 1000 * 2 ** over);
    },
    fail(key) {
      const next = [...recent(key), now()];
      failures.delete(key);
      failures.set(key, next);
      // Full: the longest untouched names go, never everyone at once.
      while (failures.size > 10_000) failures.delete(failures.keys().next().value!);
    },
    succeed(key) {
      failures.delete(key);
    },
  };
}

/**
 * The key for an address. An IPv6 home or server gets a whole /64, so the
 * first four groups are one visitor; an IPv4 address is itself.
 */
export function addressKey(ip: string): string {
  if (!ip.includes(":")) return ip;
  const [head, tail] = ip.toLowerCase().split("::");
  const left = head ? head.split(":") : [];
  // Stryker disable next-line ArrayDeclaration: one extra group at the end never reaches the first four
  const right = tail ? tail.split(":") : [];
  // Written out in full; more than eight groups (a malformed address) just adds none.
  const groups = [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right];
  return `${groups.slice(0, 4).map((group) => group.replace(/^0+(?=.)/, "")).join(":")}::/64`;
}

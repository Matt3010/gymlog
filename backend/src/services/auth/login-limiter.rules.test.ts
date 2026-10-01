import { describe, expect, it } from "vitest";
import { addressKey, createLoginLimiter } from "./login-limiter.rules";

function clock() {
  let now = 0;
  return { now: () => now, pass: (ms: number) => void (now += ms) };
}

describe("the login limiter", () => {
  it("blocks a key after the maximum failures inside the window", () => {
    const limiter = createLoginLimiter(3, 1000, clock().now);
    limiter.fail("a");
    limiter.fail("a");
    expect(limiter.blocked("a")).toBe(false);
    limiter.fail("a");
    expect(limiter.blocked("a")).toBe(true);
  });

  it("forgets failures once the window has passed", () => {
    const time = clock();
    const limiter = createLoginLimiter(2, 1000, time.now);
    limiter.fail("a");
    time.pass(500);
    limiter.fail("a");
    time.pass(499);
    expect(limiter.blocked("a")).toBe(true);
    time.pass(1);
    expect(limiter.blocked("a")).toBe(false);
    // The second failure is still inside: one more blocks again.
    limiter.fail("a");
    expect(limiter.blocked("a")).toBe(true);
  });

  it("keeps keys apart", () => {
    const limiter = createLoginLimiter(1, 1000, clock().now);
    limiter.fail("a");
    expect(limiter.blocked("b")).toBe(false);
  });

  it("forgives a key that succeeded", () => {
    const limiter = createLoginLimiter(2, 1000, clock().now);
    limiter.fail("a");
    limiter.fail("a");
    limiter.succeed("a");
    expect(limiter.blocked("a")).toBe(false);
    limiter.fail("a");
    expect(limiter.blocked("a")).toBe(false);
  });

  it("blocks after five failures in fifteen minutes by default", () => {
    const time = clock();
    const limiter = createLoginLimiter(undefined, undefined, time.now);
    for (let i = 0; i < 4; i++) limiter.fail("a");
    expect(limiter.blocked("a")).toBe(false);
    limiter.fail("a");
    expect(limiter.blocked("a")).toBe(true);
    time.pass(15 * 60_000 - 1);
    expect(limiter.blocked("a")).toBe(true);
    time.pass(1);
    expect(limiter.blocked("a")).toBe(false);
  });

  it("reads the real clock by default", () => {
    const limiter = createLoginLimiter(1, 60_000);
    limiter.fail("a");
    expect(limiter.blocked("a")).toBe(true);
  });

  describe("when full", () => {
    it("lets the longest untouched key go, and only that one", () => {
      const limiter = createLoginLimiter(1, 1000, clock().now);
      for (let i = 0; i <= 10_000; i++) limiter.fail(`k${i}`);
      expect(limiter.blocked("k0")).toBe(false);
      expect(limiter.blocked("k1")).toBe(true);
      expect(limiter.blocked("k10000")).toBe(true);
    });

    it("counts a new failure as a touch", () => {
      const limiter = createLoginLimiter(1, 1000, clock().now);
      for (let i = 0; i < 10_000; i++) limiter.fail(`k${i}`);
      limiter.fail("k0");
      limiter.fail("k10000");
      expect(limiter.blocked("k0")).toBe(true);
      expect(limiter.blocked("k1")).toBe(false);
    });
  });
});

describe("the key for an address", () => {
  it("is an IPv4 address itself", () => {
    expect(addressKey("203.0.113.7")).toBe("203.0.113.7");
  });

  it("is the /64 of an IPv6 address", () => {
    expect(addressKey("2001:db8:1:2:3:4:5:6")).toBe("2001:db8:1:2::/64");
    expect(addressKey("2001:db8:1:2:ffff:4:5:7")).toBe("2001:db8:1:2::/64");
  });

  it("reads IPv6 written any way", () => {
    expect(addressKey("2001:0DB8:0001:0002::1")).toBe("2001:db8:1:2::/64");
    expect(addressKey("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(addressKey("::1")).toBe("0:0:0:0::/64");
    expect(addressKey("2001:db8:1:2::")).toBe("2001:db8:1:2::/64");
    expect(addressKey("0000:0:00:1::")).toBe("0:0:0:1::/64");
    expect(addressKey("2001::3:4:5:6:7:8")).toBe("2001:0:3:4::/64");
  });

  it("does not stop on a malformed address", () => {
    expect(addressKey("1:2:3:4:5:6:7:8:9::1")).toBe("1:2:3:4::/64");
  });
});

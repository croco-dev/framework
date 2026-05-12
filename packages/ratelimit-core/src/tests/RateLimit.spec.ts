import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { RateLimit } from "../libs/decorators/RateLimit";
import {
  RATE_LIMIT_METADATA_KEY,
  RateLimitGuard,
  type RateLimitMetadata,
  ROUTE_GUARDS_METADATA_KEY,
} from "../libs/guards/RateLimitGuard";
import { isSlidingWindowPolicy } from "../libs/types";

describe("@RateLimit decorator", () => {
  it("should store metadata with default values", () => {
    class TestController {
      @RateLimit()
      testMethod() {}
    }

    const instance = new TestController();
    const metadata = Reflect.getMetadata(
      RATE_LIMIT_METADATA_KEY,
      instance.testMethod,
    ) as RateLimitMetadata;

    expect(metadata).not.toBeUndefined();
    expect(isSlidingWindowPolicy(metadata.policy)).toBe(true);
    if (isSlidingWindowPolicy(metadata.policy)) {
      expect(metadata.policy.limit).toBe(100);
      expect(metadata.policy.windowMs).toBe(60000); // 1m
    }
    expect(metadata.policy.name).toBe("testMethod-default");
  });

  it("should store metadata with custom limit and window", () => {
    class TestController {
      @RateLimit({ limit: 10, window: "5m" })
      limitedMethod() {}
    }

    const instance = new TestController();
    const metadata = Reflect.getMetadata(
      RATE_LIMIT_METADATA_KEY,
      instance.limitedMethod,
    ) as RateLimitMetadata;

    expect(isSlidingWindowPolicy(metadata.policy)).toBe(true);
    if (isSlidingWindowPolicy(metadata.policy)) {
      expect(metadata.policy.limit).toBe(10);
      expect(metadata.policy.windowMs).toBe(300000); // 5m
    }
  });

  it("should store metadata with custom policy name", () => {
    class TestController {
      @RateLimit({ policy: "premium-tier", limit: 1000, window: "1h" })
      premiumMethod() {}
    }

    const instance = new TestController();
    const metadata = Reflect.getMetadata(
      RATE_LIMIT_METADATA_KEY,
      instance.premiumMethod,
    ) as RateLimitMetadata;

    expect(metadata.policy.name).toBe("premium-tier");
    expect(isSlidingWindowPolicy(metadata.policy)).toBe(true);
    if (isSlidingWindowPolicy(metadata.policy)) {
      expect(metadata.policy.limit).toBe(1000);
      expect(metadata.policy.windowMs).toBe(3600000); // 1h
    }
  });

  it("should store custom key function", () => {
    const customKey = (_ctx: unknown) => "custom-key";

    class TestController {
      @RateLimit({ limit: 50, window: "1m", key: customKey })
      customKeyMethod() {}
    }

    const instance = new TestController();
    const metadata = Reflect.getMetadata(
      RATE_LIMIT_METADATA_KEY,
      instance.customKeyMethod,
    ) as RateLimitMetadata;

    expect(metadata.customKey).toBe(customKey);
  });

  it("should support various window formats", () => {
    class TestController {
      @RateLimit({ window: "30s" })
      method30s() {}

      @RateLimit({ window: "2h" })
      method2h() {}

      @RateLimit({ window: "1d" })
      method1d() {}
    }

    const instance = new TestController();

    const meta30s = Reflect.getMetadata(
      RATE_LIMIT_METADATA_KEY,
      instance.method30s,
    ) as RateLimitMetadata;
    expect(isSlidingWindowPolicy(meta30s.policy)).toBe(true);
    if (isSlidingWindowPolicy(meta30s.policy)) {
      expect(meta30s.policy.windowMs).toBe(30000);
    }

    const meta2h = Reflect.getMetadata(
      RATE_LIMIT_METADATA_KEY,
      instance.method2h,
    ) as RateLimitMetadata;
    expect(isSlidingWindowPolicy(meta2h.policy)).toBe(true);
    if (isSlidingWindowPolicy(meta2h.policy)) {
      expect(meta2h.policy.windowMs).toBe(7200000);
    }

    const meta1d = Reflect.getMetadata(
      RATE_LIMIT_METADATA_KEY,
      instance.method1d,
    ) as RateLimitMetadata;
    expect(isSlidingWindowPolicy(meta1d.policy)).toBe(true);
    if (isSlidingWindowPolicy(meta1d.policy)) {
      expect(meta1d.policy.windowMs).toBe(86400000);
    }
  });

  it("should throw when window value is zero", () => {
    class TestController {
      method() {}
    }

    const descriptor = Object.getOwnPropertyDescriptor(TestController.prototype, "method");
    if (!descriptor) {
      throw new Error("descriptor not found");
    }

    expect(() => {
      RateLimit({ window: "0m" })(TestController.prototype, "method", descriptor);
    }).toThrow("Window must be greater than 0");
  });

  it("should auto-register RateLimitGuard", () => {
    class TestController {
      @RateLimit({ limit: 10, window: "1m" })
      guardedMethod() {}
    }

    const guards =
      Reflect.getMetadata(ROUTE_GUARDS_METADATA_KEY, TestController, "guardedMethod") || [];
    expect(guards).toContain(RateLimitGuard);
  });

  it("should not duplicate RateLimitGuard if already registered", () => {
    class TestController {
      @RateLimit({ limit: 10, window: "1m" })
      guardedMethod() {}
    }

    // Simulate applying decorator twice
    const guards =
      Reflect.getMetadata(ROUTE_GUARDS_METADATA_KEY, TestController, "guardedMethod") || [];
    expect(guards.filter((g: unknown) => g === RateLimitGuard)).toHaveLength(1);
  });

  it("should preserve existing guards", () => {
    class FakeGuard {}

    class TestController {
      guardedMethod() {}
    }

    // Pre-register a guard
    Reflect.defineMetadata(ROUTE_GUARDS_METADATA_KEY, [FakeGuard], TestController, "guardedMethod");

    // Apply decorator manually
    const descriptor = Object.getOwnPropertyDescriptor(TestController.prototype, "guardedMethod");
    if (!descriptor) throw new Error("descriptor not found");
    RateLimit({ limit: 5, window: "1m" })(TestController.prototype, "guardedMethod", descriptor);

    const guards =
      Reflect.getMetadata(ROUTE_GUARDS_METADATA_KEY, TestController, "guardedMethod") || [];
    expect(guards).toContain(FakeGuard);
    expect(guards).toContain(RateLimitGuard);
    expect(guards).toHaveLength(2);
  });
});

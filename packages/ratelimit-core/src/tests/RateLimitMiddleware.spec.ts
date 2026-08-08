import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createRateLimitMiddleware,
  type HttpContext,
  RATE_LIMIT_CLIENT_IDENTITY_CONTEXT_KEY,
} from "../libs/middleware/rateLimitMiddleware";
import { RateLimitExceededProblem } from "../libs/problems/RateLimitExceededProblem";
import type { RateLimiter } from "../libs/RateLimiter";
import type { RateLimitPolicy, RateLimitResult } from "../libs/types";

describe("createRateLimitMiddleware", () => {
  let mockRateLimiter!: RateLimiter;
  const policy: RateLimitPolicy = {
    name: "test-global",
    algorithm: "sliding",
    limit: 100,
    windowMs: 3600000,
  };

  const successResult: RateLimitResult = {
    success: true,
    degraded: false,
    limit: 100,
    remaining: 99,
    resetAtMs: Date.now() + 3600000,
  };

  const failedResult: RateLimitResult = {
    success: false,
    degraded: false,
    limit: 100,
    remaining: 0,
    resetAtMs: Date.now() + 3600000,
  };

  const createContext = (overrides: Partial<HttpContext["req"]> = {}): HttpContext => {
    const store = new Map<string, unknown>();
    return {
      req: {
        method: "GET",
        path: "/api/test",
        headers: { "x-forwarded-for": "192.168.1.1" },
        ...overrides,
      },
      set: <T>(key: string, value: T) => {
        store.set(key, value);
      },
      get: <T>(key: string) => store.get(key) as T | undefined,
    };
  };

  beforeEach(() => {
    mockRateLimiter = {
      checkWithKey: vi.fn().mockResolvedValue(successResult),
    } as unknown as RateLimiter;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should allow request within limit", async () => {
    const middleware = createRateLimitMiddleware({
      rateLimiter: mockRateLimiter,
      policy,
    });
    const ctx = createContext();
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware(ctx, next);

    expect(next).toHaveBeenCalled();
    expect(ctx.get("rateLimitResult")).toEqual(successResult);
  });

  it("should throw RateLimitExceededProblem when limit exceeded", async () => {
    vi.mocked(mockRateLimiter.checkWithKey).mockResolvedValue(failedResult);
    const middleware = createRateLimitMiddleware({
      rateLimiter: mockRateLimiter,
      policy,
    });
    const ctx = createContext();
    const next = vi.fn();

    await expect(middleware(ctx, next)).rejects.toThrow(RateLimitExceededProblem);
    expect(next).not.toHaveBeenCalled();
  });

  it("should ignore spoofable proxy headers by default", async () => {
    const middleware = createRateLimitMiddleware({
      rateLimiter: mockRateLimiter,
      policy,
      keySegments: ["ip"],
    });
    const ctx = createContext({
      headers: {
        "x-forwarded-for": "10.0.0.1, 192.168.1.1",
        "x-real-ip": "203.0.113.9",
        "cf-connecting-ip": "203.0.113.7",
      },
    });
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware(ctx, next);

    expect(mockRateLimiter.checkWithKey).toHaveBeenCalledWith(
      'rl2:[["policy","test-global"],["ip","unknown"]]',
      policy,
      { failOpen: false },
    );
    expect(ctx.get(RATE_LIMIT_CLIENT_IDENTITY_CONTEXT_KEY)).toEqual({
      value: "unknown",
      source: "unknown",
      trusted: false,
    });
  });

  it("should use an explicit client IP context value", async () => {
    const middleware = createRateLimitMiddleware({
      rateLimiter: mockRateLimiter,
      policy,
      keySegments: ["ip"],
    });
    const ctx = createContext();
    ctx.set("clientIp", "203.0.113.9");
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware(ctx, next);

    expect(ctx.get("rateLimitKey")).toBe('rl2:[["policy","test-global"],["ip","203.0.113.9"]]');
    expect(ctx.get(RATE_LIMIT_CLIENT_IDENTITY_CONTEXT_KEY)).toEqual({
      value: "203.0.113.9",
      source: "context.clientIp",
      trusted: true,
    });
  });

  it("should preserve explicit client identity metadata", async () => {
    const middleware = createRateLimitMiddleware({
      rateLimiter: mockRateLimiter,
      policy,
      keySegments: ["ip"],
    });
    const ctx = createContext();
    const metadata = {
      value: "203.0.113.7",
      source: "runtime.lambda.requestContext.http.sourceIp",
      trusted: true,
      runtime: "lambda",
    };
    ctx.set(RATE_LIMIT_CLIENT_IDENTITY_CONTEXT_KEY, metadata);
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware(ctx, next);

    expect(mockRateLimiter.checkWithKey).toHaveBeenCalledWith(
      'rl2:[["policy","test-global"],["ip","203.0.113.7"]]',
      policy,
      { failOpen: false },
    );
    expect(ctx.get(RATE_LIMIT_CLIENT_IDENTITY_CONTEXT_KEY)).toEqual(metadata);
  });

  it("should store the consumed rate limit key in context", async () => {
    const middleware = createRateLimitMiddleware({
      rateLimiter: mockRateLimiter,
      policy,
      keySegments: ["ip"],
    });
    const ctx = createContext();
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware(ctx, next);

    expect(ctx.get("rateLimitKey")).toBe('rl2:[["policy","test-global"],["ip","unknown"]]');
  });

  it("should keep named policies using the same algorithm in distinct buckets", async () => {
    const firstPolicy = { ...policy, name: "login-per-ip" };
    const secondPolicy = { ...policy, name: "signup-per-ip" };
    const firstContext = createContext();
    const secondContext = createContext();

    await createRateLimitMiddleware({
      rateLimiter: mockRateLimiter,
      policy: firstPolicy,
      keySegments: ["ip"],
    })(firstContext, vi.fn().mockResolvedValue(undefined));
    await createRateLimitMiddleware({
      rateLimiter: mockRateLimiter,
      policy: secondPolicy,
      keySegments: ["ip"],
    })(secondContext, vi.fn().mockResolvedValue(undefined));

    expect(firstContext.get("rateLimitKey")).toBe(
      'rl2:[["policy","login-per-ip"],["ip","unknown"]]',
    );
    expect(secondContext.get("rateLimitKey")).toBe(
      'rl2:[["policy","signup-per-ip"],["ip","unknown"]]',
    );
  });

  it("should store rate limit headers in context", async () => {
    const middleware = createRateLimitMiddleware({
      rateLimiter: mockRateLimiter,
      policy,
      addHeaders: true,
    });
    const ctx = createContext();
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware(ctx, next);

    const headers = ctx.get<Record<string, string>>("rateLimitHeaders");
    expect(headers).not.toBeUndefined();
    expect(headers?.["X-RateLimit-Limit"]).toBe("100");
    expect(headers?.["X-RateLimit-Remaining"]).toBe("99");
  });

  it.each([
    { success: true, remaining: 100, retryAfter: undefined },
    { success: false, remaining: 0, retryAfter: "3" },
  ])("should expose policy-derived degraded headers when success is $success", async (testCase) => {
    vi.useFakeTimers();
    const now = Date.UTC(2026, 0, 1);
    vi.setSystemTime(now);
    vi.mocked(mockRateLimiter.checkWithKey).mockResolvedValue({
      success: testCase.success,
      degraded: true,
      limit: 100,
      remaining: testCase.remaining,
      resetAtMs: now + 2500,
    });
    const middleware = createRateLimitMiddleware({
      rateLimiter: mockRateLimiter,
      policy,
      addHeaders: true,
      failOpen: testCase.success,
    });
    const ctx = createContext();

    if (testCase.success) {
      await middleware(ctx, vi.fn().mockResolvedValue(undefined));
    } else {
      await expect(middleware(ctx, vi.fn())).rejects.toThrow(RateLimitExceededProblem);
    }

    expect(ctx.get<Record<string, string>>("rateLimitHeaders")).toEqual({
      "X-RateLimit-Limit": "100",
      "X-RateLimit-Remaining": String(testCase.remaining),
      "X-RateLimit-Reset": String(Math.ceil((now + 2500) / 1000)),
      ...(testCase.retryAfter === undefined ? {} : { "Retry-After": testCase.retryAfter }),
    });
  });

  it("should not add headers when addHeaders is false", async () => {
    const middleware = createRateLimitMiddleware({
      rateLimiter: mockRateLimiter,
      policy,
      addHeaders: false,
    });
    const ctx = createContext();
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware(ctx, next);

    expect(ctx.get("rateLimitHeaders")).toBeUndefined();
  });

  it("should include route in key when keySegments includes route", async () => {
    const middleware = createRateLimitMiddleware({
      rateLimiter: mockRateLimiter,
      policy,
      keySegments: ["ip", "route"],
    });
    const ctx = createContext({ method: "POST", path: "/api/orders" });
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware(ctx, next);

    expect(mockRateLimiter.checkWithKey).toHaveBeenCalledWith(
      'rl2:[["policy","test-global"],["ip","unknown"],["route",[["method","POST"],["path","/api/orders"]]]]',
      policy,
      { failOpen: false },
    );
  });
});

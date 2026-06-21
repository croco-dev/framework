import "reflect-metadata";

import { Container } from "@croco/framework-context";
import { Logger } from "@croco/framework-logger";
import { Controller, Get } from "@croco/protocols-rest";
import {
  createSlidingWindowPolicy,
  RateLimiter,
  RateLimitKeyBuilder,
  SlidingWindowInMemoryStore,
} from "@croco/ratelimit-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../libs/CrocoApp";
import { ErrorHandler } from "../libs/ErrorHandler";
import { HealthCheckRegistry } from "../libs/HealthCheckRegistry";
import {
  createRateLimitMiddlewareFactory,
  rateLimitHttpMiddleware,
} from "../libs/middleware/RateLimitMiddleware";

type RateLimitTestContext = Parameters<ReturnType<typeof rateLimitHttpMiddleware>>[0];

function createRateLimitTestContext(options: { path?: string; status?: number } = {}): {
  ctx: RateLimitTestContext;
  headers: Map<string, string>;
} {
  const store = new Map<string, unknown>();
  const headers = new Map<string, string>();
  const path = options.path ?? "/test";

  const ctx = {
    req: {
      method: "GET",
      path,
      headers: { "x-forwarded-for": "127.0.0.1" },
      url: `http://localhost${path}`,
    },
    res: { status: options.status ?? 200, headers: {} },
    raw: {
      header: (name: string, value: string) => {
        headers.set(name, value);
      },
      json: () => new Response(),
    },
    set: <T>(key: string, value: T) => {
      store.set(key, value);
    },
    get: <T>(key: string): T | undefined => store.get(key) as T | undefined,
    header: (name: string) => (name === "x-forwarded-for" ? "127.0.0.1" : undefined),
  } as unknown as RateLimitTestContext;

  return { ctx, headers };
}

describe("RateLimitMiddleware", () => {
  let rateLimiter: RateLimiter;

  @Controller("/limited")
  class RateLimitedController {
    @Get("/resource")
    getResource() {
      return { ok: true };
    }
  }

  beforeEach(() => {
    Container.reset();
    const logger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    } as unknown as Logger;
    Container.set(Logger, logger);
    Container.set(ErrorHandler, new ErrorHandler(logger));
    Container.set(HealthCheckRegistry, new HealthCheckRegistry());

    const store = new SlidingWindowInMemoryStore();
    const keyBuilder = new RateLimitKeyBuilder(["ip"]);
    rateLimiter = new RateLimiter(store, keyBuilder, { failOpen: false });
  });

  describe("rateLimitHttpMiddleware", () => {
    it("should allow requests within rate limit", async () => {
      const middleware = rateLimitHttpMiddleware({
        rateLimiter,
        policy: createSlidingWindowPolicy("test", 10, 60000),
      });

      let nextCalled = false;

      const ctx = {
        req: {
          method: "GET",
          path: "/test",
          headers: { "x-forwarded-for": "127.0.0.1" },
          url: "http://localhost/test",
        },
        res: { status: 200, headers: {} },
        raw: { header: () => {}, json: () => new Response() },
        set: () => {},
        get: () => undefined,
        header: (name: string) => (name === "x-forwarded-for" ? "127.0.0.1" : undefined),
      } as unknown as Parameters<typeof middleware>[0];

      await middleware(ctx, async () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
    });

    it("should block requests exceeding rate limit", async () => {
      const middleware = rateLimitHttpMiddleware({
        rateLimiter,
        policy: createSlidingWindowPolicy("strict", 1, 60000),
        failOpen: false,
      });

      const ctx = {
        req: {
          method: "GET",
          path: "/test",
          headers: { "x-forwarded-for": "127.0.0.1" },
          url: "http://localhost/test",
        },
        res: { status: 200, headers: {} },
        raw: { header: () => {}, json: () => new Response() },
        set: () => {},
        get: () => undefined,
        header: (name: string) => (name === "x-forwarded-for" ? "127.0.0.1" : undefined),
      } as unknown as Parameters<typeof middleware>[0];

      await middleware(ctx, async () => {});

      await expect(middleware(ctx, async () => {})).rejects.toThrow("Rate limit exceeded");
    });

    it("should add rate limit headers when addHeaders is true", async () => {
      const middleware = rateLimitHttpMiddleware({
        rateLimiter,
        policy: createSlidingWindowPolicy("test", 10, 60000),
        addHeaders: true,
      });

      const mockStore = new Map<string, unknown>();

      const ctx = {
        req: {
          method: "GET",
          path: "/test",
          headers: { "x-forwarded-for": "127.0.0.1" },
          url: "http://localhost/test",
        },
        res: { status: 200, headers: {} },
        raw: {
          header: () => {},
          json: () => new Response(),
        },
        set: <T>(key: string, value: T) => {
          mockStore.set(key, value);
        },
        get: <T>(key: string): T | undefined => mockStore.get(key) as T,
        header: (name: string) => (name === "x-forwarded-for" ? "127.0.0.1" : undefined),
      } as unknown as Parameters<typeof middleware>[0];

      await middleware(ctx, async () => {});

      const rateLimitHeaders = ctx.get<Record<string, string>>("rateLimitHeaders");
      expect(rateLimitHeaders).toBeDefined();
      expect(rateLimitHeaders?.["X-RateLimit-Limit"]).toBeDefined();
      expect(rateLimitHeaders?.["X-RateLimit-Remaining"]).toBeDefined();
    });

    it("should skip rate limiting when the skip predicate matches", async () => {
      const middleware = rateLimitHttpMiddleware({
        rateLimiter,
        policy: createSlidingWindowPolicy("strict", 1, 60000),
        skip: (ctx) => ctx.req.path === "/ops/health",
      });

      const ctx = {
        req: {
          method: "GET",
          path: "/ops/health",
          headers: { "x-forwarded-for": "127.0.0.1" },
          url: "http://localhost/ops/health",
        },
        res: { status: 200, headers: {} },
        raw: { header: () => {}, json: () => new Response() },
        set: () => {},
        get: () => undefined,
        header: (name: string) => (name === "x-forwarded-for" ? "127.0.0.1" : undefined),
      } as unknown as Parameters<typeof middleware>[0];

      let nextCalls = 0;

      await middleware(ctx, async () => {
        nextCalls += 1;
      });
      await middleware(ctx, async () => {
        nextCalls += 1;
      });

      expect(nextCalls).toBe(2);
    });

    it("should refund successful responses when skipSuccessfulRequests is enabled", async () => {
      const middleware = rateLimitHttpMiddleware({
        rateLimiter,
        policy: createSlidingWindowPolicy("strict-success", 1, 60000),
        skipSuccessfulRequests: true,
      });

      let nextCalls = 0;

      for (let i = 0; i < 2; i++) {
        const { ctx } = createRateLimitTestContext();

        await middleware(ctx, async () => {
          ctx.res.status = 204;
          nextCalls += 1;
        });
      }

      expect(nextCalls).toBe(2);
    });

    it("should refund the original successful response when completions are out of order", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

      const middleware = rateLimitHttpMiddleware({
        rateLimiter,
        policy: createSlidingWindowPolicy("strict-out-of-order", 2, 60000),
        skipSuccessfulRequests: true,
      });
      const { ctx: firstCtx } = createRateLimitTestContext();
      let releaseFirst: () => void = () => {};
      const firstPending = new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });

      const firstRequest = middleware(firstCtx, async () => {
        await firstPending;
        firstCtx.res.status = 200;
      });

      vi.advanceTimersByTime(1000);
      const { ctx: secondCtx } = createRateLimitTestContext({ status: 500 });
      await middleware(secondCtx, async () => {
        secondCtx.res.status = 500;
      });

      releaseFirst();
      await firstRequest;

      vi.advanceTimersByTime(1000);
      const { ctx: thirdCtx, headers: thirdHeaders } = createRateLimitTestContext({ status: 500 });
      await middleware(thirdCtx, async () => {
        thirdCtx.res.status = 500;
      });

      expect(thirdHeaders.get("X-RateLimit-Reset")).toBe(
        String(Math.ceil((Date.UTC(2026, 0, 1, 0, 0, 1) + 60000) / 1000)),
      );

      vi.useRealTimers();
    });

    it("should refund failed responses when skipFailedRequests is enabled", async () => {
      const middleware = rateLimitHttpMiddleware({
        rateLimiter,
        policy: createSlidingWindowPolicy("strict-failure", 1, 60000),
        skipFailedRequests: true,
      });

      let nextCalls = 0;

      for (let i = 0; i < 2; i++) {
        const { ctx } = createRateLimitTestContext({ status: 500 });

        await middleware(ctx, async () => {
          ctx.res.status = 500;
          nextCalls += 1;
        });
      }

      expect(nextCalls).toBe(2);
    });

    it("should refund thrown failed responses when skipFailedRequests is enabled", async () => {
      const middleware = rateLimitHttpMiddleware({
        rateLimiter,
        policy: createSlidingWindowPolicy("strict-thrown-failure", 1, 60000),
        skipFailedRequests: true,
      });

      let nextCalls = 0;

      for (let i = 0; i < 2; i++) {
        const { ctx } = createRateLimitTestContext();

        await expect(
          middleware(ctx, async () => {
            nextCalls += 1;
            throw new Error("handler failed");
          }),
        ).rejects.toThrow("handler failed");
      }

      expect(nextCalls).toBe(2);
    });

    it("should keep rate limit headers for outcomes that remain counted", async () => {
      const middleware = rateLimitHttpMiddleware({
        rateLimiter,
        policy: createSlidingWindowPolicy("strict-counted", 1, 60000),
        skipSuccessfulRequests: true,
      });
      const { ctx, headers } = createRateLimitTestContext({ status: 500 });

      await middleware(ctx, async () => {
        ctx.res.status = 500;
      });

      expect(headers.get("X-RateLimit-Limit")).toBe("1");
      expect(headers.get("X-RateLimit-Remaining")).toBe("0");
    });

    it("should apply outcome refunds through the rate limit middleware factory", async () => {
      const factory = createRateLimitMiddlewareFactory({
        rateLimiter,
        defaultPolicy: createSlidingWindowPolicy("factory-strict", 1, 60000),
        skipSuccessfulRequests: true,
      });
      const middleware = factory();
      let nextCalls = 0;

      for (let i = 0; i < 2; i++) {
        const { ctx } = createRateLimitTestContext();

        await middleware(ctx, async () => {
          ctx.res.status = 200;
          nextCalls += 1;
        });
      }

      expect(nextCalls).toBe(2);
    });
  });

  describe("integration with CrocoApp", () => {
    it("should apply rate limiting to all requests", async () => {
      const app = createApp({
        controllers: [],
        middlewares: [
          rateLimitHttpMiddleware({
            rateLimiter,
            policy: createSlidingWindowPolicy("api", 5, 60000),
          }),
        ],
      });

      const response = await app.fetch(
        new Request("http://localhost/test", {
          headers: { "x-forwarded-for": "127.0.0.1" },
        }),
      );

      expect(response.status).toBe(404);
    });

    it("should include recovery headers on 429 Problem responses", async () => {
      const app = createApp({
        controllers: [RateLimitedController],
        middlewares: [
          rateLimitHttpMiddleware({
            rateLimiter,
            policy: createSlidingWindowPolicy("api", 1, 60000),
            addHeaders: true,
          }),
        ],
        securityValidation: "off",
      });
      const request = () =>
        new Request("http://localhost/limited/resource", {
          headers: { "x-forwarded-for": "127.0.0.1" },
        });

      const allowed = await app.fetch(request());
      const rejected = await app.fetch(request());

      expect(allowed.status).toBe(200);
      expect(allowed.headers.get("X-RateLimit-Limit")).toBe("1");
      expect(allowed.headers.get("X-RateLimit-Remaining")).toBe("0");
      expect(allowed.headers.get("Retry-After")).toBeNull();

      expect(rejected.status).toBe(429);
      expect(rejected.headers.get("Retry-After")).not.toBeNull();
      expect(rejected.headers.get("X-RateLimit-Limit")).toBe("1");
      expect(rejected.headers.get("X-RateLimit-Remaining")).toBe("0");
      expect(rejected.headers.get("X-RateLimit-Reset")).not.toBeNull();

      const body = await rejected.json();
      expect(body).toMatchObject({
        code: "RATE_LIMIT_EXCEEDED",
        status: 429,
      });
    });

    it("should suppress 429 recovery headers when addHeaders is false", async () => {
      const app = createApp({
        controllers: [RateLimitedController],
        middlewares: [
          rateLimitHttpMiddleware({
            rateLimiter,
            policy: createSlidingWindowPolicy("api", 1, 60000),
            addHeaders: false,
          }),
        ],
        securityValidation: "off",
      });
      const request = () =>
        new Request("http://localhost/limited/resource", {
          headers: { "x-forwarded-for": "127.0.0.1" },
        });

      await app.fetch(request());
      const rejected = await app.fetch(request());

      expect(rejected.status).toBe(429);
      expect(rejected.headers.get("Retry-After")).toBeNull();
      expect(rejected.headers.get("X-RateLimit-Limit")).toBeNull();
      expect(rejected.headers.get("X-RateLimit-Remaining")).toBeNull();
      expect(rejected.headers.get("X-RateLimit-Reset")).toBeNull();
    });
  });
});

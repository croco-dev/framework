import "reflect-metadata";

import { Container } from "@croco/framework-context";
import { Logger } from "@croco/framework-logger";
import {
  createSlidingWindowPolicy,
  RateLimiter,
  RateLimitKeyBuilder,
  SlidingWindowInMemoryStore,
} from "@croco/ratelimit-core";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../libs/CrocoApp";
import { ErrorHandler } from "../libs/ErrorHandler";
import { HealthCheckRegistry } from "../libs/HealthCheckRegistry";
import { rateLimitHttpMiddleware } from "../libs/middleware/RateLimitMiddleware";

describe("RateLimitMiddleware", () => {
  let rateLimiter: RateLimiter;

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
  });
});

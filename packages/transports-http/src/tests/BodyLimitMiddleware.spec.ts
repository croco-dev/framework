import "reflect-metadata";

import { Container } from "@croco/framework-context";
import { Logger } from "@croco/framework-logger";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../libs/CrocoApp";
import { ErrorHandler } from "../libs/ErrorHandler";
import { HealthCheckRegistry } from "../libs/HealthCheckRegistry";
import { bodyLimitMiddleware, kb, mb } from "../libs/middleware/BodyLimitMiddleware";

describe("BodyLimitMiddleware", () => {
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
  });

  describe("bodyLimitMiddleware", () => {
    it("should allow requests under the limit", async () => {
      const middleware = bodyLimitMiddleware({ limit: 1024 });
      let nextCalled = false;

      const ctx = {
        req: { method: "POST", path: "/test", headers: {}, url: "http://localhost/test" },
        res: { status: 200, headers: {} },
        raw: { header: () => {}, json: () => new Response() },
        header: (name: string) => (name === "content-length" ? "500" : undefined),
      } as unknown as Parameters<typeof middleware>[0];

      await middleware(ctx, async () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
    });

    it("should reject requests over the limit", async () => {
      const middleware = bodyLimitMiddleware({ limit: 1024 });

      const ctx = {
        req: { method: "POST", path: "/test", headers: {}, url: "http://localhost/test" },
        res: { status: 200, headers: {} },
        raw: { header: () => {}, json: () => new Response() },
        header: (name: string) => (name === "content-length" ? "2048" : undefined),
        jsonResponse: (body: unknown, status: number) => {
          ctx.res.status = status;
          return new Response(JSON.stringify(body), { status });
        },
      } as unknown as Parameters<typeof middleware>[0];

      await expect(middleware(ctx, async () => {})).rejects.toBeDefined();
      expect(ctx.res.status).toBe(413);
    });

    it("should use default limit of 1MB", async () => {
      const middleware = bodyLimitMiddleware();
      let nextCalled = false;

      const ctx = {
        req: { method: "POST", path: "/test", headers: {}, url: "http://localhost/test" },
        res: { status: 200, headers: {} },
        raw: { header: () => {}, json: () => new Response() },
        header: (name: string) => (name === "content-length" ? "500000" : undefined),
      } as unknown as Parameters<typeof middleware>[0];

      await middleware(ctx, async () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
    });

    it("should handle missing content-length header", async () => {
      const middleware = bodyLimitMiddleware({ limit: 1024 });
      let nextCalled = false;

      const ctx = {
        req: { method: "POST", path: "/test", headers: {}, url: "http://localhost/test" },
        res: { status: 200, headers: {} },
        raw: { header: () => {}, json: () => new Response() },
        header: () => undefined,
      } as unknown as Parameters<typeof middleware>[0];

      await middleware(ctx, async () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
    });

    it("should support custom status code", async () => {
      const middleware = bodyLimitMiddleware({ limit: 1024, statusCode: 400 });

      const ctx = {
        req: { method: "POST", path: "/test", headers: {}, url: "http://localhost/test" },
        res: { status: 200, headers: {} },
        raw: { header: () => {}, json: () => new Response() },
        header: (name: string) => (name === "content-length" ? "2048" : undefined),
        jsonResponse: (body: unknown, status: number) => {
          ctx.res.status = status;
          return new Response(JSON.stringify(body), { status });
        },
      } as unknown as Parameters<typeof middleware>[0];

      await expect(middleware(ctx, async () => {})).rejects.toBeDefined();
      expect(ctx.res.status).toBe(400);
    });
  });

  describe("helper functions", () => {
    it("should convert MB to bytes", () => {
      expect(mb(1)).toBe(1024 * 1024);
      expect(mb(10)).toBe(10 * 1024 * 1024);
    });

    it("should convert KB to bytes", () => {
      expect(kb(1)).toBe(1024);
      expect(kb(100)).toBe(100 * 1024);
    });
  });
});

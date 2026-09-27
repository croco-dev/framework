import "reflect-metadata";
import { Container } from "@croco/framework-context";
import { Logger } from "@croco/framework-logger";
import { Controller, Get } from "@croco/protocols-rest";
import {
  RateLimit,
  RateLimitExceededProblem,
  RateLimitGuard,
  RateLimiter,
  RateLimitKeyBuilder,
  SlidingWindowInMemoryStore,
} from "@croco/ratelimit-core";
import type { GuardContext, KeySegment, RateLimitResult } from "@croco/ratelimit-core";
import type { ExecutionContext } from "@croco/protocols-rest";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../libs/CrocoApp";
import { ErrorHandler } from "../libs/ErrorHandler";
import { HealthCheckRegistry } from "../libs/HealthCheckRegistry";
import { HttpContext } from "../libs/HttpContext";
import { HttpExecutionContext } from "../libs/HttpExecutionContext";

const handleResource = vi.fn(() => ({ ok: true }));

@Controller("/limited")
class LimitedController {
  @Get("/resource")
  @RateLimit({ limit: 1, window: "1m" })
  resource() {
    return handleResource();
  }

  @Get("/plain")
  plain() {
    return { ok: true };
  }
}

describe("RateLimitGuard HTTP integration", () => {
  let guard: RateLimitGuard;

  beforeEach(() => {
    Container.reset();
    handleResource.mockClear();
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      fatal: vi.fn(),
      child: () => logger,
    } as unknown as Logger;
    Container.set(Logger, logger);
    Container.set(ErrorHandler, new ErrorHandler(logger));
    Container.set(HealthCheckRegistry, new HealthCheckRegistry());
    guard = new RateLimitGuard(
      new RateLimiter(new SlidingWindowInMemoryStore(), new RateLimitKeyBuilder(["user"])),
    );
    Container.set(RateLimitGuard, guard);
  });

  it("should enforce quota and share results through HttpExecutionContext", async () => {
    const app = new Hono();
    const results: RateLimitResult[] = [];
    app.get("/resource", async (raw) => {
      const http = new HttpContext(raw);
      http.set("userId", "alice");
      const context: GuardContext = new HttpExecutionContext(http, LimitedController, "resource");
      expect(context.get("userId")).toBe("alice");
      try {
        await guard.canActivate(context);
        return raw.json({ ok: true });
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitExceededProblem);
        expect(error).toMatchObject({ status: 429, code: "RATE_LIMIT_EXCEEDED" });
        return raw.json({ limited: true }, 429);
      } finally {
        const result = http.get<RateLimitResult>("rateLimitResult");
        expect(result).toBeDefined();
        if (result) results.push(result);
      }
    });

    expect((await app.request("/resource")).status).toBe(200);
    expect((await app.request("/resource")).status).toBe(429);
    expect(results.map((result) => result.success)).toEqual([true, false]);
  });

  it("should return 429 through the auto-registered controller guard and isolate users", async () => {
    const app = createApp({
      controllers: [LimitedController],
      middlewares: [
        async (context, next) => {
          context.set("userId", context.header("x-test-user"));
          return next();
        },
      ],
      securityValidation: "off",
    });
    const request = (user: string, path = "/limited/resource") =>
      app.fetch(new Request(`http://localhost${path}`, { headers: { "x-test-user": user } }));

    expect((await request("alice")).status).toBe(200);
    const denied = await request("alice");
    expect(denied.status).toBe(429);
    expect(await denied.json()).toMatchObject({ status: 429, code: "RATE_LIMIT_EXCEEDED" });
    expect((await request("bob")).status).toBe(200);
    expect(handleResource).toHaveBeenCalledTimes(2);
    expect((await request("alice", "/limited/plain")).status).toBe(200);
  });
});

type AuthenticatedRequest = Request & { user?: unknown; principal?: unknown; apiKey?: unknown };

class HeaderAuthGuard {
  canActivate(context: ExecutionContext): boolean {
    const request = context.getRequest() as AuthenticatedRequest;
    const apiKey = request.headers.get("x-api-key");
    if (apiKey) {
      const principal = { id: apiKey, type: "apikey", keyId: apiKey };
      request.principal = principal;
      request.apiKey = principal;
      return true;
    }

    const userId = request.headers.get("x-user-id");
    if (!userId) return false;
    const user = { id: userId, roles: [], permissions: [] };
    request.principal = { ...user, type: "user" };
    request.user = user;
    return true;
  }
}

@Controller("/reports")
class ReportController {
  @Get("/export")
  @RateLimit({ limit: 1, window: "1m" })
  export() {
    return { ok: true };
  }
}

function createReportApp(segment: KeySegment) {
  Container.set(
    RateLimitGuard,
    new RateLimitGuard(
      new RateLimiter(new SlidingWindowInMemoryStore(), new RateLimitKeyBuilder([segment])),
    ),
  );
  return createApp({
    controllers: [ReportController],
    globalGuards: [new HeaderAuthGuard()],
    securityValidation: "off",
    diValidation: "off",
  });
}

function exportWith(headers: Record<string, string>): Request {
  return new Request("http://localhost/reports/export", { headers });
}

describe("RateLimitGuard principal key segments", () => {
  beforeEach(() => Container.reset());

  it("keys the user segment by the authenticated user", async () => {
    const app = createReportApp("user");

    expect((await app.fetch(exportWith({ "x-user-id": "user-1" }))).status).toBe(200);
    expect((await app.fetch(exportWith({ "x-user-id": "user-2" }))).status).toBe(200);
    expect((await app.fetch(exportWith({ "x-user-id": "user-1" }))).status).toBe(429);
  });

  it("keys the apiKey segment by the authenticated API key", async () => {
    const app = createReportApp("apiKey");

    expect((await app.fetch(exportWith({ "x-api-key": "key-1" }))).status).toBe(200);
    expect((await app.fetch(exportWith({ "x-api-key": "key-2" }))).status).toBe(200);
    expect((await app.fetch(exportWith({ "x-api-key": "key-1" }))).status).toBe(429);
  });
});

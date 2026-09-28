import "reflect-metadata";
import type { AddressInfo } from "node:net";
import { Container } from "@croco/framework-context";
import {
  type CallHandler,
  Controller,
  type ExecutionContext,
  Get,
  type Interceptor,
  UseGuards,
  UseInterceptors,
} from "@croco/protocols-rest";
import {
  RateLimit,
  RateLimitGuard,
  RateLimiter,
  RateLimitKeyBuilder,
  SlidingWindowInMemoryStore,
} from "@croco/ratelimit-core";
import { createTRPCClient, httpLink } from "@trpc/client";
import type { AnyRouter } from "@trpc/server";
import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTrpcRouter } from "../libs/createTrpcRouter";

type ContextStorage = {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
};

let nextContextValue = 0;
let customRateLimitKey = "reports-export-a";

class ContextWritingGuard {
  canActivate(context: ExecutionContext): boolean {
    const storage = context as ExecutionContext & ContextStorage;
    expect(storage.get<number>("shared-value")).toBeUndefined();
    storage.set("shared-value", ++nextContextValue);
    return true;
  }
}

class ContextReadingInterceptor implements Interceptor<ExecutionContext> {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<unknown> {
    return {
      fromGuard: (context as ExecutionContext & ContextStorage).get<number>("shared-value"),
      response: await next.handle(),
    };
  }
}

@Controller("/reports")
class ReportController {
  @Get("/summary")
  @RateLimit({ limit: 1, window: "1m" })
  summary(): { ok: boolean } {
    return { ok: true };
  }

  @Get("/export")
  @RateLimit({ limit: 1, window: "1m", key: () => customRateLimitKey })
  export(): { ok: boolean } {
    return { ok: true };
  }

  @Get("/shared")
  @UseGuards(ContextWritingGuard)
  @UseInterceptors(ContextReadingInterceptor)
  shared(): string {
    return "ok";
  }
}

type ReportClient = {
  readonly report: {
    readonly summary: { query: () => Promise<{ ok: boolean }> };
    readonly export: { query: () => Promise<{ ok: boolean }> };
    readonly shared: { query: () => Promise<{ fromGuard: number; response: string }> };
  };
};

describe("tRPC procedures decorated with @RateLimit", () => {
  let server: ReturnType<typeof createHTTPServer>;
  let client: ReportClient;

  beforeEach(async () => {
    nextContextValue = 0;
    customRateLimitKey = "reports-export-a";
    Container.reset();
    Container.set(
      RateLimitGuard,
      new RateLimitGuard(
        new RateLimiter(new SlidingWindowInMemoryStore(), new RateLimitKeyBuilder(["route"])),
      ),
    );
    server = createHTTPServer({
      router: createTrpcRouter([ReportController]),
      createContext: () => ({}),
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    client = createTRPCClient<AnyRouter>({
      links: [httpLink({ url: `http://127.0.0.1:${port}` })],
    }) as unknown as ReportClient;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("allows the first default-key call and rejects the second with a Croco rate-limit problem", async () => {
    await expect(client.report.summary.query()).resolves.toEqual({ ok: true });
    await expect(client.report.summary.query()).rejects.toMatchObject({
      meta: { response: { status: 429 } },
      data: expect.objectContaining({
        code: "TOO_MANY_REQUESTS",
        httpStatus: 429,
        croco: expect.objectContaining({ code: "RATE_LIMIT_EXCEEDED", status: 429 }),
      }),
    });
  });

  it("applies each custom key's limit independently", async () => {
    await expect(client.report.export.query()).resolves.toEqual({ ok: true });
    await expect(client.report.export.query()).rejects.toMatchObject({
      meta: { response: { status: 429 } },
      data: expect.objectContaining({
        code: "TOO_MANY_REQUESTS",
        httpStatus: 429,
        croco: expect.objectContaining({ code: "RATE_LIMIT_EXCEEDED", status: 429 }),
      }),
    });

    customRateLimitKey = "reports-export-b";
    await expect(client.report.export.query()).resolves.toEqual({ ok: true });
    await expect(client.report.export.query()).rejects.toMatchObject({
      meta: { response: { status: 429 } },
      data: expect.objectContaining({
        code: "TOO_MANY_REQUESTS",
        httpStatus: 429,
        croco: expect.objectContaining({ code: "RATE_LIMIT_EXCEEDED", status: 429 }),
      }),
    });
  });

  it("shares context values from a guard with an interceptor in the same call", async () => {
    await expect(client.report.shared.query()).resolves.toEqual({ fromGuard: 1, response: "ok" });
    await expect(client.report.shared.query()).resolves.toEqual({ fromGuard: 2, response: "ok" });
  });
});

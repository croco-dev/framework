import { describe, expect, it, vi } from "vitest";
import {
  type SecurityHeadersOptions,
  securityHeadersMiddleware,
} from "../libs/middleware/SecurityHeadersMiddleware";
import type { CrocoHttpContext } from "../libs/types";

function createMockContext(): CrocoHttpContext {
  const resHeaders: Record<string, string> = {};

  return {
    req: {
      method: "GET",
      url: "https://api.example.com/test",
      path: "/test",
      params: {},
      query: {},
      headers: {},
    },
    res: {
      status: 200,
      headers: resHeaders,
    },
    raw: {
      header: vi.fn((name: string, value: string) => {
        resHeaders[name] = value;
      }),
    } as unknown as CrocoHttpContext["raw"],
    param: vi.fn(),
    query: vi.fn(),
    header: vi.fn(),
    json: vi.fn(),
    set: vi.fn(),
    get: vi.fn(),
    text: vi.fn(),
    jsonResponse: vi.fn(),
    redirect: vi.fn(),
  };
}

describe("securityHeadersMiddleware", () => {
  it("should add all security headers by default", async () => {
    const ctx = createMockContext();
    const middleware = securityHeadersMiddleware();
    const next = vi.fn();

    await middleware(ctx, next);

    expect(next).toHaveBeenCalledOnce();
    expect(ctx.raw.header).toHaveBeenCalledWith("X-Content-Type-Options", "nosniff");
    expect(ctx.raw.header).toHaveBeenCalledWith(
      "Strict-Transport-Security",
      expect.stringContaining("max-age="),
    );
    expect(ctx.raw.header).toHaveBeenCalledWith("X-Frame-Options", "DENY");
    expect(ctx.raw.header).toHaveBeenCalledWith("X-XSS-Protection", "1; mode=block");
    expect(ctx.raw.header).toHaveBeenCalledWith(
      "Referrer-Policy",
      "strict-origin-when-cross-origin",
    );
  });

  it("should set correct HSTS header with includeSubDomains", async () => {
    const ctx = createMockContext();
    const middleware = securityHeadersMiddleware();
    const next = vi.fn();

    await middleware(ctx, next);

    expect(ctx.raw.header).toHaveBeenCalledWith(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  });

  it("should disable X-Content-Type-Options when option is false", async () => {
    const ctx = createMockContext();
    const middleware = securityHeadersMiddleware({ contentTypeOptions: false });
    const next = vi.fn();

    await middleware(ctx, next);

    expect(ctx.raw.header).not.toHaveBeenCalledWith("X-Content-Type-Options", expect.any(String));
  });

  it("should disable Strict-Transport-Security when option is false", async () => {
    const ctx = createMockContext();
    const middleware = securityHeadersMiddleware({ strictTransportSecurity: false });
    const next = vi.fn();

    await middleware(ctx, next);

    expect(ctx.raw.header).not.toHaveBeenCalledWith(
      "Strict-Transport-Security",
      expect.any(String),
    );
  });

  it("should disable X-Frame-Options when option is false", async () => {
    const ctx = createMockContext();
    const middleware = securityHeadersMiddleware({ frameOptions: false });
    const next = vi.fn();

    await middleware(ctx, next);

    expect(ctx.raw.header).not.toHaveBeenCalledWith("X-Frame-Options", expect.any(String));
  });

  it("should disable X-XSS-Protection when option is false", async () => {
    const ctx = createMockContext();
    const middleware = securityHeadersMiddleware({ xssProtection: false });
    const next = vi.fn();

    await middleware(ctx, next);

    expect(ctx.raw.header).not.toHaveBeenCalledWith("X-XSS-Protection", expect.any(String));
  });

  it("should disable Referrer-Policy when option is false", async () => {
    const ctx = createMockContext();
    const middleware = securityHeadersMiddleware({ referrerPolicy: false });
    const next = vi.fn();

    await middleware(ctx, next);

    expect(ctx.raw.header).not.toHaveBeenCalledWith("Referrer-Policy", expect.any(String));
  });

  it("should disable multiple headers", async () => {
    const ctx = createMockContext();
    const options: SecurityHeadersOptions = {
      contentTypeOptions: false,
      frameOptions: false,
    };
    const middleware = securityHeadersMiddleware(options);
    const next = vi.fn();

    await middleware(ctx, next);

    expect(ctx.raw.header).not.toHaveBeenCalledWith("X-Content-Type-Options", expect.any(String));
    expect(ctx.raw.header).not.toHaveBeenCalledWith("X-Frame-Options", expect.any(String));
    expect(ctx.raw.header).toHaveBeenCalledWith("Strict-Transport-Security", expect.any(String));
    expect(ctx.raw.header).toHaveBeenCalledWith("X-XSS-Protection", expect.any(String));
    expect(ctx.raw.header).toHaveBeenCalledWith("Referrer-Policy", expect.any(String));
  });
});

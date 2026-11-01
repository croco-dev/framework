import "reflect-metadata";
import { Container } from "@croco/framework-context";
import { All, Controller, Delete, Options, Post, Put } from "@croco/protocols-rest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../libs/CrocoApp";
import { type CorsOptions, corsMiddleware } from "../libs/middleware/CorsMiddleware";
import { declareSecurityMiddlewareCapabilities } from "../libs/middleware/SecurityMiddlewareMarker";
import type { CrocoHttpContext, MiddlewareFunction } from "../libs/types";

const WEB_ORIGIN = "https://console.example.com";

@Controller("/users")
class UserController {
  @Post("")
  create() {
    return { created: true };
  }

  @Put("/:id")
  update() {
    return { updated: true };
  }

  @Delete("/:id")
  remove() {
    return { removed: true };
  }
}

@Controller("/explicit")
class ExplicitOptionsController {
  @Post("")
  create() {
    return { created: true };
  }

  @Options("")
  options() {
    return { handler: "options" };
  }

  @Options("/capabilities")
  capabilities() {
    return new Response(JSON.stringify({ capability: true }), {
      status: 202,
      headers: { "Content-Type": "application/json", Vary: "Accept-Language" },
    });
  }
}

@Controller("/all")
class AllController {
  @All("")
  handle() {
    return { handler: "all" };
  }
}

@Controller("/probe")
class OverlappingOptionsController {
  @Post("/known")
  create() {
    return { created: true };
  }

  @Options("/:id")
  options() {
    return { handler: "options" };
  }
}

function preflight(path: string, method: string, origin = WEB_ORIGIN): Request {
  return new Request(`https://api.example.com${path}`, {
    method: "OPTIONS",
    headers: {
      origin,
      "access-control-request-method": method,
      "access-control-request-headers": "content-type",
    },
  });
}

function createMockContext(
  method: string,
  origin?: string,
  requestHeaders: Record<string, string> = {},
): CrocoHttpContext {
  const headers: Record<string, string> = { ...requestHeaders };
  if (origin) {
    headers.origin = origin;
  }

  const resHeaders: Record<string, string> = {};
  const responseHeaders = new Headers();

  return {
    req: {
      method,
      url: "https://api.example.com/test",
      path: "/test",
      params: {},
      query: {},
      headers,
    },
    res: {
      status: 200,
      headers: resHeaders,
    },
    raw: {
      res: { headers: responseHeaders },
      header: vi.fn((name: string, value: string) => {
        resHeaders[name] = value;
        responseHeaders.set(name, value);
      }),
    } as unknown as CrocoHttpContext["raw"],
    param: vi.fn(),
    query: vi.fn(),
    header: vi.fn((name: string) => headers[name.toLowerCase()]),
    json: vi.fn(),
    set: vi.fn(),
    get: vi.fn(),
    text: vi.fn(),
    jsonResponse: vi.fn(),
    redirect: vi.fn(),
  };
}

describe("corsMiddleware", () => {
  const defaultOptions: CorsOptions = {
    origins: ["https://example.com", "https://app.example.com"],
  };

  it("should add CORS headers without treating GET as preflight", async () => {
    const ctx = createMockContext("GET", "https://example.com", {
      "access-control-request-method": "POST",
    });
    const middleware = corsMiddleware(defaultOptions);
    const next = vi.fn();

    await middleware(ctx, next);

    expect(next).toHaveBeenCalledOnce();
    expect(ctx.raw.header).toHaveBeenCalledWith(
      "Access-Control-Allow-Origin",
      "https://example.com",
    );
    expect(ctx.raw.header).toHaveBeenCalledWith("Access-Control-Allow-Methods", expect.any(String));
  });

  it("should not add CORS headers for disallowed origin", async () => {
    const ctx = createMockContext("GET", "https://malicious.com");
    const middleware = corsMiddleware(defaultOptions);
    const next = vi.fn();

    await middleware(ctx, next);

    expect(next).toHaveBeenCalledOnce();
    expect(ctx.raw.header).toHaveBeenCalledWith("Vary", "Origin");
    expect(ctx.raw.header).not.toHaveBeenCalledWith(
      "Access-Control-Allow-Origin",
      expect.any(String),
    );
  });

  it("should not add CORS headers when origin header is missing", async () => {
    const ctx = createMockContext("GET");
    const middleware = corsMiddleware(defaultOptions);
    const next = vi.fn();

    await middleware(ctx, next);

    expect(next).toHaveBeenCalledOnce();
    expect(ctx.raw.header).toHaveBeenCalledWith("Vary", "Origin");
    expect(ctx.raw.header).not.toHaveBeenCalledWith(
      "Access-Control-Allow-Origin",
      expect.any(String),
    );
  });

  it("should handle preflight OPTIONS request with 204", async () => {
    const ctx = createMockContext("OPTIONS", "https://example.com", {
      "access-control-request-method": "POST",
    });
    const middleware = corsMiddleware(defaultOptions);
    const next = vi.fn();

    await middleware(ctx, next);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.res.status).toBe(204);
    expect(ctx.raw.header).toHaveBeenCalledWith("Access-Control-Max-Age", expect.any(String));
  });

  it("should use custom methods", async () => {
    const ctx = createMockContext("GET", "https://example.com");
    const middleware = corsMiddleware({
      ...defaultOptions,
      methods: ["GET", "POST"],
    });
    const next = vi.fn();

    await middleware(ctx, next);

    expect(ctx.raw.header).toHaveBeenCalledWith("Access-Control-Allow-Methods", "GET, POST");
  });

  it("should add allowedHeaders when provided", async () => {
    const ctx = createMockContext("GET", "https://example.com");
    const middleware = corsMiddleware({
      ...defaultOptions,
      allowedHeaders: ["Content-Type", "Authorization"],
    });
    const next = vi.fn();

    await middleware(ctx, next);

    expect(ctx.raw.header).toHaveBeenCalledWith(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );
  });

  it("should add credentials header when enabled", async () => {
    const ctx = createMockContext("GET", "https://example.com");
    const middleware = corsMiddleware({
      ...defaultOptions,
      credentials: true,
    });
    const next = vi.fn();

    await middleware(ctx, next);

    expect(ctx.raw.header).toHaveBeenCalledWith("Access-Control-Allow-Credentials", "true");
  });

  it("should use custom maxAge for preflight", async () => {
    const ctx = createMockContext("OPTIONS", "https://example.com", {
      "access-control-request-method": "POST",
    });
    const middleware = corsMiddleware({
      ...defaultOptions,
      maxAge: 3600,
    });
    const next = vi.fn();

    await middleware(ctx, next);

    expect(ctx.raw.header).toHaveBeenCalledWith("Access-Control-Max-Age", "3600");
  });
});

describe("CORS preflight routing", () => {
  beforeEach(() => Container.reset());

  it.each([
    ["/users", "POST"],
    ["/users/u1", "PUT"],
    ["/users/u1", "DELETE"],
  ])("answers %s %s without an explicit OPTIONS route", async (path, method) => {
    const app = createApp({
      controllers: [UserController],
      securityValidation: "off",
      middlewares: [corsMiddleware({ origins: [WEB_ORIGIN] })],
    });

    const response = await app.fetch(preflight(path, method));

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(WEB_ORIGIN);
    expect(response.headers.get("access-control-allow-methods")).toContain(method);
    expect(response.headers.get("access-control-allow-headers")).toBe("content-type");
    expect(response.headers.get("vary")?.split(", ")).toEqual(
      expect.arrayContaining(["Origin", "Access-Control-Request-Headers"]),
    );
  });

  it.each([undefined, "", "   "])(
    "preserves an ordinary OPTIONS handler when request-method is %j",
    async (requestMethod) => {
      const app = createApp({
        controllers: [ExplicitOptionsController],
        securityValidation: "off",
        middlewares: [corsMiddleware({ origins: [WEB_ORIGIN], credentials: true })],
      });
      const headers = new Headers({
        origin: WEB_ORIGIN,
        "access-control-request-headers": "x-ordinary",
      });
      if (requestMethod !== undefined) {
        headers.set("Access-Control-Request-Method", requestMethod);
      }

      const response = await app.fetch(
        new Request("https://api.example.com/explicit/capabilities", {
          method: "OPTIONS",
          headers,
        }),
      );

      expect(response.status).toBe(202);
      expect(await response.json()).toEqual({ capability: true });
      expect(response.headers.get("access-control-allow-origin")).toBe(WEB_ORIGIN);
      expect(response.headers.get("access-control-allow-credentials")).toBe("true");
      expect(response.headers.get("access-control-allow-headers")).toBeNull();
      expect(response.headers.get("access-control-max-age")).toBeNull();
      expect(response.headers.get("vary")?.split(", ")).toEqual(
        expect.arrayContaining(["Origin", "Accept-Language"]),
      );
      expect(response.headers.get("vary")?.split(", ")).not.toContain(
        "Access-Control-Request-Headers",
      );
    },
  );

  it("preserves an ALL handler for ordinary OPTIONS and short-circuits a real preflight", async () => {
    const app = createApp({
      controllers: [AllController],
      securityValidation: "off",
      middlewares: [corsMiddleware({ origins: [WEB_ORIGIN] })],
    });

    const ordinary = await app.fetch(
      new Request("https://api.example.com/all", {
        method: "OPTIONS",
        headers: { origin: WEB_ORIGIN },
      }),
    );
    expect(ordinary.status).toBe(200);
    expect(await ordinary.json()).toEqual({ handler: "all" });
    expect(ordinary.headers.get("access-control-allow-origin")).toBe(WEB_ORIGIN);

    const actualPreflight = await app.fetch(preflight("/all", "POST"));
    expect(actualPreflight.status).toBe(204);
    expect(await actualPreflight.text()).toBe("");
    expect(actualPreflight.headers.get("access-control-allow-headers")).toBe("content-type");
  });

  it("keeps ordinary OPTIONS fallback at 404 and requires an allowed Origin for preflight", async () => {
    const app = createApp({
      controllers: [UserController, ExplicitOptionsController],
      securityValidation: "off",
      middlewares: [corsMiddleware({ origins: [WEB_ORIGIN] })],
    });

    const fallback = await app.fetch(
      new Request("https://api.example.com/users", {
        method: "OPTIONS",
        headers: { origin: WEB_ORIGIN },
      }),
    );
    expect(fallback.status).toBe(404);
    expect(fallback.headers.get("access-control-allow-origin")).toBe(WEB_ORIGIN);
    expect(fallback.headers.get("access-control-max-age")).toBeNull();

    for (const origin of [undefined, "https://other.example.com"]) {
      const headers = new Headers({ "access-control-request-method": "POST" });
      if (origin !== undefined) headers.set("Origin", origin);
      const response = await app.fetch(
        new Request("https://api.example.com/explicit/capabilities", {
          method: "OPTIONS",
          headers,
        }),
      );
      expect(response.status).toBe(202);
      expect(await response.json()).toEqual({ capability: true });
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
      expect(response.headers.get("access-control-max-age")).toBeNull();
      expect(response.headers.get("vary")?.split(", ")).toContain("Origin");
    }
  });

  it("uses only explicitly allowed headers", async () => {
    const app = createApp({
      controllers: [UserController],
      securityValidation: "off",
      middlewares: [corsMiddleware({ origins: [WEB_ORIGIN], allowedHeaders: ["Authorization"] })],
    });

    const response = await app.fetch(preflight("/users", "POST"));

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-headers")).toBe("Authorization");
    expect(response.headers.get("vary")?.split(", ")).not.toContain(
      "Access-Control-Request-Headers",
    );
  });

  it("does not reflect requested headers when the explicit allowlist is empty", async () => {
    const app = createApp({
      controllers: [UserController],
      securityValidation: "off",
      middlewares: [corsMiddleware({ origins: [WEB_ORIGIN], allowedHeaders: [] })],
    });

    const response = await app.fetch(preflight("/users", "POST"));

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-headers")).toBeNull();
    expect(response.headers.get("vary")?.split(", ")).not.toContain(
      "Access-Control-Request-Headers",
    );
  });

  it("reflects requested headers on an explicit OPTIONS route", async () => {
    const app = createApp({
      controllers: [ExplicitOptionsController],
      securityValidation: "off",
      middlewares: [corsMiddleware({ origins: [WEB_ORIGIN] })],
    });

    const response = await app.fetch(preflight("/explicit", "POST"));

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-headers")).toBe("content-type");
    expect(response.headers.get("vary")?.split(", ")).toContain("Access-Control-Request-Headers");
  });

  it("does not allow a disallowed origin or an unregistered path", async () => {
    const app = createApp({
      controllers: [UserController],
      securityValidation: "off",
      middlewares: [corsMiddleware({ origins: [WEB_ORIGIN] })],
    });

    const disallowed = await app.fetch(preflight("/users", "POST", "https://other.example.com"));
    const unregistered = await app.fetch(preflight("/missing", "POST"));

    expect(disallowed.status).toBe(404);
    expect(disallowed.headers.get("access-control-allow-origin")).toBeNull();
    expect(disallowed.headers.get("access-control-allow-headers")).toBeNull();
    expect(unregistered.status).toBe(404);
  });

  it("keeps OPTIONS at 404 when the app has no CORS capability", async () => {
    const app = createApp({ controllers: [UserController], securityValidation: "off" });

    expect((await app.fetch(preflight("/users", "POST"))).status).toBe(404);
  });

  it("runs custom middleware that declares the CORS capability", async () => {
    const customCors: MiddlewareFunction = (ctx, next) => {
      if (ctx.req.method === "OPTIONS") {
        ctx.res.status = 204;
        return new Response(null, { status: 204, headers: { "X-Custom-Cors": "yes" } });
      }
      return next();
    };
    declareSecurityMiddlewareCapabilities(customCors, ["cors"]);
    const app = createApp({
      controllers: [UserController],
      securityValidation: "off",
      middlewares: [customCors],
    });

    const response = await app.fetch(preflight("/users", "POST"));

    expect(response.status).toBe(204);
    expect(response.headers.get("X-Custom-Cors")).toBe("yes");
  });

  it("preserves explicit OPTIONS and ALL handlers for disallowed origins", async () => {
    const app = createApp({
      controllers: [ExplicitOptionsController, AllController],
      securityValidation: "off",
      middlewares: [corsMiddleware({ origins: [WEB_ORIGIN] })],
    });

    for (const path of ["/explicit", "/all"]) {
      const response = await app.fetch(preflight(path, "POST", "https://other.example.com"));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ handler: path === "/explicit" ? "options" : "all" });
    }
  });

  it("preserves all Vary values when an explicit pattern overlaps a generated preflight route", async () => {
    const replaceResponse: MiddlewareFunction = async (ctx, next) => {
      await next();
      ctx.raw.header("Vary", "Accept-Encoding");
      return new Response(null, { status: 204, headers: { Vary: "Accept-Language" } });
    };
    const app = createApp({
      controllers: [OverlappingOptionsController],
      securityValidation: "off",
      middlewares: [replaceResponse, corsMiddleware({ origins: [WEB_ORIGIN] })],
    });

    const response = await app.fetch(preflight("/probe/known", "POST"));

    expect(response.status).toBe(204);
    expect(response.headers.get("vary")?.split(", ")).toEqual(
      expect.arrayContaining([
        "Accept-Language",
        "Accept-Encoding",
        "Origin",
        "Access-Control-Request-Headers",
      ]),
    );
  });
});

import type { Context as HonoContext } from "hono";
import { describe, expect, it, vi } from "vitest";
import { HttpContext } from "../libs/HttpContext";

describe("HttpContext", () => {
  it("should parse request properties", () => {
    const url = new URL("https://example.com/test?foo=bar");
    const mockCtx = {
      req: {
        method: "GET",
        url: url.toString(),
        raw: { headers: new Headers() },
        param: vi.fn(),
        query: vi.fn(),
        header: vi.fn(),
        json: vi.fn(),
      },
      text: vi.fn(),
      json: vi.fn(),
      newResponse: vi.fn(
        (data: BodyInit | null, status?: number | ResponseInit, headers?: HeadersInit) =>
          typeof status === "number"
            ? new Response(data, { status, headers })
            : new Response(data, status),
      ),
      redirect: vi.fn(),
    };

    const ctx = new HttpContext(mockCtx as unknown as HonoContext);

    expect(ctx.req.method).toBe("GET");
    expect(ctx.req.query.foo).toBe("bar");
  });

  it("should preserve repeated query values and Fetch-coalesced header values", () => {
    const mockCtx = {
      req: {
        method: "GET",
        url: "https://example.com/test?tag=first&tag=second",
        raw: {
          headers: new Headers([
            ["x-tags", "read"],
            ["x-tags", "write"],
          ]),
        },
        param: vi.fn(),
        query: vi.fn(),
        header: vi.fn(),
        json: vi.fn(),
      },
      text: vi.fn(),
      json: vi.fn(),
      newResponse: vi.fn(
        (data: BodyInit | null, status?: number | ResponseInit, headers?: HeadersInit) =>
          typeof status === "number"
            ? new Response(data, { status, headers })
            : new Response(data, status),
      ),
      redirect: vi.fn(),
    };

    const ctx = new HttpContext(mockCtx as unknown as HonoContext);

    expect(ctx.req.query.tag).toEqual(["first", "second"]);
    expect(ctx.query("tag")).toEqual(["first", "second"]);
    expect(ctx.req.headers["x-tags"]).toBe("read, write");
  });

  it("should capture route params into req.params", () => {
    const mockCtx = {
      req: {
        method: "GET",
        url: "https://example.com/test/123",
        raw: { headers: new Headers() },
        param: vi.fn().mockReturnValue({ id: "123" }),
        query: vi.fn(),
        header: vi.fn(),
        json: vi.fn(),
      },
      text: vi.fn(),
      json: vi.fn(),
      newResponse: vi.fn(
        (data: BodyInit | null, status?: number | ResponseInit, headers?: HeadersInit) =>
          typeof status === "number"
            ? new Response(data, { status, headers })
            : new Response(data, status),
      ),
      redirect: vi.fn(),
    };

    const ctx = new HttpContext(mockCtx as unknown as HonoContext);

    expect(ctx.req.params).toEqual({ id: "123" });
    expect(ctx.request.params).toEqual({ id: "123" });
  });

  it("should get param value", () => {
    const mockCtx = {
      req: {
        method: "GET",
        url: "https://example.com/test",
        raw: { headers: new Headers() },
        param: vi.fn(),
        query: vi.fn(),
        header: vi.fn(),
        json: vi.fn(),
      },
      text: vi.fn(),
      json: vi.fn(),
      newResponse: vi.fn(
        (data: BodyInit | null, status?: number | ResponseInit, headers?: HeadersInit) =>
          typeof status === "number"
            ? new Response(data, { status, headers })
            : new Response(data, status),
      ),
      redirect: vi.fn(),
    };

    const ctx = new HttpContext(mockCtx as unknown as HonoContext);

    expect(ctx.param("id")).toBeUndefined();
  });

  it("should store and retrieve values", () => {
    const mockCtx = {
      req: {
        method: "GET",
        url: "https://example.com/test",
        raw: { headers: new Headers() },
        param: vi.fn(),
        query: vi.fn(),
        header: vi.fn(),
        json: vi.fn(),
      },
      text: vi.fn(),
      json: vi.fn(),
      newResponse: vi.fn(
        (data: BodyInit | null, status?: number | ResponseInit, headers?: HeadersInit) =>
          typeof status === "number"
            ? new Response(data, { status, headers })
            : new Response(data, status),
      ),
      redirect: vi.fn(),
    };

    const ctx = new HttpContext(mockCtx as unknown as HonoContext);

    ctx.set("user", { id: 1, name: "test" });
    expect(ctx.get("user")).toEqual({ id: 1, name: "test" });
  });

  it("should serialize JSON responses exactly once", () => {
    const stringify = vi.spyOn(JSON, "stringify");
    try {
      const mockCtx = {
        req: {
          method: "GET",
          url: "https://example.com/test",
          raw: { headers: new Headers() },
          param: vi.fn(),
          query: vi.fn(),
          header: vi.fn(),
          json: vi.fn(),
        },
        text: vi.fn(),
        json: vi.fn(),
        newResponse: vi.fn(
          (data: BodyInit | null, status?: number | ResponseInit, headers?: HeadersInit) =>
            typeof status === "number"
              ? new Response(data, { status, headers })
              : new Response(data, status),
        ),
        redirect: vi.fn(),
      };

      const ctx = new HttpContext(mockCtx as unknown as HonoContext);
      const body = { payload: "large response body" };

      stringify.mockClear();
      ctx.jsonResponse(body, 201);

      expect(stringify).toHaveBeenCalledTimes(1);
      expect(mockCtx.json).not.toHaveBeenCalled();
      expect(mockCtx.text).not.toHaveBeenCalled();
      expect(ctx.getBufferedResponseBody()).toEqual(new TextEncoder().encode(JSON.stringify(body)));
    } finally {
      stringify.mockRestore();
    }
  });

  it("should keep JSON response content type and status", async () => {
    const mockCtx = {
      req: {
        method: "GET",
        url: "https://example.com/test",
        raw: { headers: new Headers() },
        param: vi.fn().mockReturnValue({}),
        query: vi.fn(),
        header: vi.fn(),
        json: vi.fn(),
      },
      text: vi.fn(),
      json: vi.fn(),
      newResponse: vi.fn(
        (data: BodyInit | null, status?: number | ResponseInit, headers?: HeadersInit) =>
          typeof status === "number"
            ? new Response(data, { status, headers })
            : new Response(data, status),
      ),
      redirect: vi.fn(),
    };

    const ctx = new HttpContext(mockCtx as unknown as HonoContext);
    const response = ctx.jsonResponse({ ok: true }, 201);

    expect(response.status).toBe(201);
    expect(response.headers.get("content-type")).toBe("application/json");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});

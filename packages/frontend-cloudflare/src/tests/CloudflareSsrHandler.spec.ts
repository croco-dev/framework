import type { RenderServer, RuntimeContext } from "@croco/meta-vite";
import { describe, expect, it, vi } from "vitest";
import { createSsrHandler, createSsrHandlerAsFetchHandler } from "../libs/CloudflareSsrHandler";
import type { SsrWorkerEnv } from "../libs/types";

function createExecutionContext(): ExecutionContext {
  return {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
  } as unknown as ExecutionContext;
}

function createStream(payload: string): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(payload));
      controller.close();
    },
  });
}

describe("createSsrHandler", () => {
  it("createSsrHandler() returns a function", () => {
    const handler = createSsrHandler();

    expect(handler).toBeInstanceOf(Function);
    expect(handler.length).toBe(3);
  });

  it("function signature type validation - Request, SsrWorkerEnv, ExecutionContext args", async () => {
    const handler = createSsrHandler();

    const mockRequest = new Request("https://example.com/test");
    const mockEnv: SsrWorkerEnv = {};
    const mockCtx = createExecutionContext();

    const result = await handler(mockRequest, mockEnv, mockCtx);

    expect(result).toBeDefined();
    expect(result.status).toBe(500);
    await expect(result.text()).resolves.toBe("No render server configured");
  });

  it("should route API requests through configured apiBindingName", async () => {
    const handler = createSsrHandler({ apiBindingName: "MY_API" });
    const apiResponse = new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
    const customApi = {
      fetch: vi.fn().mockResolvedValue(apiResponse),
    } as unknown as Fetcher;
    const env = {
      MY_API: customApi,
    } as unknown as SsrWorkerEnv;
    const mockCtx = createExecutionContext();

    const result = await handler(new Request("https://example.com/api/users"), env, mockCtx);

    expect(customApi.fetch).toHaveBeenCalledTimes(1);
    expect(customApi.fetch).toHaveBeenCalledWith(expect.any(Request));
    expect(result).toBe(apiResponse);
  });

  it("preserves streaming service-binding API responses", async () => {
    const handler = createSsrHandler({ apiBindingName: "MY_API" });
    const apiResponse = new Response(createStream("streamed api"), {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
    const customApi = {
      fetch: vi.fn().mockResolvedValue(apiResponse),
    } as unknown as Fetcher;
    const env = {
      MY_API: customApi,
    } as unknown as SsrWorkerEnv;

    const result = await handler(
      new Request("https://example.com/api/stream"),
      env,
      createExecutionContext(),
    );
    const reader = result.body?.getReader();

    expect(result).toBe(apiResponse);
    expect(reader).toBeDefined();

    const chunk = await reader?.read();
    expect(chunk?.done).toBe(false);
    expect(new TextDecoder().decode(chunk?.value)).toBe("streamed api");
    expect(result.headers.get("content-type")).toBe("text/plain; charset=utf-8");
  });

  it("returns a non-404 ASSETS response before API and SSR fallback", async () => {
    const handler = createSsrHandler({ apiBindingName: "MY_API" });
    const assetResponse = new Response("asset", { status: 200 });
    const assets = {
      fetch: vi.fn().mockResolvedValue(assetResponse),
    } as unknown as Fetcher;
    const api = {
      fetch: vi.fn().mockResolvedValue(new Response("api")),
    } as unknown as Fetcher;
    const env = { ASSETS: assets, MY_API: api } as unknown as SsrWorkerEnv;

    const result = await handler(
      new Request("https://example.com/api/logo.png"),
      env,
      createExecutionContext(),
    );

    expect(result).toBe(assetResponse);
    expect(assets.fetch).toHaveBeenCalledTimes(1);
    expect(api.fetch).not.toHaveBeenCalled();
  });

  it("falls through ASSETS 404 responses to API service binding dispatch", async () => {
    const handler = createSsrHandler({ apiBindingName: "MY_API" });
    const apiResponse = Response.json({ ok: true });
    const assets = {
      fetch: vi.fn().mockResolvedValue(new Response("missing", { status: 404 })),
    } as unknown as Fetcher;
    const api = {
      fetch: vi.fn().mockResolvedValue(apiResponse),
    } as unknown as Fetcher;
    const env = { ASSETS: assets, MY_API: api } as unknown as SsrWorkerEnv;

    const result = await handler(
      new Request("https://example.com/api/users"),
      env,
      createExecutionContext(),
    );

    expect(result).toBe(apiResponse);
    expect(assets.fetch).toHaveBeenCalledTimes(1);
    expect(api.fetch).toHaveBeenCalledTimes(1);
  });

  it("falls through ASSETS failures to SSR with diagnostic evidence", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const renderResponse = new Response("rendered page");
    const renderServer = {
      handle: vi.fn(async () => renderResponse),
    } as unknown as RenderServer;
    const handler = createSsrHandler({ renderServer });
    const assets = {
      fetch: vi.fn(async () => {
        throw new Error("asset binding unavailable");
      }),
    } as unknown as Fetcher;

    try {
      const result = await handler(
        new Request("https://example.com/dashboard"),
        { ASSETS: assets },
        createExecutionContext(),
      );

      expect(result).toBe(renderResponse);
      expect(renderServer.handle).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        "@croco/frontend-cloudflare ASSETS binding failed; continuing to API or SSR fallback.",
        "asset binding unavailable",
      );
    } finally {
      warn.mockRestore();
    }
  });

  it("returns a deterministic 500 response when service-binding API routing fails", async () => {
    const handler = createSsrHandler({ apiBindingName: "MY_API" });
    const customApi = {
      fetch: vi.fn(async () => {
        throw new Error("api worker unavailable");
      }),
    } as unknown as Fetcher;

    const result = await handler(
      new Request("https://example.com/api/users"),
      { MY_API: customApi } as unknown as SsrWorkerEnv,
      createExecutionContext(),
    );

    expect(result.status).toBe(500);
    await expect(result.text()).resolves.toBe("API request failed");
    expect(customApi.fetch).toHaveBeenCalledTimes(1);
  });

  it("passes Cloudflare RuntimeContext to the render server", async () => {
    const executionContext = createExecutionContext();
    const env = { FEATURE_FLAG: "enabled" } as unknown as SsrWorkerEnv;
    const renderServer = {
      handle: vi.fn(async (_request, context) =>
        Response.json({
          platform: context?.platform,
          envMatches: context?.env === env,
          executionContextMatches: context?.executionContext === executionContext,
        }),
      ),
    } as unknown as RenderServer;
    const handler = createSsrHandler({ renderServer });

    const response = await handler(
      new Request("https://example.com/dashboard"),
      env,
      executionContext,
    );

    expect(renderServer.handle).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual({
      platform: "cloudflare",
      envMatches: true,
      executionContextMatches: true,
    });
  });

  it("returns a deterministic 500 response when SSR rendering fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const renderServer = {
      handle: vi.fn(async () => {
        throw new Error("render failed");
      }),
    } as unknown as RenderServer;
    const handler = createSsrHandler({ renderServer });

    try {
      const response = await handler(
        new Request("https://example.com/dashboard"),
        {},
        createExecutionContext(),
      );

      expect(response.status).toBe(500);
      await expect(response.text()).resolves.toBe("Internal server error");
      expect(error).toHaveBeenCalledWith("SSR rendering error:", expect.any(Error));
    } finally {
      error.mockRestore();
    }
  });

  it("preserves streaming render server responses", async () => {
    const renderServer = {
      handle: vi.fn(async () => new Response(createStream("streamed page"))),
    } as unknown as RenderServer;
    const handler = createSsrHandler({ renderServer });

    const response = await handler(
      new Request("https://example.com/stream"),
      {},
      createExecutionContext(),
    );
    const reader = response.body?.getReader();

    expect(reader).toBeDefined();
    const chunk = await reader?.read();
    expect(chunk?.done).toBe(false);
    expect(new TextDecoder().decode(chunk?.value)).toBe("streamed page");
  });
});

describe("createSsrHandlerAsFetchHandler", () => {
  it("uses RuntimeContext env for service-binding API routing", async () => {
    const apiResponse = Response.json({ ok: true });
    const api = {
      fetch: vi.fn().mockResolvedValue(apiResponse),
    } as unknown as Fetcher;
    const env = { API_WORKER: api };
    const context: RuntimeContext = {
      platform: "cloudflare",
      env,
      executionContext: createExecutionContext(),
    };
    const handler = createSsrHandlerAsFetchHandler();

    const response = await handler(new Request("https://example.com/api/users"), context);

    expect(response).toBe(apiResponse);
    expect(api.fetch).toHaveBeenCalledTimes(1);
  });

  it("passes the provided RuntimeContext through to the render server", async () => {
    const context: RuntimeContext = {
      platform: "cloudflare",
      env: { FEATURE_FLAG: "enabled" },
      executionContext: createExecutionContext(),
    };
    const renderServer = {
      handle: vi.fn(async (_request, runtimeContext) =>
        Response.json({
          sameContext: runtimeContext === context,
          featureFlag: (runtimeContext?.env as SsrWorkerEnv | undefined)?.FEATURE_FLAG,
        }),
      ),
    } as unknown as RenderServer;
    const handler = createSsrHandlerAsFetchHandler({ renderServer });

    const response = await handler(new Request("https://example.com/dashboard"), context);

    expect(renderServer.handle).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual({
      sameContext: true,
      featureFlag: "enabled",
    });
  });
});

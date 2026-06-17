import type { RenderServer } from "@croco/meta-vite";
import { describe, expect, it, vi } from "vitest";
import { createSsrHandler } from "../libs/CloudflareSsrHandler";
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
    expect(result).toBe(apiResponse);
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

import { describe, expect, it, vi } from "vitest";
import { createSsrHandler } from "../libs/CloudflareSsrHandler";
import type { SsrWorkerEnv } from "../libs/types";

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
    const mockCtx = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn(),
    } as unknown as ExecutionContext;

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
    const mockCtx = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn(),
    } as unknown as ExecutionContext;

    const result = await handler(new Request("https://example.com/api/users"), env, mockCtx);

    expect(customApi.fetch).toHaveBeenCalledTimes(1);
    expect(result).toBe(apiResponse);
  });
});

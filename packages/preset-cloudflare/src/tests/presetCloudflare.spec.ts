import { describe, expect, it, vi } from "vitest";
import type { CloudflareFetchEnv, ExecutionContext } from "../fetch";
import {
  createCloudflarePreset,
  createRawHonoWorkerFetchHandler,
  createWorkerFetchHandler,
} from "../index";

const createExecutionContext = (): ExecutionContext => ({
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
});

describe("createCloudflarePreset", () => {
  it("returns a cloudflare preset", () => {
    const preset = createCloudflarePreset();

    expect(preset.name).toBe("cloudflare");
    expect(preset.config.name).toBe("cloudflare");
  });

  it("uses the Worker fetch entry point", () => {
    const preset = createCloudflarePreset();

    expect(preset.config.entry).toBe("./fetch.js");
  });
});

describe("createWorkerFetchHandler", () => {
  it("returns a function", () => {
    const handler = createWorkerFetchHandler({ fetch: async () => new Response("ok") });

    expect(typeof handler).toBe("function");
  });

  it("passes requests with runtime context to the app", async () => {
    const request = new Request("https://example.com/users");
    const response = new Response("ok");
    const env: CloudflareFetchEnv = {};
    const ctx = createExecutionContext();
    const fetch = vi.fn(async () => response);
    const handler = createWorkerFetchHandler({ fetch });

    await expect(handler(request, env, ctx)).resolves.toBe(response);
    expect(fetch).toHaveBeenCalledWith(
      request,
      expect.objectContaining({
        platform: "cloudflare-workers",
        env,
        native: {
          executionContext: ctx,
        },
        capabilities: expect.objectContaining({
          env: true,
          filesystem: false,
          nodeApi: false,
          requestLifecycle: true,
          waitUntil: true,
          flush: false,
          streamingResponse: true,
          deadline: false,
          abortSignal: true,
          shutdown: false,
        }),
      }),
      { env, executionContext: ctx },
    );
  });

  it("exposes Cloudflare env and waitUntil through runtime context", async () => {
    const request = new Request("https://example.com/users", {
      headers: {
        "x-request-id": "worker-req-1",
      },
    });
    const env: CloudflareFetchEnv = { KV_NAMESPACE: "users-kv" };
    const ctx = createExecutionContext();
    const pending = Promise.resolve();
    const fetch = vi.fn(async (_request: Request, runtimeContext) => {
      runtimeContext?.waitUntil?.(pending);
      return new Response(
        JSON.stringify({
          platform: runtimeContext?.platform,
          requestId: runtimeContext?.requestId,
          value: runtimeContext?.env?.KV_NAMESPACE,
        }),
      );
    });
    const handler = createWorkerFetchHandler({ fetch });

    const response = await handler(request, env, ctx);

    await expect(response.json()).resolves.toEqual({
      platform: "cloudflare-workers",
      requestId: "worker-req-1",
      value: "users-kv",
    });
    expect(ctx.waitUntil).toHaveBeenCalledWith(pending);
  });

  it("keeps raw Hono forwarding behind an explicit compatibility helper", async () => {
    const request = new Request("https://example.com/users");
    const response = new Response("ok");
    const env: CloudflareFetchEnv = {};
    const ctx = createExecutionContext();
    const fetch = vi.fn(async () => response);
    const handler = createRawHonoWorkerFetchHandler({ fetch });

    await expect(handler(request, env, ctx)).resolves.toBe(response);
    expect(fetch).toHaveBeenCalledWith(request, env, ctx);
  });
});

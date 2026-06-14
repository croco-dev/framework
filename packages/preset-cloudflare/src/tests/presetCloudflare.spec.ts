import { describe, expect, it, vi } from "vitest";
import type { CloudflareFetchEnv, ExecutionContext } from "../fetch";
import { createCloudflarePreset, createWorkerFetchHandler } from "../index";

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

  it("passes requests to the underlying Hono app", async () => {
    const request = new Request("https://example.com/users");
    const response = new Response("ok");
    const env: CloudflareFetchEnv = {};
    const ctx = createExecutionContext();
    const fetch = vi.fn(async () => response);
    const handler = createWorkerFetchHandler({ fetch });

    await expect(handler(request, env, ctx)).resolves.toBe(response);
    expect(fetch).toHaveBeenCalledWith(request, env, ctx);
  });

  it("passes Cloudflare env and execution context to the app fetch handler", async () => {
    const request = new Request("https://example.com/users");
    const env: CloudflareFetchEnv = { KV_NAMESPACE: "users-kv" };
    const ctx = createExecutionContext();
    const pending = Promise.resolve();
    const fetch = vi.fn(
      async (_request: Request, appEnv: CloudflareFetchEnv, appCtx: ExecutionContext) => {
        appCtx.waitUntil(pending);
        return new Response(String(appEnv.KV_NAMESPACE));
      },
    );
    const handler = createWorkerFetchHandler({ fetch });

    const response = await handler(request, env, ctx);

    await expect(response.text()).resolves.toBe("users-kv");
    expect(fetch).toHaveBeenCalledWith(request, env, ctx);
    expect(ctx.waitUntil).toHaveBeenCalledWith(pending);
  });
});

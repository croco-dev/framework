import { describe, expect, it, vi } from "vitest";
import { createCloudflareComposedHandler } from "../libs/providers/cloudflare";
import type { CrocoFetchHandler } from "../libs/render/types";

function createExecutionContext(): ExecutionContext {
  return {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
  };
}

function createStream(payload: string): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(payload));
      controller.close();
    },
  });
}

describe("Cloudflare adapter", () => {
  it("returns the API response when an API handler matches the request", async () => {
    const pageHandler = vi.fn<CrocoFetchHandler>(async () => new Response("Page response"));
    const handler = createCloudflareComposedHandler({
      apiHandlers: [
        {
          match: (request) => new URL(request.url).pathname === "/api/users",
          handle: async () => new Response("API response", { status: 201 }),
        },
      ],
      pageHandler,
    });

    const response = await handler(
      new Request("https://example.test/api/users"),
      {},
      createExecutionContext(),
    );

    expect(response.status).toBe(201);
    await expect(response.text()).resolves.toBe("API response");
    expect(pageHandler).not.toHaveBeenCalled();
  });

  it("falls back to the page handler when no API handler matches", async () => {
    const pageHandler = vi.fn<CrocoFetchHandler>(async () => new Response("SSR response"));
    const handler = createCloudflareComposedHandler({
      apiHandlers: [
        {
          match: () => false,
          handle: async () => new Response("API response"),
        },
      ],
      pageHandler,
    });
    const request = new Request("https://example.test/page");

    const response = await handler(request, {}, createExecutionContext());

    await expect(response.text()).resolves.toBe("SSR response");
    expect(pageHandler).toHaveBeenCalledWith(
      request,
      expect.objectContaining({
        platform: "cloudflare",
      }),
    );
  });

  it("forwards Cloudflare env and execution context to RuntimeContext", async () => {
    const env = { TEST_BINDING: "bound-value" };
    const executionContext = createExecutionContext();
    const pageHandler = vi.fn<CrocoFetchHandler>(async () => new Response("Runtime response"));
    const handler = createCloudflareComposedHandler({
      apiHandlers: [],
      pageHandler,
    });

    const response = await handler(
      new Request("https://example.test/runtime"),
      env,
      executionContext,
    );

    await expect(response.text()).resolves.toBe("Runtime response");
    expect(pageHandler).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({
        platform: "cloudflare",
        env,
        executionContext,
      }),
    );
  });

  it("runs the first matching API handler before later matches", async () => {
    const firstHandler = vi.fn(async () => new Response("first"));
    const secondHandler = vi.fn(async () => new Response("second"));
    const handler = createCloudflareComposedHandler({
      apiHandlers: [
        {
          match: () => true,
          handle: firstHandler,
        },
        {
          match: () => true,
          handle: secondHandler,
        },
      ],
      pageHandler: async () => new Response("Page response"),
    });

    const response = await handler(
      new Request("https://example.test/api/users"),
      {},
      createExecutionContext(),
    );

    await expect(response.text()).resolves.toBe("first");
    expect(firstHandler).toHaveBeenCalledTimes(1);
    expect(secondHandler).not.toHaveBeenCalled();
  });

  it("preserves a streaming Response body in a fetch-like runtime", async () => {
    const handler = createCloudflareComposedHandler({
      apiHandlers: [
        {
          match: () => true,
          handle: async () =>
            new Response(createStream("streamed response"), {
              headers: {
                "content-type": "text/plain; charset=utf-8",
              },
            }),
        },
      ],
      pageHandler: async () => new Response("Page response"),
    });

    const response = await handler(
      new Request("https://example.test/api/stream"),
      {},
      createExecutionContext(),
    );
    const reader = response.body?.getReader();

    expect(reader).toBeDefined();

    const chunk = await reader?.read();
    expect(chunk?.done).toBe(false);
    expect(new TextDecoder().decode(chunk?.value)).toBe("streamed response");
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
  });
});

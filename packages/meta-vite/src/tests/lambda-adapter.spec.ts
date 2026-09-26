import { describe, expect, it, vi } from "vitest";
import { createLambdaComposedHandler, createLambdaHandler } from "../libs/providers/lambda";
import type { CrocoFetchHandler, RuntimeContext } from "../libs/render/types";

describe("lambda adapter", () => {
  it("exports the composed handler from the public module", async () => {
    const mod = await import("../index");

    expect(mod.createLambdaComposedHandler).toBeDefined();
  });

  it("converts API Gateway v2 event to Request", async () => {
    const pageHandler = vi.fn<CrocoFetchHandler>(async (request) =>
      Response.json(await request.json()),
    );
    const handler = createLambdaHandler(pageHandler);
    const event = createHttpApiEvent({
      method: "POST",
      rawPath: "/api/items",
      headers: {
        host: "example.com",
        "content-type": "application/json",
        "x-forwarded-proto": "https",
      },
      body: JSON.stringify({ name: "croco" }),
    });

    const response = await handler(event, {});
    const request = pageHandler.mock.calls[0]?.[0];

    expect(request?.method).toBe("POST");
    expect(request?.url).toBe("https://example.com/api/items");
    expect(request?.headers.get("content-type")).toBe("application/json");
    await expect(response.json()).resolves.toEqual({ name: "croco" });
  });

  it("returns API handler response before page fallback", async () => {
    const apiHandler = {
      match: (request: Request) => new URL(request.url).pathname === "/api/hello",
      handle: vi.fn(async () => new Response("api")),
    };
    const pageHandler = vi.fn<CrocoFetchHandler>(async () => new Response("page"));
    const handler = createLambdaComposedHandler({ apiHandlers: [apiHandler], pageHandler });

    const response = await handler(createHttpApiEvent({ rawPath: "/api/hello" }), {});

    await expect(response.text()).resolves.toBe("api");
    expect(apiHandler.handle).toHaveBeenCalledOnce();
    expect(pageHandler).not.toHaveBeenCalled();
  });

  it("passes the original Lambda event and context to matching API handlers", async () => {
    const event = createHttpApiEvent({ rawPath: "/api/runtime" });
    const lambdaContext = { awsRequestId: "lambda-request-1" };
    const apiHandler = {
      match: (request: Request) => new URL(request.url).pathname === "/api/runtime",
      handle: vi.fn(async (_request: Request, receivedEvent: unknown, receivedContext: unknown) =>
        Response.json({
          eventMatches: receivedEvent === event,
          contextMatches: receivedContext === lambdaContext,
        }),
      ),
    };
    const pageHandler = vi.fn<CrocoFetchHandler>(async () => new Response("page"));
    const handler = createLambdaComposedHandler({ apiHandlers: [apiHandler], pageHandler });

    const response = await handler(event, lambdaContext);

    expect(pageHandler).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      eventMatches: true,
      contextMatches: true,
    });
  });

  it("falls back to page handler when no API handler matches", async () => {
    const apiHandler = {
      match: () => false,
      handle: vi.fn(async () => new Response("api")),
    };
    const pageHandler = vi.fn<CrocoFetchHandler>(async () => new Response("page"));
    const handler = createLambdaComposedHandler({ apiHandlers: [apiHandler], pageHandler });

    const response = await handler(createHttpApiEvent({ rawPath: "/products" }), {});

    await expect(response.text()).resolves.toBe("page");
    expect(apiHandler.handle).not.toHaveBeenCalled();
    expect(pageHandler).toHaveBeenCalledOnce();
  });

  it("forwards RuntimeContext to page handler", async () => {
    const event = createHttpApiEvent({ rawPath: "/products" });
    const lambdaContext = { awsRequestId: "req-1" };
    const pageHandler = vi.fn<CrocoFetchHandler>(
      async (_request, _context?: RuntimeContext) => new Response("page"),
    );
    const handler = createLambdaComposedHandler({ apiHandlers: [], pageHandler });

    await handler(event, lambdaContext);
    const context = pageHandler.mock.calls[0]?.[1];

    expect(context).toEqual({
      platform: "lambda",
      event,
      lambdaContext,
    });
  });

  it("decodes base64 encoded body", async () => {
    const pageHandler = vi.fn<CrocoFetchHandler>(
      async (request) => new Response(await request.text()),
    );
    const handler = createLambdaHandler(pageHandler);
    const event = createHttpApiEvent({
      method: "POST",
      rawPath: "/api/upload",
      body: Buffer.from("hello lambda").toString("base64"),
      isBase64Encoded: true,
    });

    const response = await handler(event, {});

    await expect(response.text()).resolves.toBe("hello lambda");
  });

  it("uses API Gateway v1 method and path as fallback", async () => {
    const pageHandler = vi.fn<CrocoFetchHandler>(async () => new Response("page"));
    const handler = createLambdaHandler(pageHandler);

    await handler(
      {
        httpMethod: "PUT",
        path: "/v1/items",
        headers: {
          host: "example.com",
        },
      },
      {},
    );
    const request = pageHandler.mock.calls[0]?.[0];

    expect(request?.method).toBe("PUT");
    expect(request?.url).toBe("http://example.com/v1/items");
  });

  it("forwards HTTP API v2 event cookies to the page handler", async () => {
    const pageHandler = vi.fn<CrocoFetchHandler>(async () => new Response("page"));
    const handler = createLambdaComposedHandler({ apiHandlers: [], pageHandler });

    await handler(
      createHttpApiEvent({
        rawPath: "/account",
        cookies: ["session=abc123", "theme=dark"],
      }),
      {},
    );

    expect(pageHandler.mock.calls[0]?.[0].headers.get("cookie")).toBe("session=abc123; theme=dark");
  });

  it("merges header and HTTP API v2 event cookies by name", async () => {
    const pageHandler = vi.fn<CrocoFetchHandler>(async () => new Response("page"));
    const handler = createLambdaHandler(pageHandler);

    await handler(
      createHttpApiEvent({
        headers: { host: "example.com", Cookie: "session=header; locale=en" },
        cookies: ["session=event", "theme=dark"],
      }),
      {},
    );

    expect(pageHandler.mock.calls[0]?.[0].headers.get("cookie")).toBe(
      "session=header; locale=en; theme=dark",
    );
  });

  it("keeps repeated query values from API Gateway payload format 1.0", async () => {
    const pageHandler = vi.fn<CrocoFetchHandler>(async () => new Response("page"));
    const handler = createLambdaHandler(pageHandler);

    await handler(
      {
        version: "1.0",
        httpMethod: "GET",
        path: "/search",
        headers: { host: "example.com" },
        queryStringParameters: { q: "croco", tag: "beta" },
        multiValueQueryStringParameters: { q: ["croco"], tag: ["alpha", "beta"] },
      },
      {},
    );

    const url = new URL(pageHandler.mock.calls[0]?.[0].url ?? "http://invalid");
    expect(url.searchParams.get("q")).toBe("croco");
    expect(url.searchParams.getAll("tag")).toEqual(["alpha", "beta"]);
  });

  it("uses single-value query parameters when API Gateway has no multi-value parameters", async () => {
    const pageHandler = vi.fn<CrocoFetchHandler>(async () => new Response("page"));
    const handler = createLambdaHandler(pageHandler);

    await handler(
      {
        version: "1.0",
        httpMethod: "GET",
        path: "/search",
        headers: { host: "example.com" },
        queryStringParameters: { q: "croco", tag: "beta" },
      },
      {},
    );

    const url = new URL(pageHandler.mock.calls[0]?.[0].url ?? "http://invalid");
    expect(url.searchParams.toString()).toBe("q=croco&tag=beta");
  });

  it("preserves the raw query string of HTTP API v2 events", async () => {
    const pageHandler = vi.fn<CrocoFetchHandler>(async () => new Response("page"));
    const handler = createLambdaHandler(pageHandler);

    await handler(
      {
        ...createHttpApiEvent({
          rawPath: "/search",
          rawQueryString: "tag=alpha&tag=beta&q=croco%20framework",
        }),
        queryStringParameters: { q: "ignored" },
      },
      {},
    );

    expect(pageHandler.mock.calls[0]?.[0].url).toBe(
      "http://lambda.local/search?tag=alpha&tag=beta&q=croco%20framework",
    );
  });
});

function createHttpApiEvent(options: {
  method?: string;
  rawPath?: string;
  rawQueryString?: string;
  cookies?: string[];
  headers?: Record<string, string>;
  body?: string;
  isBase64Encoded?: boolean;
}): Record<string, unknown> {
  return {
    version: "2.0",
    rawPath: options.rawPath ?? "/",
    rawQueryString: options.rawQueryString ?? "",
    cookies: options.cookies,
    headers: options.headers ?? { host: "lambda.local" },
    body: options.body,
    isBase64Encoded: options.isBase64Encoded ?? false,
    requestContext: {
      http: {
        method: options.method ?? "GET",
        path: options.rawPath ?? "/",
      },
    },
  };
}

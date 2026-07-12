import { HonoRequest } from "hono/request";
import { describe, expect, it, vi } from "vitest";

import { bodyLimitMiddleware, kb, mb } from "../libs/middleware/BodyLimitMiddleware";
import {
  HttpBodyLimitConfigurationProblem,
  HttpRequestBodyReadProblem,
  HttpRequestBodyTooLargeProblem,
  HttpRequestBodyUnavailableProblem,
} from "../libs/problems/HttpRequestBodyProblems";
import type { CrocoHttpContext } from "../libs/types";

type StreamRequestInit = RequestInit & { duplex: "half" };

function requestWithStream(
  stream: ReadableStream<Uint8Array>,
  headers?: HeadersInit,
  signal?: AbortSignal,
): Request {
  return new Request("http://localhost/upload", {
    method: "POST",
    headers,
    body: stream,
    duplex: "half",
    signal,
  } as StreamRequestInit);
}

function createContext(request: Request): CrocoHttpContext {
  return {
    req: {
      method: request.method,
      url: request.url,
      path: "/upload",
      params: {},
      query: {},
      headers: Object.fromEntries(request.headers),
    },
    res: { status: 200, headers: {} },
    raw: { req: new HonoRequest(request) },
  } as unknown as CrocoHttpContext;
}

function createRequestBody(chunks: readonly string[], cancel?: () => void | Promise<void>) {
  const encoder = new TextEncoder();
  let index = 0;
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        const chunk = chunks[index++];
        if (chunk === undefined) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(chunk));
      },
      cancel,
    },
    { highWaterMark: 0 },
  );

  return { request: requestWithStream(stream), stream };
}

describe("BodyLimitMiddleware", () => {
  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1, 0.5, 2 ** 53])(
    "rejects unsafe limit configuration %s before request handling",
    (limit) => {
      expect(() => bodyLimitMiddleware({ limit })).toThrowError(HttpBodyLimitConfigurationProblem);
      expect(() => bodyLimitMiddleware({ limit })).toThrow(
        expect.objectContaining({
          code: "transports-http/body-limit-invalid-configuration",
          category: "InternalServerError",
          detail: "bodyLimitMiddleware limit must be a finite, nonnegative safe integer",
          extensions: undefined,
        }),
      );
    },
  );

  it("accepts zero as an empty-body boundary", async () => {
    const context = createContext(
      new Request("http://localhost/upload", { method: "POST", body: "" }),
    );

    await expect(
      bodyLimitMiddleware({ limit: 0 })(context, async () => {}),
    ).resolves.toBeUndefined();
  });

  it("enforces missing and false-low content-length against actual bytes", async () => {
    for (const headers of [undefined, { "content-length": "1" }]) {
      const { request } = createRequestBody(["12345"]);
      const requestWithHeaders = headers
        ? requestWithStream(request.body as ReadableStream<Uint8Array>, headers)
        : request;
      const middleware = bodyLimitMiddleware({ limit: 4 });

      await expect(
        middleware(createContext(requestWithHeaders), async () => {}),
      ).rejects.toMatchObject({
        code: "transports-http/request-body-too-large",
        status: 413,
        extensions: { limit: 4 },
      });
    }
  });

  it.each(["12x", "-1", "+5", "1.5", " 5", "9007199254740992", "1, 5"])(
    "treats malformed content-length %s only as unusable metadata",
    async (contentLength) => {
      const { request } = createRequestBody(["12345"]);
      const withHeader = requestWithStream(request.body as ReadableStream<Uint8Array>, {
        "content-length": contentLength,
      });

      await expect(
        bodyLimitMiddleware({ limit: 4 })(createContext(withHeader), async () => {}),
      ).rejects.toBeInstanceOf(HttpRequestBodyTooLargeProblem);
    },
  );

  it("accepts the exact boundary and replays identical bytes downstream", async () => {
    const { request, stream } = createRequestBody(["12", "34"]);
    const context = createContext(request);
    let downstream = "";

    await bodyLimitMiddleware({ limit: 4 })(context, async () => {
      downstream = await context.raw.req.text();
    });

    expect(downstream).toBe("1234");
    expect(stream.locked).toBe(false);
  });

  it("rejects a valid declared overflow without reading and starts cancellation once", async () => {
    const cancel = vi.fn(() => new Promise<void>(() => {}));
    const getReader = vi.fn();
    const request = {
      bodyUsed: false,
      body: { locked: false, cancel, getReader },
      headers: new Headers({ "content-length": "5" }),
      signal: new AbortController().signal,
      url: "http://localhost/upload",
    } as unknown as Request;
    const context = createContext(new Request("http://localhost/upload"));
    context.raw.req.raw = request;

    const result = bodyLimitMiddleware({ limit: 4 })(context, async () => {});
    await expect(
      Promise.race([result, new Promise((resolve) => setTimeout(resolve, 50))]),
    ).rejects.toBeInstanceOf(HttpRequestBodyTooLargeProblem);
    expect(cancel).toHaveBeenCalledOnce();
    expect(getReader).not.toHaveBeenCalled();
  });

  it("handles declared-overflow cancellation rejection without replacing the limit Problem", async () => {
    const cancel = vi.fn(() => Promise.reject(new Error("provider cancellation failed")));
    const request = {
      bodyUsed: false,
      body: { locked: false, cancel, getReader: vi.fn() },
      headers: new Headers({ "content-length": "5" }),
      signal: new AbortController().signal,
      url: "http://localhost/upload",
    } as unknown as Request;
    const context = createContext(new Request("http://localhost/upload"));
    context.raw.req.raw = request;

    await expect(bodyLimitMiddleware({ limit: 4 })(context, async () => {})).rejects.toMatchObject({
      code: "transports-http/request-body-too-large",
      status: 413,
      detail: "Request body too large",
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("cancels the first crossing chunk once without retaining it or waiting for cleanup", async () => {
    const cancel = vi.fn(() => new Promise<void>(() => {}));
    const { request, stream } = createRequestBody(["1234", "5"], cancel);
    const result = bodyLimitMiddleware({ limit: 4 })(createContext(request), async () => {});

    await expect(
      Promise.race([result, new Promise((resolve) => setTimeout(resolve, 50))]),
    ).rejects.toBeInstanceOf(HttpRequestBodyTooLargeProblem);
    expect(cancel).toHaveBeenCalledOnce();
    expect(stream.locked).toBe(false);
  });

  it("handles cancellation rejection without replacing the limit Problem", async () => {
    const cancellationFailure = new Error("provider cancellation failed");
    const cancel = vi.fn(() => Promise.reject(cancellationFailure));
    const { request } = createRequestBody(["12345"], cancel);

    await expect(
      bodyLimitMiddleware({ limit: 4 })(createContext(request), async () => {}),
    ).rejects.toMatchObject({
      code: "transports-http/request-body-too-large",
      detail: "Request body too large",
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("uses the configured status and message on the typed limit Problem", async () => {
    const { request } = createRequestBody(["12345"]);

    await expect(
      bodyLimitMiddleware({ limit: 4, statusCode: 422, message: "Body exceeds route policy" })(
        createContext(request),
        async () => {},
      ),
    ).rejects.toMatchObject({
      code: "transports-http/request-body-too-large",
      title: "Payload Too Large",
      status: 422,
      detail: "Body exceeds route policy",
      instance: "http://localhost/upload",
      extensions: { limit: 4 },
    });
  });

  it("fails explicitly when an earlier consumer disturbed or locked the body", async () => {
    const disturbed = new Request("http://localhost/upload", { method: "POST", body: "body" });
    await disturbed.text();
    await expect(
      bodyLimitMiddleware()(createContext(disturbed), async () => {}),
    ).rejects.toBeInstanceOf(HttpRequestBodyUnavailableProblem);

    const locked = new Request("http://localhost/upload", { method: "POST", body: "body" });
    const reader = locked.body?.getReader();
    await expect(
      bodyLimitMiddleware()(createContext(locked), async () => {}),
    ).rejects.toBeInstanceOf(HttpRequestBodyUnavailableProblem);
    reader?.releaseLock();
  });

  it("maps reader failures to a typed Problem with a private cause and releases the lock", async () => {
    const cause = new Error("provider read failed");
    const stream = new ReadableStream<Uint8Array>({
      pull() {
        throw cause;
      },
    });

    const rejection = await Promise.resolve(
      bodyLimitMiddleware()(createContext(requestWithStream(stream)), async () => {}),
    ).catch((error: unknown) => error);
    expect(rejection).toBeInstanceOf(HttpRequestBodyReadProblem);
    expect(rejection).toMatchObject({
      code: "transports-http/request-body-read-failed",
      cause,
    });
    expect(stream.locked).toBe(false);
  });

  it("distinguishes an aborted request read without leaking the provider error", async () => {
    const controller = new AbortController();
    const cause = new Error("socket aborted with provider details");
    const stream = new ReadableStream<Uint8Array>({
      pull() {
        controller.abort();
        throw cause;
      },
    });
    const rejection = await Promise.resolve(
      bodyLimitMiddleware()(
        createContext(requestWithStream(stream, undefined, controller.signal)),
        async () => {},
      ),
    ).catch((error: unknown) => error);

    expect(rejection).toBeInstanceOf(HttpRequestBodyReadProblem);
    expect(rejection).toMatchObject({
      code: "transports-http/request-body-read-failed",
      detail: "Request body reading was aborted",
      cause,
    });
    expect(stream.locked).toBe(false);
  });

  it("preserves Fetch metadata, abort propagation, and a Cloudflare descriptor", async () => {
    const controller = new AbortController();
    const original = new Request("http://localhost/upload?source=test", {
      method: "POST",
      headers: { "content-type": "text/plain", "x-test": "value" },
      body: "body",
      cache: "no-store",
      credentials: "include",
      integrity: "sha256-test",
      keepalive: true,
      mode: "cors",
      redirect: "manual",
      referrer: "https://example.com/",
      referrerPolicy: "origin",
      signal: controller.signal,
    });
    Object.defineProperty(original, "cf", {
      configurable: true,
      enumerable: false,
      value: { colo: "ICN" },
    });
    const context = createContext(original);

    await bodyLimitMiddleware({ limit: 4 })(context, async () => {
      const replay = context.raw.req.raw;
      expect(replay.method).toBe(original.method);
      expect(replay.url).toBe(original.url);
      expect(Object.fromEntries(replay.headers)).toEqual(Object.fromEntries(original.headers));
      expect(replay.cache).toBe(original.cache);
      expect(replay.credentials).toBe(original.credentials);
      expect(replay.integrity).toBe(original.integrity);
      expect(replay.keepalive).toBe(original.keepalive);
      expect(replay.mode).toBe(original.mode);
      expect(replay.redirect).toBe(original.redirect);
      expect(replay.referrer).toBe(original.referrer);
      expect(replay.referrerPolicy).toBe(original.referrerPolicy);
      expect(Object.getOwnPropertyDescriptor(replay, "cf")).toMatchObject({
        enumerable: false,
        value: { colo: "ICN" },
      });
      controller.abort();
      expect(replay.signal.aborted).toBe(true);
      await expect(replay.text()).resolves.toBe("body");
    });
  });

  it("normalizes constructor-forbidden navigation mode while replaying accepted bytes", async () => {
    const original = new Request("http://localhost/upload", { method: "POST", body: "body" });
    Object.defineProperty(original, "mode", { configurable: true, value: "navigate" });
    const context = createContext(original);

    await bodyLimitMiddleware({ limit: 4 })(context, async () => {
      expect(context.raw.req.raw.mode).toBe("cors");
      await expect(context.raw.req.raw.text()).resolves.toBe("body");
    });
  });

  it("keeps JSON, text, bytes, and form parsing available after validation", async () => {
    const cases = [
      {
        request: new Request("http://localhost/upload", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: '{"ok":true}',
        }),
        read: (request: HonoRequest) => request.json(),
        expected: { ok: true },
      },
      {
        request: new Request("http://localhost/upload", { method: "POST", body: "text" }),
        read: (request: HonoRequest) => request.text(),
        expected: "text",
      },
      {
        request: new Request("http://localhost/upload", { method: "POST", body: "bytes" }),
        read: async (request: HonoRequest) => Array.from(await request.bytes()),
        expected: Array.from(new TextEncoder().encode("bytes")),
      },
      {
        request: new Request("http://localhost/upload", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: "name=croco",
        }),
        read: (request: HonoRequest) => request.parseBody(),
        expected: { name: "croco" },
      },
      {
        request: new Request("http://localhost/upload", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: "name=croco",
        }),
        read: async (request: HonoRequest) => Object.fromEntries(await request.formData()),
        expected: { name: "croco" },
      },
    ];

    for (const testCase of cases) {
      const context = createContext(testCase.request);
      let value: unknown;
      await bodyLimitMiddleware({ limit: 32 })(context, async () => {
        value = await testCase.read(context.raw.req);
      });
      expect(value).toEqual(testCase.expected);
    }
  });

  it("converts byte units", () => {
    expect(mb(1)).toBe(1024 * 1024);
    expect(kb(1)).toBe(1024);
  });
});

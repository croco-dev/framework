import "reflect-metadata";
import { once } from "node:events";
import { request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import { serve } from "@hono/node-server";
import { context, SpanStatusCode, trace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { CrocoLambdaAdapter } from "../libs/CrocoLambdaAdapter";
import type { LambdaEvent, LambdaContext } from "../libs/types";
import {
  Container,
  Context,
  GENERATED_DI_GRAPH_VERSION,
  defineGeneratedDiGraph,
} from "@croco/framework-context";
import type { ILogger } from "@croco/framework-context";
import { Hono } from "hono";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CrocoRouteRegistrar } from "../libs/CrocoRouteRegistrar";
import { ErrorHandler } from "../libs/ErrorHandler";
import { runWithResponseRequestScope } from "../libs/ResponseRequestScope";
import { compressionMiddleware } from "../libs/middleware/CompressionMiddleware";
import type { CrocoHttpContext, MiddlewareFunction } from "../libs/types";

const exporter = new InMemorySpanExporter();
const tracerProvider = new BasicTracerProvider({
  spanProcessors: [new SimpleSpanProcessor(exporter)],
});

beforeAll(() => {
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  trace.setGlobalTracerProvider(tracerProvider);
});

beforeEach(() => exporter.reset());

afterAll(async () => {
  context.disable();
  trace.disable();
  await tracerProvider.shutdown();
});

const logger: ILogger = {
  info() {},
  warn() {},
  error() {},
  debug() {},
  fatal() {},
  child() {
    return logger;
  },
};

class RequestResource {
  readonly requestId = Context.getRequestId();
  disposals = 0;
  destroy() {
    this.disposals++;
  }
}

function fixture(
  handler: (ctx: CrocoHttpContext) => unknown,
  method = "GET",
  middlewares: MiddlewareFunction[] = [],
) {
  const hono = new Hono();
  new CrocoRouteRegistrar(hono, new ErrorHandler(logger), middlewares, logger).register(
    {
      method,
      path: "/stream",
      methodName: "stream",
      handler: async (ctx) => handler(ctx),
    },
    { registerHeadAsGet: method === "HEAD" },
  );
  return hono;
}

function requestSpan(method = "GET") {
  const spans = exporter
    .getFinishedSpans()
    .filter((span) => span.name === `HTTP ${method} /stream`);
  expect(spans).toHaveLength(1);
  expect(spans[0]?.events.filter((event) => event.name === "croco.http.request.end")).toHaveLength(
    1,
  );
  return spans[0];
}

function deferred() {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("response request scope", () => {
  beforeEach(() => {
    Container.reset();
    Container.installGeneratedGraph(
      defineGeneratedDiGraph({
        version: GENERATED_DI_GRAPH_VERSION,
        graphId: "response-request-scope",
        compilerVersion: "test",
        inputHash: "test",
        roots: [RequestResource],
        providers: [
          {
            token: RequestResource,
            tokenId: "test:RequestResource",
            debugName: "RequestResource",
            scope: "request",
            dependencies: [],
            factory: () => new RequestResource(),
            sourceLocation: { file: "ResponseRequestScope.spec.ts", line: 1, column: 1 },
          },
        ],
      }),
    );
  });

  it("keeps the provider alive across lazy reads and disposes only at EOF", async () => {
    const gate = deferred();
    let resource: RequestResource | undefined;
    let lateResource: RequestResource | undefined;
    let lateRequestId: string | null = null;
    const app = fixture(() => {
      resource = Container.get(RequestResource);
      return new Response(
        new ReadableStream<Uint8Array>(
          {
            async pull(controller) {
              await gate.promise;
              trace.getTracer("test").startSpan("late pull").end();
              lateResource = Container.get(RequestResource);
              lateRequestId = Context.getRequestId();
              controller.enqueue(new TextEncoder().encode("finished"));
              controller.close();
            },
          },
          { highWaterMark: 0 },
        ),
      );
    });
    const response = await app.request("/stream", { headers: { "x-request-id": "lazy-read" } });
    expect(resource?.disposals).toBe(0);
    expect(exporter.getFinishedSpans()).toHaveLength(0);
    gate.resolve();
    expect(await response.text()).toBe("finished");
    expect(lateResource).toBe(resource);
    expect(lateRequestId).toBe("lazy-read");
    expect(resource?.disposals).toBe(1);
    const span = requestSpan();
    const pull = exporter.getFinishedSpans().find((finished) => finished.name === "late pull");
    expect(pull?.spanContext().traceId).toBe(span?.spanContext().traceId);
    expect(pull?.parentSpanContext?.spanId).toBe(span?.spanContext().spanId);
  });

  it("ends buffered response spans before the response body is consumed", async () => {
    const app = fixture(async (ctx) => ctx.jsonResponse({ ready: true }, 201));
    const response = await app.request("/stream");

    const span = requestSpan();
    expect(span?.attributes["http.status_code"]).toBe(201);
    expect(span?.status.code).toBe(SpanStatusCode.UNSET);
    expect(await response.json()).toEqual({ ready: true });
    requestSpan();
  });

  it.each(["read", "cancel"] as const)(
    "keeps a native Response span open until the body is consumed by %s",
    async (action) => {
      const app = fixture(() => new Response("native body", { status: 202 }));
      const response = await app.request("/stream");

      expect(response.status).toBe(202);
      expect(exporter.getFinishedSpans()).toHaveLength(0);
      if (action === "read") {
        expect(await response.text()).toBe("native body");
      } else {
        await response.body?.cancel();
      }
      const span = requestSpan();
      expect(span?.attributes["http.status_code"]).toBe(202);
      expect(span?.status.code).toBe(SpanStatusCode.UNSET);
    },
  );

  it("ends the span before consuming a buffered response compressed by middleware", async () => {
    const app = fixture(() => ({ message: "buffered" }), "GET", [
      compressionMiddleware({ threshold: 1, encodings: ["gzip"] }),
    ]);
    const response = await app.request("/stream", { headers: { "accept-encoding": "gzip" } });

    expect(response.headers.get("content-encoding")).toBe("gzip");
    expect(requestSpan()?.attributes["http.status_code"]).toBe(200);
    await response.arrayBuffer();
    requestSpan();
  });
});

describe("response scope terminal paths", () => {
  beforeEach(() => {
    Container.reset();
    Container.installGeneratedGraph(
      defineGeneratedDiGraph({
        version: GENERATED_DI_GRAPH_VERSION,
        graphId: "terminal-scope",
        compilerVersion: "test",
        inputHash: "test",
        roots: [RequestResource],
        providers: [
          {
            token: RequestResource,
            tokenId: "test:RequestResource",
            debugName: "RequestResource",
            scope: "request",
            dependencies: [],
            factory: () => new RequestResource(),
            sourceLocation: { file: "ResponseRequestScope.spec.ts", line: 1, column: 1 },
          },
        ],
      }),
    );
  });

  it("cancels the source in its context and disposes exactly once", async () => {
    let resource: RequestResource | undefined;
    let cancellationResource: RequestResource | undefined;
    let cancellationReason: unknown;
    const app = fixture(() => {
      resource = Container.get(RequestResource);
      return new Response(
        new ReadableStream(
          {
            cancel(reason) {
              trace.getTracer("test").startSpan("late cancel").end();
              cancellationResource = Container.get(RequestResource);
              cancellationReason = reason;
            },
          },
          { highWaterMark: 0 },
        ),
      );
    });
    const response = await app.request("/stream");
    const reader = response.body?.getReader();
    await reader?.cancel("consumer stopped");
    await reader?.cancel("duplicate");
    expect(cancellationResource).toBe(resource);
    expect(cancellationReason).toBe("consumer stopped");
    expect(resource?.disposals).toBe(1);
    const span = requestSpan();
    const cancel = exporter.getFinishedSpans().find((finished) => finished.name === "late cancel");
    expect(cancel?.parentSpanContext?.spanId).toBe(span?.spanContext().spanId);
    expect(span?.status.code).toBe(SpanStatusCode.UNSET);
  });

  it("retains providers until asynchronous cancellation finishes while a read is pending", async () => {
    let resource: RequestResource | undefined;
    const reading = deferred();
    const cancelling = deferred();
    const release = deferred();
    const app = fixture(() => {
      resource = Container.get(RequestResource);
      return new Response(
        new ReadableStream(
          {
            pull() {
              reading.resolve();
              return new Promise<void>(() => {});
            },
            async cancel() {
              cancelling.resolve();
              await release.promise;
              expect(Container.get(RequestResource)).toBe(resource);
            },
          },
          { highWaterMark: 0 },
        ),
      );
    });
    const response = await app.request("/stream");
    const reader = response.body?.getReader();
    const read = reader?.read();
    await reading.promise;
    const cancellation = reader?.cancel();
    try {
      await cancelling.promise;
      await Promise.resolve();
      expect(resource?.disposals).toBe(0);
    } finally {
      release.resolve();
      await cancellation;
    }
    expect(await read).toEqual({ done: true, value: undefined });
    expect(resource?.disposals).toBe(1);
  });

  it("rejects body consumption with the cleanup Problem when a provider destructor fails at EOF", async () => {
    let resource: RequestResource | undefined;
    const app = fixture(() => {
      const current = Container.get(RequestResource);
      resource = current;
      current.destroy = () => {
        current.disposals++;
        throw new Error("provider cleanup failed");
      };
      return new Response(
        new ReadableStream(
          {
            pull(controller) {
              controller.close();
            },
          },
          { highWaterMark: 0 },
        ),
      );
    });
    const response = await app.request("/stream");
    await expect(response.text()).rejects.toMatchObject({
      code: "framework-context/request-scope-disposal-failed",
    });
    expect(resource?.disposals).toBe(1);
  });

  it("disposes an errored stream and preserves its primary error", async () => {
    let resource: RequestResource | undefined;
    const failure = new Error("source failed");
    const app = fixture(() => {
      resource = Container.get(RequestResource);
      return new Response(
        new ReadableStream(
          {
            pull(controller) {
              controller.error(failure);
            },
          },
          { highWaterMark: 0 },
        ),
      );
    });
    const response = await app.request("/stream");
    await expect(response.text()).rejects.toBe(failure);
    expect(resource?.disposals).toBe(1);
    expect(response.status).toBe(200);
    const span = requestSpan();
    expect(span?.attributes["http.status_code"]).toBe(200);
    expect(span?.status.code).toBe(SpanStatusCode.ERROR);
    expect(span?.events.filter((event) => event.name === "exception")).toEqual([
      expect.objectContaining({
        attributes: expect.objectContaining({ "exception.message": "source failed" }),
      }),
    ]);
  });

  it("preserves the original rejection when a stream error cannot be formatted", async () => {
    const failure: unknown = Object.create(null);
    const source = new ReadableStream(
      {
        pull(controller) {
          controller.error(failure);
        },
      },
      { highWaterMark: 0 },
    );
    const app = fixture(() => new Response(source, { status: 201 }));
    const response = await app.request("/stream");

    await expect(response.text()).rejects.toBe(failure);
    expect(source.locked).toBe(false);
    const span = requestSpan();
    expect(span?.attributes["http.status_code"]).toBe(201);
    expect(span?.status.code).toBe(SpanStatusCode.ERROR);
    expect(span?.events.find((event) => event.name === "exception")?.attributes).toMatchObject({
      "exception.type": "NonErrorThrown",
      "exception.message": "Response body failure reason could not be formatted",
    });
  });

  it("traces the streaming Response thrown by a handler without changing its HTTP status", async () => {
    const failure = new Error("thrown response failed");
    const app = fixture(() => {
      throw new Response(
        new ReadableStream(
          {
            pull(controller) {
              controller.error(failure);
            },
          },
          { highWaterMark: 0 },
        ),
        { status: 409 },
      );
    });
    const response = await app.request("/stream");
    expect(response.status).toBe(409);
    expect(exporter.getFinishedSpans()).toHaveLength(0);
    await expect(response.text()).rejects.toBe(failure);

    const span = requestSpan();
    expect(span?.attributes["http.status_code"]).toBe(409);
    expect(span?.status.code).toBe(SpanStatusCode.ERROR);
    expect(span?.events.map((event) => event.name)).toContain("croco.http.response.thrown");
  });

  it("aborts a pending read without waiting for an uncooperative source", async () => {
    let resource: RequestResource | undefined;
    const started = deferred();
    const gate = deferred();
    const abort = new AbortController();
    const app = fixture(() => {
      resource = Container.get(RequestResource);
      return new Response(
        new ReadableStream(
          {
            async pull() {
              started.resolve();
              await gate.promise;
            },
          },
          { highWaterMark: 0 },
        ),
      );
    });
    const response = await app.request("/stream", { signal: abort.signal });
    const body = response.text();
    void body.catch(() => undefined);
    await started.promise;
    abort.abort("disconnect");
    await expect(body).rejects.toBe("disconnect");
    expect(resource?.disposals).toBe(1);
    gate.resolve();
    const span = requestSpan();
    expect(span?.status.code).toBe(SpanStatusCode.ERROR);
    expect(span?.events.filter((event) => event.name === "exception")).toHaveLength(1);
  });

  it.each([false, true])(
    "releases an aborted source after cancellation settles (reading=%s)",
    async (reading) => {
      let resource: RequestResource | undefined;
      const started = deferred();
      const release = deferred();
      const abort = new AbortController();
      const failure = new Error("request disconnected");
      const cancel = vi.fn(async () => {
        await release.promise;
      });
      const source = new ReadableStream<Uint8Array>(
        {
          pull() {
            started.resolve();
            return new Promise<void>(() => {});
          },
          cancel,
        },
        { highWaterMark: 0 },
      );
      const app = fixture(() => {
        resource = Container.get(RequestResource);
        return new Response(source);
      });
      const response = await app.request("/stream", { signal: abort.signal });
      expect(source.locked).toBe(true);
      const body = reading ? response.text() : undefined;
      void body?.catch(() => undefined);
      if (reading) await started.promise;
      try {
        abort.abort(failure);
        await expect(body ?? response.text()).rejects.toBe(failure);
        expect(resource?.disposals).toBe(1);
        expect(cancel).toHaveBeenCalledExactlyOnceWith(failure);
        expect(source.locked).toBe(true);
      } finally {
        release.resolve();
      }
      await vi.waitFor(() => expect(source.locked).toBe(false));
      expect(resource?.disposals).toBe(1);
    },
  );

  it("shares reader cleanup when request abort interrupts consumer cancellation", async () => {
    let resource: RequestResource | undefined;
    const started = deferred();
    const cancelling = deferred();
    const release = deferred();
    const abort = new AbortController();
    const cancel = vi.fn(async () => {
      cancelling.resolve();
      await release.promise;
    });
    const source = new ReadableStream<Uint8Array>(
      {
        pull() {
          started.resolve();
          return new Promise<void>(() => {});
        },
        cancel,
      },
      { highWaterMark: 0 },
    );
    const app = fixture(() => {
      resource = Container.get(RequestResource);
      return new Response(source);
    });
    const response = await app.request("/stream", { signal: abort.signal });
    const consumer = response.body?.getReader();
    const read = consumer?.read();
    await started.promise;
    const cancellation = consumer?.cancel("consumer stopped");
    try {
      await cancelling.promise;
      expect(resource?.disposals).toBe(0);
      abort.abort("request stopped");
      expect(resource?.disposals).toBe(1);
      expect(source.locked).toBe(true);
    } finally {
      release.resolve();
      await cancellation;
    }
    expect(await read).toEqual({ done: true, value: undefined });
    expect(cancel).toHaveBeenCalledExactlyOnceWith("consumer stopped");
    expect(source.locked).toBe(false);
    expect(resource?.disposals).toBe(1);
  });

  it("releases the reader and reports a rejected abort cancellation without replacing the abort error", async () => {
    let resource: RequestResource | undefined;
    const release = deferred();
    const abort = new AbortController();
    const failure = new Error("request disconnected");
    const cancellationFailure = new Error("source cancellation failed");
    const report = vi.fn();
    const source = new ReadableStream<Uint8Array>({
      async cancel() {
        await release.promise;
        throw cancellationFailure;
      },
    });
    const response = await runWithResponseRequestScope(
      { requestId: "abort-cancellation-failure" },
      new Request("http://localhost/stream", { signal: abort.signal }),
      async () => {
        resource = Container.get(RequestResource);
        return new Response(source);
      },
      report,
    );
    try {
      abort.abort(failure);
      await expect(response.text()).rejects.toBe(failure);
      expect(resource?.disposals).toBe(1);
    } finally {
      release.resolve();
    }
    await vi.waitFor(() => expect(report).toHaveBeenCalledExactlyOnceWith(cancellationFailure));
    expect(source.locked).toBe(false);
    expect(resource?.disposals).toBe(1);
  });

  it.each(["EOF", "error"])("releases the reader when %s races with abort", async (terminal) => {
    let resource: RequestResource | undefined;
    let sourceController: ReadableStreamDefaultController<Uint8Array> | undefined;
    const started = deferred();
    const abort = new AbortController();
    const failure = new Error("request disconnected");
    const sourceFailure = new Error("source failed");
    const report = vi.fn();
    const source = new ReadableStream<Uint8Array>(
      {
        start(controller) {
          sourceController = controller;
        },
        pull() {
          started.resolve();
        },
      },
      { highWaterMark: 0 },
    );
    const response = await runWithResponseRequestScope(
      { requestId: "terminal-abort-race" },
      new Request("http://localhost/stream", { signal: abort.signal }),
      async () => {
        resource = Container.get(RequestResource);
        return new Response(source);
      },
      report,
    );
    const body = response.text();
    void body.catch(() => undefined);
    await started.promise;
    if (terminal === "EOF") sourceController?.close();
    else sourceController?.error(sourceFailure);
    abort.abort(failure);
    await expect(body).rejects.toBe(failure);
    await vi.waitFor(() => expect(source.locked).toBe(false));
    expect(resource?.disposals).toBe(1);
    if (terminal === "error") expect(report).toHaveBeenCalledExactlyOnceWith(sourceFailure);
    else expect(report).not.toHaveBeenCalled();
  });

  it.each(["GET", "HEAD"])("cleans up %s responses without a body consumer", async (method) => {
    let resource: RequestResource | undefined;
    let cancelled = false;
    const app = fixture(() => {
      resource = Container.get(RequestResource);
      return method === "HEAD"
        ? new Response(
            new ReadableStream({
              cancel() {
                cancelled = true;
              },
            }),
          )
        : new Response(null, { status: 204 });
    }, method);
    const response = await app.request("/stream", { method });
    expect(response.body).toBeNull();
    expect(resource?.disposals).toBe(1);
    expect(requestSpan(method)?.status.code).toBe(SpanStatusCode.UNSET);
    if (method === "HEAD") expect(cancelled).toBe(true);
  });

  it("cleans up handler failures before returning the Problem response", async () => {
    let resource: RequestResource | undefined;
    const app = fixture(() => {
      resource = Container.get(RequestResource);
      throw new Error("handler failed");
    });
    const response = await app.request("/stream");
    expect(response.status).toBe(500);
    expect(resource?.disposals).toBe(1);
    expect((await response.json()).status).toBe(500);
    expect(requestSpan()?.attributes["http.status_code"]).toBe(500);
  });

  it("keeps overlapping consumers in their own request scopes", async () => {
    const resources: RequestResource[] = [];
    const app = fixture(() => {
      const resource = Container.get(RequestResource);
      resources.push(resource);
      return new Response(
        new ReadableStream(
          {
            pull(controller) {
              const current = Container.get(RequestResource);
              controller.enqueue(
                new TextEncoder().encode(`${current.requestId}:${current === resource}`),
              );
              controller.close();
            },
          },
          { highWaterMark: 0 },
        ),
      );
    });
    const [first, second] = await Promise.all([
      app.request("/stream", { headers: { "x-request-id": "first" } }),
      app.request("/stream", { headers: { "x-request-id": "second" } }),
    ]);
    expect(await second.text()).toBe("second:true");
    expect(resources[0].disposals).toBe(0);
    expect(await first.text()).toBe("first:true");
    expect(resources.map((resource) => resource.disposals)).toEqual([1, 1]);
    expect(resources[0]).not.toBe(resources[1]);
    expect(Context.get()).toBeNull();
  });
  it.each(["complete", "disconnect"])(
    "keeps Node response providers alive until %s",
    async (terminal) => {
      let resource: RequestResource | undefined;
      const ended = deferred();
      const gate = deferred();
      let source: ReadableStream<Uint8Array> | undefined;
      const app = fixture(() => {
        resource = Container.get(RequestResource);
        const originalDestroy = resource.destroy.bind(resource);
        resource.destroy = () => {
          originalDestroy();
          ended.resolve();
        };
        let first = true;
        source = new ReadableStream<Uint8Array>(
          {
            async pull(controller) {
              if (first) {
                first = false;
                controller.enqueue(new TextEncoder().encode("connected"));
              } else {
                await gate.promise;
                if (terminal === "complete") {
                  expect(Container.get(RequestResource)).toBe(resource);
                  controller.enqueue(new TextEncoder().encode("finished"));
                  controller.close();
                }
              }
            },
          },
          { highWaterMark: 0 },
        );
        return new Response(source);
      });
      const server = serve({
        fetch: (request) => app.fetch(request),
        port: 0,
        hostname: "127.0.0.1",
      });
      if (!server.listening) await once(server, "listening");
      const client = httpRequest({
        host: "127.0.0.1",
        port: (server.address() as AddressInfo).port,
        path: "/stream",
      });
      client.on("error", () => undefined);
      const received = once(client, "response");
      client.end();
      try {
        const [response] = await received;
        const [chunk] = await once(response, "data");
        expect(chunk.toString()).toBe("connected");
        response.pause();
        expect(resource?.disposals).toBe(0);
        expect(exporter.getFinishedSpans()).toHaveLength(0);
        if (terminal === "complete") {
          const completed = once(response, "end");
          gate.resolve();
          response.resume();
          await completed;
        } else {
          client.destroy();
        }
        await ended.promise;
        await vi.waitFor(() => expect(source?.locked).toBe(false));
        expect(resource?.disposals).toBe(1);
        requestSpan();
      } finally {
        gate.resolve();
        client.destroy();
        const closed = once(server, "close");
        server.close();
        await closed;
      }
    },
  );

  it("finishes Lambda buffering before provider cleanup and flush", async () => {
    let resource: RequestResource | undefined;
    const app = fixture(() => {
      resource = Container.get(RequestResource);
      return new Response(
        new ReadableStream(
          {
            pull(controller) {
              expect(Container.get(RequestResource)).toBe(resource);
              expect(resource?.disposals).toBe(0);
              expect(exporter.getFinishedSpans()).toHaveLength(0);
              controller.enqueue(new TextEncoder().encode("lambda-complete"));
              controller.close();
            },
          },
          { highWaterMark: 0 },
        ),
      );
    });
    const event: LambdaEvent = {
      version: "2.0",
      routeKey: "GET /stream",
      rawPath: "/stream",
      rawQueryString: "",
      headers: {},
      isBase64Encoded: false,
      requestContext: {
        accountId: "test",
        apiId: "test",
        domainName: "localhost",
        domainPrefix: "test",
        http: {
          method: "GET",
          path: "/stream",
          protocol: "HTTP/1.1",
          sourceIp: "127.0.0.1",
          userAgent: "test",
        },
        requestId: "lambda-stream",
        routeKey: "GET /stream",
        stage: "$default",
        time: "",
        timeEpoch: 0,
      },
    };
    const context: LambdaContext = {
      callbackWaitsForEmptyEventLoop: false,
      functionName: "stream",
      functionVersion: "$LATEST",
      invokedFunctionArn: "test",
      memoryLimitInMB: "128",
      awsRequestId: "stream",
      logGroupName: "test",
      logStreamName: "test",
      getRemainingTimeInMillis: () => 5000,
      done() {},
      fail() {},
      succeed() {},
    };
    const flush = vi.fn(() => {
      expect(resource?.disposals).toBe(1);
      requestSpan();
    });
    const handler = new CrocoLambdaAdapter(app).createHandler({ flush });
    const result = await handler(event, context);
    expect(result.body).toBe("lambda-complete");
    expect(resource?.disposals).toBe(1);
    expect(flush).toHaveBeenCalledOnce();
  });
});

import "reflect-metadata";
import { once } from "node:events";
import { request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import { serve } from "@hono/node-server";
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
import { beforeEach, describe, expect, it } from "vitest";
import { CrocoRouteRegistrar } from "../libs/CrocoRouteRegistrar";
import { ErrorHandler } from "../libs/ErrorHandler";

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

function fixture(handler: () => Response | Promise<Response>, method = "GET") {
  const hono = new Hono();
  new CrocoRouteRegistrar(hono, new ErrorHandler(logger), [], logger).register(
    {
      method,
      path: "/stream",
      methodName: "stream",
      handler: async () => handler(),
    },
    { registerHeadAsGet: method === "HEAD" },
  );
  return hono;
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
    gate.resolve();
    expect(await response.text()).toBe("finished");
    expect(lateResource).toBe(resource);
    expect(lateRequestId).toBe("lazy-read");
    expect(resource?.disposals).toBe(1);
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
      const app = fixture(() => {
        resource = Container.get(RequestResource);
        const originalDestroy = resource.destroy.bind(resource);
        resource.destroy = () => {
          originalDestroy();
          ended.resolve();
        };
        let first = true;
        return new Response(
          new ReadableStream<Uint8Array>(
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
          ),
        );
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
        if (terminal === "complete") {
          const completed = once(response, "end");
          gate.resolve();
          response.resume();
          await completed;
        } else {
          client.destroy();
        }
        await ended.promise;
        expect(resource?.disposals).toBe(1);
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
    const handler = new CrocoLambdaAdapter(app).createHandler({
      flush() {
        expect(resource?.disposals).toBe(1);
      },
    });
    const result = await handler(event, context);
    expect(result.body).toBe("lambda-complete");
    expect(resource?.disposals).toBe(1);
  });
});

import "reflect-metadata";
import { Buffer } from "node:buffer";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { Agent, request as sendHttpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Container, type ILogger, LOGGER_TOKEN } from "@croco/framework-context";
import { Logger } from "@croco/framework-logger";
import { Body, Controller, Get, Post, Raw, RequestValidationProblem } from "@croco/protocols-rest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createApp, type CrocoApp } from "../libs/CrocoApp";
import { startServer } from "../libs/adapters/NodeAdapter";
import { ErrorHandler } from "../libs/ErrorHandler";
import { HealthCheckRegistry } from "../libs/HealthCheckRegistry";
import { bodyLimitMiddleware } from "../libs/middleware/BodyLimitMiddleware";
import {
  createGracefulShutdownController,
  resetShutdownState,
} from "../libs/middleware/GracefulShutdownMiddleware";
import type { MiddlewareFunction, NodeServerHandle } from "../libs/types";

const LIFECYCLE_TIMEOUT_MS = 2_500;

@Controller("/node-smoke")
class NodeSmokeController {
  @Get("/json")
  json() {
    return { ok: true, transport: "node", path: "json" };
  }

  @Get("/problem")
  problem() {
    throw new RequestValidationProblem("query", [
      { path: "mode", message: "must be a supported smoke mode" },
    ]);
  }

  @Post("/echo")
  async echo(@Raw() raw: { req: { raw: Request } }) {
    return { body: await raw.req.raw.text() };
  }
}

const OPTIONAL_NODE_BODY_SCHEMA = z.object({ value: z.string() }).optional();
const DEFAULT_NODE_BODY_SCHEMA = z.object({ value: z.string() }).default({ value: "default" });
const CATCH_NODE_BODY_SCHEMA = z.object({ value: z.string() }).catch({ value: "caught" });
const REQUIRED_NODE_BODY_SCHEMA = z.object({ value: z.string() });
const NULLABLE_REQUIRED_NODE_BODY_SCHEMA = REQUIRED_NODE_BODY_SCHEMA.nullable();

@Controller("/node-omitted-body")
class NodeOmittedBodyController {
  @Post("/optional")
  optional(@Body(OPTIONAL_NODE_BODY_SCHEMA) body: z.infer<typeof OPTIONAL_NODE_BODY_SCHEMA>) {
    return { value: body?.value ?? "omitted" };
  }

  @Post("/default")
  defaulted(@Body(DEFAULT_NODE_BODY_SCHEMA) body: z.infer<typeof DEFAULT_NODE_BODY_SCHEMA>) {
    return body;
  }

  @Post("/catch")
  caught(@Body(CATCH_NODE_BODY_SCHEMA) body: z.infer<typeof CATCH_NODE_BODY_SCHEMA>) {
    return body;
  }

  @Post("/required")
  required(@Body(REQUIRED_NODE_BODY_SCHEMA) body: z.infer<typeof REQUIRED_NODE_BODY_SCHEMA>) {
    return body;
  }

  @Post("/nullable-required")
  nullableRequired(
    @Body(NULLABLE_REQUIRED_NODE_BODY_SCHEMA)
    body: z.infer<typeof NULLABLE_REQUIRED_NODE_BODY_SCHEMA>,
  ) {
    return body;
  }
}

const nodeSmokeHeaderMiddleware: MiddlewareFunction = async (_ctx, next) => {
  const response = await next();

  if (response instanceof Response) {
    response.headers.set("x-croco-node-smoke", "real-server");
  }

  return response;
};

describe("NodeAdapter real server smoke", () => {
  const servers: NodeServerHandle[] = [];
  let staticDir: string | undefined;

  beforeEach(() => {
    Container.reset();
    staticDir = undefined;
    resetShutdownState();

    const logger: ILogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      child: () => logger,
    };

    Container.set(Logger, logger);
    Container.set(LOGGER_TOKEN, logger);
    Container.set(ErrorHandler, new ErrorHandler(logger));
    Container.set(HealthCheckRegistry, new HealthCheckRegistry());
  });

  afterEach(async () => {
    const cleanupResults = await Promise.allSettled([
      ...servers.splice(0).map((server) => closeServer(server, "Node smoke cleanup")),
      ...(staticDir ? [rm(staticDir, { recursive: true, force: true })] : []),
    ]);

    Container.reset();
    resetShutdownState();

    const cleanupFailures = cleanupResults
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) =>
        result.reason instanceof Error ? result.reason.message : String(result.reason),
      );

    if (cleanupFailures.length > 0) {
      throw new Error(`Node smoke cleanup failed: ${cleanupFailures.join("; ")}`);
    }
  });

  it("serves routes, operational endpoints, headers, statuses, and Problem responses over startServer(app, 0)", async () => {
    const registry = Container.get(HealthCheckRegistry);
    registry.register("node-smoke", async () => ({ status: "up", latency: 1 }));
    const app = createNodeSmokeApp();
    const server = await withTimeout(
      startServer(app, 0),
      "startServer(app, 0) did not return a server handle",
    );
    servers.push(server);

    await waitForListening(server, "startServer(app, 0)");
    const baseUrl = getBaseUrl(server, "startServer(app, 0)");

    const routeResponse = await fetchWithTimeout(
      `${baseUrl}/node-smoke/json`,
      "GET /node-smoke/json",
    );
    expect(routeResponse.status).toBe(200);
    expect(routeResponse.headers.get("content-type")).toContain("application/json");
    expect(routeResponse.headers.get("x-croco-node-smoke")).toBe("real-server");
    expect(await routeResponse.json()).toEqual({ ok: true, transport: "node", path: "json" });

    const metricsResponse = await fetchWithTimeout(`${baseUrl}/metrics`, "GET /metrics");
    expect(metricsResponse.status).toBe(200);
    expect(metricsResponse.headers.get("cache-control")).toBe("no-store");
    expect(await metricsResponse.json()).toMatchObject({
      metrics: {
        healthCheckCount: 1,
      },
    });

    const problemResponse = await fetchWithTimeout(
      `${baseUrl}/node-smoke/problem`,
      "GET /node-smoke/problem",
    );
    expect(problemResponse.status).toBe(422);
    expect(problemResponse.headers.get("content-type")).toContain("application/json");
    expect(await problemResponse.json()).toMatchObject({
      code: "protocols-rest/request-validation-failed",
      detail: "query.mode: must be a supported smoke mode",
      status: 422,
      title: "Validation Error",
    });
  });

  it("serves static assets over a real Node socket when listen staticDir is enabled", async () => {
    staticDir = await mkdtemp(join(tmpdir(), "croco-node-smoke-"));
    await mkdir(join(staticDir, "assets"), { recursive: true });
    await writeFile(
      join(staticDir, "assets", "app.js"),
      'globalThis.__crocoNodeSmoke = "node adapter static smoke";\n',
    );

    const app = createNodeSmokeApp();
    const server = await withTimeout(
      app.listen(0, { staticDir }),
      "app.listen(0, { staticDir }) did not return a server handle",
    );
    servers.push(server);

    await waitForListening(server, "app.listen(0, { staticDir })");
    const baseUrl = getBaseUrl(server, "app.listen(0, { staticDir })");
    const assetResponse = await fetchWithTimeout(`${baseUrl}/assets/app.js`, "GET /assets/app.js");

    expect(assetResponse.status).toBe(200);
    expect(assetResponse.headers.get("content-type")).toContain("javascript");
    expect(await assetResponse.text()).toContain("node adapter static smoke");
  });

  it("enforces chunked request bytes and preserves the accepted body over a real Node socket", async () => {
    const app = createNodeSmokeApp();
    const server = await withTimeout(
      startServer(app, 0),
      "chunked body-limit server did not return a handle",
    );
    servers.push(server);
    await waitForListening(server, "chunked body-limit server");
    const baseUrl = getBaseUrl(server, "chunked body-limit server");

    const accepted = await sendChunkedRequest(`${baseUrl}/node-smoke/echo`, ["12", "34"]);
    expect(accepted.status).toBe(200);
    expect(accepted.body).toEqual({ body: "1234" });

    const rejected = await sendChunkedRequest(`${baseUrl}/node-smoke/echo`, ["1234", "5"]);
    expect(rejected.status).toBe(413);
    expect(rejected.body).toMatchObject({
      code: "transports-http/request-body-too-large",
      status: 413,
      limit: 4,
    });
  });

  it("preserves zero-byte request bodies for schema validation over a real Node socket", async () => {
    const app = createApp({
      controllers: [NodeOmittedBodyController],
      securityValidation: "off",
      diValidation: "off",
    });
    const server = await app.listen(0);
    servers.push(server);
    await waitForListening(server, "omitted body server");
    const baseUrl = getBaseUrl(server, "omitted body server");

    const cases = [
      { path: "optional", expectedBody: { value: "omitted" } },
      { path: "default", expectedBody: { value: "default" } },
      { path: "catch", expectedBody: { value: "caught" } },
      { path: "required", expectedStatus: 422 },
      { path: "nullable-required", expectedStatus: 422 },
    ] as const;

    for (const testCase of cases) {
      const response = await fetchWithTimeout(
        `${baseUrl}/node-omitted-body/${testCase.path}`,
        `POST /node-omitted-body/${testCase.path}`,
        { method: "POST" },
      );

      if ("expectedBody" in testCase) {
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual(testCase.expectedBody);
      } else {
        expect(response.status).toBe(testCase.expectedStatus);
        expect(await response.json()).toMatchObject({
          code: "protocols-rest/request-validation-failed",
          issues: [expect.objectContaining({ path: "body.value" })],
        });
      }
    }
  });

  it("drains a keep-alive request, closes the listener, then runs the shutdown hook on SIGTERM", async () => {
    const requestStarted = deferred();
    const releaseRequest = deferred();
    const keepAliveAgent = new Agent({ keepAlive: true });
    let server: NodeServerHandle | undefined;
    let listenerClosedBeforeHook = false;
    const graceful = createGracefulShutdownController({
      signals: ["SIGTERM"],
      timeoutMs: 1_000,
      isLambdaEnvironment: false,
      onShutdown: () => {
        listenerClosedBeforeHook = server?.listening === false;
      },
    });
    const holdRequest: MiddlewareFunction = async (ctx, next) => {
      if (ctx.req.path === "/node-smoke/json") {
        requestStarted.resolve();
        await releaseRequest.promise;
      }
      return next();
    };
    const app = createApp({
      controllers: [NodeSmokeController],
      middlewares: [graceful.middleware, holdRequest, nodeSmokeHeaderMiddleware],
      securityValidation: "off",
      diValidation: "off",
    });
    server = await app.listen(0);
    servers.push(server);
    await waitForListening(server, "graceful shutdown server");
    const baseUrl = getBaseUrl(server, "graceful shutdown server");
    const activeResponse = sendKeepAliveRequest(`${baseUrl}/node-smoke/json`, keepAliveAgent);
    await requestStarted.promise;

    process.emit("SIGTERM");
    process.emit("SIGTERM");
    await vi.waitFor(() => expect(graceful.isShuttingDown()).toBe(true));

    const rejectedResponse = await fetchWithTimeout(
      `${baseUrl}/node-smoke/problem`,
      "request received during graceful drain",
    );
    expect(rejectedResponse.status).toBe(503);

    const lateServer = await app.listen(0);
    servers.push(lateServer);
    await vi.waitFor(() => expect(lateServer.listening).toBe(false));
    expect(server.listening).toBe(true);

    releaseRequest.resolve();
    expect((await activeResponse).status).toBe(200);
    await graceful.shutdown();

    expect(server.listening).toBe(false);
    expect(listenerClosedBeforeHook).toBe(true);
    keepAliveAgent.destroy();
  });

  it("force-closes the listener when active request draining times out", async () => {
    const requestStarted = deferred();
    const releaseRequest = deferred();
    const logger = Container.get(LOGGER_TOKEN) as ILogger;
    const error = vi.spyOn(logger, "error");
    const graceful = createGracefulShutdownController({
      signals: ["SIGTERM"],
      timeoutMs: 50,
      isLambdaEnvironment: false,
      logger,
    });
    const holdRequest: MiddlewareFunction = async (ctx, next) => {
      if (ctx.req.path === "/node-smoke/json") {
        requestStarted.resolve();
        await releaseRequest.promise;
      }
      return next();
    };
    const app = createApp({
      controllers: [NodeSmokeController],
      middlewares: [graceful.middleware, holdRequest],
      securityValidation: "off",
      diValidation: "off",
    });
    const server = await app.listen(0);
    servers.push(server);
    await waitForListening(server, "timed shutdown server");
    const activeResponse = fetchWithTimeout(
      `${getBaseUrl(server, "timed shutdown server")}/node-smoke/json`,
      "active request interrupted by shutdown timeout",
    ).catch(() => undefined);
    await requestStarted.promise;

    process.emit("SIGTERM");
    const shutdownResult = graceful.shutdown().catch((failure: unknown) => failure);
    await vi.waitFor(() => expect(server.listening).toBe(false));
    const failure = await shutdownResult;

    expect(failure).toMatchObject({ phase: "active-requests" });
    expect(error).toHaveBeenCalledWith("Graceful shutdown failed", { error: failure });
    releaseRequest.resolve();
    await activeResponse;
  });
});

function deferred(): { readonly promise: Promise<void>; readonly resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

async function sendKeepAliveRequest(url: string, agent: Agent): Promise<{ status: number }> {
  return withTimeout(
    new Promise((resolve, reject) => {
      const request = sendHttpRequest(url, { agent }, (response) => {
        response.resume();
        response.on("end", () => resolve({ status: response.statusCode ?? 0 }));
      });
      request.on("error", reject);
      request.end();
    }),
    `keep-alive GET ${url} did not complete`,
  );
}

function createNodeSmokeApp(): CrocoApp {
  return createApp({
    controllers: [NodeSmokeController],
    middlewares: [bodyLimitMiddleware({ limit: 4 }), nodeSmokeHeaderMiddleware],
    securityValidation: "off",
    diValidation: "off",
  });
}

async function sendChunkedRequest(
  url: string,
  chunks: readonly string[],
): Promise<{ status: number; body: unknown }> {
  return withTimeout(
    new Promise((resolve, reject) => {
      const request = sendHttpRequest(
        url,
        {
          method: "POST",
          headers: {
            "content-type": "text/plain",
            "transfer-encoding": "chunked",
          },
        },
        (response) => {
          const responseChunks: Buffer[] = [];
          response.on("data", (chunk: Buffer) => responseChunks.push(chunk));
          response.on("end", () => {
            const text = Buffer.concat(responseChunks).toString("utf8");
            resolve({
              status: response.statusCode ?? 0,
              body: JSON.parse(text) as unknown,
            });
          });
        },
      );
      request.on("error", reject);
      for (const chunk of chunks) {
        request.write(chunk);
      }
      request.end();
    }),
    `chunked POST ${url} did not complete`,
  );
}

async function waitForListening(server: NodeServerHandle, description: string): Promise<void> {
  if (server.listening) {
    return;
  }

  let cleanup: () => void = () => {};

  await withTimeout(
    new Promise<void>((resolve, reject) => {
      cleanup = () => {
        server.off("listening", onListening);
        server.off("error", onError);
      };
      const onListening = () => {
        cleanup();
        resolve();
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };

      server.once("listening", onListening);
      server.once("error", onError);
    }),
    `${description} did not emit a listening event`,
  ).finally(() => {
    cleanup();
  });
}

function getBaseUrl(server: NodeServerHandle, description: string): string {
  const address = server.address();

  if (address === null) {
    throw new Error(`${description} did not expose a server address after listening.`);
  }

  if (typeof address === "string") {
    throw new Error(`${description} used a Unix socket address; expected TCP.`);
  }

  const hostname =
    address.address === "::"
      ? "[::1]"
      : address.address === "0.0.0.0"
        ? "127.0.0.1"
        : address.family === "IPv6"
          ? `[${address.address}]`
          : address.address;

  return `http://${hostname}:${address.port}`;
}

async function fetchWithTimeout(
  url: string,
  description: string,
  init: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error(`${description} timed out after ${LIFECYCLE_TIMEOUT_MS}ms.`));
  }, LIFECYCLE_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${description} failed for ${url}: ${message}`);
  } finally {
    clearTimeout(timeout);
  }
}

async function closeServer(server: NodeServerHandle, description: string): Promise<void> {
  await withTimeout(
    new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        server.off("error", onError);
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };

      server.once("error", onError);
      server.close((error?: Error & { code?: string }) => {
        cleanup();

        if (!error || error.code === "ERR_SERVER_NOT_RUNNING") {
          resolve();
          return;
        }

        reject(error);
      });
    }),
    `${description} close did not finish`,
  );
}

async function withTimeout<T>(operation: Promise<T>, description: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`${description} within ${LIFECYCLE_TIMEOUT_MS}ms.`));
        }, LIFECYCLE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

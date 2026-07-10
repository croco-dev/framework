import "reflect-metadata";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Container, type ILogger, LOGGER_TOKEN } from "@croco/framework-context";
import { Logger } from "@croco/framework-logger";
import { Controller, Get, RequestValidationProblem } from "@croco/protocols-rest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp, type CrocoApp } from "../libs/CrocoApp";
import { startServer } from "../libs/adapters/NodeAdapter";
import { ErrorHandler } from "../libs/ErrorHandler";
import { HealthCheckRegistry } from "../libs/HealthCheckRegistry";
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
});

function createNodeSmokeApp(): CrocoApp {
  return createApp({
    controllers: [NodeSmokeController],
    middlewares: [nodeSmokeHeaderMiddleware],
    securityValidation: "off",
    diValidation: "off",
  });
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

  return `http://127.0.0.1:${address.port}`;
}

async function fetchWithTimeout(url: string, description: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error(`${description} timed out after ${LIFECYCLE_TIMEOUT_MS}ms.`));
  }, LIFECYCLE_TIMEOUT_MS);

  try {
    return await fetch(url, { signal: controller.signal });
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

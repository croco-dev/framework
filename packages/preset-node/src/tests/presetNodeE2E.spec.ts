import http from "node:http";
import type { AddressInfo } from "node:net";
import { Hono } from "hono";
import { afterEach, describe, expect, it } from "vitest";
import type { NodeHost } from "../entry";
import { createNodeEntry, createNodeHost } from "../index";

let entry: NodeHost | null = null;
const agents: http.Agent[] = [];

afterEach(async () => {
  for (const agent of agents.splice(0)) {
    agent.destroy();
  }
  entry?.server?.closeAllConnections?.();
  await entry?.close();
  entry = null;
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

function request(port: number, agent: http.Agent, onData?: () => void) {
  return new Promise<{ status: number; connection: string | undefined; body: string }>(
    (resolve, reject) => {
      http
        .get({ host: "127.0.0.1", port, path: "/slow", agent }, (response) => {
          let body = "";
          response.setEncoding("utf8");
          response.on("data", (chunk: string) => {
            body += chunk;
            onData?.();
          });
          response.on("end", () =>
            resolve({
              status: response.statusCode ?? 0,
              connection: response.headers.connection,
              body,
            }),
          );
        })
        .on("error", reject);
    },
  );
}

function getServerPort(server: NodeHost["server"]): number {
  const address = server?.address();

  expect(address).not.toBeNull();
  expect(typeof address).toBe("object");

  return (address as AddressInfo).port;
}

describe("createNodeEntry E2E", () => {
  it("starts a server and handles HTTP requests", async () => {
    const app = new Hono();
    app.get("/test", (c) => c.json({ status: "ok" }));
    entry = createNodeEntry({ fetch: app.fetch }, { port: 0, hostname: "127.0.0.1" });

    await entry.start();
    const port = getServerPort(entry.server);

    const response = await fetch(`http://127.0.0.1:${port}/test`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  }, 10000);

  it("rejects when another server uses the same port", async () => {
    const app = new Hono();
    app.get("/test", (c) => c.text("ok"));
    entry = createNodeEntry({ fetch: app.fetch }, { port: 0, hostname: "127.0.0.1" });

    await entry.start();
    const port = getServerPort(entry.server);
    const conflictingEntry = createNodeEntry({ fetch: app.fetch }, { port, hostname: "127.0.0.1" });

    await expect(conflictingEntry.start()).rejects.toThrow();
    await conflictingEntry.close();
  }, 10000);
});

describe("createNodeHost keep-alive drain", () => {
  async function startWithInFlightRequest(keepAliveTimeout: number, connection?: string) {
    const entered = deferred();
    const gate = deferred();
    const app = new Hono();
    app.get("/slow", async (context) => {
      entered.resolve();
      await gate.promise;
      return connection
        ? new Response("done", { headers: { Connection: connection } })
        : context.text("done");
    });
    entry = createNodeHost({ fetch: app.fetch }, { port: 0, hostname: "127.0.0.1" });
    await entry.start();
    const server = entry.server;
    if (!server) {
      throw new Error("server missing after start");
    }
    server.keepAliveTimeout = keepAliveTimeout;
    const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
    agents.push(agent);
    const inFlight = request(getServerPort(server), agent);
    await entered.promise;
    return { host: entry, gate, inFlight };
  }

  it("sends Connection: close for a request completed during drain", async () => {
    const { host, gate, inFlight } = await startWithInFlightRequest(65_000);
    const closing = host.close(1_500);
    gate.resolve();

    await expect(inFlight).resolves.toEqual({ status: 200, connection: "close", body: "done" });
    await expect(closing).resolves.toBeUndefined();
  }, 10_000);

  it("completes drain after an in-flight request despite a longer keep-alive timeout", async () => {
    const { host, gate, inFlight } = await startWithInFlightRequest(65_000);
    const closing = host.close(1_500);
    gate.resolve();

    await expect(inFlight).resolves.toMatchObject({ status: 200, body: "done" });
    await expect(closing).resolves.toBeUndefined();
  }, 10_000);

  it("overrides an application keep-alive header during drain", async () => {
    const { host, gate, inFlight } = await startWithInFlightRequest(65_000, "keep-alive");
    const closing = host.close(1_500);
    gate.resolve();

    await expect(inFlight).resolves.toEqual({ status: 200, connection: "close", body: "done" });
    await expect(closing).resolves.toBeUndefined();
  }, 10_000);

  it.each([
    { kind: "object", headers: { Connection: "keep-alive" } },
    { kind: "array", headers: ["Connection", "keep-alive"] },
  ])(
    "overrides writeHead's third-argument $kind headers during drain",
    async ({ headers }) => {
      const entered = deferred();
      const gate = deferred();
      const app = new Hono();
      entry = createNodeHost({ fetch: app.fetch }, { port: 0, hostname: "127.0.0.1" });
      await entry.start();
      const server = entry.server;
      if (!server) {
        throw new Error("server missing after start");
      }
      server.keepAliveTimeout = 65_000;
      const honoListener = server.listeners("request").at(-1) as
        | ((request: http.IncomingMessage, response: http.ServerResponse) => void)
        | undefined;
      if (!honoListener) {
        throw new Error("server request listener missing after start");
      }
      server.removeListener("request", honoListener);
      server.on("request", (_request, response) => {
        entered.resolve();
        void gate.promise.then(() => {
          response.writeHead(200, undefined, headers);
          response.end("done");
        });
      });
      const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
      agents.push(agent);
      const inFlight = request(getServerPort(server), agent);
      await entered.promise;

      const closing = entry.close(1_500);
      gate.resolve();

      await expect(inFlight).resolves.toEqual({ status: 200, connection: "close", body: "done" });
      await expect(closing).resolves.toBeUndefined();
    },
    10_000,
  );

  it("closes a streaming connection after its already-sent response finishes", async () => {
    const firstChunk = deferred();
    const gate = deferred();
    const app = new Hono();
    app.get(
      "/slow",
      () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode("start"));
              void gate.promise.then(() => {
                controller.enqueue(new TextEncoder().encode("end"));
                controller.close();
              });
            },
          }),
        ),
    );
    entry = createNodeHost({ fetch: app.fetch }, { port: 0, hostname: "127.0.0.1" });
    await entry.start();
    const server = entry.server;
    if (!server) {
      throw new Error("server missing after start");
    }
    server.keepAliveTimeout = 65_000;
    const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
    agents.push(agent);
    const inFlight = request(getServerPort(server), agent, firstChunk.resolve);
    await firstChunk.promise;

    const closing = entry.close(1_500);
    gate.resolve();

    await expect(inFlight).resolves.toMatchObject({ status: 200, body: "startend" });
    await expect(closing).resolves.toBeUndefined();
  }, 10_000);
});

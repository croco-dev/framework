import { createElement } from "react";
import { InMemoryCacheStore } from "@croco/cache-core";
import { createApp } from "@croco/transports-http";
import { describe, expect, it } from "vitest";
import { createIsrMiddleware } from "../libs/isr/isrMiddleware";
import { createNodeHandler } from "../libs/providers/node";
import { RenderServer } from "../libs/render/renderServer";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { CrocoFetchHandler } from "../libs/render/types";

describe("real HTTP shell-first stream", () => {
  it("flushes the shell over a socket before the deferred region resolves", async () => {
    const region = createLatch();
    const server = new RenderServer([
      {
        path: "/pdp",
        mode: "ssr",
        componentLoader: async () => ({
          default: () => createElement("main", null, "REAL-SHELL"),
        }),
        regions: [
          {
            id: "reviews",
            loader: async () => {
              await region.promise;
              return "REAL-REGION";
            },
          },
        ],
      },
    ]);

    const { origin, close } = await startHonoFixture((request, context) =>
      server.handle(request, context),
    );
    try {
      const response = await fetch(`${origin}/pdp`, {
        signal: AbortSignal.timeout(3000),
        headers: { "Server-Timing": "client-secret;dur=100" },
      });
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let prefix = "";
      for (;;) {
        const { done, value } = (await reader?.read()) ?? { done: true, value: undefined };
        if (done || !value) break;
        prefix += decoder.decode(value, { stream: true });
        if (prefix.includes("REAL-SHELL")) break;
      }
      const timingBeforeRegion = response.headers.get("server-timing");
      region.release();
      let rest = "";
      for (;;) {
        const { done, value } = (await reader?.read()) ?? { done: true, value: undefined };
        if (done || !value) break;
        rest += decoder.decode(value, { stream: true });
      }
      rest += decoder.decode(undefined, { stream: false });

      expect(response.status).toBe(200);
      expect(prefix).toContain("REAL-SHELL");
      expect(prefix).not.toContain("REAL-REGION");
      expect(prefix + rest).toContain("REAL-REGION");
      expect(response.headers.get("x-croco-delivery")).toBe("stream; host=node");
      expect(timingBeforeRegion).toMatch(/^shell;dur=\d+(?:\.\d+)?, regions$/u);
      expect(response.headers.get("server-timing")).toBe(timingBeforeRegion);
    } finally {
      region.release();
      await close();
    }
  });

  it("serves the correct Content-Length for a normal SSR page after a deadline response", async () => {
    const render = new RenderServer([
      {
        path: "/deadline",
        mode: "ssr",
        stream: { deadlineMs: 30 },
        componentLoader: () => new Promise(() => {}),
      },
      {
        path: "/page",
        mode: "ssr",
        head: () => ({ title: "A product page" }),
        componentLoader: async () => ({
          default: () => createElement("main", null, "제품 소개"),
        }),
      },
    ]);
    const { origin, close } = await startHonoFixture((request, context) =>
      render.handle(request, context),
    );
    try {
      const expired = await fetch(`${origin}/deadline`, { signal: AbortSignal.timeout(1500) });
      expect(expired.status).toBe(503);
      expect(expired.headers.has("server-timing")).toBe(false);
      const failureHtml = await expired.text();
      expect(failureHtml).toContain("Service Unavailable");

      const ok = await fetch(`${origin}/page`, { signal: AbortSignal.timeout(1500) });
      expect(ok.status).toBe(200);
      expect(ok.headers.get("content-length")).not.toBe(expired.headers.get("content-length"));
      const html = await ok.text();
      expect(html).toContain("<title>A product page</title>");
      expect(html).toContain("<main>제품 소개</main>");
      expect(html).toMatch(/<\/body>\s*<\/html>\s*$/u);
      expect(Number(ok.headers.get("content-length"))).toBe(Buffer.byteLength(html));
    } finally {
      await close();
    }
  });

  it("does not select a disconnected Node waiter to replace a cancelled ISR fill", async () => {
    const firstStarted = createLatch();
    const waiterJoined = createLatch();
    const waiterClosed = createLatch();
    const liveJoined = createLatch();
    const owner = new AbortController();
    const abandoned = new AbortController();
    const renderOwners: string[] = [];
    const isr = createIsrMiddleware({
      cache: new InMemoryCacheStore<Response>({ maxEntries: 10 }),
      ttlMs: 60_000,
      render: (request) => {
        const client = request.headers.get("x-fixture-client") ?? "unknown";
        const render = new RenderServer([
          {
            path: "/product",
            mode: "isr",
            componentLoader: async () => {
              renderOwners.push(client);
              if (client === "owner") {
                firstStarted.release();
                await new Promise<void>(() => {});
              }
              return { default: () => createElement("main", null, client) };
            },
          },
        ]);
        return render.handle(request, { platform: "node" });
      },
    });
    const { origin, server, close } = await startHonoFixture((request) => {
      const client = request.headers.get("x-fixture-client");
      const response = isr(request);
      if (client === "abandoned") waiterJoined.release();
      if (client === "live") liveJoined.release();
      return response;
    });
    server.on("request", (incoming: IncomingMessage, outgoing: ServerResponse) => {
      if (incoming.headers["x-fixture-client"] === "abandoned") {
        outgoing.once("close", waiterClosed.release);
      }
    });
    const send = (client: string, signal: AbortSignal) =>
      fetch(`${origin}/product`, { signal, headers: { "x-fixture-client": client } });
    try {
      const ownerResult = send("owner", owner.signal).catch((error: Error) => error.name);
      await firstStarted.promise;
      const abandonedResult = send("abandoned", abandoned.signal).catch(
        (error: Error) => error.name,
      );
      await waiterJoined.promise;
      const live = send("live", AbortSignal.timeout(3000));
      await liveJoined.promise;
      abandoned.abort();
      expect(await abandonedResult).toBe("AbortError");
      await waiterClosed.promise;
      owner.abort();
      expect(await ownerResult).toBe("AbortError");

      const response = await live;
      expect(response.status).toBe(200);
      await expect(response.text()).resolves.toContain("<main>live</main>");
      expect(renderOwners).toEqual(["owner", "live"]);
    } finally {
      abandoned.abort();
      owner.abort();
      await close();
    }
  });
});

function createLatch() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

async function startHonoFixture(handler: CrocoFetchHandler) {
  const adapter = createNodeHandler(handler);
  const app = createApp({ controllers: [], securityValidation: "off" });
  app.getHono().get("*", (context) => adapter.fetch(context.req.raw));
  // The Node adapter installs Hono's optimized request/response globals.
  const globals = { Request: globalThis.Request, Response: globalThis.Response };
  let server: Awaited<ReturnType<typeof app.listen>> | undefined;
  const close = async () => {
    const listeningServer = server;
    if (listeningServer) {
      await new Promise<void>((resolve) => {
        listeningServer.close(() => resolve());
        if ("closeAllConnections" in listeningServer) listeningServer.closeAllConnections();
      });
    }
    Object.assign(globalThis, globals);
  };
  try {
    server = await app.listen(0);
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected a TCP address");
    return { origin: `http://127.0.0.1:${address.port}`, server, close };
  } catch (error) {
    await close();
    throw error;
  }
}

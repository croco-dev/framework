import { once } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { request as sendHttpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { serve, type ServerType } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { afterEach, describe, expect, it } from "vitest";

type StaticResponse = {
  readonly status: number;
  readonly authorized: string | undefined;
  readonly body: string;
};

describe("Hono Node serveStatic security boundary", () => {
  const servers: ServerType[] = [];
  const staticRoots: string[] = [];

  afterEach(async () => {
    await Promise.all([
      ...servers.splice(0).map(closeServer),
      ...staticRoots.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
    ]);
  });

  it("rejects route-mismatch paths before they can bypass mounted middleware", async () => {
    const staticRoot = await mkdtemp(join(tmpdir(), "croco-node-serve-static-"));
    staticRoots.push(staticRoot);
    await mkdir(join(staticRoot, "static", "admin"), { recursive: true });

    const secret = "protected-static-secret";
    await writeFile(join(staticRoot, "static", "admin", "secret.txt"), secret);
    if (process.platform !== "win32") {
      await writeFile(join(staticRoot, "static", "admin\\secret.txt"), secret);
    }

    const app = new Hono();
    app.use("/static/admin/*", async (context, next) => {
      context.header("x-authorized", "true");
      await next();
    });
    app.use("/static/*", serveStatic({ root: staticRoot }));

    const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 0 });
    servers.push(server);
    if (!server.listening) {
      await once(server, "listening");
    }

    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("Expected the Hono Node test server to listen on a TCP address.");
    }

    const authorized = await requestPath(address.port, "/static/admin/secret.txt");
    expect(authorized).toEqual({ status: 200, authorized: "true", body: secret });

    const unsafeResponses = await Promise.all(
      ["/static//admin/secret.txt", "/static/admin%5Csecret.txt"].map((path) =>
        requestPath(address.port, path),
      ),
    );
    expect(unsafeResponses).toEqual([
      { status: 404, authorized: undefined, body: "404 Not Found" },
      { status: 404, authorized: undefined, body: "404 Not Found" },
    ]);
  });
});

async function requestPath(port: number, path: string): Promise<StaticResponse> {
  return new Promise((resolve, reject) => {
    const request = sendHttpRequest({ hostname: "127.0.0.1", port, path }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => {
        resolve({
          status: response.statusCode ?? 0,
          authorized: response.headers["x-authorized"] as string | undefined,
          body: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });
    request.on("error", reject);
    request.end();
  });
}

async function closeServer(server: ServerType): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error?: Error & { code?: string }) => {
      if (error && error.code !== "ERR_SERVER_NOT_RUNNING") {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

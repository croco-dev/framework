import { createServer } from "node:http";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";

import type { ClientRequest, IncomingMessage, RequestOptions, Server } from "node:http";

// Exercise the redirect implementation actually installed behind Axios, not a test-only dependency.
const axiosRequire = createRequire(createRequire(import.meta.url).resolve("axios"));
const redirectHttp = (
  axiosRequire("follow-redirects") as {
    http: {
      get(
        options: RequestOptions & { sensitiveHeaders?: string[] },
        callback: (response: IncomingMessage) => void,
      ): ClientRequest;
    };
  }
).http;
const servers: Server[] = [];

async function listen(server: Server): Promise<number> {
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Expected a TCP server");
  return address.port;
}

function request(options: RequestOptions & { sensitiveHeaders?: string[] }): Promise<void> {
  return new Promise((resolve, reject) => {
    redirectHttp
      .get(options, (response) => {
        response.resume();
        response.on("end", resolve);
        response.on("error", reject);
      })
      .on("error", reject);
  });
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
});

describe("follow-redirects (resolved via Axios)", () => {
  it.each(["array", "custom-name"] as const)(
    "strips %s credentials on a cross-origin redirect",
    async (kind) => {
      let received: IncomingMessage["headers"] = {};
      const destination = await listen(
        createServer((request, response) => {
          received = request.headers;
          response.end("destination");
        }),
      );
      const origin = await listen(
        createServer((_request, response) => {
          response.writeHead(302, { location: `http://127.0.0.1:${destination}/` });
          response.end();
        }),
      );
      const headers =
        kind === "array"
          ? [
              "Authorization",
              "Bearer private-token",
              "Cookie",
              "session=private",
              "X-Public",
              "visible",
            ]
          : {
              "X-Cred^ential": "private-token",
              "X-Secret|Key": "private-key",
              "X-Public": "visible",
            };

      await request({
        hostname: "127.0.0.1",
        port: origin,
        path: "/",
        headers,
        sensitiveHeaders: ["X-Cred^ential", "X-Secret|Key"],
      });

      // Array-form headers must not leak values under numeric header names either.
      expect(JSON.stringify(received)).not.toContain("private-token");
      expect(JSON.stringify(received)).not.toContain("private-key");
      expect(JSON.stringify(received)).not.toContain("session=private");
      expect(received["x-public"]).toBe("visible");
      expect(received.authorization).toBeUndefined();
      expect(received.cookie).toBeUndefined();
      expect(received["x-cred^ential"]).toBeUndefined();
      expect(received["x-secret|key"]).toBeUndefined();
    },
  );

  it("preserves credentials on a same-origin redirect", async () => {
    let received: IncomingMessage["headers"] = {};
    const port = await listen(
      createServer((incoming, response) => {
        if (incoming.url === "/") {
          response.writeHead(302, { location: "/destination" });
        } else {
          received = incoming.headers;
        }
        response.end();
      }),
    );
    await request({
      hostname: "127.0.0.1",
      port,
      path: "/",
      headers: {
        Authorization: "Bearer retained-token",
        Cookie: "session=retained",
        "X-Cred^ential": "retained-secret",
      },
      sensitiveHeaders: ["X-Cred^ential"],
    });
    expect(received.authorization).toBe("Bearer retained-token");
    expect(received.cookie).toBe("session=retained");
    expect(received["x-cred^ential"]).toBe("retained-secret");
  });
});

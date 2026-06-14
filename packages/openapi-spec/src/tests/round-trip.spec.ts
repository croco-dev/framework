import "reflect-metadata";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { extractRouteIR } from "@croco/protocols-core";
import { Controller, Get, ResponseSchema } from "@croco/protocols-rest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { emitOpenAPI } from "../libs/emitOpenAPI";

type User = {
  readonly id: number;
  readonly name: string;
};

const userSchema = z.object({
  id: z.number(),
  name: z.string(),
});

type GeneratedUsersClient = {
  readonly userControllerListUsers: (options?: RequestInit) => Promise<{
    readonly data: User[];
    readonly status: number;
  }>;
};

describe("OpenAPI round trip", () => {
  it("should generate a fetch client that can call a matching backend", async () => {
    @Controller("/users")
    class UserController {
      @Get("/")
      @ResponseSchema(z.array(userSchema))
      listUsers(): User[] {
        return [{ id: 1, name: "Alice" }];
      }
    }

    const routes = extractRouteIR(UserController);
    const spec = emitOpenAPI([UserController]);
    const tempDirectory = mkdtempSync(join(tmpdir(), "openapi-roundtrip-"));
    const specPath = join(tempDirectory, "openapi.json");
    const clientPath = join(tempDirectory, "client.ts");
    const server = await listenOnRandomPort();
    const originalFetch = globalThis.fetch;

    try {
      expect(routes).toHaveLength(1);
      writeFileSync(specPath, JSON.stringify(spec, null, 2));
      runOrval(specPath, clientPath);
      expect(readFileSync(clientPath, "utf8")).toContain("data: UserControllerListUsers200");

      globalThis.fetch = createRelativeFetch(server.url, originalFetch);
      const client = (await import(pathToFileURL(clientPath).href)) as GeneratedUsersClient;
      const response = await client.userControllerListUsers();

      expect(response.status).toBe(200);
      expect(response.data).toEqual([{ id: 1, name: "Alice" }]);
    } finally {
      globalThis.fetch = originalFetch;
      await closeServer(server.instance);
      rmSync(tempDirectory, { force: true, recursive: true });
    }
  });
});

function runOrval(specPath: string, clientPath: string): void {
  execFileSync(
    "pnpm",
    ["exec", "orval", "--input", specPath, "--output", clientPath, "--client", "fetch"],
    {
      cwd: join(__dirname, "../.."),
      stdio: "pipe",
    },
  );
}

function createRelativeFetch(baseUrl: string, delegate: typeof fetch): typeof fetch {
  return (input, init) => {
    if (typeof input === "string" && input.startsWith("/")) {
      return delegate(`${baseUrl}${input}`, init);
    }

    return delegate(input, init);
  };
}

function listenOnRandomPort(): Promise<{ readonly instance: Server; readonly url: string }> {
  const server = createServer((request, response) => {
    if (request.method === "GET" && request.url === "/users") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify([{ id: 1, name: "Alice" }]));
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ message: "Not Found" }));
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Unable to allocate a test server port"));
        return;
      }

      resolve({
        instance: server,
        url: `http://127.0.0.1:${address.port}`,
      });
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

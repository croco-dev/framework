import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import type { RouteIR } from "@croco/protocols-core";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { generateClientFiles } from "../libs/generate";

const outDir = path.join(os.tmpdir(), "opencode-roundtrip-rpc-codegen");
const moduleDir = path.join(os.tmpdir(), "opencode-roundtrip-rpc-codegen-modules");
const EMPTY_INPUT_SCHEMAS = { body: null, path: null, query: null, headers: null };
const BODY_INPUT_SCHEMAS = {
  body: {} as RouteIR["inputSchemas"]["body"],
  path: null,
  query: null,
  headers: null,
};
const PATH_QUERY_INPUT_SCHEMAS = {
  body: null,
  path: z.object({ id: z.string() }) as any,
  query: z.object({
    includePosts: z.boolean(),
    page: z.number(),
    search: z.string().optional(),
    tags: z.array(z.string()),
    deletedAt: z.string().nullable(),
  }) as any,
  headers: null,
};
const HEADER_INPUT_SCHEMAS = {
  body: null,
  path: null,
  query: null,
  headers: z.object({ authorization: z.string(), "x-request-id": z.string().optional() }) as any,
};

describe("rpc-codegen round trip", () => {
  beforeEach(() => {
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.rmSync(moduleDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
    fs.mkdirSync(moduleDir, { recursive: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.rmSync(moduleDir, { recursive: true, force: true });
  });

  it("generates domain clients that can call a mocked server", async () => {
    const routeIRs: RouteIR[] = [
      {
        controllerName: "UserController",
        methodName: "listUsers",
        httpMethod: "GET",
        path: "/users",
        params: [],
        inputSchema: null,
        inputSchemas: EMPTY_INPUT_SCHEMAS,
        outputSchema: null,
        domain: "user",
      },
      {
        controllerName: "UserController",
        methodName: "createUser",
        httpMethod: "POST",
        path: "/users",
        params: [{ kind: "body", name: "", schema: null }],
        inputSchema: null,
        inputSchemas: BODY_INPUT_SCHEMAS,
        outputSchema: null,
        domain: "user",
      },
      {
        controllerName: "OrderController",
        methodName: "listOrders",
        httpMethod: "GET",
        path: "/orders",
        params: [],
        inputSchema: null,
        inputSchemas: EMPTY_INPUT_SCHEMAS,
        outputSchema: null,
        domain: "order",
      },
    ];

    const files = generateClientFiles(routeIRs, outDir);

    expect(files).toEqual([path.join(outDir, "order.ts"), path.join(outDir, "user.ts")]);
    expect(fs.readdirSync(outDir).sort()).toEqual(["order.ts", "user.ts"]);

    const userContent = fs.readFileSync(path.join(outDir, "user.ts"), "utf-8");
    const orderContent = fs.readFileSync(path.join(outDir, "order.ts"), "utf-8");

    expect(userContent).toContain("export const userClient = {");
    expect(userContent).toContain(
      "listUsers: (): Promise<unknown | undefined> => fetch('/users', { method: 'GET' })",
    );
    expect(userContent).toContain(
      "createUser: (input: CreateUserInput): Promise<unknown | undefined> =>",
    );
    expect(userContent).toContain(
      "fetch('/users', { method: 'POST', body: JSON.stringify(input), headers: { 'Content-Type': 'application/json' } })",
    );
    expect(orderContent).toContain("export const orderClient = {");
    expect(orderContent).toContain(
      "listOrders: (): Promise<unknown | undefined> => fetch('/orders', { method: 'GET' })",
    );

    const userModule = await importGeneratedClient("user-path-query.ts", userContent);
    const fetchMock = vi.fn(async (url: string, options: RequestInit) => {
      if (url === "/users" && options.method === "GET") {
        return jsonResponse([{ id: "1", name: "Alice" }]);
      }

      if (url === "/users" && options.method === "POST") {
        return jsonResponse({ id: "2", name: JSON.parse(options.body as string).name });
      }

      return jsonResponse({ message: "not found" }, 404);
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(userModule.userClient.listUsers()).resolves.toEqual([{ id: "1", name: "Alice" }]);
    await expect(userModule.userClient.createUser({ name: "Bob" })).resolves.toEqual({
      id: "2",
      name: "Bob",
    });
    expect(fetchMock).toHaveBeenCalledWith("/users", { method: "GET" });
    expect(fetchMock).toHaveBeenCalledWith("/users", {
      method: "POST",
      body: JSON.stringify({ name: "Bob" }),
      headers: { "Content-Type": "application/json" },
    });
  });

  it("resolves no-output clients for 204 and empty success responses", async () => {
    const routeIRs: RouteIR[] = [
      {
        controllerName: "HealthController",
        methodName: "health",
        httpMethod: "GET",
        path: "/health",
        params: [],
        inputSchema: null,
        inputSchemas: EMPTY_INPUT_SCHEMAS,
        outputSchema: null,
        domain: "health",
      },
      {
        controllerName: "HealthController",
        methodName: "clear",
        httpMethod: "POST",
        path: "/health/cache",
        params: [],
        inputSchema: null,
        inputSchemas: EMPTY_INPUT_SCHEMAS,
        outputSchema: null,
        domain: "health",
      },
      {
        controllerName: "HealthController",
        methodName: "fail",
        httpMethod: "GET",
        path: "/health/fail",
        params: [],
        inputSchema: null,
        inputSchemas: EMPTY_INPUT_SCHEMAS,
        outputSchema: null,
        domain: "health",
      },
    ];

    const files = generateClientFiles(routeIRs, outDir);
    const healthContent = fs.readFileSync(files[0], "utf-8");
    const healthModule = await importGeneratedClient("health.ts", healthContent);
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/health") {
        return new Response(null, { status: 204 });
      }

      if (url === "/health/fail") {
        return new Response("", { status: 500 });
      }

      return new Response("", { status: 200 });
    });

    vi.stubGlobal("fetch", fetchMock);

    expect(healthContent).toContain(
      "function readOptionalJsonResponse(response: Response): Promise<unknown | undefined>",
    );
    expect(healthContent).toContain("async function rejectErrorResponse(response: Response): Promise<never>");
    await expect(healthModule.healthClient.health()).resolves.toBeUndefined();
    await expect(healthModule.healthClient.clear()).resolves.toBeUndefined();
    await expect(healthModule.healthClient.fail()).rejects.toThrow("RPC request failed with HTTP 500");
    expect(fetchMock).toHaveBeenCalledWith("/health", { method: "GET" });
    expect(fetchMock).toHaveBeenCalledWith("/health/cache", { method: "POST" });
    expect(fetchMock).toHaveBeenCalledWith("/health/fail", { method: "GET" });
  });

  it("generates path and query inputs that can call a mocked server", async () => {
    const routeIRs: RouteIR[] = [
      {
        controllerName: "UserController",
        methodName: "getUser",
        httpMethod: "GET",
        path: "/users/:id",
        params: [
          { kind: "path", name: "id", schema: null },
          { kind: "query", name: "includePosts", schema: null },
        ],
        inputSchema: null,
        inputSchemas: PATH_QUERY_INPUT_SCHEMAS,
        outputSchema: null,
        domain: "user",
      },
    ];

    const files = generateClientFiles(routeIRs, outDir);
    const userContent = fs.readFileSync(files[0], "utf-8");
    const userModule = await importGeneratedClient("user-output.ts", userContent);
    const fetchMock = vi.fn(async () => jsonResponse({ id: "1", includePosts: true }));

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      userModule.userClient.getUser({
        path: { id: "1" },
        query: {
          includePosts: true,
          page: 2,
          search: undefined,
          tags: ["new", "vip"],
          deletedAt: null,
        },
      }),
    ).resolves.toEqual({ id: "1", includePosts: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "/users/1?includePosts=true&page=2&tags=new&tags=vip&deletedAt=null",
      { method: "GET" },
    );
  });

  it("generates header inputs that can call a mocked server", async () => {
    const routeIRs: RouteIR[] = [
      {
        controllerName: "UserController",
        methodName: "getCurrentUser",
        httpMethod: "GET",
        path: "/me",
        params: [
          { kind: "header", name: "authorization", schema: null },
          { kind: "header", name: "x-request-id", schema: null },
        ],
        inputSchema: null,
        inputSchemas: HEADER_INPUT_SCHEMAS,
        outputSchema: null,
        domain: "user",
      },
    ];

    const files = generateClientFiles(routeIRs, outDir);
    const userContent = fs.readFileSync(files[0], "utf-8");
    const userModule = await importGeneratedClient("user-headers.ts", userContent);
    const fetchMock = vi.fn(async () => jsonResponse({ id: "1" }));

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      userModule.userClient.getCurrentUser({
        headers: { authorization: "Bearer token", "x-request-id": undefined },
      }),
    ).resolves.toEqual({ id: "1" });
    expect(fetchMock).toHaveBeenCalledWith("/me", {
      method: "GET",
      headers: { authorization: "Bearer token" },
    });
  });

  it("generates outputSchema types that compile", async () => {
    const routeIRs: RouteIR[] = [
      {
        controllerName: "UserController",
        methodName: "getUser",
        httpMethod: "GET",
        path: "/users/:id",
        params: [{ kind: "path", name: "id", schema: null }],
        inputSchema: null,
        inputSchemas: {
          body: null,
          path: z.object({ id: z.string() }) as any,
          query: null,
          headers: null,
        },
        outputSchema: z.object({ id: z.string(), name: z.string() }) as any,
        domain: "user",
      },
    ];

    const files = generateClientFiles(routeIRs, outDir);
    const userContent = fs.readFileSync(files[0], "utf-8");
    const userModule = await importGeneratedClient("user.ts", userContent);
    const fetchMock = vi.fn(async () => jsonResponse({ id: "1", name: "Alice" }));

    vi.stubGlobal("fetch", fetchMock);

    await expect(userModule.userClient.getUser({ path: { id: "1" } })).resolves.toEqual({
      id: "1",
      name: "Alice",
    });
  });

  it("rejects non-2xx Problem responses with preserved details", async () => {
    const routeIRs: RouteIR[] = [
      {
        controllerName: "UserController",
        methodName: "getUser",
        httpMethod: "GET",
        path: "/users/:id",
        params: [{ kind: "path", name: "id", schema: null }],
        inputSchema: null,
        inputSchemas: { body: null, path: z.object({ id: z.string() }) as any, query: null },
        outputSchema: z.object({ id: z.string(), name: z.string() }) as any,
        domain: "user",
      },
    ];

    const files = generateClientFiles(routeIRs, outDir);
    const userContent = fs.readFileSync(files[0], "utf-8");
    const userModule = await importGeneratedClient("user-problem.ts", userContent);
    const problem = {
      type: "https://errors.example.com/not-found",
      title: "Not Found",
      status: 404,
      code: "USER_NOT_FOUND",
      detail: "User missing",
      traceId: "trace-1",
    };
    const fetchMock = vi.fn(async () => jsonResponse(problem, 404));

    vi.stubGlobal("fetch", fetchMock);

    const error = await getRejectedError(
      userModule.userClient.getUser({ path: { id: "missing" } }),
    );
    const problemError = error as {
      readonly name: string;
      readonly problem: Record<string, unknown>;
      readonly response: Response;
    };

    expect(problemError.name).toBe("RpcClientProblemError");
    expect(problemError.problem).toEqual(problem);
    expect(problemError.response.status).toBe(404);
  });

  it("rejects non-JSON error responses without parsing them as success", async () => {
    const routeIRs: RouteIR[] = [
      {
        controllerName: "UserController",
        methodName: "getUser",
        httpMethod: "GET",
        path: "/users/:id",
        params: [{ kind: "path", name: "id", schema: null }],
        inputSchema: null,
        inputSchemas: { body: null, path: z.object({ id: z.string() }) as any, query: null },
        outputSchema: z.object({ id: z.string(), name: z.string() }) as any,
        domain: "user",
      },
    ];

    const files = generateClientFiles(routeIRs, outDir);
    const userContent = fs.readFileSync(files[0], "utf-8");
    const userModule = await importGeneratedClient("user-non-json.ts", userContent);
    const fetchMock = vi.fn(async () => textResponse("upstream unavailable", 503));

    vi.stubGlobal("fetch", fetchMock);

    const error = await getRejectedError(userModule.userClient.getUser({ path: { id: "1" } }));
    const responseError = error as {
      readonly name: string;
      readonly message: string;
      readonly response: Response;
    };

    expect(responseError.name).toBe("RpcClientResponseError");
    expect(responseError.message).toBe("RPC request failed with HTTP 503");
    expect(responseError.response.status).toBe(503);
  });
});

async function importGeneratedClient(fileName: string, source: string) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
    reportDiagnostics: true,
  });

  expect(output.diagnostics).toEqual([]);

  const modulePath = path.join(moduleDir, fileName.replace(/\.ts$/, ".mjs"));
  fs.writeFileSync(modulePath, output.outputText);

  return import(pathToFileURL(modulePath).href) as Promise<{
    readonly userClient: {
      readonly listUsers: () => Promise<unknown>;
      readonly createUser: (input: { readonly name: string }) => Promise<unknown>;
      readonly getUser: (input: {
        readonly path: { readonly id: string };
        readonly query?: {
          readonly includePosts: boolean;
          readonly page: number;
          readonly search: string | undefined;
          readonly tags: string[];
          readonly deletedAt: string | null;
        };
      }) => Promise<unknown>;
      readonly getCurrentUser: (input: {
        readonly headers: {
          readonly authorization: string;
          readonly "x-request-id": string | undefined;
        };
      }) => Promise<unknown>;
    };
    readonly healthClient: {
      readonly health: () => Promise<unknown>;
      readonly clear: () => Promise<unknown>;
      readonly fail: () => Promise<unknown>;
    };
  }>;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function textResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain" },
  });
}

async function getRejectedError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }

  throw new Error("Expected promise to reject.");
}

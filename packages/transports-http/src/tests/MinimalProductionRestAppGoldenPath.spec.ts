import "reflect-metadata";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Container } from "@croco/framework-context";
import { Problem, ProblemCategory } from "@croco/problems-core";
import { buildContractGraph } from "@croco/protocols-core";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emitOpenAPIFromContractGraph } from "../../../openapi-spec/src/index";
import { generateClientFilesFromContractGraph } from "../../../rpc-codegen/src/index";
import {
  GOLDEN_PATH_REST_CONTROLLERS,
  GOLDEN_PATH_ORIGIN,
  GOLDEN_PATH_TENANT_HEADER,
  type CreateGoldenItemResponse,
  type GoldenItemResponse,
  createMinimalProductionLambdaContext,
  createMinimalProductionLambdaEvent,
  createMinimalProductionRestApp,
} from "./fixtures/MinimalProductionRestAppFixture";
import type { CrocoApp, LambdaResponse } from "../index";

type ProblemDetailsBody = {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly code: string;
  readonly detail?: string;
  readonly instance?: string;
  readonly issues?: readonly {
    readonly path: string;
    readonly message: string;
  }[];
  readonly itemId?: string;
};

class GoldenPathGeneratedClientProblem extends Problem {
  readonly code = "golden-path/generated-client";
  readonly category = ProblemCategory.InternalServerError;

  constructor(files: readonly string[]) {
    super(
      "golden-path/generated-client",
      ProblemCategory.InternalServerError,
      `Expected generated goldenPathRest.ts, got: ${files.join(", ")}`,
    );
  }
}

type GoldenPathRestGeneratedModule = {
  readonly goldenPathRestClient: {
    readonly getItem: (
      input: {
        readonly path: { readonly id: string };
        readonly query?: Record<string, unknown>;
        readonly headers: { readonly [GOLDEN_PATH_TENANT_HEADER]: string };
      },
      options?: unknown,
    ) => Promise<unknown>;
    readonly getItemResult: (
      input: {
        readonly path: { readonly id: string };
        readonly query?: Record<string, unknown>;
        readonly headers: { readonly [GOLDEN_PATH_TENANT_HEADER]: string };
      },
      options?: unknown,
    ) => Promise<
      | {
          readonly ok: true;
          readonly data: unknown;
          readonly response: Response;
        }
      | {
          readonly ok: false;
          readonly kind: "problem";
          readonly code: string;
          readonly category: string;
          readonly status: number;
          readonly problem: unknown;
          readonly declaration: unknown;
          readonly response: Response;
        }
      | {
          readonly ok: false;
          readonly kind: "external";
          readonly error: { readonly name: string };
          readonly response: Response;
          readonly body?: unknown;
        }
    >;
    readonly createItem: (
      input: {
        readonly body: { readonly name: string; readonly quantity: number };
        readonly headers: { readonly [GOLDEN_PATH_TENANT_HEADER]: string };
      },
      options?: unknown,
    ) => Promise<unknown>;
  };
};

const PACKAGE_ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const GENERATED_RPC_TEMP_ROOT = path.join(
  PACKAGE_ROOT_DIR,
  "node_modules",
  ".croco-http-golden-path",
);

describe("minimal production REST app golden path", () => {
  let app: CrocoApp;
  let rpcOutDir: string;
  let rpcModuleDir: string;

  beforeEach(() => {
    Container.reset();
    app = createMinimalProductionRestApp();
    rpcOutDir = createIgnoredTempDir("rpc-out-");
    rpcModuleDir = createIgnoredTempDir("rpc-modules-");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fs.rmSync(GENERATED_RPC_TEMP_ROOT, { recursive: true, force: true });
  });

  it("runs GET, POST, validation, declared Problem, and unknown route through Node fetch", async () => {
    const getResponse = await app.fetch(
      new Request("http://localhost/golden/items/seed-1?includeAudit=true", {
        headers: {
          [GOLDEN_PATH_TENANT_HEADER]: "tenant-node",
          origin: GOLDEN_PATH_ORIGIN,
        },
      }),
    );

    expect(getResponse.status).toBe(200);
    expect(getResponse.headers.get("x-content-type-options")).toBe("nosniff");
    expect(getResponse.headers.get("access-control-allow-origin")).toBe(GOLDEN_PATH_ORIGIN);
    expect(getResponse.headers.get("x-golden-path-middleware")).toBe("observed");
    await expect(readJson<GoldenItemResponse>(getResponse)).resolves.toEqual({
      id: "seed-1",
      name: "Seed Inventory Item",
      tenantId: "tenant-node",
      status: "available",
      includeAudit: true,
      servedBy: "minimal-production-rest-app",
    });

    const postResponse = await app.fetch(
      new Request("http://localhost/golden/items", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [GOLDEN_PATH_TENANT_HEADER]: "tenant-node",
        },
        body: JSON.stringify({ name: "Sample Widget", quantity: 3 }),
      }),
    );

    expect(postResponse.status).toBe(200);
    await expect(readJson<CreateGoldenItemResponse>(postResponse)).resolves.toEqual({
      id: "created-sample-widget-3",
      name: "Sample Widget",
      quantity: 3,
      tenantId: "tenant-node",
      status: "created",
    });

    const validationResponse = await app.fetch(
      new Request("http://localhost/golden/items", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [GOLDEN_PATH_TENANT_HEADER]: "tenant-node",
        },
        body: JSON.stringify({ name: "", quantity: 0 }),
      }),
    );

    expect(validationResponse.status).toBe(422);
    const validationProblem = await readJson<ProblemDetailsBody>(validationResponse);
    expect(validationProblem).toMatchObject({
      title: "Validation Error",
      status: 422,
      code: "protocols-rest/request-validation-failed",
      instance: "http://localhost/golden/items",
    });
    expect(validationProblem.issues?.map((issue) => issue.path)).toEqual(
      expect.arrayContaining(["body.name", "body.quantity"]),
    );

    const missingTenantResponse = await app.fetch(
      new Request("http://localhost/golden/items/seed-1"),
    );

    expect(missingTenantResponse.status).toBe(422);
    await expect(readJson<ProblemDetailsBody>(missingTenantResponse)).resolves.toMatchObject({
      status: 422,
      code: "protocols-rest/request-validation-failed",
    });

    const problemResponse = await app.fetch(
      new Request("http://localhost/golden/items/unavailable", {
        headers: { [GOLDEN_PATH_TENANT_HEADER]: "tenant-node" },
      }),
    );

    expect(problemResponse.status).toBe(409);
    await expect(readJson<ProblemDetailsBody>(problemResponse)).resolves.toMatchObject({
      type: "https://croco.dev/problems/golden-path/item-unavailable",
      title: "Conflict",
      status: 409,
      code: "golden-path/item-unavailable",
      instance: "http://localhost/golden/items/unavailable",
    });

    const unknownRouteResponse = await app.fetch(
      new Request("http://localhost/golden/missing", {
        headers: { [GOLDEN_PATH_TENANT_HEADER]: "tenant-node" },
      }),
    );

    expect(unknownRouteResponse.status).toBe(404);
  });

  it("runs the same runtime matrix through the Lambda handler", async () => {
    const handler = app.lambdaHandler();
    const context = createMinimalProductionLambdaContext();

    const getResponse = await handler(
      createMinimalProductionLambdaEvent("GET", "/golden/items/seed-1", {
        rawQueryString: "includeAudit=true",
        headers: {
          [GOLDEN_PATH_TENANT_HEADER]: "tenant-lambda",
          origin: GOLDEN_PATH_ORIGIN,
        },
      }),
      context,
    );

    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.headers?.["x-content-type-options"]).toBe("nosniff");
    expect(getResponse.headers?.["x-golden-path-middleware"]).toBe("observed");
    expect(readLambdaJson<GoldenItemResponse>(getResponse)).toEqual({
      id: "seed-1",
      name: "Seed Inventory Item",
      tenantId: "tenant-lambda",
      status: "available",
      includeAudit: true,
      servedBy: "minimal-production-rest-app",
    });

    const postResponse = await handler(
      createMinimalProductionLambdaEvent("POST", "/golden/items", {
        headers: {
          "content-type": "application/json",
          [GOLDEN_PATH_TENANT_HEADER]: "tenant-lambda",
        },
        body: { name: "Lambda Widget", quantity: 4 },
      }),
      context,
    );

    expect(postResponse.statusCode).toBe(200);
    expect(readLambdaJson<CreateGoldenItemResponse>(postResponse)).toEqual({
      id: "created-lambda-widget-4",
      name: "Lambda Widget",
      quantity: 4,
      tenantId: "tenant-lambda",
      status: "created",
    });

    const validationResponse = await handler(
      createMinimalProductionLambdaEvent("POST", "/golden/items", {
        headers: {
          "content-type": "application/json",
          [GOLDEN_PATH_TENANT_HEADER]: "tenant-lambda",
        },
        body: { name: "", quantity: 0 },
      }),
      context,
    );

    expect(validationResponse.statusCode).toBe(422);
    expect(readLambdaJson<ProblemDetailsBody>(validationResponse)).toMatchObject({
      status: 422,
      code: "protocols-rest/request-validation-failed",
    });

    const problemResponse = await handler(
      createMinimalProductionLambdaEvent("GET", "/golden/items/unavailable", {
        headers: { [GOLDEN_PATH_TENANT_HEADER]: "tenant-lambda" },
      }),
      context,
    );

    expect(problemResponse.statusCode).toBe(409);
    expect(readLambdaJson<ProblemDetailsBody>(problemResponse)).toMatchObject({
      status: 409,
      code: "golden-path/item-unavailable",
    });

    const unknownRouteResponse = await handler(
      createMinimalProductionLambdaEvent("GET", "/golden/missing", {
        headers: { [GOLDEN_PATH_TENANT_HEADER]: "tenant-lambda" },
      }),
      context,
    );

    expect(unknownRouteResponse.statusCode).toBe(404);
  });

  it("emits OpenAPI expectations from a diagnostic-free contract graph", () => {
    const graph = buildContractGraph(GOLDEN_PATH_REST_CONTROLLERS);

    expect(graph.diagnostics).toEqual([]);

    const spec = emitOpenAPIFromContractGraph(graph);
    const getOperation = spec.paths?.["/golden/items/{id}"]?.get;
    const postOperation = spec.paths?.["/golden/items"]?.post;

    expect(getOperation).toMatchObject({
      operationId: "goldenPathGetItem",
      summary: "GoldenPathRestController.getItem",
    });
    expect(getOperation?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          in: "path",
          name: "id",
          required: true,
          schema: expect.objectContaining({ type: "string", minLength: 1 }),
        }),
        expect.objectContaining({
          in: "query",
          name: "includeAudit",
          required: false,
        }),
        expect.objectContaining({
          in: "header",
          name: GOLDEN_PATH_TENANT_HEADER,
          required: true,
          schema: expect.objectContaining({ type: "string", minLength: 1 }),
        }),
      ]),
    );
    expect(getOperation?.responses?.[200]).toMatchObject({
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              id: { type: "string" },
              tenantId: { type: "string" },
              servedBy: { type: "string", enum: ["minimal-production-rest-app"] },
            },
            required: ["id", "name", "tenantId", "status", "includeAudit", "servedBy"],
          },
        },
      },
    });
    expect(getOperation?.responses?.[409]).toMatchObject({
      "x-croco-problems": [
        expect.objectContaining({
          code: "golden-path/item-unavailable",
          category: "Conflict",
          status: 409,
          type: "https://croco.dev/problems/golden-path/item-unavailable",
        }),
      ],
    });
    expect(getOperation?.responses?.[422]).toMatchObject({
      "x-croco-problems": [
        expect.objectContaining({
          code: "protocols-rest/request-validation-failed",
          category: "ValidationError",
          status: 422,
        }),
      ],
    });

    expect(postOperation).toMatchObject({
      operationId: "goldenPathCreateItem",
      summary: "GoldenPathRestController.createItem",
    });
    expect(postOperation?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          in: "header",
          name: GOLDEN_PATH_TENANT_HEADER,
          required: true,
          schema: expect.objectContaining({ type: "string", minLength: 1 }),
        }),
      ]),
    );
    expect(postOperation?.requestBody).toMatchObject({
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              name: { type: "string", minLength: 1 },
              quantity: {
                type: "integer",
                exclusiveMinimum: 0,
              },
            },
            required: ["name", "quantity"],
          },
        },
      },
    });
    expect(postOperation?.responses?.[200]).toMatchObject({
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              quantity: {
                type: "integer",
                exclusiveMinimum: 0,
              },
              tenantId: { type: "string" },
              status: { type: "string", enum: ["created"] },
            },
            required: ["id", "name", "quantity", "tenantId", "status"],
          },
        },
      },
    });
    expect(postOperation?.responses?.[422]).toMatchObject({
      "x-croco-problems": [
        expect.objectContaining({
          code: "protocols-rest/request-validation-failed",
          category: "ValidationError",
          status: 422,
        }),
      ],
    });
  });

  it("runs a generated RPC client through the real CrocoApp fetch runtime", async () => {
    const graph = buildContractGraph(GOLDEN_PATH_REST_CONTROLLERS);

    expect(graph.diagnostics).toEqual([]);

    const module = await importGeneratedGoldenPathClient(graph);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const requestUrl = rawUrl.startsWith("http://")
        ? rawUrl
        : `http://localhost${rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`}`;

      return app.fetch(new Request(requestUrl, init));
    });

    vi.stubGlobal("fetch", fetchMock);

    const directGetResponse = await app.fetch(
      new Request("http://localhost/golden/items/seed-1?includeAudit=true", {
        headers: { [GOLDEN_PATH_TENANT_HEADER]: "tenant-rpc" },
      }),
    );
    const rpcGetBody = await module.goldenPathRestClient.getItem({
      path: { id: "seed-1" },
      query: { includeAudit: "true" },
      headers: { [GOLDEN_PATH_TENANT_HEADER]: "tenant-rpc" },
    });

    expect(rpcGetBody).toEqual(await readJson<GoldenItemResponse>(directGetResponse));

    const directPostResponse = await app.fetch(
      new Request("http://localhost/golden/items", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [GOLDEN_PATH_TENANT_HEADER]: "tenant-rpc",
        },
        body: JSON.stringify({ name: "Rpc Widget", quantity: 5 }),
      }),
    );
    const rpcPostBody = await module.goldenPathRestClient.createItem({
      body: { name: "Rpc Widget", quantity: 5 },
      headers: { [GOLDEN_PATH_TENANT_HEADER]: "tenant-rpc" },
    });

    expect(rpcPostBody).toEqual(await readJson<CreateGoldenItemResponse>(directPostResponse));

    const directProblemResponse = await app.fetch(
      new Request("http://localhost/golden/items/unavailable", {
        headers: { [GOLDEN_PATH_TENANT_HEADER]: "tenant-rpc" },
      }),
    );
    const directProblem = await readJson<ProblemDetailsBody>(directProblemResponse);
    const rpcProblem = await module.goldenPathRestClient.getItemResult({
      path: { id: "unavailable" },
      query: {},
      headers: { [GOLDEN_PATH_TENANT_HEADER]: "tenant-rpc" },
    });

    expect(rpcProblem).toMatchObject({
      ok: false,
      kind: "problem",
      code: directProblem.code,
      category: "Conflict",
      status: directProblem.status,
      problem: expect.objectContaining({
        code: directProblem.code,
        status: directProblem.status,
      }),
    });
    expect(fetchMock).toHaveBeenCalledWith("/golden/items/seed-1?includeAudit=true", {
      method: "GET",
      headers: { [GOLDEN_PATH_TENANT_HEADER]: "tenant-rpc" },
    });
  });

  async function importGeneratedGoldenPathClient(
    graph: ReturnType<typeof buildContractGraph>,
  ): Promise<GoldenPathRestGeneratedModule> {
    const files = generateClientFilesFromContractGraph(graph, rpcOutDir);
    const domainFile = files.find((file) => path.basename(file) === "goldenPathRest.ts");

    if (!domainFile) {
      throw new GoldenPathGeneratedClientProblem(files);
    }

    const rpcSource = fs.readFileSync(path.join(rpcOutDir, "rpc.ts"), "utf-8");
    const domainSource = fs.readFileSync(domainFile, "utf-8");
    const rpcOutput = ts.transpileModule(rpcSource, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
      },
      reportDiagnostics: true,
    });
    const domainOutput = ts.transpileModule(
      domainSource.replace("from './rpc';", "from './rpc.mjs';"),
      {
        compilerOptions: {
          module: ts.ModuleKind.ES2022,
          target: ts.ScriptTarget.ES2022,
        },
        reportDiagnostics: true,
      },
    );

    expect(rpcOutput.diagnostics).toEqual([]);
    expect(domainOutput.diagnostics).toEqual([]);

    const modulePath = path.join(rpcModuleDir, "goldenPathRest.mjs");

    fs.writeFileSync(path.join(rpcModuleDir, "rpc.mjs"), rpcOutput.outputText);
    fs.writeFileSync(modulePath, domainOutput.outputText);

    return import(pathToFileURL(modulePath).href) as Promise<GoldenPathRestGeneratedModule>;
  }
});

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function readLambdaJson<T>(response: LambdaResponse): T {
  return JSON.parse(response.body ?? "null") as T;
}

function createIgnoredTempDir(prefix: string): string {
  fs.mkdirSync(GENERATED_RPC_TEMP_ROOT, { recursive: true });

  return fs.mkdtempSync(path.join(GENERATED_RPC_TEMP_ROOT, prefix));
}

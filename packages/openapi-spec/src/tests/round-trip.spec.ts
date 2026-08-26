import "reflect-metadata";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Problem, ProblemCategory } from "@croco/problems-core";
import { extractRouteIR } from "@croco/protocols-core";
import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  ProblemResponse,
  Query,
  ResponseSchema,
} from "@croco/protocols-rest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createApp } from "../../../transports-http/src/libs/CrocoApp";
import { emitOpenAPI } from "../libs/emitOpenAPI";

type User = {
  readonly id: number;
  readonly name: string;
};

const userSchema = z.object({
  id: z.number(),
  name: z.string(),
});

const roundTripRequestSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().positive(),
});

const roundTripResponseSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  requestSource: z.string(),
  mode: z.enum(["summary", "full"]),
  received: roundTripRequestSchema,
});

type RoundTripRequest = z.infer<typeof roundTripRequestSchema>;
type RoundTripResponse = z.infer<typeof roundTripResponseSchema>;

type GeneratedUsersClient = {
  readonly userControllerListUsers: (options?: RequestInit) => Promise<{
    readonly data: User[];
    readonly status: number;
  }>;
};

type OpenAPIDocument = ReturnType<typeof emitOpenAPI>;
type OpenAPIPathItem = NonNullable<OpenAPIDocument["paths"]>[string];
type OpenAPIOperation = NonNullable<OpenAPIPathItem>["post"];
type OpenAPIResponse = NonNullable<NonNullable<OpenAPIOperation>["responses"]>[string];
type OpenAPISchema = Record<string, unknown>;
type RuntimeRouteContext = {
  readonly contentType: string;
  readonly method: string;
  readonly operationId: string;
  readonly path: string;
  readonly status: number | string;
};
type RuntimeRequestOptions = {
  readonly body?: unknown;
  readonly headers?: Record<string, string>;
  readonly method: "post";
  readonly pathParams: Record<string, string>;
  readonly query?: Record<string, string>;
};

class RoundTripWidgetNotFoundProblem extends Problem {
  constructor(widgetId: string) {
    super(
      "testing/widget-not-found",
      ProblemCategory.NotFound,
      `Widget '${widgetId}' was not found.`,
    );
  }
}

describe("OpenAPI round trip", () => {
  it(
    "should generate a fetch client that can call a matching backend",
    { timeout: 30000 },
    async () => {
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
    },
  );

  it("should validate generated operations against real runtime responses", async () => {
    @Controller("/round-trip")
    class RoundTripController {
      @Post("/:tenantId/widgets/:widgetId/archive")
      @ProblemResponse({
        code: "testing/widget-not-found",
        category: ProblemCategory.NotFound,
        description: "Fixture widget is not available.",
      })
      archiveWidget(
        @Param("tenantId", z.string().min(1)) _tenantId: string,
        @Param("widgetId", z.string().min(1)) widgetId: string,
      ): void {
        if (widgetId === "missing") {
          throw new RoundTripWidgetNotFoundProblem(widgetId);
        }
      }

      @Post("/:tenantId/widgets/:widgetId")
      @ResponseSchema(roundTripResponseSchema)
      @ProblemResponse({
        code: "testing/widget-not-found",
        category: ProblemCategory.NotFound,
        description: "Fixture widget is not available.",
      })
      createWidget(
        @Param("tenantId", z.string().min(1)) tenantId: string,
        @Param("widgetId", z.string().min(1)) widgetId: string,
        @Query("mode", z.enum(["summary", "full"])) mode: "summary" | "full",
        @Header("x-request-source", z.string().min(1)) requestSource: string,
        @Body(roundTripRequestSchema) body: RoundTripRequest,
      ): RoundTripResponse {
        if (widgetId === "missing") {
          throw new RoundTripWidgetNotFoundProblem(widgetId);
        }

        return {
          id: widgetId,
          tenantId,
          requestSource,
          mode,
          received: body,
        };
      }
    }

    const spec = emitOpenAPI([RoundTripController]);
    const operationPath = "/round-trip/{tenantId}/widgets/{widgetId}";
    const operation = readOperation(spec, "post", operationPath);
    const app = createApp({
      controllers: [RoundTripController],
      diValidation: "off",
      securityValidation: "off",
    });

    expect(operation).toMatchObject({
      operationId: "RoundTripController_createWidget",
      parameters: expect.arrayContaining([
        expect.objectContaining({ in: "path", name: "tenantId", required: true }),
        expect.objectContaining({ in: "path", name: "widgetId", required: true }),
        expect.objectContaining({ in: "query", name: "mode" }),
        expect.objectContaining({ in: "header", name: "x-request-source" }),
      ]),
      requestBody: {
        content: {
          "application/json": {
            schema: expect.objectContaining({
              properties: expect.objectContaining({
                name: expect.objectContaining({ type: "string" }),
                quantity: expect.objectContaining({ type: "integer" }),
              }),
            }),
          },
        },
      },
    });

    const successResponse = await app.fetch(
      createRequestFromOperation(operation, operationPath, {
        body: { name: "Starter", quantity: 3 },
        headers: {
          "content-type": "application/json",
          "x-request-source": "contract-test",
        },
        method: "post",
        pathParams: {
          tenantId: "acme",
          widgetId: "widget-1",
        },
        query: {
          mode: "full",
        },
      }),
    );
    const successBody = await successResponse.json();

    expect(successResponse.status).toBe(200);
    expect(successBody).toEqual({
      id: "widget-1",
      tenantId: "acme",
      requestSource: "contract-test",
      mode: "full",
      received: {
        name: "Starter",
        quantity: 3,
      },
    });
    assertRuntimeResponseMatchesOpenAPI(
      spec,
      operation,
      operationPath,
      200,
      "application/json",
      successBody,
    );

    const problemResponse = await app.fetch(
      createRequestFromOperation(operation, operationPath, {
        body: { name: "Missing", quantity: 1 },
        headers: {
          "content-type": "application/json",
          "x-request-source": "contract-test",
        },
        method: "post",
        pathParams: {
          tenantId: "acme",
          widgetId: "missing",
        },
        query: {
          mode: "summary",
        },
      }),
    );
    const problemBody = await problemResponse.json();

    expect(problemResponse.status).toBe(404);
    expect(problemBody).toMatchObject({
      code: "testing/widget-not-found",
      detail: "Widget 'missing' was not found.",
      status: 404,
      title: "Not Found",
      type: "about:blank",
    });
    expect(operation.responses?.[404]).toMatchObject({
      content: {
        "application/problem+json": {
          schema: { $ref: "#/components/schemas/ProblemDetails" },
        },
      },
      "x-croco-problems": [
        {
          category: "NotFound",
          code: "testing/widget-not-found",
          description: "Fixture widget is not available.",
          status: 404,
        },
      ],
    });
    assertRuntimeResponseMatchesOpenAPI(
      spec,
      operation,
      operationPath,
      404,
      "application/problem+json",
      problemBody,
    );

    const archivePath = "/round-trip/{tenantId}/widgets/{widgetId}/archive";
    const archiveOperation = readOperation(spec, "post", archivePath);
    const archiveResponse = await app.fetch(
      createRequestFromOperation(archiveOperation, archivePath, {
        method: "post",
        pathParams: {
          tenantId: "acme",
          widgetId: "widget-1",
        },
      }),
    );

    expect(archiveResponse.status).toBe(204);
    expect(await archiveResponse.text()).toBe("");
    expect(archiveOperation.responses?.[200]).toBeUndefined();
    expect(archiveOperation.responses?.[204]).toEqual({ description: "No content" });
    expect(archiveOperation.responses?.[204]).not.toHaveProperty("content");
    expect(archiveOperation.responses?.[404]).toMatchObject({
      content: {
        "application/problem+json": {
          schema: { $ref: "#/components/schemas/ProblemDetails" },
        },
      },
      "x-croco-problems": [
        {
          category: "NotFound",
          code: "testing/widget-not-found",
          description: "Fixture widget is not available.",
          status: 404,
        },
      ],
    });
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

function readOperation(
  spec: OpenAPIDocument,
  method: "post",
  path: string,
): NonNullable<OpenAPIOperation> {
  const operation = spec.paths?.[path]?.[method];

  if (!operation) {
    throw new Error(`Expected generated OpenAPI operation ${method.toUpperCase()} ${path}.`);
  }

  return operation;
}

function createRequestFromOperation(
  operation: NonNullable<OpenAPIOperation>,
  path: string,
  options: RuntimeRequestOptions,
): Request {
  const operationId = operation.operationId ?? "<missing operationId>";
  const url = new URL(
    interpolateOpenAPIPath(path, options.pathParams, operationId),
    "http://localhost",
  );

  for (const [key, value] of Object.entries(options.query ?? {})) {
    url.searchParams.set(key, value);
  }

  return new Request(url, {
    body: typeof options.body === "string" ? options.body : JSON.stringify(options.body),
    headers: options.headers,
    method: options.method.toUpperCase(),
  });
}

function interpolateOpenAPIPath(
  path: string,
  pathParams: Record<string, string>,
  operationId: string,
): string {
  return path.replace(/\{([^}]+)\}/g, (_match, key: string) => {
    const value = pathParams[key];

    if (!value) {
      throw new Error(
        `[OpenAPI round trip] POST ${path} (${operationId}): missing sample path parameter ${key}`,
      );
    }

    return encodeURIComponent(value);
  });
}

function assertRuntimeResponseMatchesOpenAPI(
  spec: OpenAPIDocument,
  operation: NonNullable<OpenAPIOperation>,
  path: string,
  status: number,
  contentType: string,
  body: unknown,
): void {
  const context = {
    contentType,
    method: "POST",
    operationId: operation.operationId ?? "<missing operationId>",
    path,
    status,
  };
  const schema = readResponseSchema(spec, operation, context);

  assertValueMatchesSchema(spec, body, schema, "body", context);
}

function readResponseSchema(
  spec: OpenAPIDocument,
  operation: NonNullable<OpenAPIOperation>,
  context: RuntimeRouteContext,
): OpenAPISchema {
  const response = operation.responses?.[context.status] as OpenAPIResponse | undefined;

  if (!response) {
    throw routeDiagnostic(context, `response status ${context.status} is not documented`);
  }

  const content = response.content?.[context.contentType] as
    | { readonly schema?: OpenAPISchema }
    | undefined;
  if (!content?.schema) {
    throw routeDiagnostic(context, `response content type ${context.contentType} has no schema`);
  }

  return resolveSchemaRef(spec, content.schema);
}

function assertValueMatchesSchema(
  spec: OpenAPIDocument,
  value: unknown,
  schema: OpenAPISchema,
  path: string,
  context: RuntimeRouteContext,
): void {
  const resolvedSchema = resolveSchemaRef(spec, schema);
  const types = toSchemaTypes(resolvedSchema.type);

  if (types.length > 0 && !types.some((type) => valueMatchesSchemaType(value, type))) {
    throw routeDiagnostic(
      context,
      `${path} expected ${types.join(" or ")}, received ${describeValue(value)}`,
    );
  }

  if (Array.isArray(resolvedSchema.enum) && !resolvedSchema.enum.includes(value)) {
    throw routeDiagnostic(
      context,
      `${path} expected one of ${resolvedSchema.enum.map(String).join(", ")}, received ${String(
        value,
      )}`,
    );
  }

  if (types.includes("object")) {
    assertObjectMatchesSchema(spec, value, resolvedSchema, path, context);
    return;
  }

  if (types.includes("array")) {
    assertArrayMatchesSchema(spec, value, resolvedSchema, path, context);
  }
}

function assertObjectMatchesSchema(
  spec: OpenAPIDocument,
  value: unknown,
  schema: OpenAPISchema,
  path: string,
  context: RuntimeRouteContext,
): void {
  if (!isRecord(value)) {
    return;
  }

  const required = Array.isArray(schema.required) ? schema.required.filter(isString) : [];
  const properties = isRecord(schema.properties) ? schema.properties : {};

  for (const key of required) {
    if (!(key in value)) {
      throw routeDiagnostic(context, `${path}.${key} is required by the generated schema`);
    }
  }

  for (const [key, propertySchema] of Object.entries(properties)) {
    if (key in value && isRecord(propertySchema)) {
      assertValueMatchesSchema(spec, value[key], propertySchema, `${path}.${key}`, context);
    }
  }
}

function assertArrayMatchesSchema(
  spec: OpenAPIDocument,
  value: unknown,
  schema: OpenAPISchema,
  path: string,
  context: RuntimeRouteContext,
): void {
  if (!Array.isArray(value) || !isRecord(schema.items)) {
    return;
  }

  value.forEach((item, index) => {
    assertValueMatchesSchema(
      spec,
      item,
      schema.items as OpenAPISchema,
      `${path}[${index}]`,
      context,
    );
  });
}

function resolveSchemaRef(spec: OpenAPIDocument, schema: OpenAPISchema): OpenAPISchema {
  const ref = schema.$ref;

  if (typeof ref !== "string") {
    return schema;
  }

  const match = /^#\/components\/schemas\/([^/]+)$/.exec(ref);
  const resolved = match ? spec.components?.schemas?.[match[1]] : undefined;

  if (!isRecord(resolved)) {
    throw new Error(`Unable to resolve OpenAPI schema reference ${ref}.`);
  }

  return resolved;
}

function toSchemaTypes(type: unknown): string[] {
  if (typeof type === "string") {
    return [type];
  }

  if (Array.isArray(type)) {
    return type.filter(isString);
  }

  return [];
}

function valueMatchesSchemaType(value: unknown, type: string): boolean {
  switch (type) {
    case "array":
      return Array.isArray(value);
    case "boolean":
      return typeof value === "boolean";
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "null":
      return value === null;
    case "number":
      return typeof value === "number";
    case "object":
      return isRecord(value) && !Array.isArray(value);
    case "string":
      return typeof value === "string";
    default:
      return true;
  }
}

function routeDiagnostic(context: RuntimeRouteContext, detail: string): Error {
  return new Error(
    `[OpenAPI round trip] ${context.method} ${context.path} (${context.operationId}) status ${context.status} ${context.contentType}: ${detail}`,
  );
}

function describeValue(value: unknown): string {
  if (Array.isArray(value)) {
    return "array";
  }

  return value === null ? "null" : typeof value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

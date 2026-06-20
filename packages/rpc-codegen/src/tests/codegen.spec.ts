import * as fs from "node:fs";
import * as path from "node:path";
import { ProblemCategory } from "@croco/problems-core";
import {
  type ContractGraph,
  defineRouteSchema,
  type InferRouteSchemaRequest,
  type InferRouteSchemaResponse,
  type RouteIR,
} from "@croco/protocols-core";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { generateClientFiles, generateClientFilesFromContractGraph } from "../libs/generate";

const TEMP_DIR = path.join(__dirname, "codegen-temp");
const GENERATED_CLIENT_TYPECHECK_TIMEOUT_MS = 15_000;
const EMPTY_INPUT_SCHEMAS = {
  body: null,
  path: null,
  query: null,
  headers: null,
};
const BODY_INPUT_SCHEMAS: RouteIR["inputSchemas"] = {
  body: z.object({
    name: z.string(),
  }) as unknown as RouteIR["inputSchemas"]["body"],
  path: null,
  query: null,
  headers: null,
};
const PATH_INPUT_SCHEMAS = {
  body: null,
  path: z.object({ id: z.string() }) as any,
  query: null,
  headers: null,
};
const QUERY_INPUT_SCHEMAS = {
  body: null,
  path: null,
  query: z.object({ page: z.string() }) as any,
  headers: null,
};
const NON_STRING_QUERY_INPUT_SCHEMAS = {
  body: null,
  path: null,
  query: z.object({
    page: z.number(),
    active: z.boolean().optional(),
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
  headers: z.object({
    authorization: z.string(),
    "x-tenant-id": z.string().optional(),
  }) as any,
};
const COMBINED_INPUT_SCHEMAS = {
  body: z.object({ name: z.string() }) as any,
  path: z.object({ id: z.string() }) as any,
  query: z.object({ filter: z.string() }) as any,
  headers: null,
};
const BODY_HEADER_INPUT_SCHEMAS = {
  body: z.object({ name: z.string() }) as any,
  path: null,
  query: null,
  headers: z.object({ "x-request-id": z.string() }) as any,
};

describe("generateClientFiles", () => {
  beforeEach(() => {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  });

  it("should generate a GET fetch client", () => {
    const routes: RouteIR[] = [
      {
        controllerName: "UserController",
        methodName: "list",
        httpMethod: "GET",
        path: "/users",
        params: [],
        inputSchema: null,
        inputSchemas: EMPTY_INPUT_SCHEMAS,
        outputSchema: null,
        domain: null,
      },
    ];

    const files = generateClientFiles(routes, TEMP_DIR);

    expect(files).toEqual([
      path.join(TEMP_DIR, "user.ts"),
      path.join(TEMP_DIR, "rpc.ts"),
      path.join(TEMP_DIR, "index.ts"),
    ]);
    const content = fs.readFileSync(files[0], "utf-8");
    const rpcContent = fs.readFileSync(path.join(TEMP_DIR, "rpc.ts"), "utf-8");
    expect(content).toContain("export const userClient = {");
    expect(content).toContain("export const userContractRoutes = [");
    expect(content).toContain(
      "{ routeId: 'UserController.list', operationId: 'UserController_list', methodName: 'list', method: 'GET', path: '/users' }",
    );
    expect(content).toContain(
      "import { readOptionalJsonResponse, readOptionalJsonResult, type RpcClientResult, type RpcDeclaredProblem, type RpcProblemDetailsFor } from './rpc';",
    );
    expect(rpcContent).toContain("export class RpcClientProblemError extends Error");
    expect(rpcContent).toContain("export class RpcClientResponseError extends Error");
    expect(rpcContent).toContain("if (isRpcProblemDetails(body))");
    expect(content).not.toContain("async function handleJsonResponse<T = unknown>");
    expect(content).toContain(
      "list: (): Promise<unknown | undefined> => fetch('/users', { method: 'GET' }).then((response) => readOptionalJsonResponse(response)),",
    );
    expect(content).toContain(
      "listResult: (): Promise<ListResult> => fetch('/users', { method: 'GET' }).then((response) => readOptionalJsonResult<ListProblem>(response, listProblemDeclarations)),",
    );
  });

  it("should preserve contract graph route id, operation id, schemas, and Problem metadata", () => {
    const graph: ContractGraph = {
      version: "croco.contract-graph.v1",
      controllers: [
        {
          name: "UsersController",
          path: "/users",
          guards: [],
          roles: [],
          routeIds: ["UsersController.getUser"],
        },
      ],
      routes: [
        {
          routeId: "UsersController.getUser",
          operationId: "UsersController_getUser",
          controllerName: "UsersController",
          methodName: "getUser",
          httpMethod: "GET",
          path: "/users/:id",
          controllerPath: "/users",
          params: [{ kind: "path", name: "id", schema: null }],
          inputSchema: null,
          inputSchemas: PATH_INPUT_SCHEMAS,
          outputSchema: z.object({ id: z.string() }) as unknown as RouteIR["outputSchema"],
          domain: null,
          access: { guards: [], roles: [] },
          problemResponses: [
            {
              code: "USER_NOT_FOUND",
              category: ProblemCategory.NotFound,
              status: 404,
              description: "User id is missing, or the user was deleted.",
            },
          ],
        },
      ],
      diagnostics: [],
    };

    const files = generateClientFilesFromContractGraph(graph, TEMP_DIR);
    const content = fs.readFileSync(files[0], "utf-8");

    expect(content).toContain(
      "{ routeId: 'UsersController.getUser', operationId: 'UsersController_getUser', methodName: 'getUser', method: 'GET', path: '/users/:id' }",
    );
    expect(content).toContain("export type GetUserInput = { path: { id: string; }; };");
    expect(content).toContain("export type GetUserOutput = { id: string; };");
    expect(content).toContain(
      "export type GetUserProblem = RpcDeclaredProblem<'USER_NOT_FOUND', 'NotFound', 404>;",
    );
    expect(content).toContain(
      "{ code: 'USER_NOT_FOUND', category: 'NotFound', status: 404, description: 'User id is missing, or the user was deleted.' }",
    );
  });

  it("should reject ALL routes instead of emitting invalid fetch methods", () => {
    const routes: RouteIR[] = [
      {
        controllerName: "HooksController",
        methodName: "handleHook",
        httpMethod: "ALL",
        path: "/hooks/:id",
        params: [{ kind: "path", name: "id", schema: null }],
        inputSchema: null,
        inputSchemas: PATH_INPUT_SCHEMAS,
        outputSchema: null,
        domain: null,
      },
    ];

    expect(() => generateClientFiles(routes, TEMP_DIR)).toThrow(
      "Cannot generate RPC client for @All route HooksController.handleHook (/hooks/:id): @All is runtime-only and cannot be represented as a concrete generated client request. Use explicit HTTP method decorators for generated contracts.",
    );
    expect(fs.existsSync(path.join(TEMP_DIR, "hooks.ts"))).toBe(false);
  });

  it("should reject routes with more than one body parameter", () => {
    const bodySchema = z.object({
      name: z.string(),
    }) as unknown as RouteIR["inputSchema"];
    const auditSchema = z.object({
      auditId: z.string(),
    }) as unknown as RouteIR["inputSchema"];
    const routes: RouteIR[] = [
      {
        controllerName: "UsersController",
        methodName: "createUser",
        httpMethod: "POST",
        path: "/users",
        params: [
          { kind: "body", name: "", schema: bodySchema },
          { kind: "body", name: "", schema: auditSchema },
        ],
        inputSchema: bodySchema,
        inputSchemas: BODY_INPUT_SCHEMAS,
        outputSchema: null,
        domain: null,
      },
    ];

    expect(() => generateClientFiles(routes, TEMP_DIR)).toThrow(
      "Cannot generate RPC client for route UsersController.createUser (/users): generated contracts support one request body per route, but 2 @Body() parameters were found.",
    );
    expect(fs.existsSync(path.join(TEMP_DIR, "users.ts"))).toBe(false);
  });

  it("should reject path variables without matching path parameter metadata", () => {
    const routes: RouteIR[] = [
      {
        controllerName: "UsersController",
        methodName: "getUser",
        httpMethod: "GET",
        path: "/users/:id",
        params: [],
        inputSchema: null,
        inputSchemas: PATH_INPUT_SCHEMAS,
        outputSchema: null,
        domain: null,
      },
    ];

    expect(() => generateClientFiles(routes, TEMP_DIR)).toThrow(
      "Cannot generate RPC client for route UsersController.getUser (/users/:id): route path declares ':id' but no @Param(\"id\") metadata was found.",
    );
    expect(fs.existsSync(path.join(TEMP_DIR, "users.ts"))).toBe(false);
  });

  it("should reject path variables without matching generated path schemas", () => {
    const routes: RouteIR[] = [
      {
        controllerName: "UsersController",
        methodName: "getUser",
        httpMethod: "GET",
        path: "/users/:id",
        params: [{ kind: "path", name: "id", schema: null }],
        inputSchema: null,
        inputSchemas: EMPTY_INPUT_SCHEMAS,
        outputSchema: null,
        domain: null,
      },
    ];

    expect(() => generateClientFiles(routes, TEMP_DIR)).toThrow(
      "Cannot generate RPC client for route UsersController.getUser (/users/:id): route path declares ':id' but no generated path schema was found.",
    );
    expect(fs.existsSync(path.join(TEMP_DIR, "users.ts"))).toBe(false);
  });

  it("should reject generated path schemas without matching path variables", () => {
    const routes: RouteIR[] = [
      {
        controllerName: "UsersController",
        methodName: "listUsers",
        httpMethod: "GET",
        path: "/users",
        params: [],
        inputSchema: null,
        inputSchemas: PATH_INPUT_SCHEMAS,
        outputSchema: null,
        domain: null,
      },
    ];

    expect(() => generateClientFiles(routes, TEMP_DIR)).toThrow(
      "Cannot generate RPC client for route UsersController.listUsers (/users): generated path schema declares 'id' but route path '/users' does not contain ':id'.",
    );
    expect(fs.existsSync(path.join(TEMP_DIR, "users.ts"))).toBe(false);
  });

  it("should serialize POST body input", () => {
    const routes: RouteIR[] = [
      {
        controllerName: "UserController",
        methodName: "create",
        httpMethod: "POST",
        path: "/users",
        params: [{ kind: "body", name: "", schema: null }],
        inputSchema: null,
        inputSchemas: BODY_INPUT_SCHEMAS,
        outputSchema: null,
        domain: null,
      },
    ];

    const files = generateClientFiles(routes, TEMP_DIR);

    const content = fs.readFileSync(files[0], "utf-8");
    expect(content).toContain("create: (input: CreateInput): Promise<unknown | undefined> =>");
    expect(content).toContain(
      "fetch('/users', { method: 'POST', body: JSON.stringify(input), headers: { 'Content-Type': 'application/json' } })",
    );
  });

  it("should generate one file per controller domain", () => {
    const routes: RouteIR[] = [
      {
        controllerName: "UserController",
        methodName: "list",
        httpMethod: "GET",
        path: "/users",
        params: [],
        inputSchema: null,
        inputSchemas: EMPTY_INPUT_SCHEMAS,
        outputSchema: null,
        domain: null,
      },
      {
        controllerName: "OrderController",
        methodName: "list",
        httpMethod: "GET",
        path: "/orders",
        params: [],
        inputSchema: null,
        inputSchemas: EMPTY_INPUT_SCHEMAS,
        outputSchema: null,
        domain: null,
      },
    ];

    const files = generateClientFiles(routes, TEMP_DIR);

    expect(files).toEqual([
      path.join(TEMP_DIR, "order.ts"),
      path.join(TEMP_DIR, "user.ts"),
      path.join(TEMP_DIR, "rpc.ts"),
      path.join(TEMP_DIR, "index.ts"),
    ]);
    expect(fs.existsSync(path.join(TEMP_DIR, "user.ts"))).toBe(true);
    expect(fs.existsSync(path.join(TEMP_DIR, "order.ts"))).toBe(true);
    expect(fs.readFileSync(path.join(TEMP_DIR, "index.ts"), "utf-8")).toBe(
      "export * from './rpc';\nexport { orderClient } from './order';\nexport { userClient } from './user';\nexport * as orderRpc from './order';\nexport * as userRpc from './user';\n",
    );
  });

  it("should reject generated Result method names that collide with route methods", () => {
    const routes: RouteIR[] = [
      {
        controllerName: "UserController",
        methodName: "get",
        httpMethod: "GET",
        path: "/users/:id",
        params: [{ kind: "path", name: "id", schema: null }],
        inputSchema: null,
        inputSchemas: PATH_INPUT_SCHEMAS,
        outputSchema: null,
        domain: "user",
      },
      {
        controllerName: "UserController",
        methodName: "getResult",
        httpMethod: "GET",
        path: "/users/:id/result",
        params: [{ kind: "path", name: "id", schema: null }],
        inputSchema: null,
        inputSchemas: PATH_INPUT_SCHEMAS,
        outputSchema: null,
        domain: "user",
      },
    ];

    expect(() => generateClientFiles(routes, TEMP_DIR)).toThrow(
      "Cannot generate RPC client for domain 'user': member 'getResult' would be generated for UserController.getResult (/users/:id/result) as a route method, but UserController.get (/users/:id) already generates that member as a result method.",
    );
  });

  it(
    "should generate a package barrel that typechecks with duplicate route type names",
    () => {
      const routes: RouteIR[] = [
        {
          controllerName: "UserController",
          methodName: "get",
          httpMethod: "GET",
          path: "/users/:id",
          params: [{ kind: "path", name: "id", schema: null }],
          inputSchema: null,
          inputSchemas: PATH_INPUT_SCHEMAS,
          outputSchema: z.object({
            id: z.string(),
          }) as unknown as RouteIR["outputSchema"],
          domain: "user",
        },
        {
          controllerName: "OrderController",
          methodName: "get",
          httpMethod: "GET",
          path: "/orders/:id",
          params: [{ kind: "path", name: "id", schema: null }],
          inputSchema: null,
          inputSchemas: PATH_INPUT_SCHEMAS,
          outputSchema: z.object({
            id: z.string(),
          }) as unknown as RouteIR["outputSchema"],
          domain: "order",
        },
      ];

      generateClientFiles(routes, TEMP_DIR);

      assertGeneratedPackageTypechecks(["index.ts", "rpc.ts", "order.ts", "user.ts"]);
    },
    GENERATED_CLIENT_TYPECHECK_TIMEOUT_MS,
  );

  it("should generate React Query hooks when enabled", () => {
    const routes: RouteIR[] = [
      {
        controllerName: "UserController",
        methodName: "create",
        httpMethod: "POST",
        path: "/users",
        params: [{ kind: "body", name: "", schema: null }],
        inputSchema: null,
        inputSchemas: BODY_INPUT_SCHEMAS,
        outputSchema: null,
        domain: null,
      },
    ];

    const files = generateClientFiles(routes, TEMP_DIR, { reactQuery: true });

    const content = fs.readFileSync(files[0], "utf-8");
    expect(content).toContain("import { useMutation, useQuery } from '@tanstack/react-query';");
    expect(content).toContain("export function useCreate()");
    expect(content).toContain("return useMutation({ mutationFn: userClient.create });");
  });

  it("should generate query input types from inputSchemas", () => {
    const routes: RouteIR[] = [
      {
        controllerName: "UserController",
        methodName: "list",
        httpMethod: "GET",
        path: "/users",
        params: [{ kind: "query", name: "page", schema: null }],
        inputSchema: null,
        inputSchemas: QUERY_INPUT_SCHEMAS,
        outputSchema: null,
        domain: null,
      },
    ];

    const files = generateClientFiles(routes, TEMP_DIR);

    const content = fs.readFileSync(files[0], "utf-8");
    expect(content).toContain("export type ListInput = { query: { page: string; }; };");
  });

  it("should generate path input types from inputSchemas", () => {
    const routes: RouteIR[] = [
      {
        controllerName: "UserController",
        methodName: "get",
        httpMethod: "GET",
        path: "/users/:id",
        params: [{ kind: "path", name: "id", schema: null }],
        inputSchema: null,
        inputSchemas: PATH_INPUT_SCHEMAS,
        outputSchema: null,
        domain: null,
      },
    ];

    const files = generateClientFiles(routes, TEMP_DIR);

    const content = fs.readFileSync(files[0], "utf-8");
    expect(content).toContain("export type GetInput = { path: { id: string; }; };");
  });

  it("should generate header input types from inputSchemas", () => {
    const routes: RouteIR[] = [
      {
        controllerName: "UserController",
        methodName: "get",
        httpMethod: "GET",
        path: "/users",
        params: [
          { kind: "header", name: "authorization", schema: null },
          { kind: "header", name: "x-tenant-id", schema: null },
        ],
        inputSchema: null,
        inputSchemas: HEADER_INPUT_SCHEMAS,
        outputSchema: null,
        domain: null,
      },
    ];

    const files = generateClientFiles(routes, TEMP_DIR);

    const content = fs.readFileSync(files[0], "utf-8");
    expect(content).toContain(
      "export type GetInput = { headers: { authorization: string; 'x-tenant-id': string | undefined; }; };",
    );
  });

  it("should generate combined input types from inputSchemas", () => {
    const routes: RouteIR[] = [
      {
        controllerName: "UserController",
        methodName: "update",
        httpMethod: "PATCH",
        path: "/users/:id",
        params: [
          { kind: "path", name: "id", schema: null },
          { kind: "query", name: "filter", schema: null },
          { kind: "body", name: "", schema: null },
        ],
        inputSchema: null,
        inputSchemas: COMBINED_INPUT_SCHEMAS,
        outputSchema: null,
        domain: null,
      },
    ];

    const files = generateClientFiles(routes, TEMP_DIR);

    const content = fs.readFileSync(files[0], "utf-8");
    expect(content).toContain(
      "export type UpdateInput = { body: { name: string; }; path: { id: string; }; query: { filter: string; }; };",
    );
  });

  it("should generate client DTOs from one route schema object", () => {
    const createUserRoute = defineRouteSchema({
      request: {
        body: z.object({
          name: z.string(),
          email: z.string().email(),
        }),
      },
      response: z.object({
        id: z.string(),
        name: z.string(),
        email: z.string().email(),
      }),
    });
    type CreateUserBody = InferRouteSchemaRequest<typeof createUserRoute>["body"];
    type CreateUserResponse = InferRouteSchemaResponse<typeof createUserRoute>;
    const validBody: CreateUserBody = { name: "Ada", email: "ada@example.com" };
    const validResponse: CreateUserResponse = {
      id: "user-1",
      name: validBody.name,
      email: validBody.email,
    };
    // @ts-expect-error DTO field types are inferred from the schema object.
    const invalidBody: CreateUserBody = { name: "Ada", email: 42 };
    const bodySchema = createUserRoute.request.body as unknown as NonNullable<
      RouteIR["inputSchemas"]["body"]
    >;
    const responseSchema = createUserRoute.response as unknown as NonNullable<
      RouteIR["outputSchema"]
    >;
    const routes: RouteIR[] = [
      {
        controllerName: "UserController",
        methodName: "createUser",
        httpMethod: "POST",
        path: "/users",
        params: [{ kind: "body", name: "", schema: bodySchema }],
        inputSchema: bodySchema,
        inputSchemas: {
          body: bodySchema,
          path: null,
          query: null,
          headers: null,
        },
        outputSchema: responseSchema,
        domain: null,
      },
    ];

    const files = generateClientFiles(routes, TEMP_DIR);
    const content = fs.readFileSync(files[0], "utf-8");

    expect(validResponse.id).toBe("user-1");
    expect(invalidBody).toBeDefined();
    expect(content).toContain("export type CreateUserInput = { name: string; email: string; };");
    expect(content).toContain(
      "export type CreateUserOutput = { id: string; name: string; email: string; };",
    );
    expect(content).toContain("createUser: (input: CreateUserInput): Promise<CreateUserOutput>");
  });

  it("should generate output types from outputSchema", () => {
    const routes: RouteIR[] = [
      {
        controllerName: "UserController",
        methodName: "get",
        httpMethod: "GET",
        path: "/users/:id",
        params: [{ kind: "path", name: "id", schema: null }],
        inputSchema: null,
        inputSchemas: PATH_INPUT_SCHEMAS,
        outputSchema: z.object({ id: z.string(), name: z.string() }) as any,
        domain: null,
      },
    ];

    const files = generateClientFiles(routes, TEMP_DIR);

    const content = fs.readFileSync(files[0], "utf-8");
    expect(content).toContain("export type GetOutput = { id: string; name: string; };");
    expect(content).toContain("get: (input: GetInput): Promise<GetOutput> =>");
    expect(content).toContain("handleJsonResponse<GetOutput>(response)");
    expect(content).not.toContain("readOptionalJsonResponse(response: Response)");
  });

  it(
    "should generate typed Problem result unions for exhaustive client handling",
    () => {
      const routes: RouteIR[] = [
        {
          controllerName: "UserController",
          methodName: "get",
          httpMethod: "GET",
          path: "/users/:id",
          params: [{ kind: "path", name: "id", schema: null }],
          inputSchema: null,
          inputSchemas: PATH_INPUT_SCHEMAS,
          outputSchema: z.object({ id: z.string(), name: z.string() }) as any,
          problemResponses: [
            {
              code: "USER_NOT_FOUND",
              category: ProblemCategory.NotFound,
              status: 404,
              routeContractProblems: [
                {
                  code: "USER_NOT_FOUND",
                  category: ProblemCategory.NotFound,
                  status: 404,
                },
                {
                  code: "USER_FORBIDDEN",
                  category: ProblemCategory.Forbidden,
                  status: 403,
                },
              ],
            },
            {
              code: "USER_FORBIDDEN",
              category: ProblemCategory.Forbidden,
              status: 403,
            },
          ],
          domain: null,
        },
      ];

      const files = generateClientFiles(routes, TEMP_DIR);

      const content = fs.readFileSync(files[0], "utf-8");
      const source = `import { assertExhaustiveProblem } from './rpc';
${content}
async function exerciseGeneratedProblemResult() {
  const result = await userClient.getResult({ path: { id: 'missing' } });

  if (result.ok) {
    const userName: string = result.data.name;
    void userName;
    return;
  }

  if (result.kind === 'external') {
    const externalStatus: number = result.response.status;
    void externalStatus;
    return;
  }

  switch (result.code) {
    case 'USER_NOT_FOUND': {
      const code: 'USER_NOT_FOUND' = result.problem.code;
      const category: 'NotFound' = result.category;
      const status: 404 = result.status;
      void code;
      void category;
      void status;
      return;
    }
    case 'USER_FORBIDDEN': {
      const code: 'USER_FORBIDDEN' = result.problem.code;
      const category: 'Forbidden' = result.declaration.category;
      const status: 403 = result.problem.status;
      void code;
      void category;
      void status;
      return;
    }
    default:
      return assertExhaustiveProblem(result);
  }
}

function handleMissingProblemBranch(failure: Extract<GetResult, { ok: false; kind: 'problem' }>) {
  switch (failure.code) {
    case 'USER_NOT_FOUND':
      return failure.problem.detail;
    default:
      // @ts-expect-error USER_FORBIDDEN remains unhandled, so the default branch is not never.
      return assertExhaustiveProblem(failure);
  }
}

void exerciseGeneratedProblemResult;
void handleMissingProblemBranch;
`;

      expect(content).toContain(
        "import { handleJsonResponse, handleJsonResult, type RpcClientResult, type RpcDeclaredProblem, type RpcProblemDetailsFor } from './rpc';",
      );
      expect(content).toContain(
        "export type GetProblem = RpcDeclaredProblem<'USER_NOT_FOUND', 'NotFound', 404> | RpcDeclaredProblem<'USER_FORBIDDEN', 'Forbidden', 403>;",
      );
      expect(content).toContain(
        "export type GetProblemDetails = RpcProblemDetailsFor<GetProblem>;",
      );
      expect(content).toContain("export type GetResult = RpcClientResult<GetOutput, GetProblem>;");
      expect(content).toContain("getResult: (input: GetInput): Promise<GetResult> =>");
      expect(content).toContain(
        "handleJsonResult<GetOutput, GetProblem>(response, getProblemDeclarations)",
      );
      assertGeneratedClientTypechecks(source);
    },
    GENERATED_CLIENT_TYPECHECK_TIMEOUT_MS,
  );

  it("should keep undeclared route Problem unions as never", () => {
    const routes: RouteIR[] = [
      {
        controllerName: "UserController",
        methodName: "list",
        httpMethod: "GET",
        path: "/users",
        params: [],
        inputSchema: null,
        inputSchemas: EMPTY_INPUT_SCHEMAS,
        outputSchema: z.array(z.object({ id: z.string() })) as unknown as RouteIR["outputSchema"],
        domain: null,
      },
    ];

    const files = generateClientFiles(routes, TEMP_DIR);

    const content = fs.readFileSync(files[0], "utf-8");
    expect(content).toContain("export type ListProblem = never;");
    expect(content).toContain("export type ListResult = RpcClientResult<ListOutput, ListProblem>;");
  });

  it("should generate JSON-safe literal, enum, union, and record output types", () => {
    const routes: RouteIR[] = [
      {
        controllerName: "StatusController",
        methodName: "get",
        httpMethod: "GET",
        path: "/status",
        params: [],
        inputSchema: null,
        inputSchemas: EMPTY_INPUT_SCHEMAS,
        outputSchema: z.object({
          version: z.literal("status/v1"),
          status: z.enum(["up", "down"]),
          mode: z.union([z.literal("live"), z.literal("test")]),
          details: z.record(z.string(), z.unknown()),
        }) as unknown as RouteIR["outputSchema"],
        domain: null,
      },
    ];

    const files = generateClientFiles(routes, TEMP_DIR);

    const content = fs.readFileSync(files[0], "utf-8");
    expect(content).toContain(
      "export type GetOutput = { version: 'status/v1'; status: 'up' | 'down'; mode: 'live' | 'test'; details: Record<string, unknown>; };",
    );
  });

  it("should reject unsupported Zod schemas instead of emitting unknown fallbacks", () => {
    const routes: RouteIR[] = [
      {
        controllerName: "StatusController",
        methodName: "get",
        httpMethod: "GET",
        path: "/status",
        params: [],
        inputSchema: null,
        inputSchemas: EMPTY_INPUT_SCHEMAS,
        outputSchema: z.object({
          checkedAt: z.date(),
        }) as unknown as RouteIR["outputSchema"],
        domain: null,
      },
    ];

    expect(() => generateClientFiles(routes, TEMP_DIR)).toThrow(
      "Cannot generate RPC client type for unsupported schema ZodDate.",
    );
    expect(fs.existsSync(path.join(TEMP_DIR, "status.ts"))).toBe(false);
  });

  it("should not emit zod references for body-only routes", () => {
    const routes: RouteIR[] = [
      {
        controllerName: "UserController",
        methodName: "create",
        httpMethod: "POST",
        path: "/users",
        params: [{ kind: "body", name: "", schema: null }],
        inputSchema: null,
        inputSchemas: {
          body: z.object({ name: z.string() }) as any,
          path: null,
          query: null,
          headers: null,
        },
        outputSchema: null,
        domain: null,
      },
    ];

    const files = generateClientFiles(routes, TEMP_DIR);

    const content = fs.readFileSync(files[0], "utf-8");
    expect(content).not.toContain("z.");
  });

  it("should use path input when generating path parameter fetch calls", () => {
    const routes: RouteIR[] = [
      {
        controllerName: "UserController",
        methodName: "get",
        httpMethod: "GET",
        path: "/users/:id",
        params: [{ kind: "path", name: "id", schema: null }],
        inputSchema: null,
        inputSchemas: PATH_INPUT_SCHEMAS,
        outputSchema: null,
        domain: null,
      },
    ];

    const files = generateClientFiles(routes, TEMP_DIR);

    const content = fs.readFileSync(files[0], "utf-8");
    expect(content).toContain(
      "const path = `/users/${encodeURIComponent(String(input.path.id))}`;",
    );
    expect(content).toContain(
      "return fetch(path, { method: 'GET' }).then((response) => readOptionalJsonResponse(response));",
    );
  });

  it("should not rewrite path parameters with matching prefixes", () => {
    const routes: RouteIR[] = [
      {
        controllerName: "PairController",
        methodName: "compare",
        httpMethod: "GET",
        path: "/pairs/:id/:id2",
        params: [
          { kind: "path", name: "id", schema: null },
          { kind: "path", name: "id2", schema: null },
        ],
        inputSchema: null,
        inputSchemas: {
          body: null,
          path: z.object({
            id: z.string(),
            id2: z.string(),
          }) as unknown as NonNullable<RouteIR["inputSchemas"]["path"]>,
          query: null,
          headers: null,
        },
        outputSchema: null,
        domain: null,
      },
    ];

    const files = generateClientFiles(routes, TEMP_DIR);

    const content = fs.readFileSync(files[0], "utf-8");
    expect(content).toContain(
      "const path = `/pairs/${encodeURIComponent(String(input.path.id))}/${encodeURIComponent(String(input.path.id2))}`;",
    );
    expect(content).not.toContain("${encodeURIComponent(String(input.path.id))}2");
  });

  it("should bracket-access path parameters that are not JavaScript identifiers", () => {
    const routes: RouteIR[] = [
      {
        controllerName: "UserController",
        methodName: "get",
        httpMethod: "GET",
        path: "/users/:user-id",
        params: [{ kind: "path", name: "user-id", schema: null }],
        inputSchema: null,
        inputSchemas: {
          body: null,
          path: z.object({ "user-id": z.string() }) as unknown as NonNullable<
            RouteIR["inputSchemas"]["path"]
          >,
          query: null,
          headers: null,
        },
        outputSchema: null,
        domain: null,
      },
    ];

    const files = generateClientFiles(routes, TEMP_DIR);

    const content = fs.readFileSync(files[0], "utf-8");
    expect(content).toContain(
      "const path = `/users/${encodeURIComponent(String(input.path['user-id']))}`;",
    );
  });

  it("should normalize catch-all path parameters when generating fetch paths", () => {
    const routes: RouteIR[] = [
      {
        controllerName: "AssetController",
        methodName: "get",
        httpMethod: "GET",
        path: "/assets/:...id",
        params: [{ kind: "path", name: "id", schema: null }],
        inputSchema: null,
        inputSchemas: PATH_INPUT_SCHEMAS,
        outputSchema: null,
        domain: null,
      },
    ];

    const files = generateClientFiles(routes, TEMP_DIR);

    const content = fs.readFileSync(files[0], "utf-8");
    expect(content).toContain(
      "const path = `/assets/${encodeURIComponent(String(input.path.id))}`;",
    );
  });

  it("should serialize query input when generating query parameter fetch calls", () => {
    const routes: RouteIR[] = [
      {
        controllerName: "UserController",
        methodName: "list",
        httpMethod: "GET",
        path: "/users",
        params: [{ kind: "query", name: "page", schema: null }],
        inputSchema: null,
        inputSchemas: QUERY_INPUT_SCHEMAS,
        outputSchema: null,
        domain: null,
      },
    ];

    const files = generateClientFiles(routes, TEMP_DIR);

    const content = fs.readFileSync(files[0], "utf-8");
    expect(content).toContain(
      "type QueryParamValue = string | number | boolean | null | undefined;",
    );
    expect(content).toContain(
      "type QueryParamInput = QueryParamValue | readonly QueryParamValue[];",
    );
    expect(content).toContain(
      "function serializeQueryParams(query: Record<string, QueryParamInput>): string",
    );
    expect(content).toContain("const query = serializeQueryParams(input.query);");
    expect(content).toContain("const url = query ? `${path}?${query}` : path;");
    expect(content).toContain(
      "return fetch(url, { method: 'GET' }).then((response) => readOptionalJsonResponse(response));",
    );
  });

  it("should serialize header input when generating fetch calls", () => {
    const routes: RouteIR[] = [
      {
        controllerName: "UserController",
        methodName: "get",
        httpMethod: "GET",
        path: "/users",
        params: [
          { kind: "header", name: "authorization", schema: null },
          { kind: "header", name: "x-tenant-id", schema: null },
        ],
        inputSchema: null,
        inputSchemas: HEADER_INPUT_SCHEMAS,
        outputSchema: null,
        domain: null,
      },
    ];

    const files = generateClientFiles(routes, TEMP_DIR);

    const content = fs.readFileSync(files[0], "utf-8");
    expect(content).toContain(
      "function serializeHeaders(headers: Record<string, HeaderParamValue>): Record<string, string>",
    );
    expect(content).toContain("const path = '/users';");
    expect(content).toContain(
      "return fetch(path, { method: 'GET', headers: serializeHeaders(input.headers) }).then((response) => readOptionalJsonResponse(response));",
    );
  });

  it("should preserve generated headers when body routes set JSON content type", () => {
    const routes: RouteIR[] = [
      {
        controllerName: "UserController",
        methodName: "create",
        httpMethod: "POST",
        path: "/users",
        params: [
          { kind: "body", name: "", schema: null },
          { kind: "header", name: "x-request-id", schema: null },
        ],
        inputSchema: null,
        inputSchemas: BODY_HEADER_INPUT_SCHEMAS,
        outputSchema: null,
        domain: null,
      },
    ];

    const files = generateClientFiles(routes, TEMP_DIR);

    const content = fs.readFileSync(files[0], "utf-8");
    expect(content).toContain(
      "export type CreateInput = { body: { name: string; }; headers: { 'x-request-id': string; }; };",
    );
    expect(content).toContain(
      "return fetch(path, { method: 'POST', body: JSON.stringify(input.body), headers: { ...serializeHeaders(input.headers), 'Content-Type': 'application/json' } })",
    );
  });

  it("should keep React Query hooks delegated to typed query clients", () => {
    const routes: RouteIR[] = [
      {
        controllerName: "UserController",
        methodName: "list",
        httpMethod: "GET",
        path: "/users",
        params: [{ kind: "query", name: "page", schema: null }],
        inputSchema: null,
        inputSchemas: QUERY_INPUT_SCHEMAS,
        outputSchema: null,
        domain: null,
      },
    ];

    const files = generateClientFiles(routes, TEMP_DIR, { reactQuery: true });

    const content = fs.readFileSync(files[0], "utf-8");
    expect(content).toContain("export function useList(input: ListInput)");
    expect(content).toContain(
      "return useQuery({ queryKey: ['list', input], queryFn: () => userClient.list(input) });",
    );
  });

  it(
    "should typecheck generated clients with non-string query inputs",
    () => {
      const routes: RouteIR[] = [
        {
          controllerName: "UserController",
          methodName: "list",
          httpMethod: "GET",
          path: "/users",
          params: [
            { kind: "query", name: "page", schema: null },
            { kind: "query", name: "active", schema: null },
            { kind: "query", name: "search", schema: null },
            { kind: "query", name: "tags", schema: null },
            { kind: "query", name: "deletedAt", schema: null },
          ],
          inputSchema: null,
          inputSchemas: NON_STRING_QUERY_INPUT_SCHEMAS,
          outputSchema: null,
          domain: null,
        },
      ];

      const files = generateClientFiles(routes, TEMP_DIR);

      const content = fs.readFileSync(files[0], "utf-8");
      expect(content).toContain(
        "export type ListInput = { query: { page: number; active: boolean | undefined; search: string | undefined; tags: string[]; deletedAt: string | null; }; };",
      );
      expect(content).toContain(
        "import { readOptionalJsonResponse, readOptionalJsonResult, type RpcClientResult, type RpcDeclaredProblem, type RpcProblemDetailsFor } from './rpc';",
      );
      assertGeneratedClientTypechecks(`${content}
const result: Promise<unknown | undefined> = userClient.list({
  query: { page: 2, active: false, search: undefined, tags: ['new', 'vip'], deletedAt: null },
});
const resultBranch: Promise<ListResult> = userClient.listResult({
  query: { page: 2, active: false, search: undefined, tags: ['new', 'vip'], deletedAt: null },
});
void result;
void resultBranch;
`);
    },
    GENERATED_CLIENT_TYPECHECK_TIMEOUT_MS,
  );

  it(
    "should typecheck generated clients with header inputs",
    () => {
      const routes: RouteIR[] = [
        {
          controllerName: "UserController",
          methodName: "get",
          httpMethod: "GET",
          path: "/users",
          params: [
            { kind: "header", name: "authorization", schema: null },
            { kind: "header", name: "x-tenant-id", schema: null },
          ],
          inputSchema: null,
          inputSchemas: HEADER_INPUT_SCHEMAS,
          outputSchema: null,
          domain: null,
        },
      ];

      const files = generateClientFiles(routes, TEMP_DIR);

      const content = fs.readFileSync(files[0], "utf-8");
      assertGeneratedClientTypechecks(`${content}
const result: Promise<unknown | undefined> = userClient.get({
  headers: { authorization: 'Bearer token', 'x-tenant-id': undefined },
});
void result;
`);
    },
    GENERATED_CLIENT_TYPECHECK_TIMEOUT_MS,
  );

  it("should serialize body, path, and query input when generating combined fetch calls", () => {
    const routes: RouteIR[] = [
      {
        controllerName: "UserController",
        methodName: "update",
        httpMethod: "PATCH",
        path: "/users/:id",
        params: [
          { kind: "path", name: "id", schema: null },
          { kind: "query", name: "filter", schema: null },
          { kind: "body", name: "", schema: null },
        ],
        inputSchema: null,
        inputSchemas: COMBINED_INPUT_SCHEMAS,
        outputSchema: null,
        domain: null,
      },
    ];

    const files = generateClientFiles(routes, TEMP_DIR);

    const content = fs.readFileSync(files[0], "utf-8");
    expect(content).toContain(
      "const path = `/users/${encodeURIComponent(String(input.path.id))}`;",
    );
    expect(content).toContain("const query = serializeQueryParams(input.query);");
    expect(content).toContain("const url = query ? `${path}?${query}` : path;");
    expect(content).toContain(
      "return fetch(url, { method: 'PATCH', body: JSON.stringify(input.body), headers: { 'Content-Type': 'application/json' } })",
    );
  });
});

function assertGeneratedClientTypechecks(
  source: string,
  rpcSource = fs.readFileSync(path.join(TEMP_DIR, "rpc.ts"), "utf-8"),
): void {
  assertVirtualTypeScriptSourcesTypecheck(
    new Map([
      ["generated-client.ts", source],
      ["rpc.ts", rpcSource],
    ]),
    ["generated-client.ts"],
  );
}

function assertGeneratedPackageTypechecks(fileNames: readonly string[]): void {
  const sources = new Map(
    fileNames.map((fileName) => [
      fileName,
      fs.readFileSync(path.join(TEMP_DIR, fileName), "utf-8"),
    ]),
  );

  assertVirtualTypeScriptSourcesTypecheck(sources, fileNames);
}

function assertVirtualTypeScriptSourcesTypecheck(
  sources: ReadonlyMap<string, string>,
  rootFileNames: readonly string[],
): void {
  const compilerOptions: ts.CompilerOptions = {
    lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    skipLibCheck: true,
    strict: true,
    target: ts.ScriptTarget.ES2022,
    types: [],
  };
  const host = ts.createCompilerHost(compilerOptions);

  host.getSourceFile = (name, languageVersion) => {
    const text = sources.get(name) ?? sources.get(path.basename(name));

    if (text !== undefined) {
      return ts.createSourceFile(name, text, languageVersion, true);
    }

    const fileText = ts.sys.readFile(name);

    return fileText === undefined
      ? undefined
      : ts.createSourceFile(name, fileText, languageVersion, true);
  };
  host.fileExists = (name) =>
    sources.has(name) || sources.has(path.basename(name)) || ts.sys.fileExists(name);
  host.readFile = (name) =>
    sources.get(name) ?? sources.get(path.basename(name)) ?? ts.sys.readFile(name);

  const program = ts.createProgram([...rootFileNames], compilerOptions, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  const messages = diagnostics.map((diagnostic) =>
    ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
  );

  expect(messages).toEqual([]);
}

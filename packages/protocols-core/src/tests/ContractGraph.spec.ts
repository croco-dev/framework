import "reflect-metadata";
import { ProblemCategory } from "@croco/problems-core";
import { Container } from "typedi";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  assertContractGraphHasNoErrors,
  buildContractGraph,
  ContractGraphDiagnosticError,
  formatContractDiagnostic,
} from "../libs/ContractGraph";
import {
  assertContractGraphConsumerRouteCoverage,
  createContractGraphConsumerCoverage,
  getContractGraphConsumerRouteCoverageDiagnostics,
} from "../libs/ContractGraphConsumerCoverage";
import { diffContractGraphSnapshots } from "../libs/ContractGraphDiff";
import {
  createContractGraphSnapshot,
  stringifyContractGraphSnapshot,
} from "../libs/ContractGraphSnapshot";
import { REST_ROUTES_KEY, type RouteMetadata } from "../libs/sharedTypes";
import {
  defineRouteSchema,
  type InferRouteSchemaRequest,
  type InferRouteSchemaResponse,
} from "../libs/RouteSchema";
import { CONTRACT_SCHEMA_JSON_UNSAFE_DIAGNOSTIC_CODE } from "../libs/SchemaDescriptor";
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  ProblemResponse,
  Query,
  ResponseSchema,
  Roles,
  UseGuards,
} from "./helpers/test-decorators";

describe("buildContractGraph", () => {
  beforeEach(() => {
    Container.reset();
    vi.restoreAllMocks();
  });

  it("should build stable controller, route id, operation id, and schema graph nodes", () => {
    const createUserSchema = z.object({ name: z.string() });

    @Controller("/users")
    class UsersController {
      @Get("/:id")
      getUser(@Param("id") _id: string, @Query("include") _include: string): void {}

      @Post("/")
      createUser(@Body(createUserSchema) _body: z.infer<typeof createUserSchema>): void {}
    }

    const graph = buildContractGraph([UsersController]);

    expect(graph.version).toBe("croco.contract-graph.v1");
    expect(graph.controllers).toEqual([
      {
        name: "UsersController",
        path: "/users",
        guards: [],
        roles: [],
        routeIds: ["UsersController.getUser", "UsersController.createUser"],
      },
    ]);
    expect(graph.routes).toHaveLength(2);
    expect(graph.routes[0]).toMatchObject({
      routeId: "UsersController.getUser",
      operationId: "UsersController_getUser",
      controllerName: "UsersController",
      methodName: "getUser",
      httpMethod: "GET",
      path: "/users/:id",
      controllerPath: "/users",
    });
    expect(graph.routes[1]?.inputSchemas.body).toBe(createUserSchema);
    expect(graph.diagnostics).toEqual([]);
  });

  it("should preserve a route schema object as the DTO and contract source of truth", () => {
    const createUserRoute = defineRouteSchema({
      request: {
        body: z.object({
          name: z.string().min(1),
          email: z.string().email(),
        }),
      },
      response: z.object({
        id: z.string().uuid(),
        name: z.string(),
        email: z.string().email(),
      }),
    });
    type CreateUserBody = InferRouteSchemaRequest<typeof createUserRoute>["body"];
    type CreateUserRequest = InferRouteSchemaRequest<typeof createUserRoute>;
    type CreateUserResponse = InferRouteSchemaResponse<typeof createUserRoute>;

    const validBody: CreateUserBody = { name: "Ada", email: "ada@example.com" };
    const validRequest: CreateUserRequest = { body: validBody };
    // @ts-expect-error DTO fields are inferred from the schema instead of a hand-maintained type.
    const invalidBody: CreateUserBody = { name: "Ada", email: 42 };

    @Controller("/users")
    class UsersController {
      @Post("/")
      @ResponseSchema(createUserRoute.response)
      createUser(@Body(createUserRoute.request.body) body: CreateUserBody): CreateUserResponse {
        return { id: "4ea573de-cfb9-4696-bc48-216f19f44300", ...body };
      }
    }

    const graph = buildContractGraph([UsersController]);
    const route = graph.routes[0];

    expect(validBody.email).toBe("ada@example.com");
    expect(validRequest.body.email).toBe("ada@example.com");
    expect(invalidBody).toBeDefined();
    expect(route?.inputSchemas.body).toBe(createUserRoute.request.body);
    expect(route?.params[0]?.schema).toBe(createUserRoute.request.body);
    expect(route?.outputSchema).toBe(createUserRoute.response);
    expect(createContractGraphSnapshot(graph).routes[0]).toMatchObject({
      request: {
        body: {
          kind: "object",
          fields: [
            { name: "email", required: true, schema: { kind: "string" } },
            { name: "name", required: true, schema: { kind: "string" } },
          ],
        },
      },
      response: {
        kind: "object",
        fields: [
          { name: "email", required: true, schema: { kind: "string" } },
          { name: "id", required: true, schema: { kind: "string" } },
          { name: "name", required: true, schema: { kind: "string" } },
        ],
      },
    });
    expect(graph.diagnostics).toEqual([]);
  });

  it("should normalize catch-all route parameters when validating path metadata", () => {
    @Controller("/assets")
    class AssetsController {
      @Get("/:...id")
      getAsset(@Param("id") _id: string): void {}
    }

    const graph = buildContractGraph([AssetsController]);

    expect(graph.routes[0]).toMatchObject({
      routeId: "AssetsController.getAsset",
      path: "/assets/:...id",
    });
    expect(graph.diagnostics).toEqual([]);
    expect(() => assertContractGraphHasNoErrors(graph)).not.toThrow();
  });

  it("should preserve route contract identity and reject body or response decorator drift", () => {
    const bodySchema = z.object({ name: z.string() });
    const otherBodySchema = z.object({ displayName: z.string() });
    const responseSchema = z.object({ id: z.string(), name: z.string() });
    const otherResponseSchema = z.object({ id: z.string(), displayName: z.string() });

    @Controller("/users")
    class UsersController {
      @Post("/")
      @ResponseSchema(otherResponseSchema)
      createUser(@Body(otherBodySchema) _body: z.infer<typeof otherBodySchema>): void {}
    }

    attachRouteContract(UsersController, "createUser", {
      id: "users.create",
      method: "POST",
      path: "/users",
      operationId: "createUser",
      sourceLocation: { path: "src/controllers/UserController.ts", line: 20 },
      body: bodySchema,
      response: responseSchema,
    });

    const graph = buildContractGraph([UsersController]);

    expect(graph.routes[0]).toMatchObject({
      routeContract: {
        id: "users.create",
        method: "POST",
        path: "/users",
        operationId: "createUser",
        sourceLocation: { path: "src/controllers/UserController.ts", line: 20 },
      },
      operationId: "createUser",
    });
    expect(createContractGraphSnapshot(graph).routes[0]?.routeContract).toEqual({
      id: "users.create",
      method: "POST",
      path: "/users",
      operationId: "createUser",
      sourceLocation: { path: "src/controllers/UserController.ts", line: 20 },
    });
    expect(graph.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "contract-route-body-schema-mismatch",
          contractId: "users.create",
          sourceLocation: { path: "src/controllers/UserController.ts", line: 20 },
        }),
        expect.objectContaining({
          code: "contract-route-response-schema-mismatch",
          contractId: "users.create",
          sourceLocation: { path: "src/controllers/UserController.ts", line: 20 },
        }),
      ]),
    );
  });

  it("should expose auth and access metadata references when present", () => {
    const AuthGuard = class SharedAccessGuard {};
    const AuditGuard = class SharedAccessGuard {};

    @UseGuards(AuthGuard)
    @Roles("admin")
    @Controller("/admin")
    class AdminController {
      @UseGuards(AuditGuard)
      @Roles("owner")
      @Get("/:id")
      getAdminAsset(@Param("id") _id: string): void {}
    }

    const graph = buildContractGraph([AdminController]);

    expect(graph.controllers[0]).toMatchObject({
      name: "AdminController",
      guards: [
        {
          type: "rest.guard",
          id: "rest.guard:controller:AdminController:0:constructor:SharedAccessGuard",
          kind: "constructor",
          name: "SharedAccessGuard",
          declaredAt: "controller",
          owner: { controllerName: "AdminController" },
          index: 0,
        },
      ],
      roles: ["admin"],
    });
    expect(graph.routes[0]?.access).toEqual({
      guards: [
        {
          type: "rest.guard",
          id: "rest.guard:controller:AdminController:0:constructor:SharedAccessGuard",
          kind: "constructor",
          name: "SharedAccessGuard",
          declaredAt: "controller",
          owner: { controllerName: "AdminController" },
          index: 0,
        },
        {
          type: "rest.guard",
          id: "rest.guard:route:AdminController.getAdminAsset:0:constructor:SharedAccessGuard",
          kind: "constructor",
          name: "SharedAccessGuard",
          declaredAt: "route",
          owner: {
            controllerName: "AdminController",
            methodName: "getAdminAsset",
            routeId: "AdminController.getAdminAsset",
          },
          index: 0,
        },
      ],
      roles: ["admin", "owner"],
    });
    expect(graph.routes[0]?.access.guards[0]?.id).not.toBe(graph.routes[0]?.access.guards[1]?.id);
    expect(graph.diagnostics).toEqual([]);
  });

  it("should preserve unnamed guard metadata references", () => {
    const unnamedGuard = function Guard() {};
    Object.defineProperty(unnamedGuard, "name", { value: "" });

    @UseGuards(unnamedGuard)
    @Controller("/admin")
    class AdminController {
      @Get("/")
      getAdmin(): void {}
    }

    const graph = buildContractGraph([AdminController]);

    expect(unnamedGuard.name).toBe("");
    expect(graph.controllers[0]?.guards).toEqual([
      {
        type: "rest.guard",
        id: "rest.guard:controller:AdminController:0:constructor:anonymous",
        kind: "constructor",
        name: "anonymous",
        declaredAt: "controller",
        owner: { controllerName: "AdminController" },
        index: 0,
      },
    ]);
    expect(graph.routes[0]?.access.guards[0]?.name).toBe("anonymous");
    expect(graph.diagnostics).toEqual([]);
  });

  it("should report unsupported and drift-prone route metadata as diagnostics", () => {
    @Controller("/hooks")
    class HooksController {
      @Get("/:id")
      handleHook(@Param("hookId") _hookId: string): void {}
    }

    const graph = buildContractGraph([HooksController]);

    expect(graph.diagnostics).toEqual([
      expect.objectContaining({
        code: "contract-route-missing-path-param",
        severity: "error",
        routeId: "HooksController.handleHook",
      }),
      expect.objectContaining({
        code: "contract-route-unbound-path-param",
        severity: "error",
        routeId: "HooksController.handleHook",
      }),
    ]);
    expect(() => assertContractGraphHasNoErrors(graph)).toThrow(ContractGraphDiagnosticError);
  });

  it("should warn when generated contracts unwrap Zod effects", () => {
    @Controller("/profiles")
    class ProfilesController {
      @Post("/")
      createProfile(@Body(z.string().refine((value) => value.length > 0)) _body: string): void {}
    }

    const graph = buildContractGraph([ProfilesController]);

    expect(graph.diagnostics).toEqual([
      expect.objectContaining({
        code: "contract-schema-zod-effects-unwrapped",
        severity: "warning",
        routeId: "ProfilesController.createProfile",
      }),
    ]);
    expect(() => assertContractGraphHasNoErrors(graph)).not.toThrow();
    expect(formatContractDiagnostic(graph.diagnostics[0])).toContain(
      "WARNING contract-schema-zod-effects-unwrapped ProfilesController.createProfile",
    );
  });

  it("should warn when generated contracts unwrap nested Zod effects", () => {
    @Controller("/profiles")
    class ProfilesController {
      @Post("/")
      createProfile(
        @Body(z.object({ name: z.string().refine((value) => value.length > 0) }))
        _body: { name: string },
      ): void {}
    }

    const graph = buildContractGraph([ProfilesController]);

    expect(graph.diagnostics).toEqual([
      expect.objectContaining({
        code: "contract-schema-zod-effects-unwrapped",
        severity: "warning",
        routeId: "ProfilesController.createProfile",
      }),
    ]);
    expect(() => assertContractGraphHasNoErrors(graph)).not.toThrow();
  });

  it("should reject JSON-unsafe schemas with the shared schema diagnostic code", () => {
    @Controller("/profiles")
    class ProfilesController {
      @Post("/")
      createProfile(
        @Body(
          z.object({
            amount: z.bigint(),
            checkedAt: z.date(),
            trimmed: z.string().transform((value) => value.trim()),
          }),
        )
        _body: unknown,
      ): void {}
    }

    const graph = buildContractGraph([ProfilesController]);

    expect(graph.diagnostics).toEqual([
      expect.objectContaining({
        code: CONTRACT_SCHEMA_JSON_UNSAFE_DIAGNOSTIC_CODE,
        severity: "error",
        routeId: "ProfilesController.createProfile",
        message: expect.stringContaining("body.amount"),
      }),
      expect.objectContaining({
        code: CONTRACT_SCHEMA_JSON_UNSAFE_DIAGNOSTIC_CODE,
        severity: "error",
        routeId: "ProfilesController.createProfile",
        message: expect.stringContaining("body.checkedAt"),
      }),
      expect.objectContaining({
        code: CONTRACT_SCHEMA_JSON_UNSAFE_DIAGNOSTIC_CODE,
        severity: "error",
        routeId: "ProfilesController.createProfile",
        message: expect.stringContaining("body.trimmed"),
      }),
    ]);
    expect(() => assertContractGraphHasNoErrors(graph)).toThrow(ContractGraphDiagnosticError);
  });

  it("should reject JSON-unsafe decorator parameter schemas shadowed by route contracts", () => {
    @Controller("/profiles")
    class ProfilesController {
      @Get("/:id")
      getProfile(@Param("id", z.date()) _id: Date): void {}
    }

    attachRouteContract(ProfilesController, "getProfile", {
      method: "GET",
      path: "/profiles/:id",
      params: z.object({ id: z.string() }),
    });

    const graph = buildContractGraph([ProfilesController]);

    expect(graph.diagnostics).toEqual([
      expect.objectContaining({
        code: "contract-route-path-param-schema-mismatch",
        severity: "error",
        routeId: "ProfilesController.getProfile",
      }),
      expect.objectContaining({
        code: CONTRACT_SCHEMA_JSON_UNSAFE_DIAGNOSTIC_CODE,
        severity: "error",
        routeId: "ProfilesController.getProfile",
        message: expect.stringContaining("path.id"),
      }),
    ]);
    expect(() => assertContractGraphHasNoErrors(graph)).toThrow(ContractGraphDiagnosticError);
  });

  it("should reject routes with more than one request body parameter", () => {
    @Controller("/users")
    class UsersController {
      @Post("/")
      createUser(
        @Body(z.object({ name: z.string() })) _body: { name: string },
        @Body(z.object({ auditId: z.string() })) _audit: { auditId: string },
      ): void {}
    }

    const graph = buildContractGraph([UsersController]);

    expect(graph.diagnostics).toEqual([
      expect.objectContaining({
        code: "contract-route-multiple-body-params",
        severity: "error",
        routeId: "UsersController.createUser",
      }),
    ]);
    expect(() => assertContractGraphHasNoErrors(graph)).toThrow(ContractGraphDiagnosticError);
  });

  it("should reject duplicate normalized operation ids", () => {
    @Controller("/users")
    class UsersController {
      @Get("/with-underscore")
      get_user(): void {}
    }

    @Controller("/users-alt")
    class UsersController_get {
      @Get("/plain")
      user(): void {}
    }

    const graph = buildContractGraph([UsersController, UsersController_get]);

    expect(graph.diagnostics).toEqual([
      expect.objectContaining({
        code: "contract-route-duplicate-operation-id",
        severity: "error",
        routeId: "UsersController_get.user",
      }),
    ]);
    expect(() => assertContractGraphHasNoErrors(graph)).toThrow(ContractGraphDiagnosticError);
  });

  it("should reject duplicate controller names used as contract identity", () => {
    const FirstController = (() => {
      @Controller("/first")
      class DuplicateController {
        @Get("/one")
        one(): void {}
      }

      return DuplicateController;
    })();

    const SecondController = (() => {
      @Controller("/second")
      class DuplicateController {
        @Get("/two")
        two(): void {}
      }

      return DuplicateController;
    })();

    const graph = buildContractGraph([FirstController, SecondController]);

    expect(graph.diagnostics).toEqual([
      expect.objectContaining({
        code: "contract-controller-duplicate-name",
        severity: "error",
        target: "controller",
        controllerName: "DuplicateController",
      }),
    ]);
    expect(() => assertContractGraphHasNoErrors(graph)).toThrow(ContractGraphDiagnosticError);
  });

  it("should create byte-stable sorted JSON snapshots for the same controller metadata", () => {
    @Controller("/admin")
    class AdminController {
      @Get("/")
      listAdmins(): void {}
    }

    @Controller("/users")
    class UsersController {
      @Post("/")
      createUser(
        @Body(z.object({ email: z.string().optional(), name: z.string() }))
        _body: { name: string; email?: string },
      ): void {}

      @Get("/:id")
      getUser(@Param("id") _id: string): void {}
    }

    const first = stringifyContractGraphSnapshot(
      createContractGraphSnapshot(buildContractGraph([UsersController, AdminController])),
    );
    const second = stringifyContractGraphSnapshot(
      createContractGraphSnapshot(buildContractGraph([AdminController, UsersController])),
    );
    const snapshot = JSON.parse(first);

    expect(first).toBe(second);
    expect(snapshot).toMatchObject({
      snapshotVersion: "croco.contract-graph.snapshot.v1",
      graphVersion: "croco.contract-graph.v1",
      controllerCount: 2,
      routeCount: 3,
      operationIds: [
        "AdminController_listAdmins",
        "UsersController_createUser",
        "UsersController_getUser",
      ],
      consumerCoverage: {
        version: "croco.contract-consumer-coverage.v1",
        routeCount: 3,
        consumers: [
          expect.objectContaining({
            consumerId: "admin-generated",
            requiredRouteFields: expect.arrayContaining([
              "routeId",
              "operationId",
              "request.body",
              "response",
              "problems",
              "access.guards",
              "access.roles",
            ]),
          }),
          expect.objectContaining({
            consumerId: "openapi",
            requiredRouteFields: expect.arrayContaining([
              "routeId",
              "operationId",
              "request.body",
              "response",
              "problems",
            ]),
          }),
          expect.objectContaining({
            consumerId: "rpc-client",
            requiredRouteFields: expect.arrayContaining([
              "routeId",
              "operationId",
              "request.body",
              "response",
              "problems",
            ]),
          }),
        ],
      },
    });
  });

  it("should report consumer coverage diagnostics instead of silently dropping unsupported fields", () => {
    const AuthGuard = class AuthGuard {};

    @UseGuards(AuthGuard)
    @Roles("admin")
    @Controller("/admin")
    class AdminController {
      @Get("/")
      listAdmins(): void {}
    }

    const graph = buildContractGraph([AdminController]);
    const report = createContractGraphConsumerCoverage(graph);

    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        code: "contract-consumer-unsupported-route-field",
        severity: "warning",
        routeId: "AdminController.listAdmins",
        message: expect.stringContaining("access.guards"),
      }),
      expect.objectContaining({
        code: "contract-consumer-unsupported-route-field",
        severity: "warning",
        routeId: "AdminController.listAdmins",
        message: expect.stringContaining("access.roles"),
      }),
      expect.objectContaining({
        code: "contract-consumer-unsupported-route-field",
        severity: "warning",
        routeId: "AdminController.listAdmins",
        message: expect.stringContaining("access.guards"),
      }),
      expect.objectContaining({
        code: "contract-consumer-unsupported-route-field",
        severity: "warning",
        routeId: "AdminController.listAdmins",
        message: expect.stringContaining("access.roles"),
      }),
    ]);
    const openApiCoverage = report.consumers.find((consumer) => consumer.consumerId === "openapi");
    expect(openApiCoverage?.routes[0]?.unsupportedFields).toEqual([
      "access.guards",
      "access.roles",
    ]);
  });

  it("should reject generated consumers that omit graph routes", () => {
    @Controller("/users")
    class UsersController {
      @Get("/")
      listUsers(): void {}

      @Post("/")
      createUser(): void {}
    }

    const graph = buildContractGraph([UsersController]);

    expect(() =>
      assertContractGraphConsumerRouteCoverage(graph, "openapi", [
        {
          routeId: "UsersController.listUsers",
          operationId: "UsersController_listUsers",
        },
      ]),
    ).toThrow("contract-consumer-missing-route");
  });

  it("should reject generated consumers that drop operation ids, response schemas, or Problems", () => {
    const userSchema = z.object({ id: z.string() });

    @Controller("/users")
    class UsersController {
      @Get("/:id")
      @ResponseSchema(userSchema)
      @ProblemResponse({
        code: "USER_NOT_FOUND",
        category: ProblemCategory.NotFound,
      })
      getUser(@Param("id") _id: string): z.infer<typeof userSchema> {
        return { id: "user_1" };
      }
    }

    const graph = buildContractGraph([UsersController]);
    const diagnostics = getContractGraphConsumerRouteCoverageDiagnostics(graph, "openapi", [
      {
        routeId: "UsersController.getUser",
        consumedFields: [
          "routeId",
          "httpMethod",
          "path",
          "request.body",
          "request.path",
          "request.query",
          "request.headers",
          "response",
          "problems",
        ],
        fieldFingerprints: {
          routeId: "UsersController.getUser",
          httpMethod: "GET",
          path: "/users/:id",
          "request.body": "absent",
          "request.path": "present",
          "request.query": "absent",
          "request.headers": "absent",
          response: "absent",
          problems: "[]",
        },
      },
    ]);

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "contract-consumer-missing-generated-route-field",
      "contract-consumer-route-field-mismatch",
      "contract-consumer-route-field-mismatch",
    ]);
    expect(diagnostics.map((diagnostic) => diagnostic.message)).toEqual([
      expect.stringContaining("operationId"),
      expect.stringContaining("problems"),
      expect.stringContaining("response"),
    ]);
  });

  it("should reject admin-generated consumers that drift access metadata", () => {
    const AuthGuard = class AuthGuard {};

    @UseGuards(AuthGuard)
    @Roles("admin")
    @Controller("/admin")
    class AdminController {
      @Get("/")
      listAdmins(): void {}
    }

    const graph = buildContractGraph([AdminController]);
    const diagnostics = getContractGraphConsumerRouteCoverageDiagnostics(graph, "admin-generated", [
      {
        routeId: "AdminController.listAdmins",
        operationId: "AdminController_listAdmins",
        consumedFields: [
          "routeId",
          "operationId",
          "httpMethod",
          "path",
          "request.body",
          "request.path",
          "request.query",
          "request.headers",
          "response",
          "problems",
          "access.guards",
          "access.roles",
        ],
        fieldFingerprints: {
          routeId: "AdminController.listAdmins",
          operationId: "AdminController_listAdmins",
          httpMethod: "GET",
          path: "/admin",
          "request.body": "absent",
          "request.path": "absent",
          "request.query": "absent",
          "request.headers": "absent",
          response: "absent",
          problems: "[]",
          "access.guards": "[]",
          "access.roles": "[]",
        },
      },
    ]);

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "contract-consumer-route-field-mismatch",
      "contract-consumer-route-field-mismatch",
    ]);
    expect(diagnostics.map((diagnostic) => diagnostic.message)).toEqual([
      expect.stringContaining("access.guards"),
      expect.stringContaining("access.roles"),
    ]);
  });

  it("should snapshot declared Problem responses as route failure contracts", () => {
    @Controller("/users")
    class UsersController {
      @Get("/:id")
      @ProblemResponse({
        code: "USER_FORBIDDEN",
        category: ProblemCategory.Forbidden,
      })
      @ProblemResponse({
        code: "USER_NOT_FOUND",
        category: ProblemCategory.NotFound,
        description: "User id is missing.",
      })
      getUser(@Param("id") _id: string): void {}
    }

    const graph = buildContractGraph([UsersController]);
    const snapshot = createContractGraphSnapshot(graph);

    expect(graph.diagnostics).toEqual([]);
    expect(snapshot.routes[0]?.problems).toEqual([
      {
        code: "USER_FORBIDDEN",
        category: "Forbidden",
        status: 403,
      },
      {
        code: "USER_NOT_FOUND",
        category: "NotFound",
        description: "User id is missing.",
        status: 404,
      },
    ]);
  });

  it("should reject duplicate declared Problem codes on a route", () => {
    @Controller("/users")
    class UsersController {
      @Get("/:id")
      @ProblemResponse({ code: "USER_NOT_FOUND", category: ProblemCategory.NotFound })
      @ProblemResponse({ code: "USER_NOT_FOUND", category: ProblemCategory.NotFound })
      getUser(@Param("id") _id: string): void {}
    }

    const graph = buildContractGraph([UsersController]);

    expect(graph.diagnostics).toEqual([
      expect.objectContaining({
        code: "contract-route-duplicate-problem-code",
        routeId: "UsersController.getUser",
      }),
    ]);
    expect(() => assertContractGraphHasNoErrors(graph)).toThrow(ContractGraphDiagnosticError);
  });

  it("should reject manual Problem responses that drift from route contract problems", () => {
    const userIdSchema = z.string();

    @Controller("/users")
    class UsersController {
      @Get("/:id")
      @ProblemResponse({
        code: "USER_FORBIDDEN",
        category: ProblemCategory.Forbidden,
      })
      getUser(@Param("id", userIdSchema) _id: string): void {}
    }

    attachRouteContract(UsersController, "getUser", {
      method: "GET",
      path: "/users/:id",
      params: z.object({ id: userIdSchema }),
      problems: [
        {
          code: "USER_NOT_FOUND",
          category: ProblemCategory.NotFound,
          status: 404,
        },
      ],
    });

    const graph = buildContractGraph([UsersController], { strictProblemResponses: true });

    expect(graph.diagnostics).toEqual([
      expect.objectContaining({
        code: "contract-route-missing-problem-response",
        routeId: "UsersController.getUser",
      }),
      expect.objectContaining({
        code: "contract-route-problem-response-not-in-contract",
        routeId: "UsersController.getUser",
      }),
    ]);
    expect(() => assertContractGraphHasNoErrors(graph)).toThrow(ContractGraphDiagnosticError);
  });

  it("should reject missing route metadata for route contract problems", () => {
    const userIdSchema = z.string();

    @Controller("/users")
    class UsersController {
      @Get("/:id")
      getUser(@Param("id", userIdSchema) _id: string): void {}
    }

    attachRouteContract(UsersController, "getUser", {
      method: "GET",
      path: "/users/:id",
      params: z.object({ id: userIdSchema }),
      problems: [
        {
          code: "USER_NOT_FOUND",
          category: ProblemCategory.NotFound,
          status: 404,
        },
      ],
    });

    const graph = buildContractGraph([UsersController], { strictProblemResponses: true });

    expect(graph.diagnostics).toEqual([
      expect.objectContaining({
        code: "contract-route-missing-problem-response",
        routeId: "UsersController.getUser",
      }),
    ]);
    expect(() => assertContractGraphHasNoErrors(graph)).toThrow(ContractGraphDiagnosticError);
  });

  it("should reject Problem responses that are not declared by the route contract", () => {
    const routeContractProblems = [
      {
        code: "USER_NOT_FOUND",
        category: ProblemCategory.NotFound,
        status: 404,
      },
    ];

    @Controller("/users")
    class UsersController {
      @Get("/:id")
      @ProblemResponse({
        code: "USER_FORBIDDEN",
        category: ProblemCategory.Forbidden,
        status: 403,
      })
      @ProblemResponse({
        ...routeContractProblems[0],
        routeContractProblems,
      })
      getUser(@Param("id") _id: string): void {}
    }

    const graph = buildContractGraph([UsersController]);

    expect(graph.diagnostics).toEqual([
      expect.objectContaining({
        code: "contract-route-problem-response-not-in-contract",
        routeId: "UsersController.getUser",
      }),
    ]);
    expect(() => assertContractGraphHasNoErrors(graph)).toThrow(ContractGraphDiagnosticError);
  });

  it("should reject Problem response category/status drift from route contracts", () => {
    const routeContractProblems = [
      {
        code: "USER_NOT_FOUND",
        category: ProblemCategory.NotFound,
        status: 404,
      },
    ];

    @Controller("/users")
    class UsersController {
      @Get("/:id")
      @ProblemResponse({
        code: "USER_NOT_FOUND",
        category: ProblemCategory.Forbidden,
        status: 403,
        routeContractProblems,
      })
      getUser(@Param("id") _id: string): void {}
    }

    const graph = buildContractGraph([UsersController]);

    expect(graph.diagnostics).toEqual([
      expect.objectContaining({
        code: "contract-route-problem-response-mismatch",
        routeId: "UsersController.getUser",
      }),
    ]);
    expect(() => assertContractGraphHasNoErrors(graph)).toThrow(ContractGraphDiagnosticError);
  });

  it("should reject Problem response status drift from route contracts", () => {
    const routeContractProblems = [
      {
        code: "USER_NOT_FOUND",
        category: ProblemCategory.NotFound,
        status: 404,
      },
    ];

    @Controller("/users")
    class UsersController {
      @Get("/:id")
      @ProblemResponse({
        code: "USER_NOT_FOUND",
        category: ProblemCategory.NotFound,
        status: 500,
        routeContractProblems,
      })
      getUser(@Param("id") _id: string): void {}
    }

    const graph = buildContractGraph([UsersController]);

    expect(graph.diagnostics).toEqual([
      expect.objectContaining({
        code: "contract-route-problem-response-mismatch",
        routeId: "UsersController.getUser",
      }),
    ]);
    expect(() => assertContractGraphHasNoErrors(graph)).toThrow(ContractGraphDiagnosticError);
  });

  it("should reject filtered route contract Problem declarations", () => {
    const routeContractProblems = [
      {
        code: "USER_FORBIDDEN",
        category: ProblemCategory.Forbidden,
        status: 403,
      },
      {
        code: "USER_NOT_FOUND",
        category: ProblemCategory.NotFound,
        status: 404,
      },
    ];

    @Controller("/users")
    class UsersController {
      @Get("/:id")
      @ProblemResponse({
        ...routeContractProblems[0],
        routeContractProblems,
      })
      getUser(@Param("id") _id: string): void {}
    }

    const graph = buildContractGraph([UsersController]);

    expect(graph.diagnostics).toEqual([
      expect.objectContaining({
        code: "contract-route-missing-problem-response",
        routeId: "UsersController.getUser",
      }),
    ]);
    expect(() => assertContractGraphHasNoErrors(graph)).toThrow(ContractGraphDiagnosticError);
  });

  it("should warn in strict Problem mode when a route has no declared failure union", () => {
    @Controller("/users")
    class UsersController {
      @Get("/:id")
      getUser(@Param("id") _id: string): void {}
    }

    const graph = buildContractGraph([UsersController], { strictProblemResponses: true });

    expect(graph.diagnostics).toEqual([
      expect.objectContaining({
        code: "contract-route-missing-problem-response-contract",
        severity: "warning",
        routeId: "UsersController.getUser",
      }),
    ]);
    expect(() => assertContractGraphHasNoErrors(graph)).not.toThrow();
  });

  it("should classify added routes as non-breaking and removed routes as breaking", () => {
    const BaselineController = (() => {
      @Controller("/users")
      class UsersController {
        @Get("/")
        listUsers(): void {}
      }

      return UsersController;
    })();
    const CurrentController = (() => {
      @Controller("/users")
      class UsersController {
        @Get("/")
        listUsers(): void {}

        @Post("/")
        createUser(@Body(z.object({ name: z.string() })) _body: { name: string }): void {}
      }

      return UsersController;
    })();
    const baseline = createContractGraphSnapshot(buildContractGraph([BaselineController]));
    const current = createContractGraphSnapshot(buildContractGraph([CurrentController]));

    const additiveDiff = diffContractGraphSnapshots(baseline, current);
    const removalDiff = diffContractGraphSnapshots(current, baseline);

    expect(additiveDiff.hasBreakingChanges).toBe(false);
    expect(additiveDiff.nonBreakingChanges).toEqual([
      expect.objectContaining({
        code: "contract-route-added",
        routeId: "UsersController.createUser",
      }),
    ]);
    expect(removalDiff.hasBreakingChanges).toBe(true);
    expect(removalDiff.breakingChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "contract-route-removed",
          routeId: "UsersController.createUser",
        }),
        expect.objectContaining({
          code: "contract-operation-id-removed",
          operationId: "UsersController_createUser",
        }),
      ]),
    );
  });

  it("should classify HTTP method and path changes as breaking", () => {
    const BaselineController = (() => {
      @Controller("/users")
      class UsersController {
        @Get("/:id")
        getUser(@Param("id") _id: string): void {}
      }

      return UsersController;
    })();
    const CurrentController = (() => {
      @Controller("/users")
      class UsersController {
        @Post("/:id/details")
        getUser(@Param("id") _id: string): void {}
      }

      return UsersController;
    })();

    const diff = diffContractGraphSnapshots(
      createContractGraphSnapshot(buildContractGraph([BaselineController])),
      createContractGraphSnapshot(buildContractGraph([CurrentController])),
    );

    expect(diff.hasBreakingChanges).toBe(true);
    expect(diff.breakingChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "contract-route-method-path-changed",
          routeId: "UsersController.getUser",
        }),
      ]),
    );
  });

  it("should classify required request expansion as breaking and optional fields as non-breaking", () => {
    const BaselineController = (() => {
      @Controller("/users")
      class UsersController {
        @Post("/")
        createUser(@Body(z.object({ name: z.string() })) _body: { name: string }): void {}
      }

      return UsersController;
    })();
    const CurrentController = (() => {
      @Controller("/users")
      class UsersController {
        @Post("/")
        createUser(
          @Body(
            z.object({
              age: z.number().optional(),
              email: z.string(),
              name: z.string(),
            }),
          )
          _body: { name: string; email: string; age?: number },
        ): void {}
      }

      return UsersController;
    })();

    const diff = diffContractGraphSnapshots(
      createContractGraphSnapshot(buildContractGraph([BaselineController])),
      createContractGraphSnapshot(buildContractGraph([CurrentController])),
    );

    expect(diff.hasBreakingChanges).toBe(true);
    expect(diff.breakingChanges).toEqual([
      expect.objectContaining({
        code: "contract-request-required-field-added",
        fieldPath: "email",
        location: "body",
      }),
    ]);
    expect(diff.nonBreakingChanges).toEqual([
      expect.objectContaining({
        code: "contract-request-optional-field-added",
        fieldPath: "age",
        location: "body",
      }),
    ]);
  });

  it("should classify request field schema changes as breaking", () => {
    const BaselineController = (() => {
      @Controller("/users")
      class UsersController {
        @Post("/")
        createUser(
          @Body(
            z.object({
              age: z.string(),
              profile: z.object({ nickname: z.string() }),
            }),
          )
          _body: { age: string; profile: { nickname: string } },
        ): void {}
      }

      return UsersController;
    })();
    const CurrentController = (() => {
      @Controller("/users")
      class UsersController {
        @Post("/")
        createUser(
          @Body(
            z.object({
              age: z.number(),
              profile: z.object({ nickname: z.number() }),
            }),
          )
          _body: { age: number; profile: { nickname: number } },
        ): void {}
      }

      return UsersController;
    })();

    const diff = diffContractGraphSnapshots(
      createContractGraphSnapshot(buildContractGraph([BaselineController])),
      createContractGraphSnapshot(buildContractGraph([CurrentController])),
    );

    expect(diff.hasBreakingChanges).toBe(true);
    expect(diff.breakingChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "contract-request-field-schema-incompatible",
          fieldPath: "age",
          location: "body",
        }),
        expect.objectContaining({
          code: "contract-request-field-schema-incompatible",
          fieldPath: "profile.nickname",
          location: "body",
        }),
      ]),
    );
  });

  it("should classify top-level request schema changes as breaking", () => {
    const BaselineController = (() => {
      @Controller("/search")
      class SearchController {
        @Post("/")
        search(@Body(z.string()) _body: string): void {}
      }

      return SearchController;
    })();
    const CurrentController = (() => {
      @Controller("/search")
      class SearchController {
        @Post("/")
        search(@Body(z.number()) _body: number): void {}
      }

      return SearchController;
    })();

    const diff = diffContractGraphSnapshots(
      createContractGraphSnapshot(buildContractGraph([BaselineController])),
      createContractGraphSnapshot(buildContractGraph([CurrentController])),
    );

    expect(diff.hasBreakingChanges).toBe(true);
    expect(diff.breakingChanges).toEqual([
      expect.objectContaining({
        code: "contract-request-schema-incompatible",
        location: "body",
        routeId: "SearchController.search",
      }),
    ]);
  });

  it("should classify response schema removals as incompatible", () => {
    const BaselineController = (() => {
      @Controller("/users")
      class UsersController {
        @ResponseSchema(z.object({ id: z.string(), name: z.string() }))
        @Get("/:id")
        getUser(@Param("id") _id: string): void {}
      }

      return UsersController;
    })();
    const CurrentController = (() => {
      @Controller("/users")
      class UsersController {
        @ResponseSchema(z.object({ id: z.string() }))
        @Get("/:id")
        getUser(@Param("id") _id: string): void {}
      }

      return UsersController;
    })();

    const diff = diffContractGraphSnapshots(
      createContractGraphSnapshot(buildContractGraph([BaselineController])),
      createContractGraphSnapshot(buildContractGraph([CurrentController])),
    );

    expect(diff.hasBreakingChanges).toBe(true);
    expect(diff.breakingChanges).toEqual([
      expect.objectContaining({
        code: "contract-response-schema-incompatible",
        routeId: "UsersController.getUser",
      }),
    ]);
  });

  it("should classify added Problem response codes as breaking and removed codes as non-breaking", () => {
    const BaselineController = (() => {
      @Controller("/users")
      class UsersController {
        @Get("/:id")
        @ProblemResponse({ code: "USER_NOT_FOUND", category: ProblemCategory.NotFound })
        getUser(@Param("id") _id: string): void {}
      }

      return UsersController;
    })();
    const CurrentController = (() => {
      @Controller("/users")
      class UsersController {
        @Get("/:id")
        @ProblemResponse({ code: "USER_FORBIDDEN", category: ProblemCategory.Forbidden })
        @ProblemResponse({ code: "USER_NOT_FOUND", category: ProblemCategory.NotFound })
        getUser(@Param("id") _id: string): void {}
      }

      return UsersController;
    })();
    const baseline = createContractGraphSnapshot(buildContractGraph([BaselineController]));
    const current = createContractGraphSnapshot(buildContractGraph([CurrentController]));

    const additiveDiff = diffContractGraphSnapshots(baseline, current);
    const removalDiff = diffContractGraphSnapshots(current, baseline);

    expect(additiveDiff.hasBreakingChanges).toBe(true);
    expect(additiveDiff.breakingChanges).toEqual([
      expect.objectContaining({
        code: "contract-problem-response-added",
        fieldPath: "USER_FORBIDDEN",
        location: "problem",
      }),
    ]);
    expect(removalDiff.hasBreakingChanges).toBe(true);
    expect(removalDiff.breakingChanges).toEqual([
      expect.objectContaining({
        code: "contract-problem-response-removed",
        fieldPath: "USER_FORBIDDEN",
        location: "problem",
      }),
    ]);
  });

  it("should classify Problem category or status changes as breaking", () => {
    const BaselineController = (() => {
      @Controller("/users")
      class UsersController {
        @Get("/:id")
        @ProblemResponse({ code: "USER_NOT_FOUND", category: ProblemCategory.NotFound })
        getUser(@Param("id") _id: string): void {}
      }

      return UsersController;
    })();
    const CurrentController = (() => {
      @Controller("/users")
      class UsersController {
        @Get("/:id")
        @ProblemResponse({ code: "USER_NOT_FOUND", category: ProblemCategory.Forbidden })
        getUser(@Param("id") _id: string): void {}
      }

      return UsersController;
    })();

    const diff = diffContractGraphSnapshots(
      createContractGraphSnapshot(buildContractGraph([BaselineController])),
      createContractGraphSnapshot(buildContractGraph([CurrentController])),
    );

    expect(diff.breakingChanges).toEqual([
      expect.objectContaining({
        code: "contract-problem-response-classification-changed",
        fieldPath: "USER_NOT_FOUND",
        location: "problem",
      }),
    ]);
  });

  it("should classify nullable response expansions as incompatible", () => {
    const BaselineController = (() => {
      @Controller("/users")
      class UsersController {
        @ResponseSchema(z.object({ name: z.string() }))
        @Get("/:id")
        getUser(@Param("id") _id: string): void {}
      }

      return UsersController;
    })();
    const CurrentController = (() => {
      @Controller("/users")
      class UsersController {
        @ResponseSchema(z.object({ name: z.string().nullable() }))
        @Get("/:id")
        getUser(@Param("id") _id: string): void {}
      }

      return UsersController;
    })();

    const diff = diffContractGraphSnapshots(
      createContractGraphSnapshot(buildContractGraph([BaselineController])),
      createContractGraphSnapshot(buildContractGraph([CurrentController])),
    );

    expect(diff.hasBreakingChanges).toBe(true);
    expect(diff.breakingChanges).toEqual([
      expect.objectContaining({
        code: "contract-response-schema-incompatible",
        routeId: "UsersController.getUser",
      }),
    ]);
  });
});

function attachRouteContract(
  controller: Function,
  methodName: string,
  contract: NonNullable<RouteMetadata["contract"]>,
): void {
  const routes = Reflect.getMetadata(REST_ROUTES_KEY, controller) as RouteMetadata[];

  Reflect.defineMetadata(
    REST_ROUTES_KEY,
    routes.map((route) => (route.methodName === methodName ? { ...route, contract } : route)),
    controller,
  );
}

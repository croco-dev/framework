import "reflect-metadata";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProblemCategory } from "@croco/problems-core";
import {
  buildContractGraph,
  CONTRACT_SCHEMA_JSON_UNSAFE_DIAGNOSTIC_CODE,
} from "@croco/protocols-core";
import {
  All,
  Body,
  Controller,
  defineRouteContract,
  defineRouteSchema,
  Get,
  Header,
  HttpMethod,
  type InferRouteSchemaRequest,
  type InferRouteSchemaResponse,
  Param,
  Post,
  ProblemResponse,
  Query,
  RequestValidationProblem,
  type RouteBody,
  type RouteMethodReturn,
  ResponseSchema,
} from "@croco/protocols-rest";
import { Container } from "typedi";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { emitOpenAPI, emitOpenAPIFromContractGraph } from "../libs/emitOpenAPI";

describe("emitOpenAPI", () => {
  beforeEach(() => {
    Container.reset();
  });

  it("should emit a GET operation with a path parameter", () => {
    @Controller("/users")
    class UsersController {
      @Get("/:id")
      getUser(@Param("id") _id: string): void {}
    }

    const spec = emitOpenAPI([UsersController]);
    const getUser = spec.paths?.["/users/{id}"]?.get;

    expect(spec.openapi).toBe("3.1.0");
    expect(getUser).toMatchObject({
      operationId: "UsersController_getUser",
      tags: ["UsersController"],
      parameters: [
        {
          in: "path",
          name: "id",
          required: true,
          schema: { type: "string" },
        },
      ],
    });
  });

  it("should consume the canonical contract graph as its source of truth", () => {
    const userSchema = z.object({ id: z.string() });

    @Controller("/users")
    class UsersController {
      @Get("/:id")
      @ResponseSchema(userSchema)
      @ProblemResponse({
        code: "USER_NOT_FOUND",
        category: ProblemCategory.NotFound,
        description: "User id is missing.",
      })
      getUser(@Param("id") _id: string): z.infer<typeof userSchema> {
        return { id: "user_1" };
      }
    }

    const graph = buildContractGraph([UsersController]);
    const spec = emitOpenAPIFromContractGraph(graph);
    const operation = spec.paths?.["/users/{id}"]?.get;

    expect(graph.routes[0]?.routeId).toBe("UsersController.getUser");
    expect(operation?.operationId).toBe("UsersController_getUser");
    expect(operation?.summary).toBe("UsersController.getUser");
    expect(operation?.parameters).toEqual([
      {
        in: "path",
        name: "id",
        required: true,
        schema: { type: "string" },
      },
    ]);
    expect(operation?.responses?.[200]).toMatchObject({
      content: {
        "application/json": {
          schema: {
            properties: { id: { type: "string" } },
            required: ["id"],
            type: "object",
          },
        },
      },
    });
    expect(operation?.responses?.[404]).toMatchObject({
      "x-croco-problems": [
        {
          category: "NotFound",
          code: "USER_NOT_FOUND",
          cookbookPath: "/reference/problem-recovery-cookbook/#user-not-found",
          description: "User id is missing.",
          status: 404,
        },
      ],
    });
  });

  it("should reference the shared Project manifest bundle when configured", () => {
    @Controller("/users")
    class UsersController {
      @Get("/")
      listUsers(): void {}
    }

    const graph = buildContractGraph([UsersController]);
    const spec = emitOpenAPIFromContractGraph(graph, {
      manifestBundlePath: ".croco/manifest/",
    });

    expect(spec["x-croco-manifest-bundle"]).toEqual({
      schemaVersion: "croco.openapi.manifest-source.v1",
      directory: ".croco/manifest",
      artifacts: {
        contractGraph: ".croco/manifest/contract-graph.json",
        problems: ".croco/manifest/problems.json",
        diGraph: ".croco/manifest/di-graph.json",
        runtime: ".croco/manifest/runtime.json",
        policies: ".croco/manifest/policies.json",
        providers: ".croco/manifest/providers.json",
      },
    });
  });

  it("should emit entitlement requirements as OpenAPI operation extensions", () => {
    const entitlementRequirementsKey = Symbol.for("croco:entitlements:requirements");

    function RequiresEntitlement(): MethodDecorator {
      return (target, propertyKey) => {
        Reflect.defineMetadata(
          entitlementRequirementsKey,
          [
            {
              feature: "reports.export",
              description: "Export report data.",
              resource: { type: "report", idParam: "id" },
            },
          ],
          target.constructor,
          propertyKey,
        );
      };
    }

    @Controller("/reports")
    class ReportsController {
      @Get("/:id")
      @RequiresEntitlement()
      exportReport(@Param("id") _id: string): void {}
    }

    const graph = buildContractGraph([ReportsController]);
    const spec = emitOpenAPIFromContractGraph(graph);

    expect(graph.routes[0]?.entitlements).toEqual([
      {
        feature: "reports.export",
        description: "Export report data.",
        resource: { type: "report", idParam: "id" },
      },
    ]);
    expect(spec.paths?.["/reports/{id}"]?.get?.["x-croco-entitlements"]).toEqual([
      {
        feature: "reports.export",
        description: "Export report data.",
        resource: { type: "report", idParam: "id" },
      },
    ]);
  });

  it("should normalize catch-all path parameters from the canonical contract graph", () => {
    @Controller("/assets")
    class AssetsController {
      @Get("/:...id")
      getAsset(@Param("id") _id: string): void {}
    }

    const graph = buildContractGraph([AssetsController]);
    const spec = emitOpenAPIFromContractGraph(graph);

    expect(graph.diagnostics).toEqual([]);
    expect(spec.paths?.["/assets/{id}"]?.get).toMatchObject({
      operationId: "AssetsController_getAsset",
      parameters: [
        {
          in: "path",
          name: "id",
          required: true,
          schema: { type: "string" },
        },
      ],
    });
    expect(spec.paths?.["/assets/{...id}"]).toBeUndefined();
  });

  it("should not rewrite path parameters with matching prefixes", () => {
    @Controller("/pairs")
    class PairsController {
      @Get("/:id/:id2")
      compare(@Param("id") _id: string, @Param("id2") _id2: string): void {}
    }

    const graph = buildContractGraph([PairsController]);
    const spec = emitOpenAPIFromContractGraph(graph);

    expect(graph.diagnostics).toEqual([]);
    expect(spec.paths?.["/pairs/{id}/{id2}"]?.get?.parameters).toEqual([
      {
        in: "path",
        name: "id",
        required: true,
        schema: { type: "string" },
      },
      {
        in: "path",
        name: "id2",
        required: true,
        schema: { type: "string" },
      },
    ]);
    expect(spec.paths?.["/pairs/{id}/{id}2"]).toBeUndefined();
  });

  it("should apply document metadata options", () => {
    @Controller("/accounts")
    class AccountsController {
      @Get("/")
      listAccounts(): void {}
    }

    const spec = emitOpenAPI([AccountsController], {
      info: {
        title: "Accounts API",
        version: "2026.6.0",
        description: "Tenant account operations",
      },
      servers: [{ url: "https://api.example.com" }],
      security: [{ bearerAuth: [] }],
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      tags: [{ name: "Accounts", description: "Account operations" }],
    });

    expect(spec.info).toMatchObject({
      title: "Accounts API",
      version: "2026.6.0",
      description: "Tenant account operations",
    });
    expect(spec.servers).toEqual([{ url: "https://api.example.com" }]);
    expect(spec.security).toEqual([{ bearerAuth: [] }]);
    expect(spec.tags).toEqual([{ name: "Accounts", description: "Account operations" }]);
    expect(spec.components?.securitySchemes?.bearerAuth).toEqual({
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
    });
  });

  it("should emit a POST operation with a JSON request body", () => {
    const createOrderSchema = z.object({
      productId: z.string(),
      quantity: z.number().int(),
    });

    @Controller("/orders")
    class OrdersController {
      @Post("/")
      createOrder(@Body(createOrderSchema) _body: z.infer<typeof createOrderSchema>): void {}
    }

    const spec = emitOpenAPI([OrdersController]);
    const createOrder = spec.paths?.["/orders"]?.post;

    expect(createOrder).toMatchObject({
      operationId: "OrdersController_createOrder",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                productId: { type: "string" },
                quantity: { type: "integer" },
              },
              required: ["productId", "quantity"],
            },
          },
        },
      },
    });
  });

  it("should emit response content for declared response schemas", () => {
    const orderSchema = z.object({
      id: z.string().uuid(),
      items: z.array(z.object({ sku: z.string(), quantity: z.number().int() })),
    });

    @Controller("/orders")
    class OrdersController {
      @Get("/:id")
      @ResponseSchema(orderSchema)
      getOrder(@Param("id") _id: string): z.infer<typeof orderSchema> {
        return { id: "5d295963-ec3b-48ca-a270-c63b5793ec9a", items: [] };
      }
    }

    const spec = emitOpenAPI([OrdersController]);
    const getOrder = spec.paths?.["/orders/{id}"]?.get;

    expect(getOrder?.responses?.[200]).toMatchObject({
      description: "Successful response",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    sku: { type: "string" },
                    quantity: { type: "integer" },
                  },
                  required: ["sku", "quantity"],
                },
              },
            },
            required: ["id", "items"],
          },
        },
      },
    });
  });

  it("should emit request and response contracts from one route schema object", () => {
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
    type CreateUserResponse = InferRouteSchemaResponse<typeof createUserRoute>;

    @Controller("/users")
    class UsersController {
      @Post("/")
      @ResponseSchema(createUserRoute.response)
      createUser(@Body(createUserRoute.request.body) body: CreateUserBody): CreateUserResponse {
        return { id: "4ea573de-cfb9-4696-bc48-216f19f44300", ...body };
      }
    }

    const spec = emitOpenAPI([UsersController]);
    const createUser = spec.paths?.["/users"]?.post;

    expect(createUser?.requestBody).toMatchObject({
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              name: { type: "string", minLength: 1 },
              email: { type: "string", format: "email" },
            },
            required: ["name", "email"],
          },
        },
      },
    });
    expect(createUser?.responses?.[200]).toMatchObject({
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              name: { type: "string" },
              email: { type: "string", format: "email" },
            },
            required: ["id", "name", "email"],
          },
        },
      },
    });
  });

  it("should emit request and response contracts from a typed route contract", () => {
    const createUserSchema = z.object({
      name: z.string().min(1),
      email: z.string().email(),
    });
    const userSchema = z.object({
      id: z.string().uuid(),
      name: z.string(),
      email: z.string().email(),
    });
    const createUserContract = defineRouteContract({
      id: "users.create",
      method: HttpMethod.POST,
      path: "/users",
      operationId: "createUser",
      body: createUserSchema,
      response: userSchema,
    });

    @Controller("/users")
    class UsersController {
      @Post(createUserContract)
      createUser(
        @Body(createUserContract) body: RouteBody<typeof createUserContract>,
      ): RouteMethodReturn<typeof createUserContract> {
        return { id: "4ea573de-cfb9-4696-bc48-216f19f44300", ...body };
      }
    }

    const spec = emitOpenAPI([UsersController]);
    const createUser = spec.paths?.["/users"]?.post;

    expect(createUser?.operationId).toBe("createUser");
    expect(createUser?.requestBody).toMatchObject({
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              name: { type: "string", minLength: 1 },
              email: { type: "string", format: "email" },
            },
            required: ["name", "email"],
          },
        },
      },
    });
    expect(createUser?.responses?.[200]).toMatchObject({
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              name: { type: "string" },
              email: { type: "string", format: "email" },
            },
            required: ["id", "name", "email"],
          },
        },
      },
    });
  });

  it("should document Problem Details responses by default", () => {
    @Controller("/orders")
    class OrdersController {
      @Get("/:id")
      getOrder(@Param("id") _id: string): void {}
    }

    const spec = emitOpenAPI([OrdersController]);
    const responses = spec.paths?.["/orders/{id}"]?.get?.responses;
    const validationProblem = new RequestValidationProblem("body", [
      { path: "id", message: "Required" },
    ]);

    expect(responses?.[400]).toMatchObject({
      description: "Bad request",
      content: {
        "application/problem+json": {
          schema: {
            $ref: "#/components/schemas/ProblemDetails",
          },
        },
      },
    });
    expect(validationProblem.status).toBe(422);
    expect(responses?.[validationProblem.status]).toMatchObject({
      description: "Validation error",
      content: {
        "application/problem+json": {
          schema: {
            $ref: "#/components/schemas/ProblemDetails",
          },
        },
      },
    });
    expect(responses?.[500]).toMatchObject({
      description: "Internal server error",
      content: {
        "application/problem+json": {
          schema: {
            $ref: "#/components/schemas/ProblemDetails",
          },
        },
      },
    });
    expect(spec.components?.schemas?.ProblemDetails).toMatchObject({
      type: "object",
      required: ["type", "title", "status", "code"],
      properties: {
        type: { type: "string" },
        title: { type: "string" },
        status: { type: "integer" },
        code: { type: "string" },
        detail: { type: "string" },
        instance: { type: "string" },
      },
      additionalProperties: true,
    });
  });

  it("should allow custom problem and default responses", () => {
    @Controller("/sessions")
    class SessionsController {
      @Post("/")
      createSession(): void {}
    }

    const spec = emitOpenAPI([SessionsController], {
      problemResponses: [{ status: 401, description: "Authentication required" }],
      defaultResponses: {
        429: {
          description: "Too many requests",
        },
      },
    });
    const responses = spec.paths?.["/sessions"]?.post?.responses;

    expect(responses?.[400]).toBeUndefined();
    expect(responses?.[401]).toMatchObject({
      description: "Authentication required",
      content: {
        "application/problem+json": {
          schema: {
            $ref: "#/components/schemas/ProblemDetails",
          },
        },
      },
    });
    expect(responses?.[429]).toEqual({ description: "Too many requests" });
    expect(responses?.[200]).toEqual({ description: "Successful response" });
  });

  it("should document route-declared Problem codes under derived HTTP statuses", () => {
    @Controller("/users")
    class UsersController {
      @Get("/:id")
      @ProblemResponse({
        code: "USER_BLOCKED",
        category: ProblemCategory.BusinessRuleViolation,
        description: "The user cannot be read in the current workflow state.",
      })
      @ProblemResponse({
        code: "USER_INVALID",
        category: ProblemCategory.ValidationError,
        type: "https://errors.example.com/user-invalid",
      })
      @ProblemResponse({
        code: "USER_NOT_FOUND",
        category: ProblemCategory.NotFound,
        description: "The user id does not exist.",
      })
      getUser(@Param("id") _id: string): void {}
    }

    const spec = emitOpenAPI([UsersController]);
    const responses = spec.paths?.["/users/{id}"]?.get?.responses;

    expect(responses?.[404]).toMatchObject({
      description: "Declared Problems: USER_NOT_FOUND (NotFound): The user id does not exist.",
      content: {
        "application/problem+json": {
          schema: {
            $ref: "#/components/schemas/ProblemDetails",
          },
        },
      },
      "x-croco-problems": [
        {
          code: "USER_NOT_FOUND",
          category: "NotFound",
          cookbookPath: "/reference/problem-recovery-cookbook/#user-not-found",
          status: 404,
          description: "The user id does not exist.",
        },
      ],
    });
    expect(responses?.[422]).toMatchObject({
      description:
        "Declared Problems: USER_BLOCKED (BusinessRuleViolation): The user cannot be read in the current workflow state., USER_INVALID (ValidationError)",
      content: {
        "application/problem+json": {
          schema: {
            $ref: "#/components/schemas/ProblemDetails",
          },
        },
      },
      "x-croco-problems": [
        {
          code: "USER_BLOCKED",
          category: "BusinessRuleViolation",
          cookbookPath: "/reference/problem-recovery-cookbook/#user-blocked",
          status: 422,
          description: "The user cannot be read in the current workflow state.",
        },
        {
          code: "USER_INVALID",
          category: "ValidationError",
          cookbookPath: "/reference/problem-recovery-cookbook/#user-invalid",
          status: 422,
          type: "https://errors.example.com/user-invalid",
        },
      ],
    });
  });

  it("should preserve generic success responses without a response schema", () => {
    @Controller("/health")
    class HealthController {
      @Get("/")
      checkHealth(): void {}
    }

    const spec = emitOpenAPI([HealthController]);

    expect(spec.paths?.["/health"]?.get?.responses?.[200]).toEqual({
      description: "Successful response",
    });
  });

  it("should reject @All routes with a generated-contract diagnostic", () => {
    @Controller("/hooks")
    class HooksController {
      @All("/:id")
      handleHook(@Param("id") _id: string): void {}
    }

    const message = expectThrownMessage(() => emitOpenAPI([HooksController]));

    expect(message).toContain(
      "ERROR contract-route-unsupported-all-method HooksController.handleHook",
    );
    expect(message).toContain("emitOpenAPI.spec.ts:");
    expect(message).toContain(
      "@All is runtime-only and cannot be represented as a concrete generated contract.",
    );
  });

  it("should reject path parameters that drift from controller metadata", () => {
    @Controller("/users")
    class UsersController {
      @Get("/:id")
      getUser(@Param("userId") _userId: string): void {}
    }

    const message = expectThrownMessage(() => emitOpenAPI([UsersController]));

    expect(message).toContain("ERROR contract-route-missing-path-param UsersController.getUser");
    expect(message).toContain("emitOpenAPI.spec.ts:");
    expect(message).toContain(
      "Route path declares ':id' but no @Param(\"id\") metadata was found.",
    );
  });

  it("should reject routes with more than one body parameter", () => {
    @Controller("/users")
    class UsersController {
      @Post("/")
      createUser(
        @Body(z.object({ name: z.string() })) _body: { name: string },
        @Body(z.object({ auditId: z.string() })) _audit: { auditId: string },
      ): void {}
    }

    const message = expectThrownMessage(() => emitOpenAPI([UsersController]));

    expect(message).toContain(
      "ERROR contract-route-multiple-body-params UsersController.createUser",
    );
    expect(message).toContain("emitOpenAPI.spec.ts:");
    expect(message).toContain(
      "Generated contracts support one request body per route, but 2 @Body() parameters were found.",
    );
  });

  it("should unwrap refined response schemas", () => {
    const responseSchema = z
      .object({ name: z.string().min(1) })
      .refine((response) => response.name.length > 2);

    @Controller("/profiles")
    class ProfilesController {
      @Get("/:id")
      @ResponseSchema(responseSchema)
      getProfile(@Param("id") _id: string): z.infer<typeof responseSchema> {
        return { name: "Ada" };
      }
    }

    const spec = emitOpenAPI([ProfilesController]);

    expect(spec.paths?.["/profiles/{id}"]?.get?.responses?.[200]).toMatchObject({
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: { name: { type: "string", minLength: 1 } },
            required: ["name"],
          },
        },
      },
    });
  });

  it("should unwrap Zod refined schemas without crashing", () => {
    const refinedObjectSchema = z
      .object({ name: z.string().min(1) })
      .refine((body) => body.name.length > 2);

    @Controller("/zod-effects")
    class ZodEffectsController {
      @Post("/email")
      createEmail(
        @Body(
          z
            .string()
            .email()
            .refine((value) => value.length > 5),
        )
        _body: string,
      ): void {}

      @Post("/object")
      createObject(@Body(refinedObjectSchema) _body: z.infer<typeof refinedObjectSchema>): void {}
    }

    const spec = emitOpenAPI([ZodEffectsController]);

    expect(spec.paths?.["/zod-effects/email"]?.post?.requestBody).toMatchObject({
      required: true,
      content: {
        "application/json": {
          schema: { type: "string" },
        },
      },
    });
    expect(spec.paths?.["/zod-effects/object"]?.post?.requestBody).toMatchObject({
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: { name: { type: "string", minLength: 1 } },
            required: ["name"],
          },
        },
      },
    });
  });

  it("should reject JSON-unsafe schemas with the shared schema diagnostic code", () => {
    @Controller("/zod-unsafe")
    class ZodUnsafeController {
      @Post("/")
      createUnsafe(
        @Body(
          z.object({
            checkedAt: z.date(),
            trimmed: z.string().transform((value) => value.trim()),
          }),
        )
        _body: unknown,
      ): void {}
    }

    expect(() => emitOpenAPI([ZodUnsafeController])).toThrow(
      CONTRACT_SCHEMA_JSON_UNSAFE_DIAGNOSTIC_CODE,
    );
  });

  it(
    "should emit multiple routes and pass Redocly lint",
    {
      timeout: 120000,
    },
    () => {
      const createItemSchema = z.object({ name: z.string().min(1) });

      @Controller("/items")
      class ItemsController {
        @Get("/:id")
        getItem(
          @Param("id") _id: string,
          @Query("filter") _filter: string,
          @Header("x-request-id") _requestId: string,
        ): void {}

        @Post("/")
        createItem(@Body(createItemSchema) _body: z.infer<typeof createItemSchema>): void {}
      }

      const spec = emitOpenAPI([ItemsController]);
      const getItem = spec.paths?.["/items/{id}"]?.get;
      const createItem = spec.paths?.["/items"]?.post;

      expect(getItem?.parameters).toEqual([
        { in: "path", name: "id", required: true, schema: { type: "string" } },
        {
          in: "query",
          name: "filter",
          required: false,
          schema: { type: "string" },
        },
        {
          in: "header",
          name: "x-request-id",
          required: false,
          schema: { type: "string" },
        },
      ]);
      expect(createItem?.operationId).toBe("ItemsController_createItem");
      expectRedoclyLintPasses(spec);
    },
  );
});

function expectRedoclyLintPasses(spec: object): void {
  const tempDirectory = mkdtempSync(join(tmpdir(), "openapi-spec-"));
  const specPath = join(tempDirectory, "openapi-test.json");

  try {
    writeFileSync(specPath, JSON.stringify(spec, null, 2));
    execFileSync("pnpm", ["exec", "redocly", "lint", "--format=stylish", specPath], {
      cwd: join(__dirname, "../.."),
      stdio: "pipe",
      timeout: 100000,
    });
  } finally {
    rmSync(tempDirectory, { force: true, recursive: true });
  }
}

function expectThrownMessage(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }

  throw new Error("Expected action to throw.");
}

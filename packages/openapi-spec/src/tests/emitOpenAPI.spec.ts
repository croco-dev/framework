import "reflect-metadata";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Container } from "typedi";
import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  RequestValidationProblem,
  ResponseSchema,
  All,
} from "@croco/protocols-rest";
import { buildContractGraph } from "@croco/protocols-core";
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
    @Controller("/users")
    class UsersController {
      @Get("/:id")
      getUser(@Param("id") _id: string): void {}
    }

    const graph = buildContractGraph([UsersController]);
    const spec = emitOpenAPIFromContractGraph(graph);

    expect(graph.routes[0]?.routeId).toBe("UsersController.getUser");
    expect(spec.paths?.["/users/{id}"]?.get?.operationId).toBe("UsersController_getUser");
    expect(spec.paths?.["/users/{id}"]?.get?.summary).toBe("UsersController.getUser");
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
    const createOrderSchema = z.object({ productId: z.string(), quantity: z.number().int() });

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

    expect(() => emitOpenAPI([HooksController])).toThrow(
      "ERROR contract-route-unsupported-all-method HooksController.handleHook: @All is runtime-only and cannot be represented as a concrete generated contract. Use explicit HTTP method decorators for OpenAPI and typed clients.",
    );
  });

  it("should reject path parameters that drift from controller metadata", () => {
    @Controller("/users")
    class UsersController {
      @Get("/:id")
      getUser(@Param("userId") _userId: string): void {}
    }

    expect(() => emitOpenAPI([UsersController])).toThrow(
      "ERROR contract-route-missing-path-param UsersController.getUser: Route path declares ':id' but no @Param(\"id\") metadata was found.",
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

    expect(() => emitOpenAPI([UsersController])).toThrow(
      "ERROR contract-route-multiple-body-params UsersController.createUser: Generated contracts support one request body per route, but 2 @Body() parameters were found.",
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

  it("should handle Zod refined and transformed schemas without crashing", () => {
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

      @Post("/transform")
      createTransform(@Body(z.string().transform((value) => value.trim())) _body: string): void {}
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
    expect(spec.paths?.["/zod-effects/transform"]?.post?.requestBody).toMatchObject({
      required: true,
      content: {
        "application/json": {
          schema: { type: "string" },
        },
      },
    });
  });

  it("should emit multiple routes and pass Redocly lint", { timeout: 120000 }, () => {
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
      { in: "query", name: "filter", required: false, schema: { type: "string" } },
      { in: "header", name: "x-request-id", required: false, schema: { type: "string" } },
    ]);
    expect(createItem?.operationId).toBe("ItemsController_createItem");
    expectRedoclyLintPasses(spec);
  });
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

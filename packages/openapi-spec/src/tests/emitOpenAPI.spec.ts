import "reflect-metadata";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Body, Controller, Get, Header, Param, Post, Query } from "@croco/protocols-rest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { emitOpenAPI } from "../libs/emitOpenAPI";

describe("emitOpenAPI", () => {
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

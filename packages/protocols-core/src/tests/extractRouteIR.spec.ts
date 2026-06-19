import "reflect-metadata";
import { ProblemCategory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { extractRouteIR } from "../libs/extractRouteIR";
import { REST_ROUTES_KEY, type RouteMetadata } from "../libs/sharedTypes";
import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  ProblemResponse,
  Query,
} from "./helpers/test-decorators";

const RESPONSE_SCHEMA_KEY = Symbol.for("croco:rest:responseSchema");

function ResponseSchema(schema: z.ZodType): MethodDecorator {
  return (target, propertyKey) => {
    const ctor = target.constructor;

    Reflect.defineMetadata(RESPONSE_SCHEMA_KEY, schema, ctor, propertyKey);
  };
}

describe("extractRouteIR", () => {
  it("should extract a GET route with a path param", () => {
    @Controller("/users")
    class UsersController {
      @Get("/:id")
      getUser(@Param("id") _id: string): void {}
    }

    const routes = extractRouteIR(UsersController);

    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({
      controllerName: "UsersController",
      methodName: "getUser",
      httpMethod: "GET",
      path: "/users/:id",
      domain: null,
      inputSchema: null,
      outputSchema: null,
    });
    expect(routes[0]?.params).toEqual([{ kind: "path", name: "id", schema: null }]);
  });

  it("should extract a POST route with body schema as input schema", () => {
    const createOrderSchema = z.object({ productId: z.string() });

    @Controller("/orders")
    class OrdersController {
      @Post("/")
      createOrder(@Body(createOrderSchema) _body: z.infer<typeof createOrderSchema>): void {}
    }

    const routes = extractRouteIR(OrdersController);

    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({
      controllerName: "OrdersController",
      methodName: "createOrder",
      httpMethod: "POST",
      path: "/orders",
      domain: null,
      outputSchema: null,
    });
    expect(routes[0]?.inputSchema).toBe(createOrderSchema);
    expect(routes[0]?.params).toEqual([{ kind: "body", name: "", schema: createOrderSchema }]);
  });

  it("should set inputSchemas.body for a POST route with a body schema", () => {
    const createUserSchema = z.object({ name: z.string() });

    @Controller("/users")
    class UsersController {
      @Post("/")
      createUser(@Body(createUserSchema) _body: z.infer<typeof createUserSchema>): void {}
    }

    const routes = extractRouteIR(UsersController);

    expect(routes).toHaveLength(1);
    expect(routes[0]?.inputSchemas.body).toBe(createUserSchema);
    expect(routes[0]?.inputSchemas.path).toBeNull();
    expect(routes[0]?.inputSchemas.query).toBeNull();
    expect(routes[0]?.inputSchema).toBe(createUserSchema);
  });

  it("should set inputSchemas.path with default string schema for a path param without explicit schema", () => {
    @Controller("/users")
    class UsersController {
      @Get("/:id")
      getUser(@Param("id") _id: string): void {}
    }

    const routes = extractRouteIR(UsersController);

    expect(routes).toHaveLength(1);
    expect(routes[0]?.inputSchemas.body).toBeNull();
    expect(routes[0]?.inputSchemas.path).toBeTruthy();
    expect((routes[0]?.inputSchemas.path as z.ZodObject<any>).shape).toHaveProperty("id");
    expect((routes[0]?.inputSchemas.path as z.ZodObject<any>).shape.id).toBeInstanceOf(z.ZodString);
    expect(routes[0]?.inputSchemas.query).toBeNull();
    expect(routes[0]?.inputSchemas.headers).toBeNull();
    expect(routes[0]?.params).toEqual([{ kind: "path", name: "id", schema: null }]);
  });

  it("should extract path and query params for a route", () => {
    @Controller("/items")
    class ItemsController {
      @Get("/:id")
      getItem(@Param("id") _id: string, @Query("filter") _filter: string): void {}
    }

    const routes = extractRouteIR(ItemsController);

    expect(routes).toHaveLength(1);
    expect(routes[0]?.params).toHaveLength(2);
    expect(routes[0]?.params).toEqual([
      { kind: "path", name: "id", schema: null },
      { kind: "query", name: "filter", schema: null },
    ]);
  });

  it("should set inputSchemas for body, path, and query params", () => {
    const updateItemSchema = z.object({ name: z.string() });

    @Controller("/items")
    class ItemsController {
      @Post("/:id")
      updateItem(
        @Body(updateItemSchema) _body: z.infer<typeof updateItemSchema>,
        @Param("id", z.string()) _id: string,
        @Query("filter", z.string()) _filter: string,
      ): void {}
    }

    const routes = extractRouteIR(ItemsController);

    expect(routes).toHaveLength(1);
    expect(routes[0]?.inputSchemas.body).toBe(updateItemSchema);
    expect(routes[0]?.inputSchemas.path).toBeTruthy();
    expect((routes[0]?.inputSchemas.path as z.ZodObject<any>).shape.id).toBeInstanceOf(z.ZodString);
    expect(routes[0]?.inputSchemas.query).toBeTruthy();
    expect((routes[0]?.inputSchemas.query as z.ZodObject<any>).shape.filter).toBeInstanceOf(
      z.ZodString,
    );
    expect(routes[0]?.inputSchema).toBe(updateItemSchema);
  });

  it("should set inputSchemas.headers with default string schema for header params", () => {
    @Controller("/users")
    class UsersController {
      @Get("/")
      listUsers(@Header("x-tenant-id") _tenantId: string): void {}
    }

    const routes = extractRouteIR(UsersController);

    expect(routes).toHaveLength(1);
    expect(routes[0]?.inputSchemas.body).toBeNull();
    expect(routes[0]?.inputSchemas.path).toBeNull();
    expect(routes[0]?.inputSchemas.query).toBeNull();
    expect(routes[0]?.inputSchemas.headers).toBeTruthy();
    expect(
      (routes[0]?.inputSchemas.headers as z.ZodObject<any>).shape["x-tenant-id"],
    ).toBeInstanceOf(z.ZodString);
    expect(routes[0]?.params).toEqual([{ kind: "header", name: "x-tenant-id", schema: null }]);
  });

  it("should extract outputSchema from response schema metadata", () => {
    const userSchema = z.object({ id: z.string() });

    @Controller("/users")
    class UsersController {
      @Get("/:id")
      @ResponseSchema(userSchema)
      getUser(@Param("id") _id: string): void {}
    }

    const routes = extractRouteIR(UsersController);

    expect(routes).toHaveLength(1);
    expect(routes[0]?.outputSchema).toBe(userSchema);
  });

  it("should extract path, input, and output schemas from route contract metadata", () => {
    const userIdSchema = z.string().uuid();
    const includePostsSchema = z.boolean().optional();
    const tenantIdSchema = z.string().uuid();
    const paramsSchema = z.object({ id: userIdSchema });
    const querySchema = z.object({ includePosts: includePostsSchema });
    const userSchema = z.object({ id: z.string(), name: z.string() });

    @Controller("/users")
    class UsersController {
      @Get("/:id")
      getUser(
        @Param("id", userIdSchema) _id: string,
        @Query("includePosts", includePostsSchema) _includePosts: boolean | undefined,
        @Header("x-tenant-id", tenantIdSchema) _tenantId: string,
      ): void {}
    }

    attachRouteContract(UsersController, "getUser", {
      id: "users.get",
      method: "GET",
      path: "/users/:id",
      operationId: "getUser",
      sourceLocation: { path: "src/controllers/UserController.ts", line: 12 },
      params: paramsSchema,
      query: querySchema,
      response: userSchema,
    });

    const routes = extractRouteIR(UsersController);

    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({
      path: "/users/:id",
      routeContract: {
        id: "users.get",
        method: "GET",
        path: "/users/:id",
        operationId: "getUser",
        sourceLocation: { path: "src/controllers/UserController.ts", line: 12 },
      },
    });
    expect(routes[0]?.inputSchemas.path).toBe(paramsSchema);
    expect(routes[0]?.inputSchemas.query).toBe(querySchema);
    expect((routes[0]?.inputSchemas.headers as z.ZodObject<any>).shape["x-tenant-id"]).toBe(
      tenantIdSchema,
    );
    expect(routes[0]?.outputSchema).toBe(userSchema);
    expect(routes[0]?.params).toEqual([
      { kind: "path", name: "id", schema: userIdSchema },
      { kind: "query", name: "includePosts", schema: includePostsSchema },
      { kind: "header", name: "x-tenant-id", schema: tenantIdSchema },
    ]);
  });

  it("should set outputSchema to null when response schema metadata is missing", () => {
    @Controller("/users")
    class UsersController {
      @Get("/:id")
      getUser(@Param("id") _id: string): void {}
    }

    const routes = extractRouteIR(UsersController);

    expect(routes).toHaveLength(1);
    expect(routes[0]?.outputSchema).toBeNull();
  });

  it("should extract declared Problem responses with category-derived HTTP status", () => {
    @Controller("/users")
    class UsersController {
      @Get("/:id")
      @ProblemResponse({
        code: "USER_NOT_FOUND",
        category: ProblemCategory.NotFound,
        description: "The user id does not exist.",
        status: 500,
      })
      getUser(@Param("id") _id: string): void {}
    }

    const routes = extractRouteIR(UsersController);

    expect(routes).toHaveLength(1);
    expect(routes[0]?.problemResponses).toEqual([
      {
        code: "USER_NOT_FOUND",
        category: ProblemCategory.NotFound,
        description: "The user id does not exist.",
        status: 404,
      },
    ]);
  });

  it("should return an empty array for a class without route metadata", () => {
    class PlainClass {}

    expect(extractRouteIR(PlainClass)).toEqual([]);
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

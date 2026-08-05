import "reflect-metadata";
import type { AddressInfo } from "node:net";
import { Component, Container, Context, Inject } from "@croco/framework-context";
import { ProblemCategory } from "@croco/problems-core";
import type { RouteIR } from "@croco/protocols-core";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AnyRouter } from "@trpc/server";
import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { TrpcRouteHandlerError, createTrpcRouter } from "../libs/createTrpcRouter";

const REST_CONTROLLER_KEY = Symbol.for("croco:rest:controller");
const REST_ROUTES_KEY = Symbol.for("croco:rest:routes");
const REST_PARAMS_KEY = Symbol.for("croco:rest:params");

type TrpcCaller = {
  readonly [domain: string]: {
    readonly [procedure: string]: (input?: unknown) => Promise<unknown>;
  };
};

type ControllerMetadata = {
  readonly path: string;
  readonly target: Function;
};

type RouteMetadata = {
  readonly method: string;
  readonly path: string;
  readonly methodName: string | symbol;
};

type ParamMetadata = {
  readonly type: string;
  readonly index: number;
  readonly name?: string;
  readonly pipes?: object[];
};

const mocked = vi.hoisted(() => ({
  extractRouteIR: undefined as ((controller: Function) => RouteIR[]) | undefined,
}));

vi.mock("@croco/protocols-core", () => ({
  extractRouteIR: (controller: Function) => mocked.extractRouteIR?.(controller) ?? [],
}));

describe("createTrpcRouter", () => {
  beforeEach(() => {
    mocked.extractRouteIR = extractTestRouteIR;
  });

  afterEach(() => {
    mocked.extractRouteIR = undefined;
  });

  it("should expose GET routes as queries", async () => {
    @Controller("/users")
    class UserController {
      @Get("/")
      listUsers(): { users: string[] } {
        return { users: ["Ada"] };
      }
    }

    const router = createTrpcRouter([UserController]);
    const caller = createCaller(router);

    expect(getProcedureType(router, "user", "listUsers")).toBe("query");
    await expect(caller.user.listUsers()).resolves.toEqual({ users: ["Ada"] });
  });

  it("should expose POST routes as mutations", async () => {
    @Controller("/orders")
    class OrderController {
      @Post("/")
      createOrder(): { id: string } {
        return { id: "order-1" };
      }
    }

    const router = createTrpcRouter([OrderController]);
    const caller = createCaller(router);

    expect(getProcedureType(router, "order", "createOrder")).toBe("mutation");
    await expect(caller.order.createOrder()).resolves.toEqual({ id: "order-1" });
  });

  it("should apply input and output schemas to procedures", async () => {
    const createUserSchema = z.object({ name: z.string().min(1) });
    const userSchema = z.object({ id: z.string(), name: z.string() });

    @Controller("/users")
    class UserController {
      @Post("/")
      createUser(
        @Body(createUserSchema) input: z.infer<typeof createUserSchema>,
      ): z.infer<typeof userSchema> {
        return { id: "user-1", name: input.name };
      }
    }

    mocked.extractRouteIR = () => [
      {
        controllerName: "UserController",
        methodName: "createUser",
        httpMethod: "POST",
        path: "/users",
        routeContract: null,
        params: [{ index: 0, kind: "body", name: "", schema: createUserSchema }],
        inputSchema: createUserSchema,
        inputSchemas: { body: createUserSchema, path: null, query: null, headers: null },
        outputSchema: userSchema,
        domain: null,
      },
    ];

    const router = createTrpcRouter([UserController]);
    const caller = createCaller(router);

    await expect(caller.user.createUser({ name: "Grace" })).resolves.toEqual({
      id: "user-1",
      name: "Grace",
    });
    await expect(caller.user.createUser({ name: "" })).rejects.toThrow();
  });

  it("should resolve body, path, query, header, and context parameters at their declared positions", async () => {
    const bodySchema = z.object({ name: z.string() });
    const pathSchema = z.object({ id: z.string().uuid() });
    const querySchema = z.object({ includeArchived: z.boolean() });
    const headersSchema = z.object({ "x-tenant-id": z.string().min(1) });
    const context = { requestId: "request-1" };

    class UserController {
      resolve(
        body: z.infer<typeof bodySchema>,
        skipped: undefined,
        id: string,
        includeArchived: boolean,
        tenantId: string,
        receivedContext: unknown,
      ) {
        return { body, skipped, id, includeArchived, tenantId, receivedContext };
      }
    }

    mocked.extractRouteIR = () => [
      {
        controllerName: "UserController",
        methodName: "resolve",
        httpMethod: "POST",
        path: "/users/:id",
        routeContract: null,
        params: [
          { index: 0, kind: "body", name: "", schema: bodySchema },
          { index: 2, kind: "path", name: "id", schema: pathSchema.shape.id },
          {
            index: 3,
            kind: "query",
            name: "includeArchived",
            schema: querySchema.shape.includeArchived,
          },
          {
            index: 4,
            kind: "header",
            name: "x-tenant-id",
            schema: headersSchema.shape["x-tenant-id"],
          },
          { index: 5, kind: "ctx", name: "", schema: null },
        ],
        inputSchema: bodySchema,
        inputSchemas: {
          body: bodySchema,
          path: pathSchema,
          query: querySchema,
          headers: headersSchema,
        },
        outputSchema: null,
        domain: null,
      },
    ];

    const router = createTrpcRouter([UserController]);
    const caller = createCaller(router, context);
    const input = {
      body: { name: "Grace" },
      path: { id: "123e4567-e89b-12d3-a456-426614174000" },
      query: { includeArchived: true },
      headers: { "x-tenant-id": "tenant-1" },
    };

    await expect(caller.user.resolve(input)).resolves.toEqual({
      body: { name: "Grace" },
      id: "123e4567-e89b-12d3-a456-426614174000",
      includeArchived: true,
      receivedContext: context,
      tenantId: "tenant-1",
    });
    await expect(
      caller.user.resolve({ ...input, path: { id: "not-a-uuid" } }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("should preserve schema-less bodies and normalize omitted optional locations", async () => {
    const querySchema = z.object({ page: z.coerce.number().catch(1) });

    class UserController {
      list(body: unknown, page: number) {
        return { body, page };
      }
    }

    mocked.extractRouteIR = () => [
      {
        controllerName: "UserController",
        methodName: "list",
        httpMethod: "POST",
        path: "/users",
        routeContract: null,
        params: [
          { index: 0, kind: "body", name: "", schema: null },
          { index: 1, kind: "query", name: "page", schema: querySchema.shape.page },
        ],
        inputSchema: null,
        inputSchemas: { body: null, path: null, query: querySchema, headers: null },
        outputSchema: null,
        domain: null,
      },
    ];

    const router = createTrpcRouter([UserController]);
    const caller = createCaller(router);

    await expect(caller.user.list({ body: { name: "Grace" } })).resolves.toEqual({
      body: { name: "Grace" },
      page: 1,
    });
    await expect(caller.user.list()).resolves.toEqual({ body: undefined, page: 1 });
    await expect(
      caller.user.list({ body: { name: "Grace" }, query: { page: "2" } }),
    ).resolves.toEqual({
      body: { name: "Grace" },
      page: 2,
    });
  });

  it("should reject duplicate RouteIR parameter indexes before invoking the controller", async () => {
    const handler = vi.fn();
    const pathSchema = z.object({ id: z.string() });
    const querySchema = z.object({ id: z.string() });

    class UserController {
      read(id: string): void {
        handler(id);
      }
    }

    mocked.extractRouteIR = () => [
      {
        controllerName: "UserController",
        methodName: "read",
        httpMethod: "GET",
        path: "/users/:id",
        routeContract: null,
        params: [
          { index: 0, kind: "path", name: "id", schema: pathSchema.shape.id },
          { index: 0, kind: "query", name: "id", schema: querySchema.shape.id },
        ],
        inputSchema: null,
        inputSchemas: { body: null, path: pathSchema, query: querySchema, headers: null },
        outputSchema: null,
        domain: null,
      },
    ];

    const router = createTrpcRouter([UserController]);
    const caller = createCaller(router);
    const request = caller.user.read({ path: { id: "path-id" }, query: { id: "query-id" } });

    await expect(request).rejects.toThrow();

    const error = await captureRejectedValue(request);
    const codedError = error as { readonly cause?: unknown };

    expect(codedError.cause).toMatchObject({
      code: "protocols-trpc/duplicate-parameter-index",
      status: 500,
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("should group controllers by domain namespace", () => {
    @Controller("/users")
    class UserController {
      @Get("/")
      listUsers(): string[] {
        return ["user-1"];
      }
    }

    @Controller("/orders")
    class OrderController {
      @Get("/")
      listOrders(): string[] {
        return ["order-1"];
      }
    }

    const router = createTrpcRouter([UserController, OrderController]);

    expect(router._def.record).toHaveProperty("user");
    expect(router._def.record).toHaveProperty("order");
  });

  it("should expose a coded error when route metadata points at a non-callable handler", async () => {
    class UserController {
      readonly listUsers = "not callable";
    }

    mocked.extractRouteIR = () => [
      {
        controllerName: "UserController",
        methodName: "listUsers",
        httpMethod: "GET",
        path: "/users",
        routeContract: null,
        params: [],
        inputSchema: null,
        inputSchemas: { body: null, path: null, query: null, headers: null },
        outputSchema: null,
        domain: null,
      },
    ];

    const router = createTrpcRouter([UserController]);
    const caller = createCaller(router);
    const request = caller.user.listUsers();

    await expect(request).rejects.toThrow();

    const error = await captureRejectedValue(request);
    const codedError =
      error instanceof TrpcRouteHandlerError
        ? error
        : (error as { readonly cause?: unknown }).cause;

    expect(codedError).toBeInstanceOf(TrpcRouteHandlerError);
    expect(codedError).toMatchObject({
      category: ProblemCategory.InternalServerError,
      code: "protocols-trpc/route-handler-not-callable",
      methodName: "listUsers",
      status: 500,
    });
    expect((codedError as TrpcRouteHandlerError).toJSON()).toMatchObject({
      code: "protocols-trpc/route-handler-not-callable",
      methodName: "listUsers",
      status: 500,
    });
  });

  it("should resolve constructor-injected controllers in isolated concurrent request scopes", async () => {
    let nextStateId = 0;
    let enteredCount = 0;
    let releaseCalls = (): void => undefined;
    const bothCallsEntered = new Promise<void>((resolve) => {
      releaseCalls = resolve;
    });

    @Component({ scope: "request" })
    class RequestState {
      readonly id = ++nextStateId;
    }

    @Component({ scope: "request" })
    @Controller("/scoped")
    class ScopedController {
      constructor(@Inject(() => RequestState) private readonly state: RequestState) {}

      @Get("/")
      async inspect(): Promise<{
        readonly requestId: string | null;
        readonly stateId: number;
        readonly traceId: string | null;
        readonly usesInjectedState: boolean;
      }> {
        enteredCount += 1;
        if (enteredCount === 2) {
          releaseCalls();
        }
        await bothCallsEntered;

        return {
          requestId: Context.getRequestId(),
          stateId: this.state.id,
          traceId: Context.getActiveTraceId(),
          usesInjectedState: Container.get(RequestState) === this.state,
        };
      }
    }

    try {
      const router = createTrpcRouter([ScopedController]);
      const firstCaller = createCaller(router, {
        requestId: "trpc-request-1",
        traceId: "11111111111111111111111111111111",
      });
      const secondCaller = createCaller(router, {
        requestId: "trpc-request-2",
        traceId: "22222222222222222222222222222222",
      });
      const [first, second] = (await Promise.all([
        firstCaller.scoped.inspect(),
        secondCaller.scoped.inspect(),
      ])) as Array<{
        readonly requestId: string;
        readonly stateId: number;
        readonly traceId: string;
        readonly usesInjectedState: boolean;
      }>;

      expect(first).toMatchObject({
        requestId: "trpc-request-1",
        traceId: "11111111111111111111111111111111",
        usesInjectedState: true,
      });
      expect(second).toMatchObject({
        requestId: "trpc-request-2",
        traceId: "22222222222222222222222222222222",
        usesInjectedState: true,
      });
      expect(first?.stateId).not.toBe(second?.stateId);
      expect(Context.isActive()).toBe(false);
    } finally {
      Container.remove(ScopedController);
      Container.remove(RequestState);
    }
  });

  it("should isolate batched HTTP procedures and propagate request headers", async () => {
    let nextStateId = 0;
    let enteredCount = 0;
    let releaseCalls = (): void => undefined;
    const bothCallsEntered = new Promise<void>((resolve) => {
      releaseCalls = resolve;
    });

    @Component({ scope: "request" })
    class RequestState {
      readonly id = ++nextStateId;
    }

    @Component({ scope: "request" })
    @Controller("/batched")
    class BatchedController {
      constructor(@Inject(() => RequestState) private readonly state: RequestState) {}

      @Get("/first")
      first(): Promise<RequestSnapshot> {
        return this.inspect();
      }

      @Get("/second")
      second(): Promise<RequestSnapshot> {
        return this.inspect();
      }

      private async inspect(): Promise<RequestSnapshot> {
        enteredCount += 1;
        if (enteredCount === 2) {
          releaseCalls();
        }
        await bothCallsEntered;

        return {
          requestId: Context.getRequestId(),
          stateId: this.state.id,
          traceId: Context.getActiveTraceId(),
          usesInjectedState: Container.get(RequestState) === this.state,
        };
      }
    }

    const serverErrors: unknown[] = [];
    const router = createTrpcRouter([BatchedController]);
    const server = createHTTPServer({
      router,
      createContext: ({ req }) => ({ req }),
      onError: ({ error }) => serverErrors.push(error),
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const client = createTRPCClient<typeof router>({
      links: [
        httpBatchLink({
          url: `http://127.0.0.1:${getPort(server)}`,
          headers: {
            traceparent: "00-11111111111111111111111111111111-2222222222222222-01",
            "x-request-id": "trpc-batch-request",
          },
        }),
      ],
    }) as unknown as {
      batched: {
        first: { query: () => Promise<RequestSnapshot> };
        second: { query: () => Promise<RequestSnapshot> };
      };
    };

    try {
      let first: RequestSnapshot;
      let second: RequestSnapshot;
      try {
        [first, second] = await Promise.all([
          client.batched.first.query(),
          client.batched.second.query(),
        ]);
      } catch (error) {
        throw serverErrors[0] ?? error;
      }

      expect(first).toMatchObject({
        requestId: "trpc-batch-request",
        traceId: "11111111111111111111111111111111",
        usesInjectedState: true,
      });
      expect(second).toMatchObject({
        requestId: "trpc-batch-request",
        traceId: "11111111111111111111111111111111",
        usesInjectedState: true,
      });
      expect(first.stateId).not.toBe(second.stateId);
      expect(Context.isActive()).toBe(false);
    } finally {
      await closeServer(server);
      Container.remove(BatchedController);
      Container.remove(RequestState);
    }
  });

  it("should map request metadata and reject invalid traceparent values", async () => {
    @Controller("/metadata")
    class MetadataController {
      @Get("/")
      inspect(): { readonly requestId: string | null; readonly traceId: string | null } {
        return {
          requestId: Context.getRequestId(),
          traceId: Context.getActiveTraceId(),
        };
      }
    }

    const customRouter = createTrpcRouter([MetadataController], {
      createRequestContext: () => ({ requestId: "custom-request", traceId: "custom-trace" }),
    });
    const customCaller = createCaller(customRouter, {
      requestId: "ignored-request",
      traceId: "ignored-trace",
    });

    await expect(customCaller.metadata.inspect()).resolves.toEqual({
      requestId: "custom-request",
      traceId: "custom-trace",
    });

    const defaultRouter = createTrpcRouter([MetadataController]);
    const defaultCaller = createCaller(defaultRouter, {
      requestId: "invalid-traceparent",
      request: new Request("http://localhost", {
        headers: {
          traceparent: "ff-11111111111111111111111111111111-2222222222222222-01",
        },
      }),
    });

    await expect(defaultCaller.metadata.inspect()).resolves.toEqual({
      requestId: "invalid-traceparent",
      traceId: null,
    });

    const caseInsensitiveHeaderCaller = createCaller(defaultRouter, {
      req: {
        headers: {
          Traceparent: "00-11111111111111111111111111111111-2222222222222222-01",
          "X-Request-Id": "case-insensitive-request",
        },
      },
    });
    await expect(caseInsensitiveHeaderCaller.metadata.inspect()).resolves.toEqual({
      requestId: "case-insensitive-request",
      traceId: "11111111111111111111111111111111",
    });

    const invalidIdentifiers = [
      "00-00000000000000000000000000000000-2222222222222222-01",
      "00-11111111111111111111111111111111-0000000000000000-01",
    ];
    for (const traceparent of invalidIdentifiers) {
      const caller = createCaller(defaultRouter, {
        requestId: "all-zero-traceparent",
        req: { headers: { traceparent } },
      });

      await expect(caller.metadata.inspect()).resolves.toEqual({
        requestId: "all-zero-traceparent",
        traceId: null,
      });
    }
    expect(Context.isActive()).toBe(false);
  });

  it("should clean up request context after procedure failure", async () => {
    let observedRequestId: string | null = null;

    @Component({ scope: "request" })
    class RequestState {}

    @Component({ scope: "request" })
    @Controller("/failing-scope")
    class FailingScopedController {
      constructor(@Inject(() => RequestState) _state: RequestState) {}

      @Get("/")
      fail(): never {
        observedRequestId = Context.getRequestId();
        throw new Error("request failure");
      }
    }

    try {
      const router = createTrpcRouter([FailingScopedController]);
      const caller = createCaller(router, { requestId: "trpc-failure" });

      await expect(caller.failingScoped.fail()).rejects.toThrow();
      expect(observedRequestId).toBe("trpc-failure");
      expect(Context.isActive()).toBe(false);
    } finally {
      Container.remove(FailingScopedController);
      Container.remove(RequestState);
    }
  });
});

type RequestSnapshot = {
  readonly requestId: string | null;
  readonly stateId: number;
  readonly traceId: string | null;
  readonly usesInjectedState: boolean;
};

function createCaller(router: AnyRouter, context: unknown = {}): TrpcCaller {
  return router.createCaller(context) as TrpcCaller;
}

function getProcedureType(router: AnyRouter, domain: string, procedureName: string): string {
  const namespace = router._def.record[domain] as {
    readonly _def?: { readonly record: Record<string, unknown> };
  } & Record<string, unknown>;
  const procedures = namespace._def?.record ?? namespace;
  const procedure = procedures[procedureName] as { readonly _def: { readonly type: string } };

  return procedure._def.type;
}

async function captureRejectedValue(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }

  expect.fail("Expected promise to reject.");
}

function getPort(server: ReturnType<typeof createHTTPServer>): number {
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new TypeError("tRPC test server address is not available");
  }

  return (address as AddressInfo).port;
}

async function closeServer(server: ReturnType<typeof createHTTPServer>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function extractTestRouteIR(controllerCtor: Function): RouteIR[] {
  const controllerMeta = Reflect.getMetadata(REST_CONTROLLER_KEY, controllerCtor) as
    | ControllerMetadata
    | undefined;
  const routesMeta = Reflect.getMetadata(REST_ROUTES_KEY, controllerCtor) as
    | RouteMetadata[]
    | undefined;

  if (!controllerMeta || !routesMeta) {
    return [];
  }

  return routesMeta.map((routeMeta) => ({
    controllerName: controllerCtor.name,
    methodName: String(routeMeta.methodName),
    httpMethod: routeMeta.method,
    path: `${controllerMeta.path}${routeMeta.path}`,
    routeContract: null,
    params: [],
    inputSchema: null,
    inputSchemas: { body: null, path: null, query: null, headers: null },
    outputSchema: null,
    domain: null,
  }));
}

function Controller(path: string = ""): ClassDecorator {
  return (target: Function) => {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const metadata: ControllerMetadata = {
      path: normalizedPath === "/" ? "" : normalizedPath,
      target,
    };

    Reflect.defineMetadata(REST_CONTROLLER_KEY, metadata, target);
  };
}

function createMethodDecorator(method: string) {
  return (path: string = ""): MethodDecorator => {
    return (target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
      const normalizedPath = path.startsWith("/") ? path : `/${path}`;
      const existingRoutes = (Reflect.getMetadata(REST_ROUTES_KEY, target.constructor) ??
        []) as RouteMetadata[];
      const routeMetadata: RouteMetadata = {
        method,
        path: normalizedPath === "/" ? "" : normalizedPath,
        methodName: propertyKey,
      };

      Reflect.defineMetadata(
        REST_ROUTES_KEY,
        [...existingRoutes, routeMetadata],
        target.constructor,
      );

      return descriptor;
    };
  };
}

const Get = createMethodDecorator("GET");
const Post = createMethodDecorator("POST");

function Body(schema?: z.ZodType): ParameterDecorator {
  return (target: object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    if (!propertyKey) return;

    const existingParams = (Reflect.getMetadata(REST_PARAMS_KEY, target.constructor) ??
      new Map()) as Map<string | symbol, ParamMetadata[]>;
    const methodParams = existingParams.get(propertyKey) ?? [];
    const param: ParamMetadata = {
      type: "body",
      index: parameterIndex,
      pipes: schema ? [new ValidationPipe(schema)] : undefined,
    };

    methodParams.push(param);
    existingParams.set(propertyKey, methodParams);
    Reflect.defineMetadata(REST_PARAMS_KEY, existingParams, target.constructor);
  };
}

class ValidationPipe<T = unknown> {
  constructor(private readonly schema: z.ZodType<T>) {}

  transform(value: unknown): T {
    return this.schema.parse(value);
  }
}

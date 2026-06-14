import "reflect-metadata";
import type { RouteIR } from "@croco/protocols-core";
import type { AnyRouter } from "@trpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createTrpcRouter } from "../libs/createTrpcRouter";

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
        params: [{ kind: "body", name: "", schema: createUserSchema }],
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
});

function createCaller(router: AnyRouter): TrpcCaller {
  return router.createCaller({}) as TrpcCaller;
}

function getProcedureType(router: AnyRouter, domain: string, procedureName: string): string {
  const namespace = router._def.record[domain] as {
    readonly _def?: { readonly record: Record<string, unknown> };
  } & Record<string, unknown>;
  const procedures = namespace._def?.record ?? namespace;
  const procedure = procedures[procedureName] as { readonly _def: { readonly type: string } };

  return procedure._def.type;
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

import "reflect-metadata";
import type { Guard } from "@croco/framework-context";
import { Container } from "@croco/framework-context";
import { Logger } from "@croco/framework-logger";
import { Problem } from "@croco/problems-core";
import {
  type Constructor,
  Controller,
  type ExceptionFilter,
  type ExceptionFilterConstructor,
  type ExceptionFilterResult,
  Get,
  type GuardConstructor,
  Head,
  type Interceptor,
  type InterceptorConstructor,
  Param,
  Post,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from "@croco/protocols-rest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorHandler } from "../libs/ErrorHandler";
import { PipelineRunner } from "../libs/PipelineRunner";
import { RouteCompiler } from "../libs/RouteCompiler";
import type { CrocoHttpContext } from "../libs/types";

function createMockHttpContext(): CrocoHttpContext {
  const request = new Request("http://localhost/secured/resource");

  return {
    req: {
      method: "GET",
      url: request.url,
      path: "/secured/resource",
      params: {},
      query: {},
      headers: {},
    },
    res: {
      status: 200,
      headers: {},
    },
    raw: {
      req: {
        raw: request,
      },
    } as CrocoHttpContext["raw"],
    param: vi.fn(),
    query: vi.fn(),
    header: vi.fn(),
    json: vi.fn(),
    set: vi.fn(),
    get: vi.fn(),
    text: vi
      .fn()
      .mockImplementation((body: string, status: number = 200) => new Response(body, { status })),
    jsonResponse: vi
      .fn()
      .mockImplementation(
        (body: unknown, status: number = 200) => new Response(JSON.stringify(body), { status }),
      ),
    redirect: vi
      .fn()
      .mockImplementation((url: string, status: number = 302) => Response.redirect(url, status)),
  };
}

function expectDuplicateRouteProblem(error: unknown): Problem {
  expect(error).toBeInstanceOf(Problem);
  const problem = error as Problem;
  expect(problem.code).toBe("transports-http/duplicate-route-definition");
  return problem;
}

describe("RouteCompiler", () => {
  function createCompiler(): RouteCompiler {
    const logger = Container.get(Logger);
    const errorHandler = Container.get(ErrorHandler);
    return new RouteCompiler(logger, new PipelineRunner(errorHandler));
  }

  beforeEach(() => {
    Container.reset();
    const logger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      fatal: vi.fn(),
      child: () => logger,
    } as unknown as Logger;

    Container.set(Logger, logger);
    Container.set(ErrorHandler, new ErrorHandler(logger));
  });

  it("should compile routes from controller", () => {
    @Controller("/users")
    class UserController {
      @Get()
      list() {
        return [];
      }

      @Get("/:id")
      getById(@Param("id") id: string) {
        return { id };
      }

      @Post()
      create() {
        return { created: true };
      }
    }

    const compiler = createCompiler();
    const routes = compiler.compile([UserController]);

    expect(routes).toHaveLength(3);
    expect(routes[0].path).toBe("/users");
    expect(routes[0].method).toBe("GET");
    expect(routes[1].path).toBe("/users/:id");
    expect(routes[2].method).toBe("POST");
  });

  it("should compile catch-all paths with stable parameter names", () => {
    @Controller("/assets")
    class AssetsController {
      @Get("/:...path")
      getAsset(@Param("path") path: string) {
        return { path };
      }

      @Get("/items/:id")
      getItem(@Param("id") id: string) {
        return { id };
      }
    }

    @Controller()
    class RootAssetsController {
      @Get("/:...path")
      getAsset(@Param("path") path: string) {
        return { path };
      }
    }

    const routes = createCompiler().compile([AssetsController, RootAssetsController]);

    expect(routes.map((route) => route.path)).toEqual([
      "/assets/:path{.+}",
      "/assets/items/:id",
      "/:path{.+}",
    ]);
  });

  it("should skip non-controller classes", () => {
    class NotAController {
      @Get()
      test() {}
    }

    const compiler = createCompiler();
    const routes = compiler.compile([NotAController]);

    expect(routes).toHaveLength(0);
  });

  it("BUG-03 라우트 레벨 가드가 DI로 인스턴스화", async () => {
    class GuardDependency {
      readonly allowed = true;
    }

    class RouteLevelGuard implements Guard {
      constructor(private readonly dependency: GuardDependency) {}

      canActivate() {
        return this.dependency.allowed;
      }
    }

    class RouteLevelInterceptor implements Interceptor {
      constructor(private readonly dependency: GuardDependency) {}

      async intercept(_context: unknown, next: { handle(): Promise<unknown> }) {
        if (!this.dependency.allowed) {
          throw new TypeError("interceptor dependency missing");
        }
        return next.handle();
      }
    }

    class RouteLevelFilter implements ExceptionFilter {
      constructor(private readonly dependency: GuardDependency) {}

      catch(exception: unknown): ExceptionFilterResult {
        if (!this.dependency.allowed) {
          throw exception;
        }
        return undefined;
      }
    }

    const RouteLevelGuardCtor = RouteLevelGuard as unknown as GuardConstructor;
    const RouteLevelInterceptorCtor = RouteLevelInterceptor as unknown as InterceptorConstructor;
    const RouteLevelFilterCtor = RouteLevelFilter as unknown as ExceptionFilterConstructor;

    @Controller("/secured")
    class SecuredController {
      @Get("/resource")
      @UseFilters(RouteLevelFilterCtor)
      @UseInterceptors(RouteLevelInterceptorCtor)
      @UseGuards(RouteLevelGuardCtor)
      getResource() {
        return { ok: true };
      }
    }

    const dependency = new GuardDependency();
    const requestedTypes: Constructor[] = [];
    const container = {
      get<T>(type: Constructor<T>): T {
        requestedTypes.push(type as Constructor);

        if (type === SecuredController) {
          return new SecuredController() as T;
        }

        if (type === RouteLevelGuard) {
          return new RouteLevelGuard(dependency) as T;
        }

        if (type === RouteLevelInterceptor) {
          return new RouteLevelInterceptor(dependency) as T;
        }

        if (type === RouteLevelFilter) {
          return new RouteLevelFilter(dependency) as T;
        }

        return dependency as T;
      },
    };

    const compiler = createCompiler();
    const [route] = compiler.compile([SecuredController], {
      container,
    });

    const firstResult = await route.handler(createMockHttpContext());
    const secondResult = await route.handler(createMockHttpContext());

    expect(firstResult).toEqual({ ok: true });
    expect(secondResult).toEqual({ ok: true });
    expect(requestedTypes.filter((type) => type === SecuredController)).toHaveLength(2);
    expect(requestedTypes.filter((type) => type === RouteLevelGuard)).toHaveLength(2);
    expect(requestedTypes.filter((type) => type === RouteLevelInterceptor)).toHaveLength(2);
    expect(requestedTypes.filter((type) => type === RouteLevelFilter)).toHaveLength(2);
  });

  it("should fail fast when a provider cannot be resolved in container mode", async () => {
    class GuardDependency {
      readonly allowed = true;
    }

    class RouteLevelGuard implements Guard {
      constructor(private readonly dependency: GuardDependency) {}

      canActivate() {
        return this.dependency.allowed;
      }
    }

    const RouteLevelGuardCtor = RouteLevelGuard as unknown as GuardConstructor;

    @Controller("/secured")
    class SecuredController {
      @Get("/resource")
      @UseGuards(RouteLevelGuardCtor)
      getResource() {
        return { ok: true };
      }
    }

    const container = {
      get<T>(type: Constructor<T>): T {
        if (type === SecuredController) {
          return new SecuredController() as T;
        }

        return undefined as T;
      },
    };

    const compiler = createCompiler();
    const [route] = compiler.compile([SecuredController], {
      container,
    });

    await expect(route.handler(createMockHttpContext())).rejects.toThrow(
      "Container did not return an instance for provider RouteLevelGuard",
    );
  });

  it("should fail fast when duplicate routes resolve to the same method and path", () => {
    @Controller("/users")
    class DuplicateRouteController {
      @Get("/:id")
      getById() {
        return { ok: true };
      }

      @Get(":id")
      getByIdWithoutLeadingSlash() {
        return { ok: true };
      }
    }

    const compiler = createCompiler();

    let thrown: unknown;
    try {
      compiler.compile([DuplicateRouteController]);
    } catch (error) {
      thrown = error;
    }

    const problem = expectDuplicateRouteProblem(thrown);
    expect(problem.detail).toContain("Duplicate route definition detected for GET /users/:id.");
    expect(problem.detail).toContain(
      "Existing route: DuplicateRouteController.getById (GET /users/:id)",
    );
    expect(problem.detail).toContain(
      "Conflicting route: DuplicateRouteController.getByIdWithoutLeadingSlash (GET /users/:id)",
    );
    expect(problem.detail).toContain(
      "Recovery: give one route decorator a unique HTTP method or path before starting the HTTP transport.",
    );
    expect(problem.detail).toMatch(
      /DuplicateRouteController\.getById \(GET \/users\/:id\) at .*RouteCompiler\.spec\.ts:\d+:\d+/,
    );
    expect(problem.detail).toMatch(
      /DuplicateRouteController\.getByIdWithoutLeadingSlash \(GET \/users\/:id\) at .*RouteCompiler\.spec\.ts:\d+:\d+/,
    );
  });

  it("should allow GET and explicit HEAD handlers on the same path", () => {
    @Controller("/head-policy")
    class HeadPolicyController {
      @Get("/resource")
      getResource() {
        return { method: "GET" };
      }

      @Head("/resource")
      headResource() {
        return new Response(null, {
          headers: {
            "x-route-method": "HEAD",
          },
        });
      }
    }

    const compiler = createCompiler();
    const routes = compiler.compile([HeadPolicyController]);
    const methods = routes.map((route) => `${route.method} ${route.path}`).sort();

    expect(methods).toEqual(["GET /head-policy/resource", "HEAD /head-policy/resource"]);
  });

  it("should fail fast when duplicate explicit HEAD routes resolve to the same path", () => {
    @Controller("/head-policy")
    class DuplicateHeadController {
      @Head("/resource")
      first() {
        return new Response(null);
      }

      @Head("/resource")
      second() {
        return new Response(null);
      }
    }

    const compiler = createCompiler();

    let thrown: unknown;
    try {
      compiler.compile([DuplicateHeadController]);
    } catch (error) {
      thrown = error;
    }

    const problem = expectDuplicateRouteProblem(thrown);
    expect(problem.detail).toContain(
      "Duplicate route definition detected for HEAD /head-policy/resource.",
    );
  });

  it("should fail fast when duplicate routes are contributed by different controllers", () => {
    @Controller("/users")
    class FirstController {
      @Get("/:id")
      first() {
        return { ok: true };
      }
    }

    @Controller("/users")
    class SecondController {
      @Get("/:id")
      second() {
        return { ok: true };
      }
    }

    const compiler = createCompiler();

    let thrown: unknown;
    try {
      compiler.compile([FirstController, SecondController]);
    } catch (error) {
      thrown = error;
    }

    const problem = expectDuplicateRouteProblem(thrown);
    expect(problem.detail).toContain("Duplicate route definition detected for GET /users/:id.");
    expect(problem.detail).toContain("Existing route: FirstController.first (GET /users/:id)");
    expect(problem.detail).toContain("Conflicting route: SecondController.second (GET /users/:id)");
    expect(problem.detail).toContain(
      "Recovery: give one route decorator a unique HTTP method or path before starting the HTTP transport.",
    );
    expect(problem.detail).toMatch(
      /FirstController\.first \(GET \/users\/:id\) at .*RouteCompiler\.spec\.ts:\d+:\d+/,
    );
    expect(problem.detail).toMatch(
      /SecondController\.second \(GET \/users\/:id\) at .*RouteCompiler\.spec\.ts:\d+:\d+/,
    );
  });

  it("injects authenticated user, principal, and apiKey into controller handler parameters through route pipeline", async () => {
    const REST_PARAMS_KEY = Symbol.for("croco:rest:params");
    function createAuthDecorator(type: "user" | "principal" | "apikey"): ParameterDecorator {
      return (target: object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
        if (!propertyKey) return;
        const targetConstructor = target.constructor;
        const existingParams: Map<string | symbol, unknown[]> =
          Reflect.getOwnMetadata(REST_PARAMS_KEY, targetConstructor) ?? new Map();
        const methodParams = existingParams.get(propertyKey) ?? [];
        existingParams.set(propertyKey, [
          ...methodParams,
          {
            type,
            index: parameterIndex,
            name: undefined,
          },
        ]);
        Reflect.defineMetadata(REST_PARAMS_KEY, existingParams, targetConstructor);
      };
    }

    const MockUser = (): ParameterDecorator => createAuthDecorator("user");
    const MockCurrentPrincipal = (): ParameterDecorator => createAuthDecorator("principal");
    const MockCurrentApiKey = (): ParameterDecorator => createAuthDecorator("apikey");

    const expectedUser = { id: "user_from_guard", email: "guard@croco.dev" };
    const expectedPrincipal = { id: "principal_from_guard", type: "user" as const };
    const expectedApiKey = { key: "croco_guard_key_123" };

    class AuthInjectingGuard implements Guard {
      canActivate(context: { getRequest: () => Request }) {
        const request = context.getRequest() as Request & {
          user?: unknown;
          principal?: unknown;
          apiKey?: unknown;
        };
        request.user = expectedUser;
        request.principal = expectedPrincipal;
        request.apiKey = expectedApiKey;
        return true;
      }
    }

    @Controller("/auth-pipeline")
    class AuthPipelineController {
      @Get("/profile")
      @UseGuards(AuthInjectingGuard as unknown as GuardConstructor)
      getProfile(
        @MockUser() user: unknown,
        @MockCurrentPrincipal() principal: unknown,
        @MockCurrentApiKey() apiKey: unknown,
      ) {
        return { user, principal, apiKey };
      }
    }

    const compiler = createCompiler();
    const [route] = compiler.compile([AuthPipelineController]);

    const ctx = createMockHttpContext();
    const result = await route.handler(ctx);

    expect(result).toEqual({
      user: expectedUser,
      principal: expectedPrincipal,
      apiKey: expectedApiKey,
    });
  });
});

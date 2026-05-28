import "reflect-metadata";
import type { Guard } from "@croco/framework-context";
import { Container } from "@croco/framework-context";
import { Logger } from "@croco/framework-logger";
import {
  type Constructor,
  Controller,
  type ExceptionFilter,
  type ExceptionFilterConstructor,
  Get,
  type GuardConstructor,
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

      catch(exception: unknown) {
        if (!this.dependency.allowed) {
          throw exception;
        }
        return exception;
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

    expect(() => {
      compiler.compile([DuplicateRouteController]);
    }).toThrow("Duplicate route detected for GET /users/:id");
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

    expect(() => {
      compiler.compile([FirstController, SecondController]);
    }).toThrow("Duplicate route detected for GET /users/:id");
  });
});

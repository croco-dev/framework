import "reflect-metadata";
import { extractRouteIR } from "@croco/protocols-core";
import { Controller, Delete, Get, Post, Put } from "@croco/protocols-rest";
import { beforeEach, describe, expect, it } from "vitest";
import type { CompiledController } from "../compiler";
import { generateModule, generateRouteRegistrationCode } from "../compiler";

type RuntimeRoutePair = {
  readonly method: string;
  readonly path: string;
};

type ControllerFixture = readonly [ctor: new () => unknown, basePath: string];

type RouteMetadataShape = {
  readonly method: string;
  readonly path: string;
  readonly methodName: string | symbol;
};

const routesKey = Symbol.for("croco:rest:routes");

@Controller("/api")
class UserController {
  @Get("/users")
  listUsers(): void {}

  @Post("/users")
  createUser(): void {}

  @Get("/users/:id")
  getUser(): void {}

  @Put("/users/:id")
  updateUser(): void {}

  @Delete("/users/:id")
  deleteUser(): void {}
}

@Controller("/v2")
class V2Controller {
  @Get("/items")
  listItems(): void {}

  @Post("/items/:slug")
  createItem(): void {}
}

@Controller("")
class HealthController {
  @Get("/health")
  check(): void {}
}

const controllers: readonly ControllerFixture[] = [
  [UserController, "/api"],
  [V2Controller, "/v2"],
  [HealthController, ""],
];

function readCompiledControllers(fixtures: readonly ControllerFixture[]): CompiledController[] {
  return fixtures.map(([ctor, basePath]) => {
    const routesMeta = (Reflect.getMetadata(routesKey, ctor) ?? []) as RouteMetadataShape[];

    return {
      basePath,
      className: ctor.name,
      routes: routesMeta.map((route) => ({
        method: route.method,
        path: route.path,
        handlerName: String(route.methodName),
      })),
    };
  });
}

function toRuntimeRoutes(fixtures: readonly ControllerFixture[]): RuntimeRoutePair[] {
  return fixtures.flatMap(([ctor]) =>
    extractRouteIR(ctor).map((route) => ({ method: route.httpMethod, path: route.path })),
  );
}

describe("build-time vs runtime route equivalence", () => {
  let runtimeRoutes: RuntimeRoutePair[];
  let buildTimeControllers: CompiledController[];

  beforeEach(() => {
    runtimeRoutes = toRuntimeRoutes(controllers);
    buildTimeControllers = readCompiledControllers(controllers);
  });

  it("produces the same number of routes", () => {
    const buildCount = buildTimeControllers.reduce(
      (sum, controller) => sum + controller.routes.length,
      0,
    );

    expect(buildCount).toBe(runtimeRoutes.length);
  });

  it("generates matching route method and path pairs for all controllers", () => {
    const buildPairs = buildTimeControllers.flatMap((controller) =>
      controller.routes.map((route) => `${route.method} ${controller.basePath}${route.path}`),
    );
    const runtimePairs = runtimeRoutes.map((route) => `${route.method} ${route.path}`);

    expect([...buildPairs].sort()).toEqual([...runtimePairs].sort());
  });

  it("generates registration code with matching route method and path pairs", () => {
    const code = generateRouteRegistrationCode(buildTimeControllers);

    for (const routeCall of [
      "app.get('/api/users'",
      "app.post('/api/users'",
      "app.get('/api/users/:id'",
      "app.put('/api/users/:id'",
      "app.delete('/api/users/:id'",
      "app.get('/v2/items'",
      "app.post('/v2/items/:slug'",
      "app.get('/health'",
    ]) {
      expect(code).toContain(routeCall);
    }
  });

  it("handles empty controller lists gracefully", () => {
    const code = generateModule([]);

    expect(code).toContain("function registerRoutes");
    expect(code).not.toContain("app.get");
  });
});

import "reflect-metadata";
import { extractRouteIR } from "@croco/protocols-core";
import { All, Controller, Delete, Get, Post, Put } from "@croco/protocols-rest";
import { beforeEach, describe, expect, it } from "vitest";
import type { CompiledController } from "../compiler";
import {
  createRouteRegistrationTable,
  generateModule,
  generateRouteRegistrationCode,
} from "../compiler";

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
  @All("/any")
  handleAny(): void {}

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

@Controller("/cdn")
class CatchAllController {
  @Get("/assets/:...path")
  getAsset(): void {}

  @Get("/items/:id")
  getItem(): void {}
}

@Controller("")
class RootCatchAllController {
  @Get("/:...path")
  getRootAsset(): void {}
}

const controllers: readonly ControllerFixture[] = [
  [UserController, "/api"],
  [V2Controller, "/v2"],
  [HealthController, ""],
  [CatchAllController, "/cdn"],
  [RootCatchAllController, ""],
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

  it("generates an explicit registration table with matching route method and path pairs", () => {
    const table = createRouteRegistrationTable(buildTimeControllers);
    const tablePairs = table.entries.map(
      (entry) => `${entry.method} ${entry.contractPath ?? entry.path}`,
    );

    expect([...tablePairs].sort()).toEqual([
      "ALL /api/any",
      "DELETE /api/users/:id",
      "GET /:...path",
      "GET /api/users",
      "GET /api/users/:id",
      "GET /cdn/assets/:...path",
      "GET /cdn/items/:id",
      "GET /health",
      "GET /v2/items",
      "POST /api/users",
      "POST /v2/items/:slug",
      "PUT /api/users/:id",
    ]);

    expect(table.entries.map((entry) => `${entry.method} ${entry.path}`).sort()).toEqual([
      "ALL /api/any",
      "DELETE /api/users/:id",
      "GET /:path{.+}",
      "GET /api/users",
      "GET /api/users/:id",
      "GET /cdn/assets/:path{.+}",
      "GET /cdn/items/:id",
      "GET /health",
      "GET /v2/items",
      "POST /api/users",
      "POST /v2/items/:slug",
      "PUT /api/users/:id",
    ]);

    const code = generateRouteRegistrationCode(buildTimeControllers);

    expect(code).toContain("routeRegistrationTable");
    expect(code).toContain('"path": "/api/users"');
    expect(code).toContain('"path": "/api/users/:id"');
    expect(code).toContain('"path": "/v2/items/:slug"');
    expect(code).toContain('"path": "/health"');
    expect(code).toContain('"path": "/cdn/assets/:path{.+}"');
    expect(code).toContain('"contractPath": "/cdn/assets/:...path"');
  });

  it("handles empty controller lists gracefully", () => {
    const code = generateModule([]);

    expect(code).toContain("function registerRoutes");
    expect(code).toContain("Object.freeze([])");
  });
});

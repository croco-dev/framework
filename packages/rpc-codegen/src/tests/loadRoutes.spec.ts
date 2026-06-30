import "reflect-metadata";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadContractGraph, loadRoutes } from "../libs/loadRoutes";

let tempRoot!: string;
let sourceDir!: string;

const LOAD_ROUTES_TIMEOUT_MS = 120_000;

describe("loadRoutes", () => {
  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rpc-load-routes-"));
    sourceDir = path.join(tempRoot, "src");
    fs.mkdirSync(sourceDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it(
    "extracts exported controllers while ignoring co-located helper classes",
    async () => {
      fs.writeFileSync(path.join(sourceDir, "UsersController.ts"), getMixedControllerSource());

      const routes = await loadRoutes(path.join(sourceDir, "*.ts"));

      expect(routes).toHaveLength(1);
      expect(routes[0]).toMatchObject({
        controllerName: "UsersController",
        methodName: "listUsers",
        httpMethod: "GET",
        path: "/users",
      });
    },
    LOAD_ROUTES_TIMEOUT_MS,
  );

  it(
    "loads the canonical contract graph for exported controllers",
    async () => {
      fs.writeFileSync(path.join(sourceDir, "UsersController.ts"), getMixedControllerSource());

      const graph = await loadContractGraph(path.join(sourceDir, "*.ts"));

      expect(graph.controllers).toEqual([
        {
          name: "UsersController",
          path: "/users",
          guards: [],
          roles: [],
          routeIds: ["UsersController.listUsers"],
        },
      ]);
      expect(graph.routes[0]).toMatchObject({
        routeId: "UsersController.listUsers",
        operationId: "UsersController_listUsers",
        path: "/users",
      });
      expect(graph.diagnostics).toEqual([]);
    },
    LOAD_ROUTES_TIMEOUT_MS,
  );

  it(
    "maps emitted decorator source locations back to the original controller file",
    async () => {
      const controllerPath = path.join(sourceDir, "WeakSchemaController.ts");

      fs.writeFileSync(controllerPath, getWeakSchemaControllerSource());

      const graph = await loadContractGraph(path.join(sourceDir, "*.ts"), { strictSchemas: true });
      const paramDiagnostic = graph.diagnostics.find(
        (diagnostic) => diagnostic.code === "contract-route-missing-named-param-schema",
      );

      expect(paramDiagnostic?.sourceLocation?.path).toBe(controllerPath);
      expect(paramDiagnostic?.sourceLocation?.path).not.toContain(".croco-rpc-codegen-");
      expect(paramDiagnostic?.sourceLocation?.line).toEqual(expect.any(Number));
      expect(paramDiagnostic?.sourceLocation?.column).toEqual(expect.any(Number));
    },
    LOAD_ROUTES_TIMEOUT_MS,
  );

  it(
    "keeps emitted decorator source locations scoped to each source file",
    async () => {
      const firstDir = path.join(sourceDir, "first");
      const secondDir = path.join(sourceDir, "second");
      const firstControllerPath = path.join(firstDir, "DuplicateController.ts");
      const secondControllerPath = path.join(secondDir, "DuplicateController.ts");

      fs.mkdirSync(firstDir, { recursive: true });
      fs.mkdirSync(secondDir, { recursive: true });
      fs.writeFileSync(firstControllerPath, getDuplicateControllerSource("/first"));
      fs.writeFileSync(secondControllerPath, getDuplicateControllerSource("/second"));

      const routes = await loadRoutes(path.join(sourceDir, "**/*.ts"));
      const sourceLocationByPath = new Map(
        routes.map((route) => [route.path, route.sourceLocation?.path]),
      );

      expect(sourceLocationByPath.get("/first")).toBe(firstControllerPath);
      expect(sourceLocationByPath.get("/second")).toBe(secondControllerPath);
    },
    LOAD_ROUTES_TIMEOUT_MS,
  );

  it(
    "resolves controller imports from the nearest project node_modules",
    async () => {
      writeProtocolsRestFixture(tempRoot);
      fs.writeFileSync(
        path.join(sourceDir, "ImportedController.ts"),
        getImportedControllerSource(),
      );

      const routes = await loadRoutes(path.join(sourceDir, "*.ts"));

      expect(routes).toHaveLength(1);
      expect(routes[0]).toMatchObject({
        controllerName: "ImportedController",
        methodName: "list",
        httpMethod: "GET",
        path: "/imported",
      });
    },
    LOAD_ROUTES_TIMEOUT_MS,
  );

  it(
    "preserves local imports outside the controller glob during contract loading",
    async () => {
      const controllersDir = path.join(sourceDir, "controllers");

      fs.mkdirSync(controllersDir, { recursive: true });
      fs.writeFileSync(path.join(sourceDir, "ImportedUserDto.ts"), getLocalSupportSource());
      fs.writeFileSync(
        path.join(controllersDir, "LocalImportController.ts"),
        getControllerImportingLocalSupportSource(),
      );

      const routes = await loadRoutes(path.join(controllersDir, "*.ts"));

      expect(routes).toHaveLength(1);
      expect(routes[0]).toMatchObject({
        controllerName: "LocalImportController",
        methodName: "list",
        httpMethod: "GET",
        path: "/local-imports",
      });
    },
    LOAD_ROUTES_TIMEOUT_MS,
  );

  it(
    "fails before importing emitted controllers when controller TypeScript has errors",
    async () => {
      const controllerPath = path.join(sourceDir, "BrokenController.ts");
      fs.writeFileSync(controllerPath, getBrokenControllerSource());

      await expectControllerTypeScriptDiagnostics(
        loadRoutes(path.join(sourceDir, "*.ts")),
        controllerPath,
        "rpc-codegen/controller-typescript-diagnostics",
      );
    },
    LOAD_ROUTES_TIMEOUT_MS,
  );

  it(
    "fails clearly when matched files export no controllers",
    async () => {
      fs.writeFileSync(path.join(sourceDir, "Helper.ts"), "export class Helper {}\n");

      await expectNoRestControllersFound(loadRoutes(path.join(sourceDir, "*.ts")));
    },
    LOAD_ROUTES_TIMEOUT_MS,
  );

  it(
    "fails clearly when no files match the controller glob",
    async () => {
      await expectNoRestControllersFound(loadRoutes(path.join(sourceDir, "*.ts")));
    },
    LOAD_ROUTES_TIMEOUT_MS,
  );
});

async function expectNoRestControllersFound(result: Promise<unknown>): Promise<void> {
  await expect(result).rejects.toMatchObject({
    code: "rpc-codegen/no-rest-controllers-found",
    detail: expect.stringContaining("No exported REST controllers found"),
    status: 400,
    title: "Bad Request",
    type: "about:blank",
  });
}

async function expectControllerTypeScriptDiagnostics(
  result: Promise<unknown>,
  controllerPath: string,
  code: string,
): Promise<void> {
  try {
    await result;
  } catch (error) {
    expect(error).toMatchObject({
      code,
      status: 422,
      title: "Validation Error",
      extensions: {
        crocoCode: "CROCO_BUILD_003",
        diagnostics: [
          expect.objectContaining({
            crocoCode: "CROCO_BUILD_003",
            tsCode: "TS2322",
            file: controllerPath,
            line: expect.any(Number),
            column: expect.any(Number),
          }),
        ],
      },
    });
    expect(error).toMatchObject({
      detail: expect.stringContaining("CROCO_BUILD_003 TS2322"),
    });
    expect(error).toMatchObject({
      detail: expect.stringMatching(/BrokenController\.ts:\d+:\d+/),
    });
    return;
  }

  throw new Error("Expected controller TypeScript diagnostics to reject contract loading.");
}

function writeProtocolsRestFixture(projectDir: string): void {
  const packageDir = path.join(projectDir, "node_modules", "@croco", "protocols-rest");

  fs.mkdirSync(packageDir, { recursive: true });
  fs.writeFileSync(
    path.join(packageDir, "package.json"),
    JSON.stringify({ name: "@croco/protocols-rest", main: "index.js" }),
  );
  fs.writeFileSync(path.join(packageDir, "index.js"), getProtocolsRestFixtureSource());
  fs.writeFileSync(path.join(packageDir, "index.d.ts"), getProtocolsRestFixtureTypes());
}

function getImportedControllerSource(): string {
  return `import { Controller, Get } from '@croco/protocols-rest';

@Controller('/imported')
export class ImportedController {
  @Get('/')
  list() {
    return [];
  }
}
`;
}

function getLocalSupportSource(): string {
  return `export class ImportedUserDto {
  readonly id = 'user-1';
}
`;
}

function getControllerImportingLocalSupportSource(): string {
  return `import 'reflect-metadata';
import { ImportedUserDto } from '../ImportedUserDto';

const REST_CONTROLLER_KEY = Symbol.for('croco:rest:controller');
const REST_ROUTES_KEY = Symbol.for('croco:rest:routes');

declare namespace Reflect {
  function defineMetadata(metadataKey: unknown, metadataValue: unknown, target: object): void;
  function getMetadata(metadataKey: unknown, target: object): unknown;
}

type RouteMetadata = {
  readonly method: string;
  readonly path: string;
  readonly methodName: string | symbol;
};

function Controller(controllerPath: string): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(REST_CONTROLLER_KEY, { path: controllerPath, target }, target);
  };
}

function Get(routePath: string): MethodDecorator {
  return (target, propertyKey) => {
    const ctor = target.constructor;
    const routes = (Reflect.getMetadata(REST_ROUTES_KEY, ctor) as RouteMetadata[] | undefined) ?? [];

    Reflect.defineMetadata(REST_ROUTES_KEY, [...routes, { method: 'GET', path: routePath, methodName: propertyKey }], ctor);
  };
}

@Controller('/local-imports')
export class LocalImportController {
  @Get('/')
  list() {
    return [new ImportedUserDto()];
  }
}
`;
}

function getProtocolsRestFixtureSource(): string {
  return `const REST_CONTROLLER_KEY = Symbol.for('croco:rest:controller');
const REST_ROUTES_KEY = Symbol.for('croco:rest:routes');

exports.Controller = function Controller(controllerPath = '') {
  return (target) => {
    const path = controllerPath.startsWith('/') ? controllerPath : \`/\${controllerPath}\`;
    Reflect.defineMetadata(REST_CONTROLLER_KEY, { path: path === '/' ? '' : path, target }, target);
  };
};

exports.Get = function Get(routePath = '') {
  return (target, propertyKey, descriptor) => {
    const path = routePath.startsWith('/') ? routePath : \`/\${routePath}\`;
    const ctor = target.constructor;
    const routes = Reflect.getMetadata(REST_ROUTES_KEY, ctor) ?? [];
    Reflect.defineMetadata(REST_ROUTES_KEY, [...routes, { method: 'GET', path: path === '/' ? '' : path, methodName: propertyKey }], ctor);
    return descriptor;
  };
};
`;
}

function getProtocolsRestFixtureTypes(): string {
  return `export declare function Controller(controllerPath?: string): ClassDecorator;
export declare function Get(routePath?: string): MethodDecorator;
`;
}

function getMixedControllerSource(): string {
  return `import 'reflect-metadata';

const REST_CONTROLLER_KEY = Symbol.for('croco:rest:controller');
const REST_ROUTES_KEY = Symbol.for('croco:rest:routes');

declare namespace Reflect {
  function defineMetadata(metadataKey: unknown, metadataValue: unknown, target: object): void;
  function getMetadata(metadataKey: unknown, target: object): unknown;
}

type RouteMetadata = {
  readonly method: string;
  readonly path: string;
  readonly methodName: string | symbol;
};

function Controller(controllerPath: string): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(REST_CONTROLLER_KEY, { path: controllerPath, target }, target);
  };
}

function Get(routePath: string): MethodDecorator {
  return (target, propertyKey) => {
    const ctor = target.constructor;
    const routes = (Reflect.getMetadata(REST_ROUTES_KEY, ctor) as RouteMetadata[] | undefined) ?? [];

    Reflect.defineMetadata(REST_ROUTES_KEY, [...routes, { method: 'GET', path: routePath, methodName: propertyKey }], ctor);
  };
}

class UserDto {
  readonly id = 'user-1';
}

export class ExportedHelper {
  readonly dto = new UserDto();
}

@Controller('/users')
export class UsersController {
  @Get('/')
  listUsers() {
    return [new UserDto()];
  }
}
`;
}

function getWeakSchemaControllerSource(): string {
  return `import 'reflect-metadata';

const REST_CONTROLLER_KEY = Symbol.for('croco:rest:controller');
const REST_ROUTES_KEY = Symbol.for('croco:rest:routes');
const REST_PARAMS_KEY = Symbol.for('croco:rest:params');

declare namespace Reflect {
  function defineMetadata(metadataKey: unknown, metadataValue: unknown, target: object): void;
  function getMetadata(metadataKey: unknown, target: object): unknown;
}

enum ParamType {
  PARAM = 'param',
}

type RouteMetadata = {
  readonly method: string;
  readonly path: string;
  readonly methodName: string | symbol;
};

function Controller(controllerPath: string): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(REST_CONTROLLER_KEY, { path: controllerPath, target }, target);
  };
}

function Get(routePath: string): MethodDecorator {
  return (target, propertyKey) => {
    const ctor = target.constructor;
    const routes = (Reflect.getMetadata(REST_ROUTES_KEY, ctor) as RouteMetadata[] | undefined) ?? [];

    Reflect.defineMetadata(REST_ROUTES_KEY, [...routes, { method: 'GET', path: routePath, methodName: propertyKey }], ctor);
  };
}

function Param(name: string): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    if (!propertyKey) return;

    const ctor = target.constructor;
    const paramsMap = (Reflect.getMetadata(REST_PARAMS_KEY, ctor) as Map<string | symbol, unknown[]> | undefined) ?? new Map();
    const params = paramsMap.get(propertyKey) ?? [];

    params.push({ type: ParamType.PARAM, index: parameterIndex, name });
    paramsMap.set(propertyKey, params);
    Reflect.defineMetadata(REST_PARAMS_KEY, paramsMap, ctor);
  };
}

@Controller('/users')
export class WeakSchemaController {
  @Get('/:id')
  getUser(@Param('id') _id: string): void {}
}
`;
}

function getDuplicateControllerSource(controllerPath: string): string {
  return `import 'reflect-metadata';

const REST_CONTROLLER_KEY = Symbol.for('croco:rest:controller');
const REST_ROUTES_KEY = Symbol.for('croco:rest:routes');

declare namespace Reflect {
  function defineMetadata(metadataKey: unknown, metadataValue: unknown, target: object): void;
  function getMetadata(metadataKey: unknown, target: object): unknown;
}

type RouteMetadata = {
  readonly method: string;
  readonly path: string;
  readonly methodName: string | symbol;
};

function Controller(path: string): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(REST_CONTROLLER_KEY, { path, target }, target);
  };
}

function Get(routePath: string): MethodDecorator {
  return (target, propertyKey) => {
    const ctor = target.constructor;
    const routes = (Reflect.getMetadata(REST_ROUTES_KEY, ctor) as RouteMetadata[] | undefined) ?? [];

    Reflect.defineMetadata(REST_ROUTES_KEY, [...routes, { method: 'GET', path: routePath, methodName: propertyKey }], ctor);
  };
}

@Controller('${controllerPath}')
export class DuplicateController {
  @Get('/')
  find(): void {}
}
`;
}

function getBrokenControllerSource(): string {
  return `import 'reflect-metadata';

const REST_CONTROLLER_KEY = Symbol.for('croco:rest:controller');
const REST_ROUTES_KEY = Symbol.for('croco:rest:routes');

declare namespace Reflect {
  function defineMetadata(metadataKey: unknown, metadataValue: unknown, target: object): void;
  function getMetadata(metadataKey: unknown, target: object): unknown;
}

type RouteMetadata = {
  readonly method: string;
  readonly path: string;
  readonly methodName: string | symbol;
};

function Controller(controllerPath: string): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(REST_CONTROLLER_KEY, { path: controllerPath, target }, target);
  };
}

function Get(routePath: string): MethodDecorator {
  return (target, propertyKey) => {
    const ctor = target.constructor;
    const routes = (Reflect.getMetadata(REST_ROUTES_KEY, ctor) as RouteMetadata[] | undefined) ?? [];

    Reflect.defineMetadata(REST_ROUTES_KEY, [...routes, { method: 'GET', path: routePath, methodName: propertyKey }], ctor);
  };
}

class UserDto {
  readonly id: string = 123;
}

@Controller('/broken')
export class BrokenController {
  @Get('/')
  listUsers(): UserDto[] {
    return [new UserDto()];
  }
}
`;
}

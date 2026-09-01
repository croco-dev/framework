import "reflect-metadata";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as os from "node:os";
import * as path from "node:path";
import { buildContractGraph } from "@croco/protocols-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { emitOpenAPI } from "../libs/emitOpenAPI";
import { loadControllers } from "../libs/loadControllers";

let tempRoot!: string;
let sourceDir!: string;

const LOAD_CONTROLLER_TIMEOUT_MS = 120_000;
const SHARED_FIXTURE_ROOT = new URL(
  "../../../../scripts/fixtures/protocol-codegen/",
  import.meta.url,
);

describe("loadControllers", () => {
  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "openapi-load-controllers-"));
    sourceDir = path.join(tempRoot, "src");
    fs.mkdirSync(sourceDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it(
    "loads exported controllers while ignoring co-located helper classes",
    async () => {
      fs.writeFileSync(path.join(sourceDir, "UsersController.ts"), getMixedControllerSource());

      const controllers = await loadControllers(path.join(sourceDir, "*.ts"));
      const spec = emitOpenAPI(controllers);

      expect(controllers.map((controller) => controller.name)).toEqual(["UsersController"]);
      expect(spec.paths?.["/users"]?.get?.operationId).toBe("UsersController_listUsers");
    },
    LOAD_CONTROLLER_TIMEOUT_MS,
  );

  it(
    "resolves controller imports from the nearest project node_modules",
    async () => {
      writeProtocolsRestFixture(tempRoot);
      fs.writeFileSync(
        path.join(sourceDir, "ImportedController.ts"),
        getImportedControllerSource(),
      );

      const controllers = await loadControllers(path.join(sourceDir, "*.ts"));

      expect(controllers.map((controller) => controller.name)).toEqual(["ImportedController"]);
    },
    LOAD_CONTROLLER_TIMEOUT_MS,
  );

  it(
    "preserves local imports outside the controller glob during contract loading",
    async () => {
      const controllersDir = path.join(sourceDir, "controllers");
      const tsconfigPath = path.join(tempRoot, "tsconfig.json");

      fs.mkdirSync(controllersDir, { recursive: true });
      fs.writeFileSync(
        tsconfigPath,
        JSON.stringify({
          compilerOptions: {
            experimentalDecorators: true,
            module: "CommonJS",
            target: "ES2020",
          },
        }),
      );
      fs.writeFileSync(path.join(sourceDir, "ImportedUserDto.ts"), getLocalSupportSource());
      fs.writeFileSync(
        path.join(controllersDir, "LocalImportController.ts"),
        getControllerImportingLocalSupportSource(),
      );

      const controllers = await loadControllers(path.join(controllersDir, "*.ts"), {
        tsconfigPath,
      });
      const spec = emitOpenAPI(controllers);
      const graph = buildContractGraph(controllers, { strictSchemas: true });

      expect(controllers.map((controller) => controller.name)).toEqual(["LocalImportController"]);
      expect(spec.paths?.["/local-imports"]?.get?.operationId).toBe("LocalImportController_list");
      expect(
        graph.diagnostics.find(
          (diagnostic) => diagnostic.code === "contract-route-missing-response-schema",
        )?.sourceLocation?.path,
      ).toBe("LocalImportController.ts");
    },
    LOAD_CONTROLLER_TIMEOUT_MS,
  );

  it(
    "loads runtime path aliases with an explicit NodeNext application config",
    async () => {
      const tsconfigPath = path.join(tempRoot, "tsconfig.codegen.json");
      fs.writeFileSync(path.join(tempRoot, "package.json"), JSON.stringify({ type: "module" }));
      fs.writeFileSync(
        tsconfigPath,
        JSON.stringify({
          compilerOptions: {
            baseUrl: ".",
            experimentalDecorators: true,
            module: "NodeNext",
            moduleResolution: "NodeNext",
            paths: { "@app/*": ["src/*"] },
            target: "ES2022",
          },
        }),
      );
      fs.writeFileSync(
        path.join(sourceDir, "paths.ts"),
        "export const controllerPath = '/aliased';\n",
      );
      fs.writeFileSync(
        path.join(sourceDir, "AliasedController.ts"),
        getMixedControllerSource()
          .replace("import 'reflect-metadata';", "import { controllerPath } from '@app/paths';")
          .replace("@Controller('/users')", "@Controller(controllerPath)"),
      );

      const controllers = await loadControllers(path.join(sourceDir, "*Controller.ts"), {
        tsconfigPath,
      });
      const spec = emitOpenAPI(controllers);

      expect(spec.paths?.["/aliased"]?.get?.operationId).toBe("UsersController_listUsers");
    },
    LOAD_CONTROLLER_TIMEOUT_MS,
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

      const controllers = await loadControllers(path.join(sourceDir, "**/*.ts"));
      const graph = buildContractGraph(controllers, { strictSchemas: true });
      const sourceLocationByPath = new Map(
        graph.diagnostics
          .filter((diagnostic) => diagnostic.code === "contract-route-missing-response-schema")
          .map((diagnostic) => [diagnostic.path, diagnostic.sourceLocation?.path]),
      );

      expect(sourceLocationByPath.get("/first")).toBe("first/DuplicateController.ts");
      expect(sourceLocationByPath.get("/second")).toBe("second/DuplicateController.ts");
    },
    LOAD_CONTROLLER_TIMEOUT_MS,
  );

  it(
    "normalizes shared decorator and parameter source locations",
    async () => {
      const controllerPath = path.join(sourceDir, "LocatedController.ts");
      fs.writeFileSync(controllerPath, readSharedFixture("LocatedController.ts.fixture"));

      const controllers = await loadControllers(path.join(sourceDir, "*.ts"));
      const graph = buildContractGraph(controllers, { strictSchemas: true });
      const routeDiagnostic = graph.diagnostics.find(
        (diagnostic) => diagnostic.code === "contract-route-missing-response-schema",
      );
      const paramDiagnostic = graph.diagnostics.find(
        (diagnostic) => diagnostic.code === "contract-route-missing-named-param-schema",
      );

      expect(routeDiagnostic?.sourceLocation).toEqual({
        path: "LocatedController.ts",
        line: 60,
        column: 3,
      });
      expect(paramDiagnostic?.sourceLocation).toEqual({
        path: "LocatedController.ts",
        line: 61,
        column: 11,
      });
    },
    LOAD_CONTROLLER_TIMEOUT_MS,
  );

  it(
    "extends each application-resolved Zod runtime across controller roots",
    async () => {
      const firstDir = path.join(tempRoot, "apps", "first");
      const secondDir = path.join(tempRoot, "apps", "second");
      const firstControllerPath = path.join(firstDir, "src", "FirstController.ts");
      const secondControllerPath = path.join(secondDir, "src", "SecondController.ts");

      writeZodFixture(firstDir);
      writeZodFixture(secondDir);
      fs.mkdirSync(path.dirname(firstControllerPath), { recursive: true });
      fs.mkdirSync(path.dirname(secondControllerPath), { recursive: true });
      fs.writeFileSync(firstControllerPath, getDuplicateControllerSource("/first"));
      fs.writeFileSync(secondControllerPath, getDuplicateControllerSource("/second"));

      await loadControllers(path.join(tempRoot, "apps", "*", "src", "*Controller.ts"));

      expect(getZodOpenApiMethod(firstControllerPath)).toBeTypeOf("function");
      expect(getZodOpenApiMethod(secondControllerPath)).toBeTypeOf("function");
    },
    LOAD_CONTROLLER_TIMEOUT_MS,
  );

  it(
    "fails before importing emitted controllers when controller TypeScript has errors",
    async () => {
      const controllerPath = path.join(sourceDir, "BrokenController.ts");
      fs.writeFileSync(controllerPath, readSharedFixture("BrokenController.ts.fixture"));

      await expectControllerTypeScriptDiagnostics(
        loadControllers(path.join(sourceDir, "*.ts")),
        controllerPath,
        "openapi-spec/controller-typescript-diagnostics",
        "openapi-spec",
      );
    },
    LOAD_CONTROLLER_TIMEOUT_MS,
  );

  it(
    "fails clearly when matched files export no controllers",
    async () => {
      fs.writeFileSync(path.join(sourceDir, "Helper.ts"), "export class Helper {}\n");

      await expectNoRestControllersFound(loadControllers(path.join(sourceDir, "*.ts")));
    },
    LOAD_CONTROLLER_TIMEOUT_MS,
  );

  it(
    "fails clearly when no files match the controller glob",
    async () => {
      await expectNoRestControllersFound(loadControllers(path.join(sourceDir, "*.ts")));
    },
    LOAD_CONTROLLER_TIMEOUT_MS,
  );
});

async function expectNoRestControllersFound(result: Promise<unknown>): Promise<void> {
  await expect(result).rejects.toMatchObject({
    code: "openapi-spec/no-rest-controllers-found",
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
  generatorName: string,
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
      detail: expect.stringContaining(
        `${generatorName} refused to load controller contract sources`,
      ),
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

function readSharedFixture(name: string): string {
  return fs.readFileSync(new URL(name, SHARED_FIXTURE_ROOT), "utf8");
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

function writeZodFixture(projectDir: string): void {
  const workspaceRequire = createRequire(path.join(process.cwd(), "package.json"));
  const sourceDir = path.dirname(workspaceRequire.resolve("zod/package.json"));
  fs.cpSync(sourceDir, path.join(projectDir, "node_modules", "zod"), { recursive: true });
}

function getZodOpenApiMethod(sourcePath: string): unknown {
  const applicationRequire = createRequire(sourcePath);
  const zodModule = applicationRequire("zod") as {
    readonly ZodObject: { readonly prototype: { readonly openapi?: unknown } };
  };
  return zodModule.ZodObject.prototype.openapi;
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

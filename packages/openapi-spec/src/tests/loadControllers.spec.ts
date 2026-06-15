import "reflect-metadata";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { emitOpenAPI } from "../libs/emitOpenAPI";
import { loadControllers } from "../libs/loadControllers";

let tempRoot!: string;
let sourceDir!: string;

const LOAD_CONTROLLER_TIMEOUT_MS = 120_000;

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

function writeProtocolsRestFixture(projectDir: string): void {
  const packageDir = path.join(projectDir, "node_modules", "@croco", "protocols-rest");

  fs.mkdirSync(packageDir, { recursive: true });
  fs.writeFileSync(
    path.join(packageDir, "package.json"),
    JSON.stringify({ name: "@croco/protocols-rest", main: "index.js" }),
  );
  fs.writeFileSync(path.join(packageDir, "index.js"), getProtocolsRestFixtureSource());
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

function getMixedControllerSource(): string {
  return `const REST_CONTROLLER_KEY = Symbol.for('croco:rest:controller');
const REST_ROUTES_KEY = Symbol.for('croco:rest:routes');

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

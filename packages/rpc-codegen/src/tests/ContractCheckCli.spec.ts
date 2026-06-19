import "reflect-metadata";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCli } from "../libs/cli";

const CONTRACT_CHECK_TIMEOUT_MS = 120_000;

let tempRoot!: string;
let sourceDir!: string;

describe("rpc-codegen contract check CLI", () => {
  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rpc-contract-check-"));
    sourceDir = path.join(tempRoot, "src");
    fs.mkdirSync(sourceDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it(
    "fails when a loaded controller declares more than one request body parameter",
    async () => {
      fs.writeFileSync(path.join(sourceDir, "UsersController.ts"), getMultipleBodyController());
      const stdout: string[] = [];

      const exitCode = await runCli(["--controllers", path.join(sourceDir, "*.ts"), "--check"], {
        stdout: (message) => stdout.push(message),
      });

      expect(exitCode).toBe(1);
      expect(stdout).toContain(
        "ERROR contract-route-multiple-body-params UsersController.createUser: Generated contracts support one request body per route, but 2 @Body() parameters were found.",
      );
      expect(stdout).toContain("Contract graph check failed with 1 error(s).");
    },
    CONTRACT_CHECK_TIMEOUT_MS,
  );

  it(
    "passes when a loaded controller uses a catch-all path parameter",
    async () => {
      fs.writeFileSync(path.join(sourceDir, "AssetsController.ts"), getCatchAllController());
      const stdout: string[] = [];

      const exitCode = await runCli(["--controllers", path.join(sourceDir, "*.ts"), "--check"], {
        stdout: (message) => stdout.push(message),
      });

      expect(exitCode).toBe(0);
      expect(stdout).toContain(
        "Contract graph check passed for 1 route(s) across 1 controller(s).",
      );
    },
    CONTRACT_CHECK_TIMEOUT_MS,
  );
});

function getCatchAllController(): string {
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

@Controller('/assets')
export class AssetsController {
  @Get('/:...id')
  getAsset(@Param('id') _id: string): void {}
}
`;
}

function getMultipleBodyController(): string {
  return `import 'reflect-metadata';

const REST_CONTROLLER_KEY = Symbol.for('croco:rest:controller');
const REST_ROUTES_KEY = Symbol.for('croco:rest:routes');
const REST_PARAMS_KEY = Symbol.for('croco:rest:params');

declare namespace Reflect {
  function defineMetadata(metadataKey: unknown, metadataValue: unknown, target: object): void;
  function getMetadata(metadataKey: unknown, target: object): unknown;
}

enum ParamType {
  BODY = 'body',
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

function Post(routePath: string): MethodDecorator {
  return (target, propertyKey) => {
    const ctor = target.constructor;
    const routes = (Reflect.getMetadata(REST_ROUTES_KEY, ctor) as RouteMetadata[] | undefined) ?? [];

    Reflect.defineMetadata(REST_ROUTES_KEY, [...routes, { method: 'POST', path: routePath, methodName: propertyKey }], ctor);
  };
}

function Body(schema: unknown): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    if (!propertyKey) return;

    const ctor = target.constructor;
    const paramsMap = (Reflect.getMetadata(REST_PARAMS_KEY, ctor) as Map<string | symbol, unknown[]> | undefined) ?? new Map();
    const params = paramsMap.get(propertyKey) ?? [];

    params.push({ type: ParamType.BODY, index: parameterIndex, pipes: [{ schema }] });
    paramsMap.set(propertyKey, params);
    Reflect.defineMetadata(REST_PARAMS_KEY, paramsMap, ctor);
  };
}

@Controller('/users')
export class UsersController {
  @Post('/')
  createUser(
    @Body(null) _body: { name: string },
    @Body(null) _audit: { auditId: string },
  ): void {}
}
`;
}

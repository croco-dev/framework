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
      const controllerPath = path.join(sourceDir, "UsersController.ts");
      const stdout: string[] = [];

      fs.writeFileSync(controllerPath, getMultipleBodyController());

      const exitCode = await runCli(
        [
          "--controllers",
          path.join(sourceDir, "*.ts"),
          "--check",
          "--compatibility-problems",
          "--compatibility-schemas",
        ],
        {
          stdout: (message) => stdout.push(message),
        },
      );

      expect(exitCode).toBe(1);
      expect(stdout[0]).toContain(
        "ERROR contract-route-multiple-body-params UsersController.createUser UsersController.ts:",
      );
      expect(stdout[0]).toContain(
        "Generated contracts support one request body per route, but 2 @Body() parameters were found.",
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

      const exitCode = await runCli(
        [
          "--controllers",
          path.join(sourceDir, "*.ts"),
          "--check",
          "--compatibility-problems",
          "--compatibility-schemas",
        ],
        {
          stdout: (message) => stdout.push(message),
        },
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain(
        "Contract graph check passed for 1 route(s) across 1 controller(s).",
      );
    },
    CONTRACT_CHECK_TIMEOUT_MS,
  );

  it(
    "prints strict Problem response diagnostics without failing warnings",
    async () => {
      const controllerPath = path.join(sourceDir, "AssetsController.ts");
      const stdout: string[] = [];

      fs.writeFileSync(controllerPath, getCatchAllController());

      const exitCode = await runCli(
        [
          "--controllers",
          path.join(sourceDir, "*.ts"),
          "--check",
          "--strict-problems",
          "--compatibility-schemas",
        ],
        {
          stdout: (message) => stdout.push(message),
        },
      );

      expect(exitCode).toBe(0);
      expect(stdout[0]).toContain(
        "WARNING contract-route-missing-problem-response-contract AssetsController.getAsset AssetsController.ts:",
      );
      expect(stdout[0]).toContain(
        "Strict Problem contract mode could not find declared route failures.",
      );
      expect(stdout).toContain(
        "Contract graph check passed for 1 route(s) across 1 controller(s).",
      );
    },
    CONTRACT_CHECK_TIMEOUT_MS,
  );

  it(
    "fails strict Problem response diagnostics when diagnostics are blocking",
    async () => {
      const controllerPath = path.join(sourceDir, "AssetsController.ts");
      const stdout: string[] = [];

      fs.writeFileSync(controllerPath, getCatchAllController());

      const exitCode = await runCli(
        [
          "--controllers",
          path.join(sourceDir, "*.ts"),
          "--check",
          "--strict-problems",
          "--compatibility-schemas",
          "--fail-on-diagnostics",
        ],
        {
          stdout: (message) => stdout.push(message),
        },
      );

      expect(exitCode).toBe(1);
      expect(stdout[0]).toContain(
        "WARNING contract-route-missing-problem-response-contract AssetsController.getAsset AssetsController.ts:",
      );
      expect(stdout[0]).toContain(
        "Strict Problem contract mode could not find declared route failures.",
      );
      expect(stdout).toContain("Contract graph check failed with 1 diagnostic(s).");
    },
    CONTRACT_CHECK_TIMEOUT_MS,
  );

  it(
    "fails strict schema mode before permissive generated client contracts are accepted",
    async () => {
      const controllerPath = path.join(sourceDir, "AssetsController.ts");
      const stdout: string[] = [];

      fs.writeFileSync(controllerPath, getCatchAllController());

      const exitCode = await runCli(
        [
          "--controllers",
          path.join(sourceDir, "*.ts"),
          "--check",
          "--strict-schemas",
          "--compatibility-problems",
        ],
        {
          stdout: (message) => stdout.push(message),
        },
      );

      expect(exitCode).toBe(1);
      expect(stdout).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            "ERROR contract-route-missing-response-schema AssetsController.getAsset AssetsController.ts:",
          ),
          expect.stringContaining(
            "ERROR contract-route-missing-named-param-schema AssetsController.getAsset AssetsController.ts:",
          ),
        ]),
      );
      expect(stdout).toEqual([
        expect.stringContaining(
          "Strict schema mode requires a success response schema before RPC/OpenAPI generation.",
        ),
        expect.stringContaining(
          'Strict schema mode requires @Param("id") to receive a Zod schema or a route contract params field',
        ),
        "Contract graph check failed with 2 error(s).",
      ]);
      expect(stdout.join("\n")).not.toContain(".croco-rpc-codegen-");
      expect(stdout).toContain("Contract graph check failed with 2 error(s).");
    },
    CONTRACT_CHECK_TIMEOUT_MS,
  );

  it(
    "does not write generated clients when strict schema diagnostics block generation",
    async () => {
      const controllerPath = path.join(sourceDir, "AssetsController.ts");
      const outDir = path.join(tempRoot, "generated-client");
      const stdout: string[] = [];

      fs.writeFileSync(controllerPath, getCatchAllController());

      const exitCode = await runCli(
        [
          "--controllers",
          path.join(sourceDir, "*.ts"),
          "--out",
          outDir,
          "--strict-schemas",
          "--compatibility-problems",
        ],
        {
          stdout: (message) => stdout.push(message),
        },
      );

      expect(exitCode).toBe(1);
      expect(stdout).toContain(
        "Contract graph contains 2 error(s); fix them before generating clients.",
      );
      expect(stdout.join("\n")).toContain("AssetsController.ts:");
      expect(stdout.join("\n")).not.toContain(".croco-rpc-codegen-");
      expect(fs.existsSync(outDir)).toBe(false);
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

import "reflect-metadata";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCli } from "../libs/cli";

const OPENAPI_CLI_GENERATION_TIMEOUT_MS = 120_000;

let tempRoot!: string;
let sourceDir!: string;

describe("openapi-spec CLI generation", () => {
  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "openapi-cli-generation-"));
    sourceDir = path.join(tempRoot, "src");
    fs.mkdirSync(sourceDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it(
    "does not write output when controller TypeScript diagnostics block generation",
    async () => {
      const controllerPath = path.join(sourceDir, "BrokenController.ts");
      const outFile = path.join(tempRoot, "openapi.json");

      fs.writeFileSync(controllerPath, getBrokenControllerSource());

      await expect(
        runCli(["--controllers", path.join(sourceDir, "*.ts"), "--out", outFile]),
      ).rejects.toMatchObject({
        code: "openapi-spec/controller-typescript-diagnostics",
        extensions: {
          crocoCode: "CROCO_BUILD_003",
          diagnostics: [
            expect.objectContaining({
              tsCode: "TS2322",
              file: controllerPath,
              line: expect.any(Number),
              column: expect.any(Number),
            }),
          ],
        },
      });
      expect(fs.existsSync(outFile)).toBe(false);
    },
    OPENAPI_CLI_GENERATION_TIMEOUT_MS,
  );

  it(
    "does not write output when strict schema diagnostics block generation",
    async () => {
      const controllerPath = path.join(sourceDir, "WeakSchemaController.ts");
      const outFile = path.join(tempRoot, "openapi.json");
      const stdout: string[] = [];

      fs.writeFileSync(controllerPath, getWeakSchemaControllerSource());

      const exitCode = await runCli(
        ["--controllers", path.join(sourceDir, "*.ts"), "--out", outFile, "--strict-schemas"],
        {
          stdout: (message) => stdout.push(message),
        },
      );

      expect(exitCode).toBe(1);
      expect(stdout).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            "ERROR contract-route-missing-response-schema WeakSchemaController.getUser WeakSchemaController.ts:",
          ),
          expect.stringContaining(
            "ERROR contract-route-missing-named-param-schema WeakSchemaController.getUser WeakSchemaController.ts:",
          ),
        ]),
      );
      expect(stdout.join("\n")).toContain(
        "Strict schema mode requires a success response schema before RPC/OpenAPI generation.",
      );
      expect(stdout.join("\n")).toContain(
        'Strict schema mode requires @Param("id") to receive a Zod schema or a route contract params field',
      );
      expect(stdout.join("\n")).not.toContain(".croco-openapi-spec-");
      expect(stdout).toContain(
        "Contract graph contains 2 error(s); fix them before generating OpenAPI.",
      );
      expect(fs.existsSync(outFile)).toBe(false);
    },
    OPENAPI_CLI_GENERATION_TIMEOUT_MS,
  );

  it(
    "creates missing parent directories for generated output",
    async () => {
      const controllerPath = path.join(sourceDir, "WeakSchemaController.ts");
      const outFile = path.join(tempRoot, "generated", "contracts", "openapi.json");

      fs.writeFileSync(controllerPath, getWeakSchemaControllerSource());

      const exitCode = await runCli([
        "--controllers",
        path.join(sourceDir, "*.ts"),
        "--out",
        outFile,
        "--compatibility-problems",
        "--compatibility-schemas",
      ]);

      expect(exitCode).toBe(0);
      expect(JSON.parse(fs.readFileSync(outFile, "utf8"))).toMatchObject({
        openapi: "3.1.0",
      });
    },
    OPENAPI_CLI_GENERATION_TIMEOUT_MS,
  );

  it(
    "keeps missing output checks read-only",
    async () => {
      const controllerPath = path.join(sourceDir, "WeakSchemaController.ts");
      const outputDirectory = path.join(tempRoot, "generated", "contracts");
      const outFile = path.join(outputDirectory, "openapi.json");
      const stdout: string[] = [];

      fs.writeFileSync(controllerPath, getWeakSchemaControllerSource());

      const exitCode = await runCli(
        [
          "--controllers",
          path.join(sourceDir, "*.ts"),
          "--out",
          outFile,
          "--compatibility-problems",
          "--compatibility-schemas",
          "--output-check",
        ],
        { stdout: (message) => stdout.push(message) },
      );

      expect(exitCode).toBe(1);
      expect(stdout[0]).toBe(`[CROCO_OPENAPI_OUTPUT_MISSING] ${outFile}`);
      expect(fs.existsSync(outputDirectory)).toBe(false);
    },
    OPENAPI_CLI_GENERATION_TIMEOUT_MS,
  );
});

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

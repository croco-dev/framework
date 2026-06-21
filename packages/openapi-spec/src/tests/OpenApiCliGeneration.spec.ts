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

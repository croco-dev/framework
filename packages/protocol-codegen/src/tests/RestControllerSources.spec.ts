import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Problem, ProblemCategory } from "@croco/problems-core";
import type { ProblemExtensions } from "@croco/problems-core";
import { buildContractGraph } from "@croco/protocols-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONTROLLER_TYPESCRIPT_DIAGNOSTIC_CODE,
  loadRestControllerSources,
} from "../libs/RestControllerSources";
import type { RestControllerSourceProblems } from "../libs/RestControllerSources";

const SHARED_FIXTURE_ROOT = new URL(
  "../../../../scripts/fixtures/protocol-codegen/",
  import.meta.url,
);
const LOAD_CONTROLLER_TIMEOUT_MS = 120_000;
class TestControllerSourceProblem extends Problem {
  constructor(
    code: string,
    category: ProblemCategory,
    detail: string,
    extensions?: ProblemExtensions,
  ) {
    super(code, category, detail, extensions ? { extensions } : undefined);
  }
}

const TEST_SOURCE_PROBLEMS = {
  noControllersFound: () =>
    new TestControllerSourceProblem(
      "test-codegen/no-rest-controllers-found",
      ProblemCategory.BadRequest,
      "No controllers",
    ),
  controllerTypeScriptDiagnostics: (_controllerPatterns, diagnostics) =>
    new TestControllerSourceProblem(
      "test-codegen/controller-typescript-diagnostics",
      ProblemCategory.ValidationError,
      "TypeScript diagnostics",
      {
        crocoCode: CONTROLLER_TYPESCRIPT_DIAGNOSTIC_CODE,
        diagnostics,
      },
    ),
} satisfies RestControllerSourceProblems;

let tempRoot: string;
let sourceDir: string;

describe("loadRestControllerSources", () => {
  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "protocol-codegen-rest-sources-"));
    sourceDir = path.join(tempRoot, "src");
    fs.mkdirSync(sourceDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it(
    "loads controller modules with normalized decorator locations",
    async () => {
      const controllerPath = path.join(sourceDir, "LocatedController.ts");
      const beforeEmit = vi.fn(async () => undefined);
      fs.writeFileSync(controllerPath, readSharedFixture("LocatedController.ts.fixture"));

      const result = await loadRestControllerSources({
        controllers: path.join(sourceDir, "*.ts"),
        problems: TEST_SOURCE_PROBLEMS,
        beforeEmit,
      });
      const graph = buildContractGraph(result.controllers, { strictSchemas: true });

      expect(beforeEmit).toHaveBeenCalledWith([controllerPath]);
      expect(result.modules).toHaveLength(1);
      expect(result.modules[0]?.controllers).toEqual(result.controllers);
      expect(
        graph.diagnostics.find(
          (diagnostic) => diagnostic.code === "contract-route-missing-response-schema",
        )?.sourceLocation,
      ).toEqual({ path: "LocatedController.ts", line: 60, column: 3 });
      expect(
        graph.diagnostics.find(
          (diagnostic) => diagnostic.code === "contract-route-missing-named-param-schema",
        )?.sourceLocation,
      ).toEqual({ path: "LocatedController.ts", line: 61, column: 11 });
    },
    LOAD_CONTROLLER_TIMEOUT_MS,
  );

  it(
    "normalizes locations for imported decorator aliases",
    async () => {
      const decoratorsPath = path.join(sourceDir, "decorators.ts");
      const controllerPath = path.join(sourceDir, "AliasedController.ts");
      fs.writeFileSync(decoratorsPath, getAliasedDecoratorSource());
      fs.writeFileSync(controllerPath, getAliasedControllerSource());

      const result = await loadRestControllerSources({
        controllers: controllerPath,
        problems: TEST_SOURCE_PROBLEMS,
      });
      const graph = buildContractGraph(result.controllers, { strictSchemas: true });
      const aliasedRouteId = "AliasedController.list";
      const wrappedRouteId = "AliasedController.wrapped";

      expect(
        graph.diagnostics.find(
          (diagnostic) =>
            diagnostic.code === "contract-route-missing-response-schema" &&
            diagnostic.routeId === aliasedRouteId,
        )?.sourceLocation,
      ).toEqual({ path: "AliasedController.ts", line: 6, column: 3 });
      expect(
        graph.diagnostics.find(
          (diagnostic) =>
            diagnostic.code === "contract-route-missing-named-param-schema" &&
            diagnostic.routeId === aliasedRouteId,
        )?.sourceLocation,
      ).toEqual({ path: "AliasedController.ts", line: 7, column: 8 });
      expect(
        graph.diagnostics.find(
          (diagnostic) =>
            diagnostic.code === "contract-route-missing-response-schema" &&
            diagnostic.routeId === wrappedRouteId,
        )?.sourceLocation,
      ).toBeUndefined();
      expect(
        graph.diagnostics.some((diagnostic) =>
          diagnostic.sourceLocation?.path.includes(".croco-protocol-codegen-"),
        ),
      ).toBe(false);
    },
    LOAD_CONTROLLER_TIMEOUT_MS,
  );

  it(
    "parameterizes TypeScript diagnostic Problems by generator",
    async () => {
      const controllerPath = path.join(sourceDir, "BrokenController.ts");
      fs.writeFileSync(controllerPath, readSharedFixture("BrokenController.ts.fixture"));

      await expect(
        loadRestControllerSources({
          controllers: path.join(sourceDir, "*.ts"),
          problems: TEST_SOURCE_PROBLEMS,
        }),
      ).rejects.toMatchObject({
        code: "test-codegen/controller-typescript-diagnostics",
        extensions: {
          crocoCode: "CROCO_BUILD_003",
          diagnostics: [
            expect.objectContaining({
              crocoCode: "CROCO_BUILD_003",
              tsCode: "TS2322",
              file: controllerPath,
            }),
          ],
        },
      });
    },
    LOAD_CONTROLLER_TIMEOUT_MS,
  );

  it(
    "ignores TypeScript errors from node_modules dependencies",
    async () => {
      const dependencyDir = path.join(tempRoot, "node_modules", "broken-dependency");
      const controllerPath = path.join(sourceDir, "LocatedController.ts");
      fs.mkdirSync(dependencyDir, { recursive: true });
      fs.writeFileSync(
        path.join(dependencyDir, "package.json"),
        JSON.stringify({
          name: "broken-dependency",
          version: "1.0.0",
          main: "index.ts",
          types: "index.ts",
        }),
      );
      fs.writeFileSync(
        path.join(dependencyDir, "index.ts"),
        "export const dependencyValue: string = 123;\n",
      );
      fs.writeFileSync(
        controllerPath,
        readSharedFixture("LocatedController.ts.fixture").replace(
          "import 'reflect-metadata';",
          "import 'reflect-metadata';\nimport { dependencyValue } from 'broken-dependency';\nvoid dependencyValue;",
        ),
      );

      const beforeEmitProblem = new TestControllerSourceProblem(
        "test-codegen/before-emit",
        ProblemCategory.InternalServerError,
        "Reached beforeEmit",
      );

      await expect(
        loadRestControllerSources({
          controllers: controllerPath,
          problems: TEST_SOURCE_PROBLEMS,
          beforeEmit: async () => {
            throw beforeEmitProblem;
          },
        }),
      ).rejects.toBe(beforeEmitProblem);
    },
    LOAD_CONTROLLER_TIMEOUT_MS,
  );

  it("parameterizes the missing-controller Problem by generator", async () => {
    await expect(
      loadRestControllerSources({
        controllers: path.join(sourceDir, "*.ts"),
        problems: TEST_SOURCE_PROBLEMS,
      }),
    ).rejects.toMatchObject({
      code: "test-codegen/no-rest-controllers-found",
      status: 400,
    });
  });
});

function readSharedFixture(name: string): string {
  return fs.readFileSync(new URL(name, SHARED_FIXTURE_ROOT), "utf8");
}

function getAliasedControllerSource(): string {
  return `import { Controller, Get as Route, Query as RequestQuery } from './decorators';
const WrappedRoute = Route;

@Controller('/aliased')
export class AliasedController {
  @Route('/')
  list(@RequestQuery('search') _search: string): void {}

  @WrappedRoute('/wrapped')
  wrapped(): void {}
}
`;
}

function getAliasedDecoratorSource(): string {
  return `import 'reflect-metadata';

const REST_CONTROLLER_KEY = Symbol.for('croco:rest:controller');
const REST_ROUTES_KEY = Symbol.for('croco:rest:routes');
const REST_PARAMS_KEY = Symbol.for('croco:rest:params');

declare namespace Reflect {
  function defineMetadata(metadataKey: unknown, metadataValue: unknown, target: object): void;
  function getMetadata(metadataKey: unknown, target: object): unknown;
}

export function Controller(controllerPath: string): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(REST_CONTROLLER_KEY, { path: controllerPath, target }, target);
  };
}

export function Get(routePath: string): MethodDecorator {
  return (target, propertyKey) => {
    const ctor = target.constructor;
    const routes = (Reflect.getMetadata(REST_ROUTES_KEY, ctor) as unknown[] | undefined) ?? [];
    Reflect.defineMetadata(
      REST_ROUTES_KEY,
      [
        ...routes,
        {
          method: 'GET',
          path: routePath,
          methodName: propertyKey,
          sourceLocation: {
            path: '/tmp/.croco-protocol-codegen-stale/AliasedController.js',
            line: 1,
            column: 1,
          },
        },
      ],
      ctor,
    );
  };
}

export function Query(name: string): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    if (!propertyKey) return;
    const ctor = target.constructor;
    const paramsMap =
      (Reflect.getMetadata(REST_PARAMS_KEY, ctor) as
        | Map<string | symbol, unknown[]>
        | undefined) ?? new Map();
    const params = paramsMap.get(propertyKey) ?? [];
    paramsMap.set(propertyKey, [
      ...params,
      {
        type: 'query',
        index: parameterIndex,
        name,
        sourceLocation: {
          path: '/tmp/.croco-protocol-codegen-stale/AliasedController.js',
          line: 1,
          column: 1,
        },
      },
    ]);
    Reflect.defineMetadata(REST_PARAMS_KEY, paramsMap, ctor);
  };
}
`;
}

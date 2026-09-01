import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { buildContractGraph } from "@croco/protocols-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONTROLLER_TYPESCRIPT_DIAGNOSTIC_CODE,
  loadRestControllerSources,
  type RestControllerSourceProblems,
} from "../libs/RestControllerSources";

const SHARED_FIXTURE_ROOT = new URL(
  "../../../../scripts/fixtures/protocol-codegen/",
  import.meta.url,
);
const LOAD_CONTROLLER_TIMEOUT_MS = 120_000;
const TEST_SOURCE_PROBLEMS = {
  noControllersFound: () =>
    Object.assign(new Error("No controllers"), {
      code: "test-codegen/no-rest-controllers-found",
      status: 400,
    }),
  controllerTypeScriptDiagnostics: (_controllerPatterns, diagnostics) =>
    Object.assign(new Error("TypeScript diagnostics"), {
      code: "test-codegen/controller-typescript-diagnostics",
      extensions: {
        crocoCode: CONTROLLER_TYPESCRIPT_DIAGNOSTIC_CODE,
        diagnostics,
      },
    }),
} satisfies RestControllerSourceProblems;

let tempRoot!: string;
let sourceDir!: string;

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

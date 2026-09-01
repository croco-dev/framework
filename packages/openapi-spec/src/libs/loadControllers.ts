import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { Problem, ProblemCategory } from "@croco/problems-core";
import {
  CONTROLLER_TYPESCRIPT_DIAGNOSTIC_CODE,
  type ControllerTypeScriptDiagnostic,
  formatControllerTypeScriptDiagnostics,
  getNoRestControllersFoundMessage,
  loadRestControllerSources,
  type RestControllerSourceProblems,
} from "@croco/protocol-codegen";
import type { Constructor } from "@croco/protocols-core";
import type { z } from "zod";

type Controller = Constructor;

class NoRestControllersFoundProblem extends Problem {
  constructor(glob: string) {
    super(
      "openapi-spec/no-rest-controllers-found",
      ProblemCategory.BadRequest,
      getNoRestControllersFoundMessage(glob),
    );
  }
}

class ControllerTypeScriptDiagnosticsProblem extends Problem {
  readonly diagnostics: readonly ControllerTypeScriptDiagnostic[];

  constructor(glob: string, diagnostics: readonly ControllerTypeScriptDiagnostic[]) {
    super(
      "openapi-spec/controller-typescript-diagnostics",
      ProblemCategory.ValidationError,
      formatControllerTypeScriptDiagnostics("openapi-spec", glob, diagnostics),
      {
        extensions: {
          crocoCode: CONTROLLER_TYPESCRIPT_DIAGNOSTIC_CODE,
          diagnostics,
        },
      },
    );
    this.diagnostics = diagnostics;
  }
}

const REST_CONTROLLER_SOURCE_PROBLEMS = {
  noControllersFound: (glob) => new NoRestControllersFoundProblem(glob),
  controllerTypeScriptDiagnostics: (glob, diagnostics) =>
    new ControllerTypeScriptDiagnosticsProblem(glob, diagnostics),
} satisfies RestControllerSourceProblems;

export type LoadControllersOptions = {
  readonly tsconfigPath?: string;
};

export async function loadControllers(
  glob: string,
  options: LoadControllersOptions = {},
): Promise<Controller[]> {
  const { controllers } = await loadRestControllerSources({
    controllers: glob,
    problems: REST_CONTROLLER_SOURCE_PROBLEMS,
    ...(options.tsconfigPath ? { tsconfigPath: options.tsconfigPath } : {}),
    beforeEmit: extendApplicationZodRuntimes,
  });
  return [...controllers];
}

async function extendApplicationZodRuntimes(sourcePaths: readonly string[]): Promise<void> {
  const extendedPackages = new Set<string>();

  for (const sourcePath of sourcePaths) {
    const applicationRequire = createRequire(sourcePath);
    let packageJsonPath: string;

    try {
      packageJsonPath = applicationRequire.resolve("zod/package.json");
    } catch {
      continue;
    }

    if (extendedPackages.has(packageJsonPath)) continue;
    extendedPackages.add(packageJsonPath);

    extendZodModule(applicationRequire("zod") as unknown);
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
      readonly exports?: {
        readonly "."?: { readonly import?: unknown };
      };
    };
    const importPath = packageJson.exports?.["."]?.import;
    if (typeof importPath !== "string") continue;
    const esmModule = (await import(
      pathToFileURL(path.resolve(path.dirname(packageJsonPath), importPath)).href
    )) as unknown;
    extendZodModule(esmModule);
  }
}

function extendZodModule(moduleExports: unknown): void {
  if (!moduleExports || typeof moduleExports !== "object") return;
  const candidate = moduleExports as { readonly z?: unknown };
  const zodNamespace = candidate.z;
  if (!zodNamespace || typeof zodNamespace !== "object") return;
  const zodConstructors = zodNamespace as {
    readonly ZodObject?: unknown;
    readonly ZodType?: unknown;
  };
  if (
    typeof zodConstructors.ZodObject !== "function" ||
    typeof zodConstructors.ZodType !== "function"
  ) {
    return;
  }
  extendZodWithOpenApi(zodNamespace as typeof z);
}

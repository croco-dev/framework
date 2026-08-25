import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { Problem, ProblemCategory } from "@croco/problems-core";
import { createControllerProject } from "@croco/protocol-codegen";
import {
  type Constructor,
  discoverControllerConstructors,
  type RouteContractSourceLocation,
} from "@croco/protocols-core";
import { type Decorator, type Diagnostic, Node, type SourceFile, ts } from "ts-morph";
import type { z } from "zod";

type Controller = Constructor;

const CONTROLLER_TYPESCRIPT_DIAGNOSTIC_CODE = "CROCO_BUILD_003";
const REST_ROUTES_KEY = Symbol.for("croco:rest:routes");
const REST_PARAMS_KEY = Symbol.for("croco:rest:params");
const HTTP_ROUTE_DECORATOR_NAMES = new Set([
  "All",
  "Delete",
  "Get",
  "Head",
  "Options",
  "Patch",
  "Post",
  "Put",
]);
const PARAM_DECORATOR_NAMES = new Set(["Body", "Ctx", "Header", "Param", "Query", "Raw"]);

class NoRestControllersFoundProblem extends Problem {
  constructor(glob: string) {
    super(
      "openapi-spec/no-rest-controllers-found",
      ProblemCategory.BadRequest,
      getNoRestControllersFoundMessage(glob),
    );
  }
}

type ControllerTypeScriptDiagnostic = {
  readonly crocoCode: typeof CONTROLLER_TYPESCRIPT_DIAGNOSTIC_CODE;
  readonly tsCode: string;
  readonly file: string | null;
  readonly line: number | null;
  readonly column: number | null;
  readonly message: string;
};

type RouteSourceLocations = {
  readonly route?: RouteContractSourceLocation;
  readonly params: ReadonlyMap<number, RouteContractSourceLocation>;
};

type SourceFileControllerSourceLocations = ReadonlyMap<string, ControllerSourceLocations>;
type ControllerSourceLocations = ReadonlyMap<string, RouteSourceLocations>;

type RestRouteMetadata = {
  readonly methodName: string | symbol;
  readonly sourceLocation?: RouteContractSourceLocation;
};

type RestParamMetadata = {
  readonly index: number;
  readonly sourceLocation?: RouteContractSourceLocation;
};

export type LoadControllersOptions = {
  readonly tsconfigPath?: string;
};

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

export async function loadControllers(
  glob: string,
  options: LoadControllersOptions = {},
): Promise<Controller[]> {
  const controllerProject = createControllerProject({
    controllers: glob,
    ...(options.tsconfigPath ? { tsconfigPath: options.tsconfigPath } : {}),
  });

  try {
    const { controllerSourceFiles: sourceFiles } = controllerProject;
    const firstSourceFile = sourceFiles[0];

    if (!firstSourceFile) {
      throw new NoRestControllersFoundProblem(glob);
    }

    const sourceLocations = collectControllerSourceLocations(sourceFiles);
    assertNoControllerTypeScriptErrors(
      controllerProject.getPreEmitDiagnostics(),
      sourceFiles,
      glob,
    );
    await extendApplicationZodRuntimes(sourceFiles.map((sourceFile) => sourceFile.getFilePath()));
    controllerProject.emit();
    const controllers: Controller[] = [];

    for (const sourceFile of sourceFiles) {
      const moduleExports = await controllerProject.importModule(sourceFile);
      const discoveredControllers = discoverControllerConstructors(moduleExports);

      const sourceFileLocations = sourceLocations.get(sourceFile.getFilePath());

      for (const controller of discoveredControllers) {
        applyControllerSourceLocations(controller, sourceFileLocations?.get(controller.name));
      }

      controllers.push(...discoveredControllers);
    }

    if (controllers.length === 0) {
      throw new NoRestControllersFoundProblem(glob);
    }

    return controllers;
  } finally {
    controllerProject.dispose();
  }
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

function collectControllerSourceLocations(
  sourceFiles: readonly SourceFile[],
): ReadonlyMap<string, SourceFileControllerSourceLocations> {
  const sourceFileLocations = new Map<string, SourceFileControllerSourceLocations>();

  for (const sourceFile of sourceFiles) {
    const controllers = new Map<string, ControllerSourceLocations>();

    for (const classDeclaration of sourceFile.getClasses()) {
      const className = classDeclaration.getName();

      if (!className) {
        continue;
      }

      const routes = new Map<string, RouteSourceLocations>();

      for (const method of classDeclaration.getMethods()) {
        const routeDecorator = method.getDecorators().find(isHttpRouteDecorator);
        const params = new Map<number, RouteContractSourceLocation>();

        method.getParameters().forEach((parameter, index) => {
          const paramDecorator = parameter.getDecorators().find(isParamDecorator);

          if (paramDecorator) {
            params.set(index, toSourceLocation(paramDecorator));
          }
        });

        if (!routeDecorator && params.size === 0) {
          continue;
        }

        routes.set(method.getName(), {
          ...(routeDecorator ? { route: toSourceLocation(routeDecorator) } : {}),
          params,
        });
      }

      if (routes.size > 0) {
        controllers.set(className, routes);
      }
    }

    if (controllers.size > 0) {
      sourceFileLocations.set(sourceFile.getFilePath(), controllers);
    }
  }

  return sourceFileLocations;
}

function applyControllerSourceLocations(
  controller: Constructor,
  sourceLocations: ControllerSourceLocations | undefined,
): void {
  if (!sourceLocations) {
    return;
  }

  applyRouteSourceLocations(controller, sourceLocations);
  applyParamSourceLocations(controller, sourceLocations);
}

function applyRouteSourceLocations(
  controller: Constructor,
  sourceLocations: ControllerSourceLocations,
): void {
  const routes = Reflect.getMetadata(REST_ROUTES_KEY, controller) as
    | RestRouteMetadata[]
    | undefined;

  if (!routes) {
    return;
  }

  Reflect.defineMetadata(
    REST_ROUTES_KEY,
    routes.map((route) => {
      const sourceLocation = sourceLocations.get(String(route.methodName))?.route;

      return sourceLocation ? { ...route, sourceLocation } : route;
    }),
    controller,
  );
}

function applyParamSourceLocations(
  controller: Constructor,
  sourceLocations: ControllerSourceLocations,
): void {
  const paramsMap = Reflect.getMetadata(REST_PARAMS_KEY, controller) as
    | Map<string | symbol, RestParamMetadata[]>
    | undefined;

  if (!paramsMap) {
    return;
  }

  const mappedParams = new Map<string | symbol, RestParamMetadata[]>();

  for (const [methodName, params] of paramsMap) {
    const methodSourceLocations = sourceLocations.get(String(methodName));

    mappedParams.set(
      methodName,
      params.map((param) => {
        const sourceLocation = methodSourceLocations?.params.get(param.index);

        return sourceLocation ? { ...param, sourceLocation } : param;
      }),
    );
  }

  Reflect.defineMetadata(REST_PARAMS_KEY, mappedParams, controller);
}

function isHttpRouteDecorator(decorator: Decorator): boolean {
  return HTTP_ROUTE_DECORATOR_NAMES.has(getDecoratorName(decorator));
}

function isParamDecorator(decorator: Decorator): boolean {
  return PARAM_DECORATOR_NAMES.has(getDecoratorName(decorator));
}

function getDecoratorName(decorator: Decorator): string {
  const expression = decorator.getExpression();
  const nameExpression = Node.isCallExpression(expression)
    ? expression.getExpression()
    : expression;
  const text = nameExpression.getText();
  const parts = text.split(".");

  return parts[parts.length - 1] ?? text;
}

function toSourceLocation(decorator: Decorator): RouteContractSourceLocation {
  const sourceFile = decorator.getSourceFile();
  const location = sourceFile.compilerNode.getLineAndCharacterOfPosition(decorator.getStart());

  return {
    path: sourceFile.getFilePath(),
    line: location.line + 1,
    column: location.character + 1,
  };
}

export function getCommonSourceDir(sourceFilePaths: readonly string[]): string {
  const dirs = sourceFilePaths.map((sourceFilePath) =>
    toCommonDirPath(path.dirname(path.normalize(sourceFilePath))),
  );
  const [firstDir, ...remainingDirs] = dirs.map((dir) => dir.split("/"));

  if (!firstDir) {
    return process.cwd();
  }

  const commonParts: string[] = [];

  for (const [index, part] of firstDir.entries()) {
    if (!remainingDirs.every((dir) => dir[index] === part)) {
      break;
    }

    commonParts.push(part);
  }

  if (commonParts.length === 0) {
    return process.cwd();
  }

  if (commonParts.length === 1 && commonParts[0] === "") {
    return path.sep;
  }

  const commonDir = commonParts.join("/");

  if (isWindowsDriveRootedPath(commonParts)) {
    return commonDir;
  }

  return path.isAbsolute(commonDir) ? path.normalize(commonDir) : `${path.sep}${commonDir}`;
}

function toCommonDirPath(dir: string): string {
  return dir.replace(/\\/g, "/");
}

function isWindowsDriveRootedPath(parts: readonly string[]): boolean {
  return /^[A-Za-z]:$/.test(parts[0] ?? "");
}

function assertNoControllerTypeScriptErrors(
  projectDiagnostics: readonly Diagnostic[],
  sourceFiles: readonly SourceFile[],
  glob: string,
): void {
  const sourceFilePaths = new Set(sourceFiles.map((sourceFile) => sourceFile.getFilePath()));
  const diagnostics = projectDiagnostics
    .filter((diagnostic) => isControllerTypeScriptError(diagnostic, sourceFilePaths))
    .map(toControllerTypeScriptDiagnostic);

  if (diagnostics.length > 0) {
    throw new ControllerTypeScriptDiagnosticsProblem(glob, diagnostics);
  }
}

function isControllerTypeScriptError(
  diagnostic: Diagnostic,
  sourceFilePaths: ReadonlySet<string>,
): boolean {
  const compilerDiagnostic = diagnostic.compilerObject;

  if (compilerDiagnostic.category !== ts.DiagnosticCategory.Error) {
    return false;
  }

  const fileName = compilerDiagnostic.file?.fileName;

  return !fileName || sourceFilePaths.has(fileName) || !isNodeModulesPath(fileName);
}

function toControllerTypeScriptDiagnostic(diagnostic: Diagnostic): ControllerTypeScriptDiagnostic {
  const compilerDiagnostic = diagnostic.compilerObject;
  const file = compilerDiagnostic.file;
  const location =
    file && compilerDiagnostic.start !== undefined
      ? file.getLineAndCharacterOfPosition(compilerDiagnostic.start)
      : null;

  return {
    crocoCode: CONTROLLER_TYPESCRIPT_DIAGNOSTIC_CODE,
    tsCode: `TS${compilerDiagnostic.code}`,
    file: file?.fileName ?? null,
    line: location ? location.line + 1 : null,
    column: location ? location.character + 1 : null,
    message: ts.flattenDiagnosticMessageText(compilerDiagnostic.messageText, "\n"),
  };
}

function formatControllerTypeScriptDiagnostics(
  loaderName: string,
  glob: string,
  diagnostics: readonly ControllerTypeScriptDiagnostic[],
): string {
  const plural = diagnostics.length === 1 ? "error" : "errors";

  return [
    `${loaderName} refused to load controller contract sources because TypeScript reported ${diagnostics.length} ${plural} for '${glob}'.`,
    ...diagnostics.map(
      (diagnostic) =>
        `${diagnostic.crocoCode} ${diagnostic.tsCode} ${formatDiagnosticLocation(diagnostic)}: ${diagnostic.message}`,
    ),
  ].join("\n");
}

function formatDiagnosticLocation(diagnostic: ControllerTypeScriptDiagnostic): string {
  if (!diagnostic.file) {
    return "unknown";
  }

  if (diagnostic.line === null || diagnostic.column === null) {
    return diagnostic.file;
  }

  return `${diagnostic.file}:${diagnostic.line}:${diagnostic.column}`;
}

export function isNodeModulesPath(filePath: string): boolean {
  return filePath.split(/[\\/]/).includes("node_modules");
}

function getNoRestControllersFoundMessage(glob: string): string {
  return `No exported REST controllers found for '${glob}'. Ensure matched files export classes decorated with @Controller.`;
}

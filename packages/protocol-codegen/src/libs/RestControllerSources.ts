import "reflect-metadata";
import * as path from "node:path";
import type { Problem } from "@croco/problems-core";
import { discoverControllerConstructors } from "@croco/protocols-core";
import type { Constructor, RouteContractSourceLocation } from "@croco/protocols-core";
import { Node, ts } from "ts-morph";
import type { Decorator, Diagnostic, SourceFile } from "ts-morph";
import { createControllerProject, getCommonSourceDirectory } from "./ControllerProject";
import type { ControllerModule } from "./ControllerProject";

export const CONTROLLER_TYPESCRIPT_DIAGNOSTIC_CODE = "CROCO_BUILD_003";
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

export type ControllerTypeScriptDiagnostic = {
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

export type LoadRestControllerSourcesOptions = {
  readonly controllers: string | readonly string[];
  readonly problems: RestControllerSourceProblems;
  readonly tsconfigPath?: string;
  readonly beforeEmit?: (sourceFilePaths: readonly string[]) => Promise<void>;
};

export type RestControllerSourceProblems = {
  readonly noControllersFound: (controllerPatterns: string) => Problem;
  readonly controllerTypeScriptDiagnostics: (
    controllerPatterns: string,
    diagnostics: readonly ControllerTypeScriptDiagnostic[],
  ) => Problem;
};

export type RestControllerSourceModule = {
  readonly moduleExports: ControllerModule;
  readonly controllers: readonly Constructor[];
};

export type RestControllerSources = {
  readonly controllers: readonly Constructor[];
  readonly modules: readonly RestControllerSourceModule[];
};

export async function loadRestControllerSources(
  options: LoadRestControllerSourcesOptions,
): Promise<RestControllerSources> {
  const controllerProject = createControllerProject({
    controllers: options.controllers,
    ...(options.tsconfigPath ? { tsconfigPath: options.tsconfigPath } : {}),
  });

  try {
    const { controllerSourceFiles: sourceFiles } = controllerProject;
    const controllerPatterns = formatControllerPatterns(options.controllers);

    if (sourceFiles.length === 0) {
      throw options.problems.noControllersFound(controllerPatterns);
    }

    const sourceLocationRoot = getCommonSourceDirectory(
      sourceFiles.map((sourceFile) => sourceFile.getFilePath()),
    );
    const sourceLocations = collectControllerSourceLocations(sourceFiles, sourceLocationRoot);
    assertNoControllerTypeScriptErrors(
      controllerProject.getPreEmitDiagnostics(),
      sourceFiles,
      controllerPatterns,
      options.problems,
    );
    await options.beforeEmit?.(sourceFiles.map((sourceFile) => sourceFile.getFilePath()));
    controllerProject.emit();

    const modules: RestControllerSourceModule[] = [];
    const controllers: Constructor[] = [];

    for (const sourceFile of sourceFiles) {
      const moduleExports = await controllerProject.importModule(sourceFile);
      const moduleControllers = discoverControllerConstructors(moduleExports);
      const sourceFileLocations = sourceLocations.get(sourceFile.getFilePath());

      for (const controller of moduleControllers) {
        applyControllerSourceLocations(controller, sourceFileLocations?.get(controller.name));
      }

      modules.push({ moduleExports, controllers: moduleControllers });
      controllers.push(...moduleControllers);
    }

    if (controllers.length === 0) {
      throw options.problems.noControllersFound(controllerPatterns);
    }

    return { controllers, modules };
  } finally {
    controllerProject.dispose();
  }
}

function collectControllerSourceLocations(
  sourceFiles: readonly SourceFile[],
  sourceRoot: string,
): ReadonlyMap<string, SourceFileControllerSourceLocations> {
  const sourceFileLocations = new Map<string, SourceFileControllerSourceLocations>();

  for (const sourceFile of sourceFiles) {
    const controllers = new Map<string, ControllerSourceLocations>();

    for (const classDeclaration of sourceFile.getClasses()) {
      const className = classDeclaration.getName();
      if (!className) continue;

      const routes = new Map<string, RouteSourceLocations>();

      for (const method of classDeclaration.getMethods()) {
        const routeDecorator = method.getDecorators().find(isHttpRouteDecorator);
        const params = new Map<number, RouteContractSourceLocation>();

        method.getParameters().forEach((parameter, index) => {
          const paramDecorator = parameter.getDecorators().find(isParamDecorator);
          if (paramDecorator) {
            params.set(index, toSourceLocation(paramDecorator, sourceRoot));
          }
        });

        if (!routeDecorator && params.size === 0) continue;
        routes.set(method.getName(), {
          ...(routeDecorator ? { route: toSourceLocation(routeDecorator, sourceRoot) } : {}),
          params,
        });
      }

      if (routes.size > 0) controllers.set(className, routes);
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
  const routes = Reflect.getMetadata(REST_ROUTES_KEY, controller) as
    | RestRouteMetadata[]
    | undefined;
  if (routes) {
    Reflect.defineMetadata(
      REST_ROUTES_KEY,
      routes.map((route) => {
        const sourceLocation = sourceLocations?.get(String(route.methodName))?.route;
        if (sourceLocation) return { ...route, sourceLocation };
        return isTemporaryCodegenSourceLocation(route.sourceLocation)
          ? { ...route, sourceLocation: undefined }
          : route;
      }),
      controller,
    );
  }

  const paramsMap = Reflect.getMetadata(REST_PARAMS_KEY, controller) as
    | Map<string | symbol, RestParamMetadata[]>
    | undefined;
  if (!paramsMap) return;

  const mappedParams = new Map<string | symbol, RestParamMetadata[]>();
  for (const [methodName, params] of paramsMap) {
    const methodSourceLocations = sourceLocations?.get(String(methodName));
    mappedParams.set(
      methodName,
      params.map((param) => {
        const sourceLocation = methodSourceLocations?.params.get(param.index);
        if (sourceLocation) return { ...param, sourceLocation };
        return isTemporaryCodegenSourceLocation(param.sourceLocation)
          ? { ...param, sourceLocation: undefined }
          : param;
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
  const aliasedName = nameExpression.getSymbol()?.getAliasedSymbol()?.getName();
  if (aliasedName) return aliasedName;

  const text = nameExpression.getText();
  const parts = text.split(".");
  return parts[parts.length - 1] ?? text;
}

function isTemporaryCodegenSourceLocation(
  sourceLocation: RouteContractSourceLocation | undefined,
): boolean {
  return sourceLocation?.path.replace(/\\/g, "/").includes("/.croco-protocol-codegen-") ?? false;
}

function toSourceLocation(decorator: Decorator, sourceRoot: string): RouteContractSourceLocation {
  const sourceFile = decorator.getSourceFile();
  const location = sourceFile.compilerNode.getLineAndCharacterOfPosition(decorator.getStart());
  return {
    path: path.relative(sourceRoot, sourceFile.getFilePath()).split(path.sep).join("/"),
    line: location.line + 1,
    column: location.character + 1,
  };
}

function assertNoControllerTypeScriptErrors(
  projectDiagnostics: readonly Diagnostic[],
  sourceFiles: readonly SourceFile[],
  controllerPatterns: string,
  problems: RestControllerSourceProblems,
): void {
  const sourceFilePaths = new Set(sourceFiles.map((sourceFile) => sourceFile.getFilePath()));
  const diagnostics = projectDiagnostics
    .filter((diagnostic) => isControllerTypeScriptError(diagnostic, sourceFilePaths))
    .map(toControllerTypeScriptDiagnostic);

  if (diagnostics.length > 0) {
    throw problems.controllerTypeScriptDiagnostics(controllerPatterns, diagnostics);
  }
}

function isControllerTypeScriptError(
  diagnostic: Diagnostic,
  sourceFilePaths: ReadonlySet<string>,
): boolean {
  const compilerDiagnostic = diagnostic.compilerObject;
  if (compilerDiagnostic.category !== ts.DiagnosticCategory.Error) return false;

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

export function formatControllerTypeScriptDiagnostics(
  generatorName: string,
  controllerPatterns: string,
  diagnostics: readonly ControllerTypeScriptDiagnostic[],
): string {
  const plural = diagnostics.length === 1 ? "error" : "errors";
  return [
    `${generatorName} refused to load controller contract sources because TypeScript reported ${diagnostics.length} ${plural} for '${controllerPatterns}'.`,
    ...diagnostics.map(
      (diagnostic) =>
        `${diagnostic.crocoCode} ${diagnostic.tsCode} ${formatDiagnosticLocation(diagnostic)}: ${diagnostic.message}`,
    ),
  ].join("\n");
}

function formatDiagnosticLocation(diagnostic: ControllerTypeScriptDiagnostic): string {
  if (!diagnostic.file) return "unknown";
  if (diagnostic.line === null || diagnostic.column === null) return diagnostic.file;
  return `${diagnostic.file}:${diagnostic.line}:${diagnostic.column}`;
}

function isNodeModulesPath(filePath: string): boolean {
  return filePath.split(/[\\/]/).includes("node_modules");
}

function formatControllerPatterns(controllers: string | readonly string[]): string {
  return (Array.isArray(controllers) ? controllers : [controllers]).join(", ");
}

export function getNoRestControllersFoundMessage(controllerPatterns: string): string {
  return `No exported REST controllers found for '${controllerPatterns}'. Ensure matched files export classes decorated with @Controller.`;
}

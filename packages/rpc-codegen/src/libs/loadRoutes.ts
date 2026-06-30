import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import {
  buildContractGraph,
  type BuildContractGraphOptions,
  type Constructor,
  type ContractGraph,
  discoverControllerConstructors,
  type RouteContractSourceLocation,
  type RouteIR,
} from "@croco/protocols-core";
import { Problem, ProblemCategory } from "@croco/problems-core";
import { type Decorator, type Diagnostic, Node, Project, type SourceFile, ts } from "ts-morph";

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
      "rpc-codegen/no-rest-controllers-found",
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

class ControllerTypeScriptDiagnosticsProblem extends Problem {
  readonly diagnostics: readonly ControllerTypeScriptDiagnostic[];

  constructor(glob: string, diagnostics: readonly ControllerTypeScriptDiagnostic[]) {
    super(
      "rpc-codegen/controller-typescript-diagnostics",
      ProblemCategory.ValidationError,
      formatControllerTypeScriptDiagnostics("rpc-codegen", glob, diagnostics),
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

export async function loadRoutes(
  glob: string,
  options: BuildContractGraphOptions = {},
): Promise<RouteIR[]> {
  return [...(await loadContractGraph(glob, options)).routes];
}

export async function loadContractGraph(
  glob: string,
  options: BuildContractGraphOptions = {},
): Promise<ContractGraph> {
  const project = new Project({
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      noEmitOnError: true,
      skipLibCheck: true,
    },
  });
  project.addSourceFilesAtPaths(glob);
  const sourceFiles = project.getSourceFiles();

  if (sourceFiles.length === 0) {
    throw new NoRestControllersFoundProblem(glob);
  }

  const sourceLocations = collectControllerSourceLocations(sourceFiles);
  const rootDir = getCommonSourceDir(getProgramEmitSourceFilePaths(project, sourceFiles));
  const emitDir = fs.mkdtempSync(
    path.join(getModuleResolutionRoot(rootDir), ".croco-rpc-codegen-"),
  );
  writeCommonJsPackageBoundary(emitDir);
  project.compilerOptions.set({ rootDir, outDir: emitDir });

  try {
    assertNoControllerTypeScriptErrors(project, sourceFiles, glob);
    project.emitSync();
    const controllerConstructors: Constructor[] = [];
    let controllerCount = 0;

    for (const sourceFile of sourceFiles) {
      const moduleExports = await importEmittedModule(
        getEmittedFilePath(rootDir, emitDir, sourceFile),
      );
      const controllers = discoverControllerConstructors(moduleExports);

      controllerCount += controllers.length;
      const sourceFileLocations = sourceLocations.get(sourceFile.getFilePath());

      for (const controller of controllers) {
        applyControllerSourceLocations(controller, sourceFileLocations?.get(controller.name));
      }
      controllerConstructors.push(...controllers);
    }

    if (controllerCount === 0) {
      throw new NoRestControllersFoundProblem(glob);
    }

    return buildContractGraph(controllerConstructors, options);
  } finally {
    fs.rmSync(emitDir, { recursive: true, force: true });
  }
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

async function importEmittedModule(filePath: string): Promise<Record<string, unknown>> {
  return (await import(pathToFileURL(filePath).href)) as Record<string, unknown>;
}

function writeCommonJsPackageBoundary(emitDir: string): void {
  fs.writeFileSync(path.join(emitDir, "package.json"), JSON.stringify({ type: "commonjs" }));
}

function getProgramEmitSourceFilePaths(
  project: Project,
  sourceFiles: readonly SourceFile[],
): string[] {
  const sourceFilePaths = project
    .getProgram()
    .compilerObject.getSourceFiles()
    .map((sourceFile) => sourceFile.fileName)
    .filter(isEmittableProjectSourcePath);

  return sourceFilePaths.length > 0
    ? sourceFilePaths
    : sourceFiles.map((sourceFile) => sourceFile.getFilePath());
}

function getCommonSourceDir(sourceFilePaths: readonly string[]): string {
  const dirs = sourceFilePaths.map((sourceFilePath) => path.dirname(sourceFilePath));
  const [firstDir, ...remainingDirs] = dirs.map((dir) => dir.split(path.sep));

  if (!firstDir) {
    return process.cwd();
  }

  const commonParts = firstDir.filter((part, index) =>
    remainingDirs.every((dir) => dir[index] === part),
  );
  const commonDir = commonParts.join(path.sep);

  return path.isAbsolute(commonDir) ? commonDir : `${path.sep}${commonDir}`;
}

function getModuleResolutionRoot(sourceDir: string): string {
  let currentDir = sourceDir;

  while (true) {
    if (fs.existsSync(path.join(currentDir, "node_modules"))) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return process.cwd();
    }

    currentDir = parentDir;
  }
}

function getEmittedFilePath(rootDir: string, emitDir: string, sourceFile: SourceFile): string {
  const relativePath = path
    .relative(rootDir, sourceFile.getFilePath())
    .replace(/\.[cm]?tsx?$/, ".js");

  return path.join(emitDir, relativePath);
}

function assertNoControllerTypeScriptErrors(
  project: Project,
  sourceFiles: readonly SourceFile[],
  glob: string,
): void {
  const sourceFilePaths = new Set(sourceFiles.map((sourceFile) => sourceFile.getFilePath()));
  const diagnostics = project
    .getPreEmitDiagnostics()
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

function isNodeModulesPath(filePath: string): boolean {
  return filePath.split(path.sep).includes("node_modules");
}

function isEmittableProjectSourcePath(filePath: string): boolean {
  return (
    /\.[cm]?tsx?$/.test(filePath) && !/\.d\.[cm]?ts$/.test(filePath) && !isNodeModulesPath(filePath)
  );
}

function getNoRestControllersFoundMessage(glob: string): string {
  return `No exported REST controllers found for '${glob}'. Ensure matched files export classes decorated with @Controller.`;
}

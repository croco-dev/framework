import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { Problem, ProblemCategory } from "@croco/problems-core";
import { discoverControllerConstructors, type Constructor } from "@croco/protocols-core";
import { type Diagnostic, Project, type SourceFile, ts } from "ts-morph";

type Controller = Constructor;

const CONTROLLER_TYPESCRIPT_DIAGNOSTIC_CODE = "CROCO_BUILD_003";

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

export async function loadControllers(glob: string): Promise<Controller[]> {
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

  const rootDir = getCommonSourceDir(getProgramEmitSourceFilePaths(project, sourceFiles));
  const emitDir = fs.mkdtempSync(
    path.join(getModuleResolutionRoot(rootDir), ".croco-openapi-spec-"),
  );
  writeCommonJsPackageBoundary(emitDir);
  project.compilerOptions.set({ rootDir, outDir: emitDir });

  try {
    assertNoControllerTypeScriptErrors(project, sourceFiles, glob);
    project.emitSync();
    const controllers: Controller[] = [];

    for (const sourceFile of sourceFiles) {
      const moduleExports = await importEmittedModule(
        getEmittedFilePath(rootDir, emitDir, sourceFile),
      );
      controllers.push(...discoverControllerConstructors(moduleExports));
    }

    if (controllers.length === 0) {
      throw new NoRestControllersFoundProblem(glob);
    }

    return controllers;
  } finally {
    fs.rmSync(emitDir, { recursive: true, force: true });
  }
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

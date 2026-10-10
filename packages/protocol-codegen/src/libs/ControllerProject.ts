import { compareStrings } from "../../../../tooling/compareStrings.mjs";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import { createRequire, isBuiltin } from "node:module";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { Problem, ProblemCategory } from "@croco/problems-core";
import { type Diagnostic, Project, type SourceFile, ts } from "ts-morph";

const CONTROLLER_PROJECT_CONFIG_CODE = "CROCO_BUILD_004";
const LEGACY_COMPILER_OPTIONS = {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2020,
  experimentalDecorators: true,
  emitDecoratorMetadata: true,
  noEmitOnError: true,
  skipLibCheck: true,
} satisfies ts.CompilerOptions;

export type CreateControllerProjectOptions = {
  readonly controllers: string | readonly string[];
  readonly tsconfigPath?: string;
  readonly cwd?: string;
};

export type ControllerModule = Record<string, unknown>;

export interface ControllerProject {
  readonly project: Project;
  readonly controllerSourceFiles: readonly SourceFile[];
  readonly tsconfigPath: string | null;
  readonly sourceRoot: string;
  readonly emitDir: string;
  getPreEmitDiagnostics(): readonly Diagnostic[];
  emit(): void;
  importModule(sourceFile: SourceFile): Promise<ControllerModule>;
  importControllerModules(): Promise<readonly ControllerModule[]>;
  dispose(): void;
}

type ControllerProjectConfigReason = "invalid" | "missing" | "unreadable";

type LoadedTsconfig = {
  readonly referencePaths: readonly string[];
};

type ProjectContext = {
  readonly project: Project;
  readonly sourceFiles: readonly SourceFile[];
};

export class ControllerProjectConfigProblem extends Problem {
  readonly reason: ControllerProjectConfigReason;
  readonly tsconfigPath: string;
  readonly recoveryAction: string;

  constructor(reason: ControllerProjectConfigReason, tsconfigPath: string, detail: string) {
    const recoveryAction =
      "Provide a readable, valid tsconfig path or remove the explicit option to use nearest-config discovery.";
    super(
      "protocol-codegen/controller-project-config",
      ProblemCategory.ValidationError,
      `${CONTROLLER_PROJECT_CONFIG_CODE}: ${detail} Config: ${tsconfigPath}. Recovery: ${recoveryAction}`,
      {
        extensions: {
          crocoCode: CONTROLLER_PROJECT_CONFIG_CODE,
          reason,
          tsconfigPath,
          recoveryAction,
        },
      },
    );
    this.reason = reason;
    this.tsconfigPath = tsconfigPath;
    this.recoveryAction = recoveryAction;
  }
}

class ControllerProjectStateProblem extends Problem {
  constructor(detail: string) {
    super("protocol-codegen/controller-project-state", ProblemCategory.InternalServerError, detail);
  }
}

export function createControllerProject(
  options: CreateControllerProjectOptions,
): ControllerProject {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const controllerPatterns = Array.isArray(options.controllers)
    ? options.controllers
    : [options.controllers];
  const absolutePatterns = controllerPatterns.map((pattern) =>
    path.isAbsolute(pattern) ? path.normalize(pattern) : path.resolve(cwd, pattern),
  );
  const explicitConfigPath = options.tsconfigPath ? path.resolve(cwd, options.tsconfigPath) : null;

  let loadedConfig = explicitConfigPath ? loadTsconfigGraph(explicitConfigPath, true) : null;

  let project = createProject(explicitConfigPath);
  let controllerSourceFiles = addControllerSourceFiles(project, absolutePatterns);
  const controllerRoot = getCommonSourceDirectory(
    controllerSourceFiles.map((sourceFile) => sourceFile.getFilePath()),
    cwd,
  );
  const discoveredConfigPath = explicitConfigPath ?? discoverTsconfig(controllerRoot);

  if (!explicitConfigPath && discoveredConfigPath) {
    loadedConfig = loadTsconfigGraph(discoveredConfigPath, false);
    project = createProject(discoveredConfigPath);
    controllerSourceFiles = addControllerSourceFiles(project, absolutePatterns);
  }

  resolveProjectSourceDependencies(project);
  const referenceProjects = createReferenceProjects(loadedConfig?.referencePaths ?? []);
  const analysisProjects = [project, ...referenceProjects];
  const sourceOwners = getSourceOwners(project, controllerSourceFiles, referenceProjects);
  const analysisContexts = analysisProjects.map((analysisProject) => ({
    project: analysisProject,
    sourceFiles: analysisProject
      .getSourceFiles()
      .filter(
        (sourceFile) =>
          isEmittableSourcePath(sourceFile.getFilePath()) &&
          sourceOwners.get(normalizePath(sourceFile.getFilePath())) === analysisProject,
      ),
  }));
  const emittableSourceFiles = analysisContexts.flatMap((context) => context.sourceFiles);
  const sourceRoot = getCommonSourceDirectory(
    emittableSourceFiles.map((sourceFile) => sourceFile.getFilePath()),
    controllerRoot,
  );
  const emitDir = fs.mkdtempSync(
    path.join(findModuleResolutionRoot(controllerRoot, cwd), ".croco-protocol-codegen-"),
  );
  const emitContexts = analysisContexts.map((context) =>
    createEmitContext(context, sourceRoot, emitDir),
  );
  const outputPaths = new Map(
    emittableSourceFiles.map((sourceFile) => [
      normalizePath(sourceFile.getFilePath()),
      getEmittedFilePath(sourceRoot, emitDir, sourceFile.getFilePath()),
    ]),
  );

  let disposed = false;
  let emitted = false;

  const session: ControllerProject = {
    project,
    controllerSourceFiles,
    tsconfigPath: discoveredConfigPath,
    sourceRoot,
    emitDir,
    getPreEmitDiagnostics(): readonly Diagnostic[] {
      assertActive(disposed);
      return collectPreEmitDiagnostics(analysisContexts, sourceOwners);
    },
    emit(): void {
      assertActive(disposed);
      for (const context of emitContexts) {
        for (const sourceFile of context.sourceFiles) sourceFile.emitSync();
        rewriteRuntimeSpecifiers(context, sourceRoot, emitDir, outputPaths);
        writeModuleBoundaries(context, sourceRoot, emitDir);
      }
      emitted = true;
    },
    async importModule(sourceFile: SourceFile): Promise<ControllerModule> {
      assertActive(disposed);
      if (!emitted) {
        throw new ControllerProjectStateProblem(
          "Controller project must be emitted before importing modules.",
        );
      }
      if (!controllerSourceFiles.includes(sourceFile)) {
        throw new ControllerProjectStateProblem(
          `Source file is not an explicitly matched controller: ${sourceFile.getFilePath()}`,
        );
      }
      const emittedPath = getEmittedFilePath(sourceRoot, emitDir, sourceFile.getFilePath());
      return (await import(pathToFileURL(emittedPath).href)) as ControllerModule;
    },
    async importControllerModules(): Promise<readonly ControllerModule[]> {
      return Promise.all(
        controllerSourceFiles.map((sourceFile) => session.importModule(sourceFile)),
      );
    },
    dispose(): void {
      if (disposed) return;
      fs.rmSync(emitDir, { recursive: true, force: true });
      disposed = true;
    },
  };

  return session;
}

function createProject(tsconfigPath: string | null): Project {
  return tsconfigPath
    ? new Project({ tsConfigFilePath: tsconfigPath, skipAddingFilesFromTsConfig: true })
    : new Project({ compilerOptions: LEGACY_COMPILER_OPTIONS });
}

function addControllerSourceFiles(project: Project, patterns: readonly string[]): SourceFile[] {
  const sourceFiles = patterns.flatMap((pattern) => project.addSourceFilesAtPaths(pattern));
  return [
    ...new Map(sourceFiles.map((sourceFile) => [sourceFile.getFilePath(), sourceFile])).values(),
  ].sort((left, right) => compareStrings(left.getFilePath(), right.getFilePath()));
}

function resolveProjectSourceDependencies(project: Project): void {
  project.resolveSourceFileDependencies();
  let addedDynamicDependency: boolean;

  do {
    addedDynamicDependency = false;
    const compilerOptions = project.getCompilerOptions();

    for (const sourceFile of project.getSourceFiles()) {
      const sourcePath = sourceFile.getFilePath();
      const visit = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node) &&
          node.expression.kind === ts.SyntaxKind.ImportKeyword &&
          node.arguments.length >= 1 &&
          ts.isStringLiteral(node.arguments[0])
        ) {
          const resolvedPath = ts.resolveModuleName(
            node.arguments[0].text,
            sourcePath,
            compilerOptions,
            ts.sys,
          ).resolvedModule?.resolvedFileName;
          if (
            resolvedPath &&
            isEmittableSourcePath(resolvedPath) &&
            !project.getSourceFile(resolvedPath)
          ) {
            project.addSourceFileAtPath(resolvedPath);
            addedDynamicDependency = true;
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(sourceFile.compilerNode);
    }

    if (addedDynamicDependency) project.resolveSourceFileDependencies();
  } while (addedDynamicDependency);
}

function createReferenceProjects(referencePaths: readonly string[]): Project[] {
  return referencePaths.map((referencePath) => {
    const project = createProject(referencePath);
    project.addSourceFilesFromTsConfig(referencePath);
    resolveProjectSourceDependencies(project);
    return project;
  });
}

function getSourceOwners(
  rootProject: Project,
  controllerSourceFiles: readonly SourceFile[],
  referenceProjects: readonly Project[],
): ReadonlyMap<string, Project> {
  const owners = new Map<string, Project>();
  for (const sourceFile of rootProject.getSourceFiles()) {
    if (isEmittableSourcePath(sourceFile.getFilePath())) {
      owners.set(normalizePath(sourceFile.getFilePath()), rootProject);
    }
  }
  for (const referenceProject of referenceProjects) {
    for (const sourceFile of referenceProject.getSourceFiles()) {
      if (isEmittableSourcePath(sourceFile.getFilePath())) {
        owners.set(normalizePath(sourceFile.getFilePath()), referenceProject);
      }
    }
  }
  for (const sourceFile of controllerSourceFiles) {
    owners.set(normalizePath(sourceFile.getFilePath()), rootProject);
  }
  return owners;
}

function createEmitContext(
  analysisContext: ProjectContext,
  sourceRoot: string,
  emitDir: string,
): ProjectContext {
  const project = new Project({
    compilerOptions: createEmitCompilerOptions(
      analysisContext.project.getCompilerOptions(),
      sourceRoot,
      emitDir,
    ),
    skipFileDependencyResolution: true,
  });
  const sourceFiles = analysisContext.sourceFiles.map((sourceFile) =>
    project.addSourceFileAtPath(sourceFile.getFilePath()),
  );
  return { project, sourceFiles };
}

function collectPreEmitDiagnostics(
  contexts: readonly ProjectContext[],
  sourceOwners: ReadonlyMap<string, Project>,
): readonly Diagnostic[] {
  const diagnostics = new Map<string, Diagnostic>();
  for (const context of contexts) {
    for (const diagnostic of context.project.getPreEmitDiagnostics()) {
      const compilerDiagnostic = diagnostic.compilerObject;
      const filePath = compilerDiagnostic.file?.fileName;
      if (filePath && sourceOwners.get(normalizePath(filePath)) !== context.project) {
        continue;
      }
      const key = [
        compilerDiagnostic.code,
        compilerDiagnostic.category,
        filePath ?? "",
        compilerDiagnostic.start ?? "",
        ts.flattenDiagnosticMessageText(compilerDiagnostic.messageText, "\n"),
      ].join(":");
      diagnostics.set(key, diagnostic);
    }
  }
  return [...diagnostics.values()];
}

function createEmitCompilerOptions(
  applicationOptions: ts.CompilerOptions,
  rootDir: string,
  outDir: string,
): ts.CompilerOptions {
  const compilerOptions = { ...applicationOptions };
  delete compilerOptions.declarationDir;
  delete compilerOptions.outFile;
  delete compilerOptions.tsBuildInfoFile;
  delete compilerOptions.isolatedDeclarations;
  return {
    ...compilerOptions,
    rootDir,
    outDir,
    noEmit: false,
    noEmitOnError: false,
    emitDeclarationOnly: false,
    declaration: false,
    declarationMap: false,
    incremental: false,
    composite: false,
  };
}

function loadTsconfigGraph(tsconfigPath: string, explicit: boolean): LoadedTsconfig {
  const visited = new Set<string>();
  const referencePaths: string[] = [];

  const visit = (configPath: string, isExplicitRoot: boolean): void => {
    const normalizedPath = path.resolve(configPath);
    if (visited.has(normalizedPath)) return;
    visited.add(normalizedPath);

    const parsed = validateTsconfig(normalizedPath, isExplicitRoot);
    if (normalizedPath !== path.resolve(tsconfigPath)) referencePaths.push(normalizedPath);
    for (const reference of parsed.projectReferences ?? []) {
      visit(ts.resolveProjectReferencePath(reference), false);
    }
  };

  const rootPath = path.resolve(tsconfigPath);
  visit(rootPath, explicit);
  return { referencePaths };
}

function validateTsconfig(tsconfigPath: string, explicit: boolean): ts.ParsedCommandLine {
  if (!fs.existsSync(tsconfigPath)) {
    throw new ControllerProjectConfigProblem(
      "missing",
      tsconfigPath,
      `${explicit ? "Explicit" : "Discovered"} TypeScript configuration does not exist.`,
    );
  }

  let configText: string;
  try {
    configText = fs.readFileSync(tsconfigPath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ControllerProjectConfigProblem(
      "unreadable",
      tsconfigPath,
      `TypeScript configuration cannot be read: ${message}`,
    );
  }

  const parsedText = ts.parseConfigFileTextToJson(tsconfigPath, configText);
  if (parsedText.error) {
    throw invalidConfigProblem(tsconfigPath, [parsedText.error]);
  }
  const parsed = ts.parseJsonConfigFileContent(
    parsedText.config,
    ts.sys,
    path.dirname(tsconfigPath),
    {},
    tsconfigPath,
  );
  const relevantErrors = parsed.errors.filter((diagnostic) => diagnostic.code !== 18003);
  if (relevantErrors.length > 0) {
    throw invalidConfigProblem(tsconfigPath, relevantErrors);
  }
  return parsed;
}

function invalidConfigProblem(
  tsconfigPath: string,
  diagnostics: readonly ts.Diagnostic[],
): ControllerProjectConfigProblem {
  const reason = diagnostics
    .map(
      (diagnostic) =>
        `TS${diagnostic.code}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`,
    )
    .join("; ");
  return new ControllerProjectConfigProblem(
    "invalid",
    tsconfigPath,
    `TypeScript configuration is invalid: ${reason}`,
  );
}

function discoverTsconfig(startDirectory: string): string | null {
  let directory = startDirectory;
  while (true) {
    const candidate = path.join(directory, "tsconfig.json");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
}

export function getCommonSourceDirectory(
  sourceFilePaths: readonly string[],
  fallback = process.cwd(),
): string {
  if (sourceFilePaths.length === 0) return path.resolve(fallback);
  let commonDirectory = path.dirname(path.resolve(sourceFilePaths[0]));
  for (const sourceFilePath of sourceFilePaths.slice(1)) {
    const directory = path.dirname(path.resolve(sourceFilePath));
    while (!isPathInside(commonDirectory, directory)) {
      const parent = path.dirname(commonDirectory);
      if (parent === commonDirectory) return commonDirectory;
      commonDirectory = parent;
    }
  }
  return commonDirectory;
}

function isPathInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
  );
}

function rewriteRuntimeSpecifiers(
  context: ProjectContext,
  sourceRoot: string,
  emitDir: string,
  outputPaths: ReadonlyMap<string, string>,
): void {
  const compilerOptions = context.project.getCompilerOptions();
  const externalImports: ExternalImport[] = [];
  const outputs: Array<{
    emittedPath: string;
    emittedText: string;
    replacements: SpecifierReplacement[];
  }> = [];

  for (const sourceFile of context.sourceFiles) {
    const sourcePath = sourceFile.getFilePath();
    if (!isEmittableSourcePath(sourcePath) || sourcePath.endsWith(".json")) continue;
    const emittedPath = getEmittedFilePath(sourceRoot, emitDir, sourcePath);
    if (!fs.existsSync(emittedPath)) continue;
    const emittedText = fs.readFileSync(emittedPath, "utf8");
    const syntaxTree = ts.createSourceFile(emittedPath, emittedText, ts.ScriptTarget.Latest, true);
    const replacements: SpecifierReplacement[] = [];
    const checker = createRuntimeBindingChecker(syntaxTree);

    const visit = (node: ts.Node): void => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        addRuntimeAliasReplacement(
          node.moduleSpecifier,
          sourcePath,
          emittedPath,
          compilerOptions,
          outputPaths,
          syntaxTree,
          replacements,
          false,
          false,
          externalImports,
        );
      }
      if (
        ts.isCallExpression(node) &&
        node.arguments.length === 1 &&
        ts.isStringLiteral(node.arguments[0]) &&
        isGenuineRequireCall(node, checker)
      ) {
        addRuntimeAliasReplacement(
          node.arguments[0],
          sourcePath,
          emittedPath,
          compilerOptions,
          outputPaths,
          syntaxTree,
          replacements,
          true,
          false,
          externalImports,
        );
      }
      if (
        ts.isCallExpression(node) &&
        (node.expression.getText(syntaxTree) === "import" ||
          node.expression.kind === ts.SyntaxKind.ImportKeyword) &&
        node.arguments.length >= 1 &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        addRuntimeAliasReplacement(
          node.arguments[0],
          sourcePath,
          emittedPath,
          compilerOptions,
          outputPaths,
          syntaxTree,
          replacements,
          false,
          true,
          externalImports,
        );
      }
      ts.forEachChild(node, visit);
    };
    visit(syntaxTree);

    outputs.push({ emittedPath, emittedText, replacements });
  }

  const resolvedImports = resolveExternalImports(externalImports);
  for (const [index, externalImport] of externalImports.entries()) {
    const resolved = resolvedImports[index];
    if (resolved === undefined) {
      throw new ControllerProjectStateProblem(
        "External dependency resolver returned an incomplete result.",
      );
    }
    addSpecifierReplacement(
      externalImport.moduleSpecifier,
      resolved,
      externalImport.syntaxTree,
      externalImport.replacements,
    );
  }

  for (const { emittedPath, emittedText, replacements } of outputs) {
    let rewritten = emittedText;
    for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
      rewritten = `${rewritten.slice(0, replacement.start)}${replacement.value}${rewritten.slice(replacement.end)}`;
    }
    if (rewritten !== emittedText) fs.writeFileSync(emittedPath, rewritten);
  }
}

function addRuntimeAliasReplacement(
  moduleSpecifier: ts.StringLiteral,
  sourcePath: string,
  emittedPath: string,
  compilerOptions: ts.CompilerOptions,
  outputPaths: ReadonlyMap<string, string>,
  syntaxTree: ts.SourceFile,
  replacements: Array<{ start: number; end: number; value: string }>,
  isRequireCall: boolean,
  isDynamicImport: boolean,
  externalImports: ExternalImport[],
): void {
  const specifier = moduleSpecifier.text;
  if (path.isAbsolute(specifier)) return;
  const resolved = ts.resolveModuleName(
    specifier,
    sourcePath,
    compilerOptions,
    ts.sys,
  ).resolvedModule;
  const targetOutput = resolved
    ? outputPaths.get(normalizePath(resolved.resolvedFileName))
    : undefined;
  if (targetOutput) {
    let relative = path.relative(path.dirname(emittedPath), targetOutput).split(path.sep).join("/");
    if (!relative.startsWith(".")) relative = `./${relative}`;
    addSpecifierReplacement(moduleSpecifier, relative, syntaxTree, replacements);
    return;
  }
  const useImportCondition =
    isDynamicImport || (!isRequireCall && isEsmModuleKind(compilerOptions.module, sourcePath));
  if (!specifier.startsWith(".") && !isBuiltin(specifier)) {
    if (useImportCondition) {
      externalImports.push({ moduleSpecifier, sourcePath, syntaxTree, replacements });
    } else {
      let runtimePath: string;
      try {
        runtimePath = createRequire(sourcePath).resolve(specifier);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new ControllerProjectStateProblem(
          `Cannot resolve ${specifier} from ${sourcePath}: ${detail}`,
        );
      }
      addSpecifierReplacement(moduleSpecifier, runtimePath, syntaxTree, replacements);
    }
    return;
  }
  if (!specifier.startsWith(".")) return;
  const typeScriptSpecifier = rewriteTypeScriptExtension(specifier);
  if (typeScriptSpecifier !== specifier) {
    addSpecifierReplacement(moduleSpecifier, typeScriptSpecifier, syntaxTree, replacements);
  }
}

function createRuntimeBindingChecker(syntaxTree: ts.SourceFile): ts.TypeChecker {
  const options: ts.CompilerOptions = { allowJs: true, noResolve: true, noLib: true };
  const host = ts.createCompilerHost(options);
  host.getSourceFile = (fileName) => (fileName === syntaxTree.fileName ? syntaxTree : undefined);
  return ts.createProgram([syntaxTree.fileName], options, host).getTypeChecker();
}

function isGenuineRequireCall(node: ts.CallExpression, checker: ts.TypeChecker): boolean {
  return (
    ts.isIdentifier(node.expression) &&
    node.expression.text === "require" &&
    (checker.getSymbolAtLocation(node.expression)?.declarations?.length ?? 0) === 0
  );
}

function addSpecifierReplacement(
  moduleSpecifier: ts.StringLiteral,
  value: string,
  syntaxTree: ts.SourceFile,
  replacements: Array<{ start: number; end: number; value: string }>,
): void {
  replacements.push({
    start: moduleSpecifier.getStart(syntaxTree),
    end: moduleSpecifier.getEnd(),
    value: JSON.stringify(value),
  });
}

function rewriteTypeScriptExtension(specifier: string): string {
  return specifier
    .replace(/\.mts$/, ".mjs")
    .replace(/\.cts$/, ".cjs")
    .replace(/\.tsx?$/, ".js");
}

type SpecifierReplacement = { start: number; end: number; value: string };

type ExternalImport = {
  moduleSpecifier: ts.StringLiteral;
  sourcePath: string;
  syntaxTree: ts.SourceFile;
  replacements: SpecifierReplacement[];
};

const RESOLVE_EXTERNAL_IMPORTS = `
import { readFileSync } from 'node:fs';
try {
  const requests = JSON.parse(readFileSync(0, 'utf8'));
  process.stdout.write(JSON.stringify(requests.map(({ specifier, parentURL }) =>
    import.meta.resolve(specifier, parentURL)
  )));
} catch (error) {
  process.stderr.write(error.message);
  process.exitCode = 1;
}
`;

function resolveExternalImports(imports: readonly ExternalImport[]): readonly string[] {
  if (imports.length === 0) return [];
  let output: string;
  try {
    output = execFileSync(
      process.execPath,
      [
        ...getResolutionFlags(),
        "--experimental-import-meta-resolve",
        "--input-type=module",
        "--eval",
        RESOLVE_EXTERNAL_IMPORTS,
      ],
      {
        input: JSON.stringify(
          imports.map(({ moduleSpecifier, sourcePath }) => ({
            specifier: moduleSpecifier.text,
            parentURL: pathToFileURL(sourcePath).href,
          })),
        ),
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        maxBuffer: 10 * 1024 * 1024,
      },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new ControllerProjectStateProblem(
      `Cannot resolve application ESM dependencies: ${detail}`,
    );
  }
  const resolved: unknown = JSON.parse(output);
  if (
    !Array.isArray(resolved) ||
    resolved.length !== imports.length ||
    !resolved.every((entry: unknown) => typeof entry === "string")
  ) {
    throw new ControllerProjectStateProblem(
      "External dependency resolver returned an invalid result.",
    );
  }
  return resolved as string[];
}

function getResolutionFlags(): readonly string[] {
  const flags: string[] = [];
  const toggles = new Set([
    "addons",
    "require-module",
    "experimental-require-module",
    "preserve-symlinks",
    "preserve-symlinks-main",
  ]);
  for (let index = 0; index < process.execArgv.length; index++) {
    const argument = process.execArgv[index];
    const equals = argument.indexOf("=");
    const name = (equals === -1 ? argument : argument.slice(0, equals)).replaceAll("_", "-");
    if (name === "--conditions" || name === "-C") {
      if (equals !== -1) {
        flags.push(`${name}${argument.slice(equals)}`);
      } else {
        const value = process.execArgv[++index];
        if (value === undefined)
          throw new ControllerProjectStateProblem("Missing Node export condition.");
        flags.push(name, value);
      }
    } else if (toggles.has(name.replace(/^--(?:no-)?/, ""))) {
      flags.push(name);
    }
  }
  return flags;
}

function isEsmModuleKind(moduleKind: ts.ModuleKind | undefined, sourcePath: string): boolean {
  return (
    moduleKind === ts.ModuleKind.ES2015 ||
    moduleKind === ts.ModuleKind.ES2020 ||
    moduleKind === ts.ModuleKind.ES2022 ||
    moduleKind === ts.ModuleKind.ESNext ||
    moduleKind === ts.ModuleKind.Preserve ||
    ((moduleKind === ts.ModuleKind.Node16 || moduleKind === ts.ModuleKind.NodeNext) &&
      sourceUsesEsmBoundary(sourcePath))
  );
}

function writeModuleBoundaries(context: ProjectContext, sourceRoot: string, emitDir: string): void {
  const moduleKind = context.project.getCompilerOptions().module;

  for (const sourceFile of context.sourceFiles) {
    const sourcePath = sourceFile.getFilePath();
    if (sourcePath.endsWith(".json")) continue;
    const emittedPath = getEmittedFilePath(sourceRoot, emitDir, sourcePath);
    if (!fs.existsSync(emittedPath)) continue;
    const isEsm = isEsmModuleKind(moduleKind, sourcePath);
    fs.writeFileSync(
      path.join(path.dirname(emittedPath), "package.json"),
      JSON.stringify({ type: isEsm ? "module" : "commonjs" }),
    );
  }
}

function sourceUsesEsmBoundary(sourcePath: string): boolean {
  if (sourcePath.endsWith(".mts")) return true;
  if (sourcePath.endsWith(".cts")) return false;
  let directory = path.dirname(sourcePath);
  while (true) {
    const packagePath = path.join(directory, "package.json");
    if (fs.existsSync(packagePath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8")) as { type?: unknown };
        return packageJson.type === "module";
      } catch {
        return false;
      }
    }
    const parent = path.dirname(directory);
    if (parent === directory) return false;
    directory = parent;
  }
}

function getEmittedFilePath(sourceRoot: string, emitDir: string, sourcePath: string): string {
  const relativePath = path
    .relative(sourceRoot, sourcePath)
    .replace(/\.mts$/, ".mjs")
    .replace(/\.cts$/, ".cjs")
    .replace(/\.tsx?$/, ".js");
  return path.join(emitDir, relativePath);
}

function findModuleResolutionRoot(sourceDirectory: string, fallback: string): string {
  let directory = sourceDirectory;
  while (true) {
    if (fs.existsSync(path.join(directory, "node_modules"))) return directory;
    const parent = path.dirname(directory);
    if (parent === directory) return fallback;
    directory = parent;
  }
}

function isEmittableSourcePath(filePath: string): boolean {
  return (
    /(?:\.[cm]?tsx?|\.json)$/.test(filePath) &&
    !/\.d\.[cm]?ts$/.test(filePath) &&
    !filePath.split(path.sep).includes("node_modules")
  );
}

function normalizePath(filePath: string): string {
  return path.normalize(filePath);
}

function assertActive(disposed: boolean): void {
  if (disposed) {
    throw new ControllerProjectStateProblem("Controller project has been disposed.");
  }
}

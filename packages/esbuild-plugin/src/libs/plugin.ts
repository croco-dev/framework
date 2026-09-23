import * as fs from "node:fs";
import * as path from "node:path";
import type * as esbuild from "esbuild";
import * as ts from "typescript";
import {
  DiCompilerError,
  collectDiGraphWatchInputs,
  compileDiGraph,
  type DiCompilerOptions,
  type DiCompilerResult,
  writeDiGraph,
} from "./DiCompiler";

const REFLECT_METADATA_IMPORT = "import 'reflect-metadata';";

export interface CrocoPluginConfig {
  reflectMetadata?: boolean;
  scan?: {
    dirs?: string[];
    exclude?: string[];
    cache?: boolean;
    /** @deprecated Croco stereotypes are recognized by symbol identity. */
    decorators?: string[];
  };
  watch?: {
    optimize?: boolean;
    debounce?: number;
  };
  di?: {
    enabled?: boolean;
    graphId?: string;
    outFile?: string;
    manifestFile?: string;
    tsconfig?: string;
    packageDescriptors?: string[];
    bindings?: DiCompilerOptions["bindings"];
    modules?: DiCompilerOptions["modules"];
    moduleProviders?: DiCompilerOptions["moduleProviders"];
  };
  /** @deprecated Use `di` generated graph options. */
  generateRegistry?: {
    enabled: boolean;
    outDir?: string;
    outFile?: string;
  };
}

interface NormalizedCrocoPluginConfig {
  readonly reflectMetadata: boolean;
  readonly scan: {
    readonly dirs: readonly string[];
    readonly exclude: readonly string[];
  };
  readonly di: {
    readonly enabled: boolean;
    readonly graphId?: string;
    readonly outFile: string;
    readonly manifestFile: string;
    readonly tsconfig?: string;
    readonly packageDescriptors: readonly string[];
    readonly bindings: DiCompilerOptions["bindings"];
    readonly modules: DiCompilerOptions["modules"];
    readonly moduleProviders: DiCompilerOptions["moduleProviders"];
  };
}

function normalizeConfig(config: CrocoPluginConfig | undefined): NormalizedCrocoPluginConfig {
  return {
    reflectMetadata: config?.reflectMetadata ?? true,
    scan: {
      dirs: config?.scan?.dirs ?? ["src"],
      exclude: config?.scan?.exclude ?? [
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/__tests__/**",
        "**/fixtures/**",
        "**/benchmarks/**",
        "**/scripts/**",
        "**/.croco/**",
        "**/generated/**",
        "**/client/**",
        "**/node_modules/**",
      ],
    },
    di: {
      enabled: config?.di?.enabled ?? true,
      ...(config?.di?.graphId ? { graphId: config.di.graphId } : {}),
      outFile: config?.di?.outFile ?? ".croco/di.generated.ts",
      manifestFile: config?.di?.manifestFile ?? ".croco/di.manifest.json",
      ...(config?.di?.tsconfig ? { tsconfig: config.di.tsconfig } : {}),
      packageDescriptors: config?.di?.packageDescriptors ?? [],
      bindings: config?.di?.bindings,
      modules: config?.di?.modules,
      moduleProviders: config?.di?.moduleProviders,
    },
  };
}

function resolveEntryPointPath(entryPoint: string | { in: string; out: string }): string {
  return typeof entryPoint === "string" ? entryPoint : entryPoint.in;
}

function resolveScanRoot(build: esbuild.PluginBuild): string {
  return path.resolve(build.initialOptions.absWorkingDir ?? process.cwd());
}

function resolveEntryPointPaths(
  rawEntryPoints: esbuild.BuildOptions["entryPoints"] | undefined,
  scanRoot: string,
): string[] {
  const entryPoints = Array.isArray(rawEntryPoints)
    ? rawEntryPoints
    : rawEntryPoints && typeof rawEntryPoints === "object"
      ? Object.values(rawEntryPoints)
      : [];

  return entryPoints.map((entryPoint) => {
    const resolvedPath = resolveEntryPointPath(entryPoint);
    return path.isAbsolute(resolvedPath) ? resolvedPath : path.resolve(scanRoot, resolvedPath);
  });
}

function toEntryImport(entryPoint: string, target: string): string {
  const relative = path
    .relative(path.dirname(entryPoint), target)
    .replace(/\.(tsx?|mts|cts)$/u, "")
    .replace(/\\/gu, "/");
  return relative.startsWith(".") ? relative : `./${relative}`;
}

function toBuildErrors(error: unknown): esbuild.PartialMessage[] {
  if (error instanceof DiCompilerError) {
    return error.diagnostics.map((diagnostic) => ({
      text: `${diagnostic.code}: ${diagnostic.message}`,
      detail: error,
      location: {
        file: diagnostic.file,
        line: diagnostic.line,
        column: diagnostic.column - 1,
        length: 0,
        lineText: "",
      },
    }));
  }
  return [
    {
      text: `Croco DI compilation failed: ${error instanceof Error ? error.message : String(error)}`,
      detail: error,
    },
  ];
}

function createGraphImportContent(
  entryPoint: string,
  result: DiCompilerResult,
  binding: string,
): string {
  const graphImport = toEntryImport(entryPoint, result.outFile);
  return [
    "// @croco/generated-di-graph",
    `import { generatedDiGraph as ${binding} } from ${JSON.stringify(graphImport)};`,
  ].join("\n");
}

function attachGraphToApplicationRuntime(
  source: string,
  entryPoint: string,
):
  | {
      readonly contents: string;
      readonly binding?: string;
    }
  | undefined {
  const sourceFile = ts.createSourceFile(
    entryPoint,
    source,
    ts.ScriptTarget.Latest,
    true,
    entryPoint.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const factoryNames = new Set<string>();
  const namespaceNames = new Set<string>();
  const identifiers = new Set<string>();
  const collectIdentifiers = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) identifiers.add(node.text);
    ts.forEachChild(node, collectIdentifiers);
  };
  collectIdentifiers(sourceFile);
  let binding = "crocoGeneratedDiGraph";
  while (identifiers.has(binding)) binding += "_";

  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== "@croco/framework-module"
    ) {
      continue;
    }
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        if ((element.propertyName?.text ?? element.name.text) === "createApplicationRuntime") {
          factoryNames.add(element.name.text);
        }
      }
    } else if (bindings && ts.isNamespaceImport(bindings)) {
      namespaceNames.add(bindings.name.text);
    }
  }

  const insertions: Array<{ readonly position: number; readonly text: string }> = [];
  let foundRuntime = false;
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const directFactory =
        ts.isIdentifier(node.expression) && factoryNames.has(node.expression.text);
      const namespaceFactory =
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "createApplicationRuntime" &&
        ts.isIdentifier(node.expression.expression) &&
        namespaceNames.has(node.expression.expression.text);
      if (directFactory || namespaceFactory) {
        foundRuntime = true;
        if (node.arguments.length < 2)
          insertions.push({
            position: node.end - 1,
            text:
              node.arguments.length === 0
                ? `undefined, ${binding}`
                : `${node.arguments.hasTrailingComma ? "" : ","} ${binding}`,
          });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  if (!foundRuntime) {
    return undefined;
  }

  let transformed = source;
  for (const insertion of insertions.sort((left, right) => right.position - left.position)) {
    transformed = `${transformed.slice(0, insertion.position)}${insertion.text}${transformed.slice(insertion.position)}`;
  }
  return { contents: transformed, ...(insertions.length > 0 ? { binding } : {}) };
}

export function crocoPlugin(config?: CrocoPluginConfig): esbuild.Plugin {
  const normalizedConfig = normalizeConfig(config);
  let entryPointPaths: string[] = [];
  let compiledGraph: DiCompilerResult | undefined;
  let boundRuntime = false;
  let graphWatchFiles: string[] = [];
  let graphWatchDirs: string[] = [];
  let graphErrors: esbuild.PartialMessage[] = [];

  return {
    name: "croco-plugin",
    setup(build: esbuild.PluginBuild) {
      build.onStart(() => {
        const scanRoot = resolveScanRoot(build);
        entryPointPaths = resolveEntryPointPaths(build.initialOptions.entryPoints, scanRoot);
        compiledGraph = undefined;
        boundRuntime = false;
        graphErrors = [];
        const isServerBuild = build.initialOptions.platform !== "browser";
        if (
          !normalizedConfig.di.enabled ||
          !isServerBuild ||
          normalizedConfig.scan.dirs.length === 0
        ) {
          return undefined;
        }

        try {
          const result = compileDiGraph({
            baseDir: scanRoot,
            scanDirs: normalizedConfig.scan.dirs,
            exclude: normalizedConfig.scan.exclude,
            ...(normalizedConfig.di.graphId ? { graphId: normalizedConfig.di.graphId } : {}),
            outFile: normalizedConfig.di.outFile,
            manifestFile: normalizedConfig.di.manifestFile,
            ...(normalizedConfig.di.tsconfig ? { tsconfig: normalizedConfig.di.tsconfig } : {}),
            packageDescriptors: normalizedConfig.di.packageDescriptors,
            ...(normalizedConfig.di.bindings ? { bindings: normalizedConfig.di.bindings } : {}),
            ...(normalizedConfig.di.modules ? { modules: normalizedConfig.di.modules } : {}),
            ...(normalizedConfig.di.moduleProviders
              ? { moduleProviders: normalizedConfig.di.moduleProviders }
              : {}),
          });
          writeDiGraph(result);
          graphWatchFiles = [...result.watchFiles];
          graphWatchDirs = [...result.watchDirs];
          compiledGraph = result;
          return undefined;
        } catch (error) {
          graphErrors = toBuildErrors(error);
          const watchInputs = collectDiGraphWatchInputs({
            baseDir: scanRoot,
            scanDirs: normalizedConfig.scan.dirs,
            exclude: normalizedConfig.scan.exclude,
            ...(normalizedConfig.di.tsconfig ? { tsconfig: normalizedConfig.di.tsconfig } : {}),
            packageDescriptors: normalizedConfig.di.packageDescriptors,
            ...(normalizedConfig.di.bindings ? { bindings: normalizedConfig.di.bindings } : {}),
            ...(normalizedConfig.di.moduleProviders
              ? { moduleProviders: normalizedConfig.di.moduleProviders }
              : {}),
          });
          graphWatchFiles = [...new Set([...graphWatchFiles, ...watchInputs.watchFiles])].sort();
          graphWatchDirs = [...new Set([...graphWatchDirs, ...watchInputs.watchDirs])].sort();
          if (graphWatchDirs.length === 0) graphWatchDirs = [scanRoot];
          return undefined;
        }
      });

      build.onEnd((result) => {
        if (compiledGraph && !boundRuntime && result.errors.length === 0) {
          return {
            errors: [
              {
                text: "CROCO_DI_COMPILE_001: Server builds with generated providers must bind an app-scoped runtime with createApplicationRuntime(...).",
                location: {
                  file: entryPointPaths[0] ?? resolveScanRoot(build),
                  line: 1,
                  column: 0,
                },
              },
            ],
          };
        }
        return undefined;
      });

      build.onLoad({ filter: /\.[cm]?tsx?$/ }, async (args: { path: string }) => {
        const isEntryPoint = entryPointPaths.includes(args.path);
        if (isEntryPoint && graphErrors.length > 0) {
          return { errors: graphErrors, watchFiles: graphWatchFiles, watchDirs: graphWatchDirs };
        }
        const relativePath = path.relative(resolveScanRoot(build), args.path);
        const isLocalModule =
          !relativePath.startsWith(`..${path.sep}`) &&
          !path.isAbsolute(relativePath) &&
          !relativePath.split(path.sep).includes("node_modules");
        if (
          !isEntryPoint &&
          (!compiledGraph || !isLocalModule || args.path === compiledGraph.outFile)
        ) {
          return undefined;
        }
        const prependContents: string[] = [];
        if (isEntryPoint && normalizedConfig.reflectMetadata) {
          prependContents.push(REFLECT_METADATA_IMPORT);
        }
        const originalContent = fs.readFileSync(args.path, "utf-8");
        const attachment = compiledGraph
          ? attachGraphToApplicationRuntime(originalContent, args.path)
          : undefined;
        if (attachment) {
          boundRuntime = true;
          if (attachment.binding && compiledGraph)
            prependContents.push(
              createGraphImportContent(args.path, compiledGraph, attachment.binding),
            );
        }
        const contents = attachment?.contents ?? originalContent;
        const importPosition = contents.startsWith("#!") ? contents.indexOf("\n") + 1 : 0;
        return {
          contents:
            prependContents.length > 0
              ? `${contents.slice(0, importPosition)}${prependContents.join("\n\n")}\n\n${contents.slice(importPosition)}`
              : contents,
          loader: path.extname(args.path).toLowerCase() === ".tsx" ? "tsx" : "ts",
          watchFiles: graphWatchFiles,
          watchDirs: graphWatchDirs,
        };
      });
    },
  };
}

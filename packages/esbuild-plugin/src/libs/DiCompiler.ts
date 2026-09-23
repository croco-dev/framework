import { createHash } from "node:crypto";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";
import * as ts from "typescript";

export const DI_COMPILER_VERSION = "croco.di-compiler.v1" as const;
export const DI_MANIFEST_VERSION = "croco.di-compiler.manifest.v1" as const;
export const DI_PACKAGE_DESCRIPTOR_VERSION = "croco.di-package-descriptor.v1" as const;

const DEFAULT_SCAN_DIRS = ["src"];
const DEFAULT_EXCLUDES = [
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
];
const STEREOTYPES = new Set(["Component", "Controller", "GraphQLResolver"]);

export type DiCompilerOptions = {
  readonly baseDir?: string;
  readonly scanDirs?: readonly string[];
  readonly exclude?: readonly string[];
  readonly graphId?: string;
  readonly outFile?: string;
  readonly manifestFile?: string;
  readonly tsconfig?: string;
  readonly packageDescriptors?: readonly string[];
  readonly packageName?: string;
  readonly moduleProviders?: readonly {
    readonly token: ImportReference;
    readonly moduleId: string;
    readonly scope: "singleton";
    readonly dependencies?: readonly {
      readonly token: ImportReference;
      readonly optional?: boolean;
    }[];
  }[];
  readonly bindings?: readonly {
    readonly token: ImportReference;
    readonly useExisting: ImportReference;
    readonly multiple?: boolean;
    readonly override?: boolean;
  }[];
  readonly modules?: readonly {
    readonly id: string;
    readonly providers: readonly string[];
    readonly imports?: readonly string[];
    readonly exports?: readonly string[];
  }[];
};

export type DiCompilerDiagnostic = {
  readonly code:
    | "CROCO_DI_COMPILE_001"
    | "CROCO_DI_COMPILE_002"
    | "CROCO_DI_COMPILE_003"
    | "CROCO_DI_COMPILE_004";
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly message: string;
};

export type DiManifestDependency = {
  readonly tokenId: string;
  readonly reason: "constructor-type" | "explicit-token" | "explicit-many-token";
  readonly optional?: boolean;
  readonly parameterIndex?: number;
  readonly propertyKey?: string;
  readonly source: DiSourceLocation;
};

export type DiManifestProvider = {
  readonly tokenId: string;
  readonly exportName: string;
  readonly stereotype: string;
  readonly scope: "singleton" | "request" | "transient";
  readonly source: DiSourceLocation;
  readonly dependencies: readonly DiManifestDependency[];
  readonly multiple?: boolean;
  readonly moduleName?: string;
};

export type DiSourceLocation = {
  readonly file: string;
  readonly line: number;
  readonly column: number;
};

export type DiCompilerManifest = {
  readonly version: typeof DI_MANIFEST_VERSION;
  readonly compilerVersion: typeof DI_COMPILER_VERSION;
  readonly graphId: string;
  readonly inputHash: string;
  readonly scan: {
    readonly roots: readonly string[];
    readonly excluded: readonly string[];
  };
  readonly providers: readonly DiManifestProvider[];
  readonly roots: readonly string[];
  readonly packages: readonly DiLinkedPackage[];
  readonly modules?: DiCompilerOptions["modules"];
};

export type DiLinkedPackage = {
  readonly packageName: string;
  readonly packageVersion: string;
  readonly descriptor: string;
  readonly compilerVersion: string;
  readonly inputHash: string;
};

export type DiPackageDescriptor = {
  readonly version: typeof DI_PACKAGE_DESCRIPTOR_VERSION;
  readonly packageName: string;
  readonly packageVersion: string;
  readonly compilerVersion: string;
  readonly inputHash: string;
  readonly graph: {
    readonly import: string;
    readonly exportName: "generatedDiGraph";
  };
  readonly providers: readonly DiManifestProvider[];
  readonly roots: readonly string[];
  readonly modules?: DiCompilerOptions["modules"];
};

export type DiCompilerResult = {
  readonly code: string;
  readonly manifest: DiCompilerManifest;
  readonly outFile: string;
  readonly manifestFile: string;
  readonly watchFiles: readonly string[];
  readonly watchDirs: readonly string[];
};

export type ImportReference = {
  readonly moduleSpecifier: string;
  readonly exportName: string;
};

type DependencyAnalysis = DiManifestDependency & {
  readonly expression: string;
  readonly many: boolean;
};

type ProviderAnalysis = Omit<DiManifestProvider, "dependencies"> & {
  readonly sourceFile: ts.SourceFile;
  readonly classDeclaration: ts.ClassDeclaration;
  readonly classExpression: string;
  readonly dependencies: readonly DependencyAnalysis[];
};

type LinkedPackageAnalysis = {
  readonly descriptor: DiPackageDescriptor;
  readonly descriptorFile: string;
  readonly graphExpression: string;
};

type BindingAnalysis = DiManifestProvider & {
  readonly tokenExpression: string;
  readonly targetExpression: string;
};

export class DiCompilerError extends Error {
  readonly diagnostics: readonly DiCompilerDiagnostic[];

  constructor(diagnostics: readonly DiCompilerDiagnostic[]) {
    super(diagnostics.map((diagnostic) => formatDiagnostic(diagnostic)).join("\n"));
    this.name = "DiCompilerError";
    this.diagnostics = diagnostics;
  }
}

export function collectDiGraphWatchInputs(
  options: Pick<
    DiCompilerOptions,
    | "baseDir"
    | "scanDirs"
    | "exclude"
    | "tsconfig"
    | "packageDescriptors"
    | "moduleProviders"
    | "bindings"
  >,
): { readonly watchFiles: readonly string[]; readonly watchDirs: readonly string[] } {
  const baseDir = path.resolve(options.baseDir ?? process.cwd());
  const scanDirs = options.scanDirs ?? DEFAULT_SCAN_DIRS;
  const excludes = options.exclude ?? DEFAULT_EXCLUDES;
  const requireFromApplication = createRequire(path.join(baseDir, "package.json"));
  const descriptorFiles = (options.packageDescriptors ?? []).flatMap((descriptor) => {
    try {
      return [resolveDescriptorFile(baseDir, descriptor, requireFromApplication)];
    } catch {
      return [];
    }
  });
  const references = [
    ...(options.moduleProviders ?? []).flatMap((provider) => [
      provider.token,
      ...(provider.dependencies ?? []).map((dependency) => dependency.token),
    ]),
    ...(options.bindings ?? []).flatMap((binding) => [binding.token, binding.useExisting]),
  ];
  let compilerOptions: ts.CompilerOptions;
  try {
    compilerOptions = readCompilerOptions(baseDir, options.tsconfig);
  } catch {
    compilerOptions = { moduleResolution: ts.ModuleResolutionKind.NodeNext };
  }
  const referenceFiles = references.flatMap((reference) => {
    const resolved = ts.resolveModuleName(
      reference.moduleSpecifier,
      path.join(baseDir, "entry.ts"),
      compilerOptions,
      ts.sys,
    ).resolvedModule;
    return resolved ? [resolved.resolvedFileName] : [];
  });
  const watchFiles = [
    ...findCandidateFiles(baseDir, scanDirs, excludes),
    ...descriptorFiles,
    ...referenceFiles,
    ...(options.tsconfig ? [path.resolve(baseDir, options.tsconfig)] : []),
  ];
  return {
    watchFiles: [...new Set(watchFiles)].sort(),
    watchDirs: [
      ...new Set([...findScanDirectories(baseDir, scanDirs), ...descriptorFiles.map(path.dirname)]),
    ].sort(),
  };
}

export function compileDiGraph(options: DiCompilerOptions = {}): DiCompilerResult {
  const baseDir = path.resolve(options.baseDir ?? process.cwd());
  const scanDirs = [...(options.scanDirs ?? DEFAULT_SCAN_DIRS)];
  const excludes = [...(options.exclude ?? DEFAULT_EXCLUDES)];
  const files = findCandidateFiles(baseDir, scanDirs, excludes);
  const compilerOptions = readCompilerOptions(baseDir, options.tsconfig);
  const moduleReferences = (options.moduleProviders ?? []).flatMap((provider) => [
    provider.token,
    ...(provider.dependencies ?? []).map((dependency) => dependency.token),
  ]);
  const referenceFiles = moduleReferences.map((reference) => {
    const resolved = ts.resolveModuleName(
      reference.moduleSpecifier,
      path.join(baseDir, "entry.ts"),
      compilerOptions,
      ts.sys,
    ).resolvedModule;
    if (!resolved)
      throw packageDescriptorError(
        baseDir,
        reference.moduleSpecifier,
        `Cannot resolve module provider token '${reference.exportName}'.`,
      );
    return resolved.resolvedFileName;
  });
  const program = ts.createProgram([...files, ...referenceFiles], compilerOptions);
  const checker = program.getTypeChecker();
  const diagnostics: DiCompilerDiagnostic[] = [];
  const imports = new Map<string, string>();
  const providers: ProviderAnalysis[] = [];

  for (const fileName of files) {
    const sourceFile = program.getSourceFile(fileName);
    if (!sourceFile) {
      continue;
    }
    for (const diagnostic of program.getSyntacticDiagnostics(sourceFile)) {
      const position =
        diagnostic.start === undefined
          ? { line: 0, character: 0 }
          : sourceFile.getLineAndCharacterOfPosition(diagnostic.start);
      diagnostics.push({
        code: "CROCO_DI_COMPILE_001",
        file: normalizePath(path.relative(baseDir, sourceFile.fileName)),
        line: position.line + 1,
        column: position.character + 1,
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      });
    }
    for (const statement of sourceFile.statements) {
      if (!ts.isClassDeclaration(statement)) {
        continue;
      }
      const stereotype = getStereotype(statement, checker);
      if (!stereotype) {
        continue;
      }
      if (!statement.name || !isNamedExport(statement)) {
        diagnostics.push(
          createDiagnostic(
            statement,
            sourceFile,
            "CROCO_DI_COMPILE_001",
            "Decorated providers must be named exports so generated factories can import them.",
            baseDir,
          ),
        );
        continue;
      }

      const exportName = statement.name.text;
      const tokenId = createLocalTokenId(
        baseDir,
        sourceFile.fileName,
        exportName,
        options.packageName,
      );
      const classExpression = addSourceReference(imports, baseDir, sourceFile.fileName, exportName);
      const dependencies = analyzeDependencies({
        baseDir,
        checker,
        classDeclaration: statement,
        diagnostics,
        imports,
        packageName: options.packageName,
        sourceFile,
      });
      providers.push({
        tokenId,
        exportName,
        stereotype,
        scope: getDeclaredScope(statement, checker, baseDir),
        source: getSourceLocation(statement, sourceFile, baseDir),
        dependencies,
        sourceFile,
        classDeclaration: statement,
        classExpression,
      });
    }
  }

  const linkedPackages = readPackageDescriptors(baseDir, options.packageDescriptors ?? [], imports);
  const bindings = analyzeBindings(options, baseDir, imports, providers, linkedPackages);
  const moduleProviders = analyzeModuleProviders(
    options,
    baseDir,
    program,
    imports,
    referenceFiles,
  );
  const modules = [
    ...linkedPackages.flatMap(({ descriptor }) => descriptor.modules ?? []),
    ...(options.modules ?? []),
  ];
  const soleModule = modules.length === 1 ? modules[0] : undefined;
  if (soleModule) {
    modules[0] = {
      ...soleModule,
      providers: [
        ...new Set([...soleModule.providers, ...providers.map((provider) => provider.tokenId)]),
      ],
    };
  }
  const overriddenTokens = new Set(
    (options.bindings ?? [])
      .filter((binding) => binding.override)
      .map((binding) =>
        createReferenceTokenId(
          baseDir,
          {
            ...binding.token,
            moduleSpecifier: binding.token.moduleSpecifier.startsWith(".")
              ? path.resolve(baseDir, binding.token.moduleSpecifier)
              : binding.token.moduleSpecifier,
          },
          options.packageName,
        ),
      ),
  );
  for (let index = providers.length - 1; index >= 0; index--) {
    const provider = providers[index];
    if (provider && overriddenTokens.has(provider.tokenId)) providers.splice(index, 1);
  }

  const providerTokenIds = new Set([
    ...providers.map((provider) => provider.tokenId),
    ...bindings.map((provider) => provider.tokenId),
    ...moduleProviders.map((provider) => provider.tokenId),
    ...linkedPackages.flatMap(({ descriptor }) =>
      descriptor.providers.map((provider) => provider.tokenId),
    ),
  ]);
  for (const provider of providers) {
    for (const dependency of provider.dependencies) {
      if (!dependency.optional && !providerTokenIds.has(dependency.tokenId)) {
        diagnostics.push({
          code: "CROCO_DI_COMPILE_003",
          file: dependency.source.file,
          line: dependency.source.line,
          column: dependency.source.column,
          message: `No scanned provider or explicit binding matches dependency '${dependency.tokenId}' required by '${provider.exportName}'.`,
        });
      }
    }
  }

  if (diagnostics.length > 0) {
    throw new DiCompilerError(sortDiagnostics(diagnostics));
  }

  const sortedProviders = [...providers].sort((left, right) =>
    left.tokenId.localeCompare(right.tokenId),
  );
  const packageProviders = linkedPackages
    .flatMap(({ descriptor }) => descriptor.providers)
    .filter((provider) => !overriddenTokens.has(provider.tokenId));
  const manifestProviders = [
    ...moduleProviders.map(({ tokenExpression: _, ...provider }) => provider),
    ...bindings.map(({ tokenExpression: _, targetExpression: __, ...binding }) => binding),
    ...packageProviders,
    ...sortedProviders.map(
      ({ classDeclaration: _, classExpression: __, sourceFile: ___, ...provider }) => provider,
    ),
  ].sort((left, right) => left.tokenId.localeCompare(right.tokenId));
  for (const provider of manifestProviders) {
    const owner = modules.find((module) => module.providers.includes(provider.tokenId));
    if (provider.stereotype === "module-provider" && owner?.id !== provider.moduleName)
      throw packageDescriptorError(
        baseDir,
        provider.source.file,
        `Module provider '${provider.tokenId}' must be owned by module '${provider.moduleName}'.`,
      );
    if (owner) Object.assign(provider, { moduleName: owner.id });
  }
  validateModules(manifestProviders, modules);
  assertManifestProviders(manifestProviders, linkedPackages);

  const graphId = options.graphId ?? path.basename(baseDir);
  const outFile = path.resolve(baseDir, options.outFile ?? ".croco/di.generated.ts");
  const manifestFile = path.resolve(baseDir, options.manifestFile ?? ".croco/di.manifest.json");
  const generatedDir = path.join(baseDir, ".croco");
  const inputHash = createHash("sha256")
    .update(createInputHash(sortedProviders, linkedPackages))
    .update(
      JSON.stringify({
        bindings: options.bindings,
        modules: options.modules,
        moduleProviders: options.moduleProviders,
        files: program
          .getSourceFiles()
          .filter((file) => {
            const sourcePath = path.resolve(file.fileName);
            const relativeToGeneratedDir = path.relative(generatedDir, sourcePath);
            return (
              (!file.isDeclarationFile || referenceFiles.includes(file.fileName)) &&
              sourcePath !== outFile &&
              relativeToGeneratedDir !== "" &&
              (relativeToGeneratedDir.startsWith("..") || path.isAbsolute(relativeToGeneratedDir))
            );
          })
          .map((file) => [normalizePath(path.relative(baseDir, file.fileName)), file.text])
          .sort(),
      }),
    )
    .update(
      JSON.stringify(compilerOptions, (_key, value: unknown) =>
        typeof value === "string" && path.isAbsolute(value)
          ? normalizePath(path.relative(baseDir, value))
          : value,
      ),
    )
    .digest("hex");
  const roots = [
    ...linkedPackages.flatMap(({ descriptor }) => descriptor.roots),
    ...sortedProviders.map((provider) => provider.tokenId),
  ].sort();
  const manifest: DiCompilerManifest = {
    version: DI_MANIFEST_VERSION,
    compilerVersion: DI_COMPILER_VERSION,
    graphId,
    inputHash,
    scan: {
      roots: scanDirs.map(normalizePath).sort(),
      excluded: [...excludes].sort(),
    },
    providers: manifestProviders,
    roots,
    packages: linkedPackages.map(({ descriptor, descriptorFile }) => ({
      packageName: descriptor.packageName,
      packageVersion: descriptor.packageVersion,
      descriptor: normalizePath(path.relative(baseDir, descriptorFile)),
      compilerVersion: descriptor.compilerVersion,
      inputHash: descriptor.inputHash,
    })),
    ...(modules.length ? { modules } : {}),
  };
  const code = createGeneratedCode(
    sortedProviders,
    linkedPackages,
    manifest,
    imports,
    outFile,
    bindings,
    overriddenTokens,
    moduleProviders,
  );
  validateGeneratedCode(code, outFile, files, compilerOptions, baseDir);

  return {
    code,
    manifest,
    outFile,
    manifestFile,
    watchFiles: [
      ...new Set([
        ...files,
        ...referenceFiles,
        ...linkedPackages.map(({ descriptorFile }) => descriptorFile),
      ]),
    ].sort(),
    watchDirs: findScanDirectories(baseDir, scanDirs),
  };
}

export function writeDiGraph(result: DiCompilerResult): void {
  fs.mkdirSync(path.dirname(result.outFile), { recursive: true });
  fs.mkdirSync(path.dirname(result.manifestFile), { recursive: true });
  fs.writeFileSync(result.outFile, result.code);
  fs.writeFileSync(result.manifestFile, `${JSON.stringify(result.manifest, null, 2)}\n`);
}

export function createDiPackageDescriptor(
  result: DiCompilerResult,
  options: {
    readonly packageName: string;
    readonly packageVersion: string;
    readonly graphImport: string;
  },
): DiPackageDescriptor {
  if (!options.packageName || !options.packageVersion || !options.graphImport) {
    throw packageDescriptorError(
      process.cwd(),
      result.manifestFile,
      "DI package descriptors require packageName, packageVersion, and graphImport.",
    );
  }
  const packageTokenPrefix = `package:${options.packageName}#`;
  if (
    result.manifest.providers.some((provider) => !provider.tokenId.startsWith(packageTokenPrefix))
  ) {
    throw packageDescriptorError(
      process.cwd(),
      result.manifestFile,
      `Compile the package graph with packageName '${options.packageName}' before creating its descriptor.`,
    );
  }
  return {
    version: DI_PACKAGE_DESCRIPTOR_VERSION,
    packageName: options.packageName,
    packageVersion: options.packageVersion,
    compilerVersion: result.manifest.compilerVersion,
    inputHash: result.manifest.inputHash,
    graph: {
      import: options.graphImport,
      exportName: "generatedDiGraph",
    },
    providers: result.manifest.providers,
    roots: result.manifest.roots,
    ...(result.manifest.modules ? { modules: result.manifest.modules } : {}),
  };
}

export function writeDiPackageDescriptor(
  descriptorFile: string,
  descriptor: DiPackageDescriptor,
): void {
  const resolvedFile = path.resolve(descriptorFile);
  fs.mkdirSync(path.dirname(resolvedFile), { recursive: true });
  fs.writeFileSync(resolvedFile, `${JSON.stringify(descriptor, null, 2)}\n`);
}

function analyzeModuleProviders(
  options: DiCompilerOptions,
  baseDir: string,
  program: ts.Program,
  imports: Map<string, string>,
  referenceFiles: readonly string[],
): (DiManifestProvider & { readonly tokenExpression: string })[] {
  const checker = program.getTypeChecker();
  let referenceIndex = 0;
  const resolve = (reference: ImportReference) => {
    const file = program.getSourceFile(referenceFiles[referenceIndex++] ?? "");
    const symbol = file && checker.getSymbolAtLocation(file);
    const exported =
      symbol &&
      checker.getExportsOfModule(symbol).find((entry) => entry.name === reference.exportName);
    const target =
      exported &&
      (exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported);
    const declaration = target?.valueDeclaration;
    if (!declaration)
      throw packageDescriptorError(
        baseDir,
        reference.moduleSpecifier,
        `Module provider token '${reference.exportName}' must name an exported runtime value.`,
      );
    const normalized = {
      ...reference,
      moduleSpecifier: reference.moduleSpecifier.startsWith(".")
        ? path.resolve(baseDir, reference.moduleSpecifier)
        : reference.moduleSpecifier,
    };
    return {
      tokenId: createReferenceTokenId(baseDir, normalized, options.packageName),
      tokenExpression: addImportReference(imports, normalized),
      source: getSourceLocation(declaration, declaration.getSourceFile(), baseDir),
    };
  };
  return (options.moduleProviders ?? []).map((provider) => {
    const token = resolve(provider.token);
    if (provider.scope !== "singleton")
      throw packageDescriptorError(
        baseDir,
        token.source.file,
        `Module provider '${token.tokenId}' must use singleton scope, matching ModuleContext registration.`,
      );
    return {
      ...token,
      exportName: provider.token.exportName,
      stereotype: "module-provider",
      moduleName: provider.moduleId,
      scope: provider.scope,
      dependencies: (provider.dependencies ?? []).map((dependency) => {
        const resolved = resolve(dependency.token);
        return {
          tokenId: resolved.tokenId,
          source: resolved.source,
          reason: "explicit-token" as const,
          ...(dependency.optional === undefined ? {} : { optional: dependency.optional }),
        };
      }),
    };
  });
}

function analyzeBindings(
  options: DiCompilerOptions,
  baseDir: string,
  imports: Map<string, string>,
  providers: readonly ProviderAnalysis[],
  packages: readonly LinkedPackageAnalysis[],
): BindingAnalysis[] {
  const result: BindingAnalysis[] = [];
  const available = [...providers, ...packages.flatMap((item) => item.descriptor.providers)];
  const normalize = (reference: ImportReference): ImportReference => ({
    ...reference,
    moduleSpecifier: reference.moduleSpecifier.startsWith(".")
      ? path.resolve(baseDir, reference.moduleSpecifier)
      : reference.moduleSpecifier,
  });
  for (const binding of options.bindings ?? []) {
    const token = normalize(binding.token);
    const target = normalize(binding.useExisting);
    const tokenId = createReferenceTokenId(baseDir, token, options.packageName);
    const targetId = createReferenceTokenId(baseDir, target, options.packageName);
    const provider = available.find((item) => item.tokenId === targetId);
    if (!provider)
      throw packageDescriptorError(
        baseDir,
        token.moduleSpecifier,
        `Binding '${tokenId}' references missing provider '${targetId}'.`,
      );
    if (binding.override) {
      for (let index = result.length - 1; index >= 0; index--)
        if (result[index]?.tokenId === tokenId) result.splice(index, 1);
    }
    result.push({
      tokenId,
      exportName: token.exportName,
      stereotype: "binding",
      scope: provider.scope,
      source: provider.source,
      dependencies: [{ tokenId: targetId, reason: "explicit-token", source: provider.source }],
      multiple: binding.multiple ?? false,
      tokenExpression: addImportReference(imports, token),
      targetExpression: addImportReference(imports, target),
    });
  }
  return result;
}

function validateModules(
  providers: readonly DiManifestProvider[],
  modules: NonNullable<DiCompilerOptions["modules"]>,
): void {
  const owners = new Map<string, string>();
  const modulesById = new Map(modules.map((module) => [module.id, module]));
  const providersByToken = new Map(providers.map((provider) => [provider.tokenId, provider]));
  const fail = (message: string, source?: DiSourceLocation): never => {
    throw new DiCompilerError([
      {
        code: "CROCO_DI_COMPILE_003",
        file: source?.file ?? "<modules>",
        line: source?.line ?? 1,
        column: source?.column ?? 1,
        message,
      },
    ]);
  };
  if (modulesById.size !== modules.length) fail("Duplicate module IDs are not allowed.");
  for (const module of modules) {
    for (const imported of module.imports ?? [])
      if (!modulesById.has(imported))
        fail(`Module '${module.id}' imports unknown module '${imported}'.`);
    for (const token of module.providers) {
      if (owners.has(token))
        fail(
          `Provider '${token}' has duplicate module ownership.`,
          providersByToken.get(token)?.source,
        );
      if (!providersByToken.has(token))
        fail(`Module '${module.id}' owns unknown provider '${token}'.`);
      owners.set(token, module.id);
    }
    for (const token of module.exports ?? [])
      if (!module.providers.includes(token))
        fail(`Module '${module.id}' exports unowned provider '${token}'.`);
  }
  for (const provider of providers) {
    const owner = owners.get(provider.tokenId);
    for (const dependency of provider.dependencies) {
      const targetOwner = owners.get(dependency.tokenId);
      if (
        targetOwner &&
        targetOwner !== owner &&
        (!owner ||
          !modulesById.get(owner)?.imports?.includes(targetOwner) ||
          !modulesById.get(targetOwner)?.exports?.includes(dependency.tokenId))
      )
        fail(
          `Provider '${provider.tokenId}' cannot access private provider '${dependency.tokenId}' in module '${targetOwner}'.`,
          dependency.source,
        );
    }
  }
}

function validateGeneratedCode(
  code: string,
  outFile: string,
  files: readonly string[],
  options: ts.CompilerOptions,
  baseDir: string,
): void {
  const compilerOptions = {
    ...options,
    noEmit: true,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    skipLibCheck: true,
  };
  const host = ts.createCompilerHost(compilerOptions);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) =>
    path.resolve(fileName) === outFile
      ? ts.createSourceFile(fileName, code, languageVersion, true)
      : originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
  const program = ts.createProgram([...files, outFile], compilerOptions, host);
  const generated = program.getSourceFile(outFile);
  if (!generated)
    throw packageDescriptorError(
      baseDir,
      outFile,
      "Generated graph could not be loaded for semantic verification.",
    );
  const diagnostics = program.getSemanticDiagnostics(generated);
  if (diagnostics.length)
    throw new DiCompilerError(
      diagnostics.map((diagnostic) => ({
        code: "CROCO_DI_COMPILE_004",
        ...getSourceLocationAtPosition(generated, diagnostic.start ?? 0, baseDir),
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      })),
    );
}

function getSourceLocationAtPosition(
  source: ts.SourceFile,
  position: number,
  baseDir: string,
): DiSourceLocation {
  const location = source.getLineAndCharacterOfPosition(position);
  return {
    file: normalizePath(path.relative(baseDir, source.fileName)),
    line: location.line + 1,
    column: location.character + 1,
  };
}

function readPackageDescriptors(
  baseDir: string,
  descriptorFiles: readonly string[],
  imports: Map<string, string>,
): LinkedPackageAnalysis[] {
  const requireFromApplication = createRequire(path.join(baseDir, "package.json"));
  return [
    ...new Set(
      descriptorFiles.map((file) => resolveDescriptorFile(baseDir, file, requireFromApplication)),
    ),
  ]
    .sort()
    .map((descriptorFile) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(fs.readFileSync(descriptorFile, "utf8"));
      } catch (error) {
        throw packageDescriptorError(
          baseDir,
          descriptorFile,
          `Cannot read package descriptor: ${error instanceof Error ? error.message : String(error)}.`,
        );
      }
      if (!isDiPackageDescriptor(parsed)) {
        throw packageDescriptorError(
          baseDir,
          descriptorFile,
          `Package descriptor must use schema '${DI_PACKAGE_DESCRIPTOR_VERSION}' and declare a generated graph, providers, and roots.`,
        );
      }
      if (parsed.compilerVersion !== DI_COMPILER_VERSION) {
        throw packageDescriptorError(
          baseDir,
          descriptorFile,
          `Package descriptor compiler version '${parsed.compilerVersion}' is incompatible with '${DI_COMPILER_VERSION}'.`,
        );
      }
      const graphImport = parsed.graph.import.startsWith(".")
        ? path.resolve(path.dirname(descriptorFile), parsed.graph.import)
        : parsed.graph.import;
      return {
        descriptor: parsed,
        descriptorFile,
        graphExpression: addImportReference(imports, {
          moduleSpecifier: graphImport,
          exportName: parsed.graph.exportName,
        }),
      };
    });
}

function isDiPackageDescriptor(value: unknown): value is DiPackageDescriptor {
  if (typeof value !== "object" || value === null) return false;
  const descriptor = value as Partial<DiPackageDescriptor>;
  return (
    descriptor.version === DI_PACKAGE_DESCRIPTOR_VERSION &&
    typeof descriptor.packageName === "string" &&
    descriptor.packageName.length > 0 &&
    typeof descriptor.packageVersion === "string" &&
    descriptor.packageVersion.length > 0 &&
    typeof descriptor.compilerVersion === "string" &&
    typeof descriptor.inputHash === "string" &&
    typeof descriptor.graph === "object" &&
    descriptor.graph !== null &&
    typeof descriptor.graph.import === "string" &&
    descriptor.graph.exportName === "generatedDiGraph" &&
    Array.isArray(descriptor.providers) &&
    descriptor.providers.every(isDiManifestProvider) &&
    Array.isArray(descriptor.roots) &&
    descriptor.roots.every((root) => typeof root === "string") &&
    (descriptor.modules === undefined ||
      (Array.isArray(descriptor.modules) &&
        descriptor.modules.every(
          (module) =>
            typeof module === "object" &&
            module !== null &&
            typeof module.id === "string" &&
            Array.isArray(module.providers) &&
            module.providers.every((token: unknown) => typeof token === "string") &&
            (module.imports === undefined ||
              (Array.isArray(module.imports) &&
                module.imports.every((id: unknown) => typeof id === "string"))) &&
            (module.exports === undefined ||
              (Array.isArray(module.exports) &&
                module.exports.every((token: unknown) => typeof token === "string"))),
        )))
  );
}

function resolveDescriptorFile(
  baseDir: string,
  descriptor: string,
  requireFromApplication: NodeJS.Require,
): string {
  if (path.isAbsolute(descriptor) || descriptor.startsWith(".")) {
    return path.resolve(baseDir, descriptor);
  }
  try {
    return requireFromApplication.resolve(descriptor);
  } catch (error) {
    throw packageDescriptorError(
      baseDir,
      descriptor,
      `Cannot resolve selected package descriptor: ${error instanceof Error ? error.message : String(error)}.`,
    );
  }
}

function isDiManifestProvider(value: unknown): value is DiManifestProvider {
  if (typeof value !== "object" || value === null) return false;
  const provider = value as Partial<DiManifestProvider>;
  return (
    typeof provider.tokenId === "string" &&
    typeof provider.exportName === "string" &&
    typeof provider.stereotype === "string" &&
    (provider.scope === "singleton" ||
      provider.scope === "request" ||
      provider.scope === "transient") &&
    typeof provider.source === "object" &&
    provider.source !== null &&
    typeof provider.source.file === "string" &&
    typeof provider.source.line === "number" &&
    typeof provider.source.column === "number" &&
    Array.isArray(provider.dependencies)
  );
}

function packageDescriptorError(
  baseDir: string,
  descriptorFile: string,
  message: string,
): DiCompilerError {
  return new DiCompilerError([
    {
      code: "CROCO_DI_COMPILE_001",
      file: normalizePath(path.relative(baseDir, descriptorFile)),
      line: 1,
      column: 1,
      message,
    },
  ]);
}

function analyzeDependencies(input: {
  readonly baseDir: string;
  readonly checker: ts.TypeChecker;
  readonly classDeclaration: ts.ClassDeclaration;
  readonly diagnostics: DiCompilerDiagnostic[];
  readonly imports: Map<string, string>;
  readonly packageName?: string;
  readonly sourceFile: ts.SourceFile;
}): DependencyAnalysis[] {
  if (
    input.classDeclaration.heritageClauses?.some(
      (clause) => clause.token === ts.SyntaxKind.ExtendsKeyword,
    )
  ) {
    input.diagnostics.push(
      createDiagnostic(
        input.classDeclaration,
        input.sourceFile,
        "CROCO_DI_COMPILE_002",
        "Inherited providers are not supported by the DI compiler; declare constructor and injected properties on a provider without extends.",
        input.baseDir,
      ),
    );
    return [];
  }
  const constructor = input.classDeclaration.members.find(ts.isConstructorDeclaration);
  const dependencies: DependencyAnalysis[] = [];
  for (const [parameterIndex, parameter] of (constructor?.parameters ?? []).entries()) {
    const injection = getInjectionDecorator(parameter, input.checker);
    if (injection) {
      const [argument] = injection.call.arguments;
      const tokenExpression = argument ? unwrapLazyReference(argument) : undefined;
      const reference = tokenExpression
        ? resolveExpressionReference(tokenExpression, input.checker)
        : resolveParameterTypeReference(parameter, input.checker);
      if (!reference) {
        input.diagnostics.push(
          createDiagnostic(
            tokenExpression ?? parameter,
            input.sourceFile,
            "CROCO_DI_COMPILE_002",
            `Parameter ${parameterIndex} uses a token expression that cannot be resolved without executing user code.`,
            input.baseDir,
          ),
        );
        continue;
      }
      const expression = addImportReference(input.imports, reference);
      dependencies.push({
        tokenId: createReferenceTokenId(input.baseDir, reference, input.packageName),
        reason: tokenExpression
          ? injection.name === "InjectMany"
            ? "explicit-many-token"
            : "explicit-token"
          : "constructor-type",
        parameterIndex,
        source: getSourceLocation(parameter, input.sourceFile, input.baseDir),
        expression,
        many: injection.name === "InjectMany",
        optional: injection.name === "InjectOptional",
      });
      continue;
    }

    const typeReference = resolveParameterTypeReference(parameter, input.checker);
    if (!typeReference) {
      input.diagnostics.push(
        createDiagnostic(
          parameter,
          input.sourceFile,
          "CROCO_DI_COMPILE_002",
          `Parameter ${parameterIndex} requires a concrete class type or an explicit @Inject(token).`,
          input.baseDir,
        ),
      );
      continue;
    }
    const expression = addImportReference(input.imports, typeReference);
    dependencies.push({
      tokenId: createReferenceTokenId(input.baseDir, typeReference, input.packageName),
      reason: "constructor-type",
      parameterIndex,
      source: getSourceLocation(parameter, input.sourceFile, input.baseDir),
      expression,
      many: false,
    });
  }

  for (const property of input.classDeclaration.members.filter(ts.isPropertyDeclaration)) {
    const injection = getInjectionDecorator(property, input.checker);
    if (!injection) {
      continue;
    }
    const [argument] = injection.call.arguments;
    const tokenExpression = argument ? unwrapLazyReference(argument) : undefined;
    const reference = tokenExpression
      ? resolveExpressionReference(tokenExpression, input.checker)
      : resolvePropertyTypeReference(property, input.checker);
    if (!reference || !property.name || !ts.isIdentifier(property.name)) {
      input.diagnostics.push(
        createDiagnostic(
          property,
          input.sourceFile,
          "CROCO_DI_COMPILE_004",
          "Property injection requires an identifier property and a statically resolvable token or class type.",
          input.baseDir,
        ),
      );
      continue;
    }
    dependencies.push({
      tokenId: createReferenceTokenId(input.baseDir, reference, input.packageName),
      reason: tokenExpression
        ? injection.name === "InjectMany"
          ? "explicit-many-token"
          : "explicit-token"
        : "constructor-type",
      propertyKey: property.name.text,
      source: getSourceLocation(property, input.sourceFile, input.baseDir),
      expression: addImportReference(input.imports, reference),
      many: injection.name === "InjectMany",
      optional: injection.name === "InjectOptional",
    });
  }
  return dependencies;
}

function getInjectionDecorator(
  node: ts.ParameterDeclaration | ts.PropertyDeclaration,
  checker: ts.TypeChecker,
):
  | {
      readonly name: "Inject" | "InjectMany" | "InjectOptional";
      readonly call: ts.CallExpression;
    }
  | undefined {
  for (const decorator of ts.getDecorators(node) ?? []) {
    if (!ts.isCallExpression(decorator.expression)) {
      continue;
    }
    const name = getCrocoDecoratorName(decorator, checker);
    if (name === "Inject" || name === "InjectMany" || name === "InjectOptional") {
      return { name, call: decorator.expression };
    }
  }
  return undefined;
}

function getStereotype(
  declaration: ts.ClassDeclaration,
  checker: ts.TypeChecker,
): string | undefined {
  for (const decorator of ts.getDecorators(declaration) ?? []) {
    const name = getCrocoDecoratorName(decorator, checker);
    if (name && STEREOTYPES.has(name)) {
      return name;
    }
  }
  return undefined;
}

function getCrocoDecoratorName(
  decorator: ts.Decorator,
  checker: ts.TypeChecker,
): string | undefined {
  const expression = ts.isCallExpression(decorator.expression)
    ? decorator.expression.expression
    : decorator.expression;
  const symbol = checker.getSymbolAtLocation(expression);
  if (!symbol) {
    return undefined;
  }
  const resolved = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  const declaration = resolved.declarations?.[0];
  const name = resolved.getName();
  if (!declaration || ![...STEREOTYPES, "Inject", "InjectMany", "InjectOptional"].includes(name)) {
    return undefined;
  }
  const file = normalizePath(declaration.getSourceFile().fileName);
  const isCrocoDeclaration =
    file.includes("/node_modules/@croco/") ||
    file.includes("/packages/framework-context/") ||
    file.includes("/packages/protocols-rest/") ||
    file.includes("/packages/protocols-graphql/");
  return isCrocoDeclaration ? name : undefined;
}

function getDeclaredScope(
  declaration: ts.ClassDeclaration,
  checker: ts.TypeChecker,
  baseDir: string,
): "singleton" | "request" | "transient" {
  for (const decorator of ts.getDecorators(declaration) ?? []) {
    const name = getCrocoDecoratorName(decorator, checker);
    if (!name || !STEREOTYPES.has(name)) continue;
    if (!ts.isCallExpression(decorator.expression)) {
      continue;
    }
    const [options] = decorator.expression.arguments;
    if (!options || (name !== "Component" && ts.isStringLiteral(options))) continue;
    const fail = (): never => {
      throw new DiCompilerError([
        createDiagnostic(
          options,
          declaration.getSourceFile(),
          "CROCO_DI_COMPILE_002",
          "Provider options and scope must be static object literals with a valid singleton, request, or transient scope.",
          baseDir,
        ),
      ]);
    };
    if (!ts.isObjectLiteralExpression(options)) fail();
    if (!ts.isObjectLiteralExpression(options)) continue;
    if (
      options.properties.some(
        (property) =>
          ts.isSpreadAssignment(property) ||
          (property.name && ts.isComputedPropertyName(property.name)) ||
          (ts.isShorthandPropertyAssignment(property) && property.name.text === "scope"),
      )
    )
      fail();
    const scopeProperty = options.properties.find(
      (property): property is ts.PropertyAssignment =>
        ts.isPropertyAssignment(property) &&
        ((ts.isIdentifier(property.name) && property.name.text === "scope") ||
          (ts.isStringLiteral(property.name) && property.name.text === "scope")),
    );
    if (scopeProperty && ts.isStringLiteral(scopeProperty.initializer)) {
      const scope = scopeProperty.initializer.text;
      if (scope === "singleton" || scope === "request" || scope === "transient") {
        return scope;
      }
    }
    if (scopeProperty) fail();
  }
  return "singleton";
}

function resolveParameterTypeReference(
  parameter: ts.ParameterDeclaration,
  checker: ts.TypeChecker,
): ImportReference | undefined {
  if (!parameter.type || !ts.isTypeReferenceNode(parameter.type)) {
    return undefined;
  }
  const locationSymbol = checker.getSymbolAtLocation(parameter.type.typeName);
  const type = checker.getTypeAtLocation(parameter.type);
  const symbol = locationSymbol ?? type.aliasSymbol ?? type.getSymbol();
  const resolved =
    symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  if (!symbol || !resolved?.declarations?.some(ts.isClassDeclaration)) {
    return undefined;
  }
  return resolveSymbolReference(symbol, parameter.type.typeName, checker);
}

function resolvePropertyTypeReference(
  property: ts.PropertyDeclaration,
  checker: ts.TypeChecker,
): ImportReference | undefined {
  if (!property.type || !ts.isTypeReferenceNode(property.type)) {
    return undefined;
  }
  const locationSymbol = checker.getSymbolAtLocation(property.type.typeName);
  const type = checker.getTypeAtLocation(property.type);
  const symbol = locationSymbol ?? type.aliasSymbol ?? type.getSymbol();
  return symbol ? resolveSymbolReference(symbol, property.type.typeName, checker) : undefined;
}

function resolveExpressionReference(
  expression: ts.Expression,
  checker: ts.TypeChecker,
): ImportReference | undefined {
  if (ts.isIdentifier(expression)) {
    const symbol = checker.getSymbolAtLocation(expression);
    return symbol ? resolveSymbolReference(symbol, expression, checker) : undefined;
  }
  if (ts.isPropertyAccessExpression(expression)) {
    const base = resolveExpressionReference(expression.expression, checker);
    return base ? { ...base, exportName: `${base.exportName}.${expression.name.text}` } : undefined;
  }
  return undefined;
}

function resolveSymbolReference(
  symbol: ts.Symbol,
  location: ts.Node,
  checker: ts.TypeChecker,
): ImportReference | undefined {
  const declaration = symbol.declarations?.[0];
  if (declaration && ts.isImportSpecifier(declaration)) {
    const importDeclaration = declaration.parent.parent.parent;
    if (
      ts.isImportDeclaration(importDeclaration) &&
      ts.isStringLiteral(importDeclaration.moduleSpecifier)
    ) {
      if (importDeclaration.moduleSpecifier.text.startsWith(".")) {
        const resolved = checker.getAliasedSymbol(symbol);
        const resolvedDeclaration = resolved.declarations?.[0];
        if (resolvedDeclaration) {
          return {
            moduleSpecifier: resolvedDeclaration.getSourceFile().fileName,
            exportName: resolved.getName(),
          };
        }
      }
      return {
        moduleSpecifier: importDeclaration.moduleSpecifier.text,
        exportName: declaration.propertyName?.text ?? declaration.name.text,
      };
    }
  }
  if (declaration && ts.isImportClause(declaration)) {
    const importDeclaration = declaration.parent;
    if (
      ts.isImportDeclaration(importDeclaration) &&
      ts.isStringLiteral(importDeclaration.moduleSpecifier)
    ) {
      return { moduleSpecifier: importDeclaration.moduleSpecifier.text, exportName: "default" };
    }
  }
  const resolved = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  const resolvedDeclaration = resolved.declarations?.[0];
  if (!resolvedDeclaration) {
    return undefined;
  }
  const sourceFile = resolvedDeclaration.getSourceFile();
  if (sourceFile.isDeclarationFile && sourceFile.fileName.includes("typescript/lib/")) {
    return undefined;
  }
  return {
    moduleSpecifier: sourceFile.fileName,
    exportName: resolved.getName() || location.getText(),
  };
}

function unwrapLazyReference(expression: ts.Expression): ts.Expression | undefined {
  if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) {
    if (ts.isBlock(expression.body)) {
      const [statement] = expression.body.statements;
      return statement && ts.isReturnStatement(statement) ? statement.expression : undefined;
    }
    return expression.body;
  }
  return expression;
}

function createGeneratedCode(
  providers: readonly ProviderAnalysis[],
  linkedPackages: readonly LinkedPackageAnalysis[],
  manifest: DiCompilerManifest,
  imports: ReadonlyMap<string, string>,
  outFile: string,
  bindings: readonly BindingAnalysis[],
  overriddenTokens: ReadonlySet<string>,
  moduleProviders: readonly (DiManifestProvider & { readonly tokenExpression: string })[],
): string {
  const lines = [
    "// AUTO-GENERATED BY @croco/esbuild-plugin - DO NOT EDIT",
    'import { GENERATED_DI_GRAPH_VERSION, defineGeneratedDiGraph } from "@croco/framework-context";',
    ...(bindings.length
      ? [
          'import type { Token } from "@croco/framework-context";',
          "type BoundValue<T> = T extends Token<infer Value> ? Value : T extends abstract new (...args: never[]) => infer Value ? Value : unknown;",
        ]
      : []),
  ];
  for (const [moduleSpecifier, alias] of [...imports.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    lines.push(
      `import * as ${alias} from ${JSON.stringify(toGeneratedImport(moduleSpecifier, outFile))};`,
    );
  }
  lines.push("", "export const generatedDiGraph = defineGeneratedDiGraph({");
  lines.push("  version: GENERATED_DI_GRAPH_VERSION,");
  lines.push(`  graphId: ${JSON.stringify(manifest.graphId)},`);
  lines.push(`  compilerVersion: ${JSON.stringify(manifest.compilerVersion)},`);
  lines.push(`  inputHash: ${JSON.stringify(manifest.inputHash)},`);
  if (
    moduleProviders.length ||
    linkedPackages.some(({ descriptor }) =>
      descriptor.providers.some((provider) => provider.stereotype === "module-provider"),
    )
  ) {
    lines.push("  moduleProviders: [");
    for (const linkedPackage of linkedPackages) {
      if (
        linkedPackage.descriptor.providers.some(
          (provider) => provider.stereotype === "module-provider",
        )
      )
        lines.push(`    ...(${linkedPackage.graphExpression}.moduleProviders ?? []),`);
    }
    for (const provider of moduleProviders)
      lines.push(
        `    { token: ${provider.tokenExpression}, tokenId: ${JSON.stringify(provider.tokenId)}, moduleName: ${JSON.stringify(provider.moduleName)}, scope: ${JSON.stringify(provider.scope)}, sourceLocation: ${JSON.stringify(provider.source)} },`,
      );
    lines.push("  ],");
  }
  lines.push("  providers: [");
  for (const binding of bindings) {
    lines.push(
      `    { token: ${binding.tokenExpression}, tokenId: ${JSON.stringify(binding.tokenId)}, debugName: ${JSON.stringify(binding.exportName)}, scope: ${JSON.stringify(binding.scope)}, multiple: ${!!binding.multiple}, ${manifest.providers.find((provider) => provider.tokenId === binding.tokenId)?.moduleName ? `moduleName: ${JSON.stringify(manifest.providers.find((provider) => provider.tokenId === binding.tokenId)?.moduleName)},` : ""} dependencies: [{ token: ${binding.targetExpression}, tokenId: ${JSON.stringify(binding.dependencies[0]?.tokenId)} }], factory: (resolver): BoundValue<typeof ${binding.tokenExpression}> => resolver.get(${binding.targetExpression}), sourceLocation: ${JSON.stringify(binding.source)} },`,
    );
  }
  for (const linkedPackage of linkedPackages) {
    lines.push(
      `    ...${linkedPackage.graphExpression}.providers${overriddenTokens.size ? `.filter(provider => !${JSON.stringify([...overriddenTokens])}.includes(provider.tokenId))` : ""},`,
    );
  }
  for (const provider of providers) {
    lines.push("    {");
    lines.push(`      token: ${provider.classExpression},`);
    lines.push(`      tokenId: ${JSON.stringify(provider.tokenId)},`);
    lines.push(`      debugName: ${JSON.stringify(provider.exportName)},`);
    lines.push(`      kind: ${JSON.stringify(toGeneratedProviderKind(provider.stereotype))},`);
    lines.push(`      scope: ${JSON.stringify(provider.scope)},`);
    const moduleName = manifest.providers.find(
      (item) => item.tokenId === provider.tokenId,
    )?.moduleName;
    if (moduleName) lines.push(`      moduleName: ${JSON.stringify(moduleName)},`);
    lines.push("      dependencies: [");
    for (const dependency of provider.dependencies) {
      lines.push("        {");
      lines.push(`          token: ${dependency.expression},`);
      lines.push(`          tokenId: ${JSON.stringify(dependency.tokenId)},`);
      if (dependency.many) lines.push("          many: true,");
      if (dependency.optional) lines.push("          optional: true,");
      if (dependency.parameterIndex !== undefined)
        lines.push(`          parameterIndex: ${dependency.parameterIndex},`);
      if (dependency.propertyKey !== undefined)
        lines.push(`          propertyKey: ${JSON.stringify(dependency.propertyKey)},`);
      lines.push(`          sourceLocation: ${JSON.stringify(dependency.source)},`);
      lines.push("        },");
    }
    lines.push("      ],");
    const constructorDependencies = provider.dependencies.filter(
      (dependency) => dependency.parameterIndex !== undefined,
    );
    const propertyDependencies = provider.dependencies.filter(
      (dependency) => dependency.propertyKey !== undefined,
    );
    const argumentsList = constructorDependencies.map(
      (dependency) =>
        `resolver.${dependency.optional ? "getOptional" : dependency.many ? "getMany" : "get"}(${dependency.expression})`,
    );
    if (propertyDependencies.length === 0) {
      lines.push(
        `      factory: (${constructorDependencies.length ? "resolver" : ""}) => new ${provider.classExpression}(${argumentsList.join(", ")}),`,
      );
    } else {
      lines.push("      factory: (resolver) => {");
      lines.push(
        `        const instance = new ${provider.classExpression}(${argumentsList.join(", ")});`,
      );
      for (const dependency of propertyDependencies) {
        lines.push(
          `        instance[${JSON.stringify(dependency.propertyKey)}] = resolver.${dependency.optional ? "getOptional" : dependency.many ? "getMany" : "get"}(${dependency.expression});`,
        );
      }
      lines.push("        return instance;");
      lines.push("      },");
    }
    lines.push(`      sourceLocation: ${JSON.stringify(provider.source)},`);
    lines.push("    },");
  }
  lines.push("  ],", "  roots: [");
  for (const linkedPackage of linkedPackages) {
    lines.push(`    ...${linkedPackage.graphExpression}.roots,`);
  }
  for (const provider of providers) lines.push(`    ${provider.classExpression},`);
  lines.push("  ],", "});", "");
  return lines.join("\n");
}

function assertManifestProviders(
  providers: readonly DiManifestProvider[],
  linkedPackages: readonly LinkedPackageAnalysis[],
): void {
  const packageVersions = new Map<string, string>();
  for (const { descriptor, descriptorFile } of linkedPackages) {
    const existingVersion = packageVersions.get(descriptor.packageName);
    if (existingVersion && existingVersion !== descriptor.packageVersion) {
      throw new DiCompilerError([
        {
          code: "CROCO_DI_COMPILE_003",
          file: normalizePath(descriptorFile),
          line: 1,
          column: 1,
          message: `Package '${descriptor.packageName}' is linked with conflicting versions '${existingVersion}' and '${descriptor.packageVersion}'.`,
        },
      ]);
    }
    packageVersions.set(descriptor.packageName, descriptor.packageVersion);
  }

  const firstProviderById = new Map<string, DiManifestProvider>();
  for (const provider of providers) {
    const existing = firstProviderById.get(provider.tokenId);
    if (existing && (!existing.multiple || !provider.multiple)) {
      throw new DiCompilerError([
        {
          code: "CROCO_DI_COMPILE_003",
          ...provider.source,
          message: `Provider token '${provider.tokenId}' is declared by both '${existing.exportName}' and '${provider.exportName}'.`,
        },
      ]);
    }
    firstProviderById.set(provider.tokenId, provider);
  }

  const byId = new Map<string, DiManifestProvider[]>();
  for (const provider of providers)
    byId.set(provider.tokenId, [...(byId.get(provider.tokenId) ?? []), provider]);
  for (const provider of providers) {
    for (const dependency of provider.dependencies) {
      if (
        dependency.reason !== "explicit-many-token" &&
        (byId.get(dependency.tokenId)?.length ?? 0) > 1
      )
        throw new DiCompilerError([
          {
            code: "CROCO_DI_COMPILE_003",
            ...dependency.source,
            message: `Dependency '${dependency.tokenId}' is ambiguous; use @InjectMany or an override.`,
          },
        ]);
      if (!dependency.optional && !byId.has(dependency.tokenId))
        throw new DiCompilerError([
          {
            code: "CROCO_DI_COMPILE_003",
            ...dependency.source,
            message: `No provider matches dependency '${dependency.tokenId}' required by '${provider.exportName}'.`,
          },
        ]);
    }
  }
  const active = new Set<string>();
  const complete = new Set<DiManifestProvider>();
  const visit = (provider: DiManifestProvider, pathIds: string[]): void => {
    if (active.has(provider.tokenId)) {
      const cycle = [...pathIds, provider.tokenId];
      throw new DiCompilerError([
        {
          code: "CROCO_DI_COMPILE_003",
          ...provider.source,
          message: `Eager constructor dependency cycle: ${cycle.join(" -> ")}.`,
        },
      ]);
    }
    if (complete.has(provider)) return;
    active.add(provider.tokenId);
    for (const dependency of provider.dependencies) {
      for (const target of byId.get(dependency.tokenId) ?? [])
        visit(target, [...pathIds, provider.tokenId]);
    }
    active.delete(provider.tokenId);
    complete.add(provider);
  };
  for (const provider of providers) visit(provider, []);

  for (const provider of providers) {
    if (provider.scope !== "singleton") continue;
    const inspectScope = (current: DiManifestProvider, seen: Set<DiManifestProvider>): void => {
      for (const dependency of current.dependencies) {
        for (const target of byId.get(dependency.tokenId) ?? []) {
          if (seen.has(target)) continue;
          if (target.scope === "request" || target.scope === "transient") {
            throw new DiCompilerError([
              {
                code: "CROCO_DI_COMPILE_003",
                ...dependency.source,
                message: `Singleton provider '${provider.exportName}' cannot capture ${target.scope} provider '${target.exportName}'.`,
              },
            ]);
          }
          seen.add(target);
          inspectScope(target, seen);
        }
      }
    };
    inspectScope(provider, new Set([provider]));
  }
}

function toGeneratedProviderKind(
  stereotype: string,
): "component" | "rest-controller" | "graphql-resolver" {
  if (stereotype === "Controller") return "rest-controller";
  if (stereotype === "GraphQLResolver") return "graphql-resolver";
  return "component";
}

function addSourceReference(
  imports: Map<string, string>,
  baseDir: string,
  fileName: string,
  exportName: string,
): string {
  return addImportReference(imports, {
    moduleSpecifier: path.resolve(fileName),
    exportName,
  });
}

function addImportReference(imports: Map<string, string>, reference: ImportReference): string {
  let alias = imports.get(reference.moduleSpecifier);
  if (!alias) {
    alias = `source${imports.size}`;
    imports.set(reference.moduleSpecifier, alias);
  }
  return reference.exportName === "default"
    ? `${alias}.default`
    : `${alias}.${reference.exportName}`;
}

function createReferenceTokenId(
  baseDir: string,
  reference: ImportReference,
  packageName?: string,
): string {
  if (path.isAbsolute(reference.moduleSpecifier)) {
    return createLocalTokenId(
      baseDir,
      reference.moduleSpecifier,
      reference.exportName,
      packageName,
    );
  }
  return `package:${reference.moduleSpecifier}#${reference.exportName}`;
}

function createLocalTokenId(
  baseDir: string,
  fileName: string,
  exportName: string,
  packageName?: string,
): string {
  if (packageName && !normalizePath(path.relative(baseDir, fileName)).startsWith("../")) {
    return `package:${packageName}#${exportName}`;
  }
  return createAppTokenId(baseDir, fileName, exportName);
}

function createAppTokenId(baseDir: string, fileName: string, exportName: string): string {
  const relative = normalizePath(path.relative(baseDir, fileName)).replace(
    /\.(tsx?|mts|cts)$/u,
    "",
  );
  return `app:${relative}#${exportName}`;
}

function createInputHash(
  providers: readonly ProviderAnalysis[],
  linkedPackages: readonly LinkedPackageAnalysis[],
): string {
  const input = {
    providers: providers.map((provider) => ({
      tokenId: provider.tokenId,
      scope: provider.scope,
      stereotype: provider.stereotype,
      dependencies: provider.dependencies.map((dependency) => ({
        tokenId: dependency.tokenId,
        reason: dependency.reason,
        parameterIndex: dependency.parameterIndex,
        propertyKey: dependency.propertyKey,
        optional: dependency.optional,
        many: dependency.many,
      })),
    })),
    packages: linkedPackages.map(({ descriptor }) => ({
      packageName: descriptor.packageName,
      packageVersion: descriptor.packageVersion,
      compilerVersion: descriptor.compilerVersion,
      inputHash: descriptor.inputHash,
    })),
  };
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function findScanDirectories(baseDir: string, scanDirs: readonly string[]): string[] {
  const directories = new Set<string>();
  const visit = (directory: string): void => {
    if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) return;
    directories.add(directory);
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }))
      if (entry.isDirectory()) visit(path.join(directory, entry.name));
  };
  for (const directory of scanDirs) visit(path.resolve(baseDir, directory));
  return [...directories].sort();
}

function findCandidateFiles(
  baseDir: string,
  scanDirs: readonly string[],
  excludes: readonly string[],
): string[] {
  const files: string[] = [];
  const visit = (candidate: string): void => {
    if (!fs.existsSync(candidate)) return;
    const stat = fs.statSync(candidate);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(candidate).sort()) visit(path.join(candidate, entry));
      return;
    }
    const relative = normalizePath(path.relative(baseDir, candidate));
    if (!/\.(ts|tsx|mts|cts)$/u.test(candidate) || candidate.endsWith(".d.ts")) return;
    if (excludes.some((pattern) => globMatches(pattern, relative))) return;
    files.push(path.resolve(candidate));
  };
  for (const scanDir of scanDirs) visit(path.resolve(baseDir, scanDir));
  return [...new Set(files)].sort();
}

function readCompilerOptions(baseDir: string, explicitConfig?: string): ts.CompilerOptions {
  const configPath = explicitConfig
    ? path.resolve(baseDir, explicitConfig)
    : ts.findConfigFile(baseDir, ts.sys.fileExists, "tsconfig.json");
  if (!configPath) {
    return {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      experimentalDecorators: true,
      skipLibCheck: true,
    };
  }
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) {
    throw packageDescriptorError(
      baseDir,
      configPath,
      ts.flattenDiagnosticMessageText(config.error.messageText, "\n"),
    );
  }
  return ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath)).options;
}

function isNamedExport(declaration: ts.ClassDeclaration): boolean {
  const modifiers = ts.getModifiers(declaration) ?? [];
  return (
    modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) &&
    !modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)
  );
}

function getSourceLocation(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  baseDir: string,
): DiSourceLocation {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return {
    file: normalizePath(path.relative(baseDir, sourceFile.fileName)),
    line: position.line + 1,
    column: position.character + 1,
  };
}

function createDiagnostic(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  code: DiCompilerDiagnostic["code"],
  message: string,
  baseDir: string,
): DiCompilerDiagnostic {
  return { code, ...getSourceLocation(node, sourceFile, baseDir), message };
}

function sortDiagnostics(diagnostics: readonly DiCompilerDiagnostic[]): DiCompilerDiagnostic[] {
  return [...diagnostics].sort(
    (left, right) =>
      left.file.localeCompare(right.file) ||
      left.line - right.line ||
      left.column - right.column ||
      left.code.localeCompare(right.code),
  );
}

function formatDiagnostic(diagnostic: DiCompilerDiagnostic): string {
  return `${diagnostic.file}:${diagnostic.line}:${diagnostic.column} ${diagnostic.code} ${diagnostic.message}`;
}

function globMatches(pattern: string, fileName: string): boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/gu, "\\$&")
    .replace(/\*\*/gu, "::DOUBLE_STAR::")
    .replace(/\*/gu, "[^/]*")
    .replace(/::DOUBLE_STAR::/gu, ".*")
    .replace(/\?/gu, "[^/]");
  return new RegExp(`^${escaped}$`, "u").test(fileName);
}

function toGeneratedImport(moduleSpecifier: string, outFile: string): string {
  if (!path.isAbsolute(moduleSpecifier)) return moduleSpecifier;
  const relative = normalizePath(path.relative(path.dirname(outFile), moduleSpecifier)).replace(
    /\.(tsx?|mts|cts)$/u,
    "",
  );
  return relative.startsWith(".") ? relative : `./${relative}`;
}

function normalizePath(value: string): string {
  return value.replace(/\\/gu, "/");
}

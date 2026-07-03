import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { builtinModules } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ENTRYPOINT_EXEMPTIONS,
  findPackageJsonFiles,
  packageHasSourceEntrypoint,
} from "./package-manifest-contracts.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const defaultRootDir = resolve(__dirname, "..");
const mode = parseArgs(process.argv.slice(2));
const spawnTimeoutMs = 180_000;
const nodeBuiltinModules = new Set([
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`),
]);

type PackageJson = {
  readonly dependencies?: Record<string, string>;
  readonly name?: string;
  readonly optionalDependencies?: Record<string, string>;
  readonly packageManager?: string;
  readonly peerDependencies?: Record<string, string>;
  readonly peerDependenciesMeta?: Record<string, { readonly optional?: boolean }>;
  readonly private?: boolean;
  readonly publishConfig?: Record<string, unknown>;
  readonly [key: string]: unknown;
};

type PackageInfo = {
  readonly packageDir: string;
  readonly packagePath: string;
  readonly packageName: string;
  readonly sourceManifest: PackageJson;
};

type PackedPackageInfo = PackageInfo & {
  readonly packedManifest: PackageJson;
  readonly tarballPath: string;
};

type SmokeTarget = {
  readonly fieldName: string;
  readonly kind: "json" | "module";
  readonly specifier: string;
  readonly target: string;
};

type PackageSmokePlan = {
  readonly cjs: SmokeTarget[];
  readonly diagnostics: string[];
  readonly esm: SmokeTarget[];
  readonly types: SmokeTarget[];
};

type PackageSmokeResult = {
  readonly cjsCount: number;
  readonly esmCount: number;
  readonly packageName: string;
  readonly typesCount: number;
};

type ExemptionResult = {
  readonly packageName: string;
  readonly reason: string;
};

type RunResult = {
  readonly stderr: string;
  readonly stdout: string;
};

main();

function main(): void {
  const rootDir = mode.rootDir;
  const packRoot = mkdtempSync(join(tmpdir(), "croco-entrypoint-pack-"));
  const consumerRoot = mkdtempSync(join(tmpdir(), "croco-entrypoint-consumer-"));

  try {
    const packageManager = packageManagerFor(rootDir);
    const packageJsonFiles = findPackageJsonFiles(join(rootDir, "packages"));
    const packageIndex = packageIndexFor(packageJsonFiles);
    const diagnostics: string[] = [];
    const packedPackages = new Map<string, PackedPackageInfo>();
    const packageInfos: PackageInfo[] = [];
    const packageResults: PackageSmokeResult[] = [];
    const exemptions: ExemptionResult[] = [];
    let skippedPrivateCount = 0;

    for (const packagePath of packageJsonFiles) {
      const sourceManifest = readPackageJson(packagePath);

      if (sourceManifest.private === true) {
        skippedPrivateCount++;
        continue;
      }

      const packageName = packageNameFor(sourceManifest, packagePath);
      const exemption = ENTRYPOINT_EXEMPTIONS.get(packageName);
      if (exemption) {
        exemptions.push({ packageName, reason: exemption });
        continue;
      }

      if (!packageHasSourceEntrypoint(packagePath)) {
        diagnostics.push(
          `${relative(rootDir, packagePath)}: public package without src/index.ts needs an explicit entrypoint exemption`,
        );
        continue;
      }

      packageInfos.push({
        packageDir: dirname(packagePath),
        packageName,
        packagePath,
        sourceManifest,
      });
    }

    if (diagnostics.length > 0) {
      printCoverageSummary(packageResults, exemptions, skippedPrivateCount);
      printSmokeViolations(diagnostics);
      process.exitCode = 1;
      return;
    }

    const buildPrerequisiteDiagnostics = buildPrerequisiteDiagnosticsFor(rootDir, packageInfos);
    if (buildPrerequisiteDiagnostics.length > 0) {
      printBuildPrerequisiteFailure(buildPrerequisiteDiagnostics);
      process.exitCode = 1;
      return;
    }

    for (const packageInfo of packageInfos) {
      const graph = collectInternalRuntimeGraph(packageInfo, packageIndex);
      for (const graphPackage of graph) {
        packPackage(graphPackage, packRoot, rootDir, packedPackages);
      }

      const packedPackage = packedPackages.get(packageInfo.packageName);
      if (!packedPackage) {
        throw new Error(`${packageInfo.packageName}: packed tarball was not created`);
      }

      const graphTarballs = graph.map((graphPackage) => {
        const packedGraphPackage = packedPackages.get(graphPackage.packageName);
        if (!packedGraphPackage) {
          throw new Error(`${graphPackage.packageName}: packed tarball was not created`);
        }
        return packedGraphPackage;
      });
      const plan = planPackageSmoke(packedPackage);
      diagnostics.push(...plan.diagnostics);
      if (plan.diagnostics.length === 0) {
        runPackageSmoke(consumerRoot, packedPackage, graphTarballs, packageManager, plan);
      }
      packageResults.push({
        cjsCount: plan.cjs.length,
        esmCount: plan.esm.length,
        packageName: packageInfo.packageName,
        typesCount: plan.types.length,
      });
    }

    printCoverageSummary(packageResults, exemptions, skippedPrivateCount);

    if (diagnostics.length > 0) {
      printSmokeViolations(diagnostics);
      process.exitCode = 1;
      return;
    }

    console.log("");
    console.log(
      `package-entrypoint-smoke: cjs, esm, and typescript consumers resolved for ${packageResults.length} packages`,
    );
  } finally {
    rmSync(packRoot, { force: true, recursive: true });
    rmSync(consumerRoot, { force: true, recursive: true });
  }
}

function parseArgs(args: readonly string[]): { readonly rootDir: string } {
  let rootDir = defaultRootDir;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];

    if (arg === "--root") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--root requires a path");
      }
      rootDir = resolve(value);
      index++;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return { rootDir };
}

function buildPrerequisiteDiagnosticsFor(
  rootDir: string,
  packageInfos: readonly PackageInfo[],
): string[] {
  const missingBuildArtifacts = packageInfos.filter(
    (packageInfo) => !packageHasBuildArtifacts(packageInfo.packageDir),
  );

  if (missingBuildArtifacts.length === 0) {
    return [];
  }

  const shownPackages = missingBuildArtifacts
    .slice(0, 10)
    .map(
      (packageInfo) =>
        `${packageInfo.packageName} (${relative(rootDir, join(packageInfo.packageDir, "dist"))})`,
    );
  const remainingCount = missingBuildArtifacts.length - shownPackages.length;
  const packageList =
    remainingCount > 0
      ? `${shownPackages.join(", ")}, and ${remainingCount} more`
      : shownPackages.join(", ");

  return [
    `${missingBuildArtifacts.length} public package(s) are missing build artifacts under dist.`,
    "Run pnpm build before pnpm package-entrypoints:smoke.",
    `Missing packages: ${packageList}.`,
  ];
}

function packageHasBuildArtifacts(packageDir: string): boolean {
  const distDir = join(packageDir, "dist");
  if (!existsSync(distDir)) {
    return false;
  }

  try {
    return readdirSync(distDir).length > 0;
  } catch {
    return false;
  }
}

function printBuildPrerequisiteFailure(diagnostics: readonly string[]): void {
  console.log("");
  console.log("Package entrypoint smoke build prerequisite failed:");
  for (const diagnostic of diagnostics) {
    console.log(`- ${diagnostic}`);
  }
}

function printSmokeViolations(diagnostics: readonly string[]): void {
  console.log("");
  console.log("Package entrypoint smoke violations:");
  for (const diagnostic of diagnostics) {
    console.log(`- ${diagnostic}`);
  }
}

function readPackageJson(packagePath: string): PackageJson {
  return JSON.parse(readFileSync(packagePath, "utf-8")) as PackageJson;
}

function packageManagerFor(rootDir: string): string {
  const packageJsonPath = join(rootDir, "package.json");
  const rootManifest = readPackageJson(packageJsonPath);

  if (typeof rootManifest.packageManager !== "string" || rootManifest.packageManager.length === 0) {
    throw new Error(`${packageJsonPath}: packageManager must pin the pnpm version`);
  }

  return rootManifest.packageManager;
}

function packageNameFor(pkg: PackageJson, packagePath: string): string {
  if (typeof pkg.name === "string" && pkg.name.length > 0) {
    return pkg.name;
  }

  throw new Error(`${packagePath}: package name is required`);
}

function packageIndexFor(packageJsonFiles: readonly string[]): ReadonlyMap<string, PackageInfo> {
  const packageIndex = new Map<string, PackageInfo>();

  for (const packagePath of packageJsonFiles) {
    const sourceManifest = readPackageJson(packagePath);
    if (sourceManifest.private === true) {
      continue;
    }

    const packageName = packageNameFor(sourceManifest, packagePath);
    packageIndex.set(packageName, {
      packageDir: dirname(packagePath),
      packageName,
      packagePath,
      sourceManifest,
    });
  }

  return packageIndex;
}

function runPackageSmoke(
  consumerRoot: string,
  packageInfo: PackedPackageInfo,
  graphPackages: readonly PackedPackageInfo[],
  packageManager: string,
  plan: PackageSmokePlan,
): void {
  const packageSmokeRoot = join(consumerRoot, safeDirectoryName(packageInfo.packageName));
  mkdirSync(packageSmokeRoot, { recursive: true });
  writeConsumerPackageJson(packageSmokeRoot, graphPackages, packageManager);

  const internalPeerTarballs = internalPeerPackagesFor(graphPackages).map(
    (packageInfo) => packageInfo.tarballPath,
  );

  run(
    "pnpm",
    ["add", "--prod", packageInfo.tarballPath, ...internalPeerTarballs, "--ignore-scripts"],
    packageSmokeRoot,
    {
      label: `${packageInfo.packageName}: install packed tarball`,
    },
  );
  console.log(
    `package-entrypoint-smoke: ${packageInfo.packageName} packed tarball installed with node-linker=isolated`,
  );

  writeEsmConsumer(packageSmokeRoot, plan.esm);
  writeCjsConsumer(packageSmokeRoot, plan.cjs);
  writeTypesConsumer(packageSmokeRoot, plan.types);

  if (plan.cjs.length > 0) {
    run("node", [join(packageSmokeRoot, "cjs.cjs")], packageSmokeRoot, {
      label: `${packageInfo.packageName}: cjs entrypoints`,
    });
  }
  if (plan.esm.length > 0) {
    run("node", [join(packageSmokeRoot, "esm.mjs")], packageSmokeRoot, {
      label: `${packageInfo.packageName}: esm entrypoints`,
    });
  }
  if (plan.types.length > 0) {
    run(
      process.execPath,
      [tscPath(), "-p", join(packageSmokeRoot, "tsconfig.json")],
      packageSmokeRoot,
      {
        label: `${packageInfo.packageName}: types entrypoints`,
      },
    );
  }

  if (packageInfo.packageName === "@croco/frontend-vite") {
    runFrontendViteOptionalPeerSmoke(packageSmokeRoot, packageInfo.packageName);
  }
}

function safeDirectoryName(packageName: string): string {
  return packageName.replaceAll("/", "__").replaceAll("@", "");
}

function collectInternalRuntimeGraph(
  rootPackage: PackageInfo,
  packageIndex: ReadonlyMap<string, PackageInfo>,
): PackageInfo[] {
  const graph = new Map<string, PackageInfo>();

  function visit(packageInfo: PackageInfo): void {
    if (graph.has(packageInfo.packageName)) {
      return;
    }

    graph.set(packageInfo.packageName, packageInfo);

    for (const dependencyName of internalRuntimeDependencyNames(packageInfo.sourceManifest)) {
      const dependencyPackage = packageIndex.get(dependencyName);
      if (dependencyPackage) {
        visit(dependencyPackage);
      }
    }
  }

  visit(rootPackage);

  return Array.from(graph.values()).sort((left, right) =>
    left.packageName.localeCompare(right.packageName),
  );
}

function internalRuntimeDependencyNames(pkg: PackageJson): string[] {
  const optionalPeers = optionalPeerDependencyNames(pkg.peerDependenciesMeta);

  return Array.from(
    new Set([
      ...dependencyNames(pkg.dependencies),
      ...dependencyNames(pkg.optionalDependencies),
      ...dependencyNames(pkg.peerDependencies).filter((name) => !optionalPeers.has(name)),
    ]),
  ).sort();
}

function installDependencyNames(pkg: PackageJson): string[] {
  return Array.from(
    new Set([
      ...dependencyNames(pkg.dependencies),
      ...dependencyNames(pkg.peerDependencies),
      ...dependencyNames(pkg.optionalDependencies),
    ]),
  ).sort();
}

function dependencyNames(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  return Object.keys(value).sort();
}

function optionalPeerDependencyNames(value: unknown): ReadonlySet<string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return new Set();
  }

  return new Set(
    Object.entries(value)
      .filter(([, meta]) =>
        Boolean(meta && typeof meta === "object" && "optional" in meta && meta.optional === true),
      )
      .map(([dependencyName]) => dependencyName)
      .sort(),
  );
}

function packPackage(
  packageInfo: PackageInfo,
  packRoot: string,
  rootDir: string,
  packedPackages: Map<string, PackedPackageInfo>,
): void {
  if (packedPackages.has(packageInfo.packageName)) {
    return;
  }

  run("pnpm", ["pack", "--pack-destination", packRoot], packageInfo.packageDir, {
    label: `${packageInfo.packageName}: pnpm pack`,
  });

  const tarballPath = findTarball(packRoot, packageInfo.packageName, rootDir);
  const packedManifest = readPackedJson(tarballPath, "package/package.json", rootDir);
  packedPackages.set(packageInfo.packageName, {
    ...packageInfo,
    packedManifest,
    tarballPath,
  });
}

function findTarball(packRoot: string, packageName: string, rootDir: string): string {
  const matches = readdirSync(packRoot)
    .filter((entry) => entry.endsWith(".tgz"))
    .map((entry) => join(packRoot, entry))
    .filter((tarballPath) => {
      try {
        return readPackedJson(tarballPath, "package/package.json", rootDir).name === packageName;
      } catch {
        return false;
      }
    })
    .sort();

  const tarballPath = matches.at(-1);
  if (!tarballPath) {
    throw new Error(`${packageName}: missing packed tarball`);
  }

  return tarballPath;
}

function readPackedJson(tarballPath: string, entryPath: string, rootDir: string): PackageJson {
  return JSON.parse(readPackedFile(tarballPath, entryPath, rootDir)) as PackageJson;
}

function readPackedFile(tarballPath: string, entryPath: string, rootDir: string): string {
  return run("tar", ["-xOf", tarballPath, entryPath], rootDir, {
    label: `${tarballPath}: read ${entryPath}`,
  }).stdout;
}

function packedFileExists(tarballPath: string, entryPath: string, rootDir: string): boolean {
  const result = spawnSync("tar", ["-tf", tarballPath, entryPath], {
    cwd: rootDir,
    encoding: "utf-8",
    stdio: "pipe",
    timeout: spawnTimeoutMs,
  });

  if (result.error) {
    throw new Error(
      [
        `${tarballPath}: check ${entryPath} failed`,
        `${result.error.name}: ${result.error.message}`,
        result.stdout.trim(),
        result.stderr.trim(),
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return result.status === 0;
}

function writeConsumerPackageJson(
  consumerRoot: string,
  graphPackages: readonly PackedPackageInfo[],
  packageManager: string,
): void {
  const overrides = Object.fromEntries(
    graphPackages.map((packageInfo) => [
      packageInfo.packageName,
      `file:${packageInfo.tarballPath}`,
    ]),
  );

  writeFileSync(
    join(consumerRoot, "package.json"),
    `${JSON.stringify(
      {
        name: "croco-package-entrypoint-smoke-consumer",
        packageManager,
        private: true,
        type: "module",
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(consumerRoot, "pnpm-workspace.yaml"),
    `${JSON.stringify(
      {
        packages: [],
        overrides,
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(consumerRoot, ".npmrc"),
    [
      "node-linker=isolated",
      "hoist=false",
      "auto-install-peers=true",
      "link-workspace-packages=false",
      "",
    ].join("\n"),
  );
}

function directInternalPeerDependencyNames(packageInfo: PackageInfo): string[] {
  const optionalPeers = optionalPeerDependencyNames(
    packageInfo.sourceManifest.peerDependenciesMeta,
  );

  return dependencyNames(packageInfo.sourceManifest.peerDependencies).filter(
    (dependencyName) => !optionalPeers.has(dependencyName) && dependencyName.startsWith("@croco/"),
  );
}

function internalPeerPackagesFor(graphPackages: readonly PackedPackageInfo[]): PackedPackageInfo[] {
  const packageIndex = new Map(
    graphPackages.map((packageInfo) => [packageInfo.packageName, packageInfo]),
  );
  const peerPackages = new Map<string, PackedPackageInfo>();

  for (const packageInfo of graphPackages) {
    for (const dependencyName of directInternalPeerDependencyNames(packageInfo)) {
      const peerPackage = packageIndex.get(dependencyName);
      if (peerPackage) {
        peerPackages.set(peerPackage.packageName, peerPackage);
      }
    }
  }

  return Array.from(peerPackages.values()).sort((left, right) =>
    left.packageName.localeCompare(right.packageName),
  );
}

function planPackageSmoke(packageInfo: PackedPackageInfo): PackageSmokePlan {
  const diagnostics: string[] = [];
  const packageName = packageNameFor(packageInfo.packedManifest, packageInfo.packagePath);
  const publishManifest = packageInfo.packedManifest;
  const exportsValue = publishManifest.exports;
  const exportEntries = collectExportEntries(packageName, exportsValue, diagnostics);
  const esm: SmokeTarget[] = [];
  const cjs: SmokeTarget[] = [];
  const types: SmokeTarget[] = [];

  if (exportEntries.length === 0) {
    pushStringTarget(packageName, publishManifest.main, "main", packageInfo, diagnostics, esm);
    pushStringTarget(packageName, publishManifest.types, "types", packageInfo, diagnostics, types);
  } else {
    for (const entry of exportEntries) {
      pushConditionalTarget(
        entry.specifier,
        entry.value,
        `${entry.fieldName}.import`,
        "import",
        packageInfo,
        diagnostics,
        esm,
      );
      pushConditionalTarget(
        entry.specifier,
        entry.value,
        `${entry.fieldName}.require`,
        "require",
        packageInfo,
        diagnostics,
        cjs,
      );
      pushConditionalTarget(
        entry.specifier,
        entry.value,
        `${entry.fieldName}.types`,
        "types",
        packageInfo,
        diagnostics,
        types,
      );
    }
  }

  if (esm.length === 0) {
    diagnostics.push(`${packageName}: no ESM import target found in the publish contract`);
  }

  if (types.length === 0) {
    diagnostics.push(`${packageName}: no declaration target found in the publish contract`);
  }

  for (const target of types) {
    validateDeclaredTypeDependencies(packageInfo, target, diagnostics);
  }
  for (const target of [...esm, ...cjs]) {
    validateDeclaredRuntimeDependencies(packageInfo, target, diagnostics);
  }

  return { cjs, diagnostics, esm, types };
}

function validateDeclaredRuntimeDependencies(
  packageInfo: PackedPackageInfo,
  target: SmokeTarget,
  diagnostics: string[],
): void {
  if (target.kind === "json") {
    return;
  }

  const declaredDependencies = new Set(installDependencyNames(packageInfo.packedManifest));
  const runtimeContent = stripTemplateLiterals(
    stripComments(
      readPackedFile(
        packageInfo.tarballPath,
        `package/${target.target.slice(2)}`,
        packageInfo.packageDir,
      ),
    ),
  );
  const packageName = packageInfo.packageName;
  const undeclaredDependencies = new Set<string>();

  for (const specifier of collectRuntimeImportSpecifiers(runtimeContent)) {
    const dependencyName = packageNameFromSpecifier(specifier);

    if (
      !dependencyName ||
      dependencyName === packageName ||
      nodeBuiltinModules.has(dependencyName) ||
      declaredDependencies.has(dependencyName)
    ) {
      continue;
    }

    undeclaredDependencies.add(dependencyName);
  }

  for (const dependencyName of Array.from(undeclaredDependencies).sort()) {
    diagnostics.push(
      `${packageName}: ${target.fieldName} imports undeclared runtime dependency ${dependencyName}`,
    );
  }
}

function validateDeclaredTypeDependencies(
  packageInfo: PackedPackageInfo,
  target: SmokeTarget,
  diagnostics: string[],
): void {
  const declaredDependencies = new Set(installDependencyNames(packageInfo.packedManifest));
  const declarationContent = stripComments(
    readPackedFile(
      packageInfo.tarballPath,
      `package/${target.target.slice(2)}`,
      packageInfo.packageDir,
    ),
  );
  const packageName = packageInfo.packageName;
  const undeclaredDependencies = new Set<string>();

  for (const specifier of collectDeclarationImportSpecifiers(declarationContent)) {
    const dependencyName = packageNameFromSpecifier(specifier);

    if (
      !dependencyName ||
      dependencyName === packageName ||
      nodeBuiltinModules.has(dependencyName) ||
      declaredDependencies.has(dependencyName) ||
      declaredDependencies.has(typeDeclarationPackageNameFor(dependencyName))
    ) {
      continue;
    }

    undeclaredDependencies.add(dependencyName);
  }

  for (const dependencyName of Array.from(undeclaredDependencies).sort()) {
    diagnostics.push(
      `${packageName}: ${target.fieldName} imports undeclared type dependency ${dependencyName}`,
    );
  }
}

function collectDeclarationImportSpecifiers(content: string): string[] {
  const specifiers = new Set<string>();
  const importDeclarationPattern =
    /^\s*import(?:\s+type)?(?:\s+[^;]*?\s+from)?\s*["']([^"']+)["']/gm;
  const exportDeclarationPattern = /^\s*export(?:\s+type)?\s+[^;]*?\s+from\s*["']([^"']+)["']/gm;
  const importTypePattern = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;

  for (const pattern of [importDeclarationPattern, exportDeclarationPattern, importTypePattern]) {
    for (const match of content.matchAll(pattern)) {
      const specifier = match[1];
      if (specifier) {
        specifiers.add(specifier);
      }
    }
  }

  return Array.from(specifiers).sort();
}

function collectRuntimeImportSpecifiers(content: string): string[] {
  const specifiers = new Set<string>();
  const importDeclarationPattern = /^\s*import(?:\s+[^;]*?\s+from)?\s*["']([^"']+)["']/gm;
  const exportDeclarationPattern = /^\s*export\s+[^;]*?\s+from\s*["']([^"']+)["']/gm;
  const importCallPattern = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
  const requireCallPattern = /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g;

  for (const pattern of [
    importDeclarationPattern,
    exportDeclarationPattern,
    importCallPattern,
    requireCallPattern,
  ]) {
    for (const match of content.matchAll(pattern)) {
      const specifier = match[1];
      if (specifier) {
        specifiers.add(specifier);
      }
    }
  }

  return Array.from(specifiers).sort();
}

function stripComments(content: string): string {
  return content.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function stripTemplateLiterals(content: string): string {
  let stripped = "";
  let inTemplate = false;
  let escaped = false;

  for (const character of content) {
    if (!inTemplate) {
      if (character === "`") {
        inTemplate = true;
        stripped += " ";
        continue;
      }

      stripped += character;
      continue;
    }

    if (escaped) {
      escaped = false;
      stripped += character === "\n" ? "\n" : " ";
      continue;
    }

    if (character === "\\") {
      escaped = true;
      stripped += " ";
      continue;
    }

    if (character === "`") {
      inTemplate = false;
      stripped += " ";
      continue;
    }

    stripped += character === "\n" ? "\n" : " ";
  }

  return stripped;
}

function packageNameFromSpecifier(specifier: string): string | undefined {
  if (specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("#")) {
    return undefined;
  }

  if (specifier.startsWith("@")) {
    const [scope, name] = specifier.split("/");
    if (!scope || !name) {
      return specifier;
    }

    return `${scope}/${name}`;
  }

  return specifier.split("/")[0];
}

function typeDeclarationPackageNameFor(packageName: string): string {
  if (packageName.startsWith("@")) {
    const [scope, name] = packageName.slice(1).split("/");
    if (!scope || !name) {
      return `@types/${packageName.slice(1)}`;
    }

    return `@types/${scope}__${name}`;
  }

  return `@types/${packageName}`;
}

function collectExportEntries(
  packageName: string,
  exportsValue: unknown,
  diagnostics: string[],
): Array<{ readonly fieldName: string; readonly specifier: string; readonly value: unknown }> {
  if (!exportsValue) {
    return [];
  }

  if (typeof exportsValue === "string") {
    return [
      {
        fieldName: "exports",
        specifier: packageName,
        value: exportsValue,
      },
    ];
  }

  if (typeof exportsValue !== "object" || Array.isArray(exportsValue)) {
    diagnostics.push(`${packageName}: exports must be a string or object`);
    return [];
  }

  return Object.entries(exportsValue).map(([exportPath, value]) => ({
    fieldName: `exports["${exportPath}"]`,
    specifier: specifierFor(packageName, exportPath),
    value,
  }));
}

function specifierFor(packageName: string, exportPath: string): string {
  if (exportPath === ".") {
    return packageName;
  }

  if (exportPath.startsWith("./")) {
    return `${packageName}/${exportPath.slice(2)}`;
  }

  return `${packageName}/${exportPath}`;
}

function pushConditionalTarget(
  specifier: string,
  value: unknown,
  fieldName: string,
  condition: "import" | "require" | "types",
  packageInfo: PackedPackageInfo,
  diagnostics: string[],
  targets: SmokeTarget[],
): void {
  if (typeof value === "string") {
    if (condition === "types" && isJsonTargetPath(value)) {
      return;
    }

    pushStringTarget(specifier, value, fieldName, packageInfo, diagnostics, targets);
    return;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    diagnostics.push(
      `${packageNameFor(packageInfo.sourceManifest, packageInfo.packagePath)}: ${fieldName} must be a string`,
    );
    return;
  }

  const target = (value as Record<string, unknown>)[condition];
  if (target === undefined && condition === "require") {
    return;
  }
  if (condition === "types" && typeof target === "string" && isJsonTargetPath(target)) {
    return;
  }

  pushStringTarget(specifier, target, fieldName, packageInfo, diagnostics, targets);
}

function pushStringTarget(
  specifier: string,
  target: unknown,
  fieldName: string,
  packageInfo: PackedPackageInfo,
  diagnostics: string[],
  targets: SmokeTarget[],
): void {
  const packageName = packageNameFor(packageInfo.packedManifest, packageInfo.packagePath);

  if (typeof target !== "string") {
    diagnostics.push(`${packageName}: ${fieldName} must be a string`);
    return;
  }

  if (!target.startsWith("./")) {
    diagnostics.push(`${packageName}: ${fieldName} must be a relative package file path`);
    return;
  }

  if (
    !packedFileExists(packageInfo.tarballPath, `package/${target.slice(2)}`, packageInfo.packageDir)
  ) {
    diagnostics.push(`${packageName}: ${fieldName} points to missing file ${target}`);
    return;
  }

  targets.push({
    fieldName,
    kind: isJsonTargetPath(target) ? "json" : "module",
    specifier,
    target,
  });
}

function isJsonTargetPath(target: string): boolean {
  return target.endsWith(".json");
}

function writeEsmConsumer(smokeRoot: string, targets: readonly SmokeTarget[]): void {
  writeFileSync(
    join(smokeRoot, "esm.mjs"),
    [
      'process.env.SKIP_ENV_VALIDATION = "true";',
      "const targets = [",
      ...targets.map(
        (target) =>
          `  ${JSON.stringify({ json: target.kind === "json", specifier: target.specifier })},`,
      ),
      "];",
      "for (const target of targets) {",
      "  if (target.json) {",
      '    await import(target.specifier, { with: { type: "json" } });',
      "  } else {",
      "    await import(target.specifier);",
      "  }",
      "  console.log(`esm ok ${target.specifier}`);",
      "}",
      "",
    ].join("\n"),
  );
}

function writeCjsConsumer(smokeRoot: string, targets: readonly SmokeTarget[]): void {
  writeFileSync(
    join(smokeRoot, "cjs.cjs"),
    [
      'process.env.SKIP_ENV_VALIDATION = "true";',
      'const { createRequire } = require("node:module");',
      "const requireFromSmoke = createRequire(__filename);",
      "const targets = [",
      ...targets.map((target) => `  ${JSON.stringify(target.specifier)},`),
      "];",
      "for (const target of targets) {",
      "  requireFromSmoke(target);",
      "  console.log(`cjs ok ${target}`);",
      "}",
      "",
    ].join("\n"),
  );
}

function writeTypesConsumer(smokeRoot: string, targets: readonly SmokeTarget[]): void {
  writeFileSync(
    join(smokeRoot, "types.ts"),
    targets
      .flatMap((target, index) => [
        `import type * as Package${index} from ${JSON.stringify(target.specifier)};`,
        `type Package${index}Entrypoint = typeof Package${index};`,
        `declare const package${index}: Package${index}Entrypoint | undefined;`,
        `void package${index};`,
        "",
      ])
      .join("\n"),
  );
  writeFileSync(
    join(smokeRoot, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          module: "NodeNext",
          moduleResolution: "NodeNext",
          noEmit: true,
          skipLibCheck: true,
          strict: true,
          target: "ES2022",
        },
        include: ["types.ts"],
      },
      null,
      2,
    )}\n`,
  );
}

function runFrontendViteOptionalPeerSmoke(smokeRoot: string, packageName: string): void {
  removeCloudflareVitePlugin(smokeRoot);

  writeFileSync(
    join(smokeRoot, "frontend-vite-optional-peer.cjs"),
    [
      `const { crocoVitePlugin } = require("${packageName}");`,
      "const plugins = crocoVitePlugin({ cloudflare: false });",
      "if (!Array.isArray(plugins) || plugins.length !== 0) {",
      '  throw new Error("cloudflare: false should not create Cloudflare plugin options");',
      "}",
      'console.log("frontend-vite optional peer cjs ok");',
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(smokeRoot, "frontend-vite-optional-peer.mjs"),
    [
      `const { crocoVitePlugin, MissingCloudflareVitePluginProblem } = await import("${packageName}");`,
      "const plugins = crocoVitePlugin({ cloudflare: false });",
      "if (!Array.isArray(plugins) || plugins.length !== 0) {",
      '  throw new Error("cloudflare: false should not create Cloudflare plugin options");',
      "}",
      "try {",
      "  await Promise.all(crocoVitePlugin());",
      "} catch (error) {",
      "  if (error instanceof MissingCloudflareVitePluginProblem && error.message.includes('Install \"@cloudflare/vite-plugin\"')) {",
      '    console.log("frontend-vite optional peer esm ok");',
      "    process.exit(0);",
      "  }",
      "  throw error;",
      "}",
      'throw new Error("default Cloudflare plugin unexpectedly resolved without @cloudflare/vite-plugin");',
      "",
    ].join("\n"),
  );

  run("node", [join(smokeRoot, "frontend-vite-optional-peer.cjs")], smokeRoot, {
    label: `${packageName}: frontend-vite optional peer cjs`,
  });
  run("node", [join(smokeRoot, "frontend-vite-optional-peer.mjs")], smokeRoot, {
    label: `${packageName}: frontend-vite optional peer esm`,
  });

  installBrokenCloudflareVitePlugin(smokeRoot);
  writeFileSync(
    join(smokeRoot, "frontend-vite-nested-error.mjs"),
    [
      `const { crocoVitePlugin } = await import("${packageName}");`,
      "try {",
      "  await Promise.all(crocoVitePlugin());",
      "} catch (error) {",
      "  if (!(error instanceof Error)) {",
      "    throw new Error('expected an Error from the broken Cloudflare plugin');",
      "  }",
      "  if (!error.message.includes('cloudflare-plugin-transitive-missing')) {",
      "    throw new Error(`expected nested missing dependency diagnostic, got: ${error.message}`);",
      "  }",
      "  if (error.message.includes('Install \"@cloudflare/vite-plugin\"')) {",
      "    throw new Error(`nested Cloudflare plugin errors must not be rewritten: ${error.message}`);",
      "  }",
      '  console.log("frontend-vite nested error ok");',
      "  process.exit(0);",
      "}",
      'throw new Error("broken Cloudflare plugin unexpectedly resolved");',
      "",
    ].join("\n"),
  );
  run("node", [join(smokeRoot, "frontend-vite-nested-error.mjs")], smokeRoot, {
    label: `${packageName}: frontend-vite nested peer error`,
  });
}

function removeCloudflareVitePlugin(smokeRoot: string): void {
  rmSync(join(smokeRoot, "node_modules", "@cloudflare", "vite-plugin"), {
    force: true,
    recursive: true,
  });
}

function installBrokenCloudflareVitePlugin(smokeRoot: string): void {
  const packageDir = join(smokeRoot, "node_modules", "@cloudflare", "vite-plugin");
  mkdirSync(join(packageDir, "dist"), { recursive: true });
  writeFileSync(
    join(packageDir, "package.json"),
    `${JSON.stringify(
      {
        exports: {
          ".": "./dist/index.mjs",
        },
        name: "@cloudflare/vite-plugin",
        type: "module",
        version: "0.0.0-smoke",
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(packageDir, "dist", "index.mjs"),
    [
      "import 'cloudflare-plugin-transitive-missing';",
      "",
      "export function cloudflare() {",
      "  return [];",
      "}",
      "",
    ].join("\n"),
  );
}

function printCoverageSummary(
  packageResults: readonly PackageSmokeResult[],
  exemptions: readonly ExemptionResult[],
  skippedPrivateCount: number,
): void {
  console.log("package-entrypoint-smoke: checked packages");
  for (const result of packageResults) {
    console.log(
      `✓ ${result.packageName}: esm ${result.esmCount}, cjs ${result.cjsCount}, types ${result.typesCount}`,
    );
  }

  console.log("");
  console.log("package-entrypoint-smoke: exemptions");
  if (exemptions.length === 0) {
    console.log("- none");
  } else {
    for (const exemption of exemptions) {
      console.log(`- ${exemption.packageName}: ${exemption.reason}`);
    }
  }

  console.log("");
  console.log(
    `package-entrypoint-smoke: summary checked=${packageResults.length} exempt=${exemptions.length} skippedPrivate=${skippedPrivateCount}`,
  );
}

function tscPath(): string {
  return join(defaultRootDir, "node_modules", "typescript", "lib", "tsc.js");
}

function run(
  command: string,
  args: readonly string[],
  cwd: string,
  options: { readonly expectedExitCode?: number; readonly label: string },
): RunResult {
  const expectedExitCode = options.expectedExitCode ?? 0;
  const result = spawnSync(command, [...args], {
    cwd,
    encoding: "utf-8",
    env: { ...process.env, DATABASE_URL: "" },
    stdio: "pipe",
    timeout: spawnTimeoutMs,
  });

  if (result.error || result.status !== expectedExitCode) {
    throw new Error(
      [
        `${options.label}: ${command} ${args.map((arg) => relativeArg(cwd, arg)).join(" ")} failed`,
        `Expected exit code: ${expectedExitCode}`,
        `Actual exit code: ${result.status ?? "null"}`,
        result.error ? `${result.error.name}: ${result.error.message}` : undefined,
        result.stdout.trim(),
        result.stderr.trim(),
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return {
    stderr: result.stderr,
    stdout: result.stdout,
  };
}

function relativeArg(cwd: string, arg: string): string {
  if (arg.startsWith(cwd)) {
    return relative(cwd, arg);
  }

  return arg;
}

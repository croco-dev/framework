import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
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
const spawnTimeoutMs = 30_000;
const nodeBuiltinModules = new Set([
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`),
]);

type PackageJson = {
  readonly name?: string;
  readonly private?: boolean;
  readonly publishConfig?: Record<string, unknown>;
  readonly [key: string]: unknown;
};

type PackageInfo = {
  readonly packageDir: string;
  readonly packagePath: string;
  readonly packageName: string;
  readonly publishManifest: PackageJson;
  readonly sourceManifest: PackageJson;
};

type SmokeTarget = {
  readonly fieldName: string;
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

main();

function main(): void {
  const rootDir = mode.rootDir;
  const smokeRoot = mkdtempSync(join(tmpdir(), "croco-entrypoint-smoke-"));

  try {
    const packageJsonFiles = findPackageJsonFiles(join(rootDir, "packages"));
    const packageIndex = packageIndexFor(packageJsonFiles);
    const diagnostics: string[] = [];
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

      const packageInfo: PackageInfo = {
        packageDir: dirname(packagePath),
        packageName,
        packagePath,
        publishManifest: publishManifestFor(sourceManifest),
        sourceManifest,
      };
      const plan = planPackageSmoke(packageInfo);
      diagnostics.push(...plan.diagnostics);
      if (plan.diagnostics.length === 0) {
        runPackageSmoke(smokeRoot, packageInfo, packageIndex, plan);
      }
      packageResults.push({
        cjsCount: plan.cjs.length,
        esmCount: plan.esm.length,
        packageName,
        typesCount: plan.types.length,
      });
    }

    printCoverageSummary(packageResults, exemptions, skippedPrivateCount);

    if (diagnostics.length > 0) {
      console.log("");
      console.log("Package entrypoint smoke violations:");
      for (const diagnostic of diagnostics) {
        console.log(`- ${diagnostic}`);
      }
      process.exitCode = 1;
      return;
    }

    console.log("");
    console.log(
      `package-entrypoint-smoke: cjs, esm, and typescript consumers resolved for ${packageResults.length} packages`,
    );
  } finally {
    rmSync(smokeRoot, { force: true, recursive: true });
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

function readPackageJson(packagePath: string): PackageJson {
  return JSON.parse(readFileSync(packagePath, "utf-8")) as PackageJson;
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
      publishManifest: publishManifestFor(sourceManifest),
      sourceManifest,
    });
  }

  return packageIndex;
}

function publishManifestFor(sourceManifest: PackageJson): PackageJson {
  const publishManifest = {
    ...sourceManifest,
    ...sourceManifest.publishConfig,
  };
  delete publishManifest.publishConfig;

  return publishManifest;
}

function runPackageSmoke(
  smokeRoot: string,
  packageInfo: PackageInfo,
  packageIndex: ReadonlyMap<string, PackageInfo>,
  plan: PackageSmokePlan,
): void {
  const packageSmokeRoot = join(smokeRoot, safeDirectoryName(packageInfo.packageName));
  mkdirSync(packageSmokeRoot, { recursive: true });
  installPackageGraph(packageSmokeRoot, packageInfo, packageIndex, new Set());

  writeEsmConsumer(packageSmokeRoot, plan.esm);
  writeCjsConsumer(packageSmokeRoot, plan.cjs);
  writeTypesConsumer(packageSmokeRoot, plan.types);

  if (plan.cjs.length > 0) {
    run("node", [join(packageSmokeRoot, "cjs.cjs")], packageSmokeRoot);
  }
  if (plan.esm.length > 0) {
    run("node", [join(packageSmokeRoot, "esm.mjs")], packageSmokeRoot);
  }
  if (plan.types.length > 0) {
    run(
      process.execPath,
      [tscPath(), "-p", join(packageSmokeRoot, "tsconfig.json")],
      packageSmokeRoot,
    );
  }
}

function safeDirectoryName(packageName: string): string {
  return packageName.replaceAll("/", "__").replaceAll("@", "");
}

function installPackageGraph(
  smokeRoot: string,
  packageInfo: PackageInfo,
  packageIndex: ReadonlyMap<string, PackageInfo>,
  installedPackages: Set<string>,
): void {
  if (installedPackages.has(packageInfo.packageName)) {
    return;
  }

  installedPackages.add(packageInfo.packageName);
  installPackage(smokeRoot, packageInfo);

  for (const dependencyName of installDependencyNames(packageInfo.sourceManifest)) {
    const workspaceDependency = packageIndex.get(dependencyName);
    if (workspaceDependency) {
      installPackageGraph(smokeRoot, workspaceDependency, packageIndex, installedPackages);
      continue;
    }

    installExternalDependency(
      smokeRoot,
      dependencyName,
      optionalDependencyNames(packageInfo.sourceManifest).has(dependencyName),
    );
  }
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

function optionalDependencyNames(pkg: PackageJson): ReadonlySet<string> {
  return new Set(dependencyNames(pkg.optionalDependencies));
}

function installPackage(smokeRoot: string, packageInfo: PackageInfo): void {
  const smokePackageDir = join(smokeRoot, "node_modules", ...packageInfo.packageName.split("/"));
  const sourceDistDir = join(packageInfo.packageDir, "dist");
  mkdirSync(smokePackageDir, { recursive: true });
  if (existsSync(sourceDistDir)) {
    cpSync(sourceDistDir, join(smokePackageDir, "dist"), { recursive: true });
  } else {
    mkdirSync(join(smokePackageDir, "dist"), { recursive: true });
  }
  writeFileSync(
    join(smokePackageDir, "package.json"),
    `${JSON.stringify(packageInfo.publishManifest, null, 2)}\n`,
  );
}

function installExternalDependency(
  smokeRoot: string,
  dependencyName: string,
  optional: boolean,
): void {
  const sourceDependencyDir = join(defaultRootDir, "node_modules", ...dependencyName.split("/"));
  if (!existsSync(sourceDependencyDir)) {
    if (optional) {
      return;
    }

    throw new Error(`${dependencyName}: declared dependency is missing from root node_modules`);
  }

  const smokeDependencyDir = join(smokeRoot, "node_modules", ...dependencyName.split("/"));
  if (existsSync(smokeDependencyDir)) {
    return;
  }

  mkdirSync(dirname(smokeDependencyDir), { recursive: true });
  symlinkSync(sourceDependencyDir, smokeDependencyDir, "dir");
}

function planPackageSmoke(packageInfo: PackageInfo): PackageSmokePlan {
  const diagnostics: string[] = [];
  const packageName = packageNameFor(packageInfo.sourceManifest, packageInfo.packagePath);
  const publishManifest = packageInfo.publishManifest;
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

  return { cjs, diagnostics, esm, types };
}

function validateDeclaredTypeDependencies(
  packageInfo: PackageInfo,
  target: SmokeTarget,
  diagnostics: string[],
): void {
  const declaredDependencies = new Set(installDependencyNames(packageInfo.sourceManifest));
  const declarationPath = join(packageInfo.packageDir, target.target);
  const declarationContent = stripComments(readFileSync(declarationPath, "utf-8"));
  const importPattern = /\b(?:from|import)\s*\(?\s*["']([^"']+)["']/g;
  const packageName = packageInfo.packageName;
  const undeclaredDependencies = new Set<string>();

  for (const match of declarationContent.matchAll(importPattern)) {
    const specifier = match[1];
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

function stripComments(content: string): string {
  return content.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
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
  packageInfo: PackageInfo,
  diagnostics: string[],
  targets: SmokeTarget[],
): void {
  if (typeof value === "string") {
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

  pushStringTarget(specifier, target, fieldName, packageInfo, diagnostics, targets);
}

function pushStringTarget(
  specifier: string,
  target: unknown,
  fieldName: string,
  packageInfo: PackageInfo,
  diagnostics: string[],
  targets: SmokeTarget[],
): void {
  const packageName = packageNameFor(packageInfo.sourceManifest, packageInfo.packagePath);

  if (typeof target !== "string") {
    diagnostics.push(`${packageName}: ${fieldName} must be a string`);
    return;
  }

  if (!target.startsWith("./")) {
    diagnostics.push(`${packageName}: ${fieldName} must be a relative package file path`);
    return;
  }

  const targetPath = join(packageInfo.packageDir, target);
  if (!existsSync(targetPath)) {
    diagnostics.push(`${packageName}: ${fieldName} points to missing file ${target}`);
    return;
  }

  targets.push({ fieldName, specifier, target });
}

function writeEsmConsumer(smokeRoot: string, targets: readonly SmokeTarget[]): void {
  writeFileSync(
    join(smokeRoot, "esm.mjs"),
    [
      'process.env.SKIP_ENV_VALIDATION = "true";',
      "const targets = [",
      ...targets.map((target) => `  ${JSON.stringify(target.specifier)},`),
      "];",
      "for (const target of targets) {",
      "  await import(target);",
      "  console.log(`esm ok ${target}`);",
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

function run(command: string, args: readonly string[], cwd: string): void {
  const result = spawnSync(command, [...args], {
    cwd,
    encoding: "utf-8",
    stdio: "pipe",
    timeout: spawnTimeoutMs,
  });

  if (result.error || result.status !== 0) {
    throw new Error(
      [
        `${command} ${args.join(" ")} failed`,
        result.error ? `${result.error.name}: ${result.error.message}` : undefined,
        result.stdout.trim(),
        result.stderr.trim(),
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  if (result.stdout.trim()) {
    console.log(result.stdout.trim());
  }
}

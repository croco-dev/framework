#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";

export const TYPESCRIPT_BASELINE = "6.0.3";
export const GENERATED_TYPESCRIPT_RANGE = `^${TYPESCRIPT_BASELINE}`;
export const TSUP_COMPATIBILITY_VERSION = "8.5.1";
export const TSUP_COMPATIBILITY_PATCH = "patches/tsup@8.5.1.patch";

type JsonRecord = Readonly<Record<string, unknown>>;

export function collectWorkspaceCompilerDiagnostics(
  rootPackage: JsonRecord,
  workspace: JsonRecord,
): string[] {
  const diagnostics: string[] = [];
  checkValue(
    diagnostics,
    "package.json devDependencies.typescript",
    nestedString(rootPackage, "devDependencies", "typescript"),
    TYPESCRIPT_BASELINE,
  );
  checkValue(
    diagnostics,
    "package.json devDependencies.tsup",
    nestedString(rootPackage, "devDependencies", "tsup"),
    TSUP_COMPATIBILITY_VERSION,
  );
  checkValue(
    diagnostics,
    "pnpm-workspace.yaml overrides.typescript",
    nestedString(workspace, "overrides", "typescript"),
    TYPESCRIPT_BASELINE,
  );
  checkValue(
    diagnostics,
    `pnpm-workspace.yaml patchedDependencies.tsup@${TSUP_COMPATIBILITY_VERSION}`,
    nestedString(workspace, "patchedDependencies", `tsup@${TSUP_COMPATIBILITY_VERSION}`),
    TSUP_COMPATIBILITY_PATCH,
  );
  return diagnostics;
}

export function collectCompilerBaselineDiagnostics(rootDir: string): string[] {
  const diagnostics: string[] = [];
  const rootPackage = readJson(join(rootDir, "package.json"));
  const workspace = parseYaml(
    readFileSync(join(rootDir, "pnpm-workspace.yaml"), "utf8"),
  ) as JsonRecord;

  diagnostics.push(...collectWorkspaceCompilerDiagnostics(rootPackage, workspace));

  const baseConfigPath = join(rootDir, "tsconfig", "tsconfig.base.json");
  const baseCompilerOptions = compilerOptionsFor(readJson(baseConfigPath));
  checkValue(
    diagnostics,
    "tsconfig/tsconfig.base.json compilerOptions.experimentalDecorators",
    baseCompilerOptions.experimentalDecorators,
    true,
  );
  checkValue(
    diagnostics,
    "tsconfig/tsconfig.base.json compilerOptions.emitDecoratorMetadata",
    baseCompilerOptions.emitDecoratorMetadata,
    true,
  );
  checkValue(
    diagnostics,
    "tsconfig/tsconfig.base.json compilerOptions.rootDir",
    baseCompilerOptions.rootDir,
    "..",
  );
  checkValue(
    diagnostics,
    "tsconfig/tsconfig.base.json compilerOptions.moduleResolution",
    baseCompilerOptions.moduleResolution,
    "bundler",
  );
  if (
    !Array.isArray(baseCompilerOptions.types) ||
    baseCompilerOptions.types.length !== 1 ||
    baseCompilerOptions.types[0] !== "node"
  ) {
    diagnostics.push(
      'tsconfig/tsconfig.base.json compilerOptions.types: expected ["node"] for TypeScript 6 ambient types',
    );
  }

  for (const configPath of findFiles(rootDir, (name) =>
    /^tsconfig.*\.json(?:\.hbs)?$/.test(name),
  )) {
    const displayPath = relative(rootDir, configPath);
    const compilerOptions = compilerOptionsFor(readJson(configPath));
    for (const option of ["baseUrl", "downlevelIteration", "ignoreDeprecations"] as const) {
      if (option in compilerOptions) {
        diagnostics.push(
          `${displayPath}: compilerOptions.${option} is not allowed on the TypeScript 6 baseline`,
        );
      }
    }
    if (
      typeof compilerOptions.moduleResolution === "string" &&
      ["node", "node10"].includes(compilerOptions.moduleResolution.toLowerCase())
    ) {
      diagnostics.push(
        `${displayPath}: compilerOptions.moduleResolution must not use the deprecated node10 resolver`,
      );
    }
    const paths = compilerOptions.paths;
    if (isRecord(paths)) {
      for (const [specifier, targets] of Object.entries(paths)) {
        if (!Array.isArray(targets)) continue;
        for (const target of targets) {
          if (typeof target === "string" && !target.startsWith("./") && !target.startsWith("../")) {
            diagnostics.push(
              `${displayPath}: compilerOptions.paths.${specifier} target ${JSON.stringify(target)} must be config-relative`,
            );
          }
        }
      }
    }
  }

  const generatedManifestPaths = findFiles(
    join(rootDir, "packages", "create-croco-app", "templates"),
    (name) => name === "package.json.hbs",
  );
  let generatedDeclarationCount = 0;
  for (const manifestPath of generatedManifestPaths) {
    const source = readFileSync(manifestPath, "utf8");
    for (const match of source.matchAll(/"typescript"\s*:\s*"([^"]+)"/g)) {
      generatedDeclarationCount++;
      checkValue(
        diagnostics,
        `${relative(rootDir, manifestPath)} TypeScript range`,
        match[1],
        GENERATED_TYPESCRIPT_RANGE,
      );
    }
  }
  if (generatedDeclarationCount === 0) {
    diagnostics.push("create-croco-app templates must declare the supported TypeScript range");
  }
  const generatedBaseCompilerOptions = compilerOptionsFor(
    readJson(join(rootDir, "packages", "create-croco-app", "templates", "blank", "tsconfig.json")),
  );
  if (
    !Array.isArray(generatedBaseCompilerOptions.types) ||
    generatedBaseCompilerOptions.types.length !== 1 ||
    generatedBaseCompilerOptions.types[0] !== "node"
  ) {
    diagnostics.push(
      'create-croco-app base tsconfig compilerOptions.types: expected ["node"] for TypeScript 6 ambient types',
    );
  }
  for (const templateName of ["admin-console", "ai-saas", "blank", "saas", "spa-be-split"]) {
    const generatedRootManifest = readJson(
      join(rootDir, "packages", "create-croco-app", "templates", templateName, "package.json.hbs"),
    );
    checkValue(
      diagnostics,
      `create-croco-app ${templateName} manifest devDependencies.@types/node`,
      nestedString(generatedRootManifest, "devDependencies", "@types/node"),
      "^22",
    );
  }
  for (const templateName of ["saas", "spa-be-split"]) {
    const apiTsconfigPath = join(
      rootDir,
      "packages",
      "create-croco-app",
      "templates",
      templateName,
      "apps",
      "api-server",
      "tsconfig.json.hbs",
    );
    const apiCompilerOptions = compilerOptionsFor(readJson(apiTsconfigPath));
    if (
      !Array.isArray(apiCompilerOptions.types) ||
      apiCompilerOptions.types.length !== 1 ||
      apiCompilerOptions.types[0] !== "node"
    ) {
      diagnostics.push(
        `${relative(rootDir, apiTsconfigPath)} compilerOptions.types: expected ["node"] for TypeScript 6 ambient types`,
      );
    }
  }
  for (const templateName of ["base-ddd", "saas", "spa-be-split"]) {
    const workspacePath = join(
      rootDir,
      "packages",
      "create-croco-app",
      "templates",
      templateName,
      "pnpm-workspace.yaml.hbs",
    );
    const generatedWorkspace = parseYaml(readFileSync(workspacePath, "utf8")) as JsonRecord;
    checkValue(
      diagnostics,
      `${relative(rootDir, workspacePath)} patchedDependencies.tsup@${TSUP_COMPATIBILITY_VERSION}`,
      nestedString(generatedWorkspace, "patchedDependencies", `tsup@${TSUP_COMPATIBILITY_VERSION}`),
      TSUP_COMPATIBILITY_PATCH,
    );
  }
  const workspaceTsupPatch = readFileSync(join(rootDir, TSUP_COMPATIBILITY_PATCH), "utf8");
  for (const templateName of ["blank", "spa-be-split"]) {
    const generatedTsupPatchPath = join(
      rootDir,
      "packages",
      "create-croco-app",
      "templates",
      templateName,
      "patches",
      "tsup@8.5.1.patch",
    );
    if (
      !existsSync(generatedTsupPatchPath) ||
      readFileSync(generatedTsupPatchPath, "utf8") !== workspaceTsupPatch
    ) {
      diagnostics.push(
        `create-croco-app ${templateName} tsup compatibility patch must match patches/tsup@8.5.1.patch`,
      );
    }
  }

  for (const manifestPath of findFiles(
    join(rootDir, "examples"),
    (name) => name === "package.json",
  )) {
    const manifest = readJson(manifestPath);
    const declaredVersion = nestedString(manifest, "devDependencies", "typescript");
    if (declaredVersion !== undefined) {
      checkValue(
        diagnostics,
        `${relative(rootDir, manifestPath)} devDependencies.typescript`,
        declaredVersion,
        GENERATED_TYPESCRIPT_RANGE,
      );
    }
  }

  const supportPolicyPath = join(rootDir, "docs", "typescript-support.md");
  if (!existsSync(supportPolicyPath)) {
    diagnostics.push("docs/typescript-support.md: compiler support policy is missing");
  } else {
    const supportPolicy = readFileSync(supportPolicyPath, "utf8");
    for (const requiredText of [
      `TypeScript ${TYPESCRIPT_BASELINE}`,
      "experimentalDecorators",
      "emitDecoratorMetadata",
      "patches/tsup@8.5.1.patch",
      "Removal condition",
    ]) {
      if (!supportPolicy.includes(requiredText)) {
        diagnostics.push(
          `docs/typescript-support.md: must document ${JSON.stringify(requiredText)}`,
        );
      }
    }
  }

  return diagnostics.sort();
}

function checkValue(
  diagnostics: string[],
  label: string,
  actual: unknown,
  expected: string | boolean,
): void {
  if (actual !== expected) {
    diagnostics.push(
      `${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
    );
  }
}

function compilerOptionsFor(config: JsonRecord): JsonRecord {
  return isRecord(config.compilerOptions) ? config.compilerOptions : {};
}

function findFiles(rootDir: string, predicate: (name: string) => boolean): string[] {
  if (!existsSync(rootDir)) return [];
  const files: string[] = [];
  const ignoredDirectories = new Set([
    ".croco",
    ".git",
    ".turbo",
    "ci-reports",
    "dist",
    "node_modules",
    "tmp",
  ]);
  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;
    const entryPath = join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findFiles(entryPath, predicate));
    } else if (predicate(entry.name)) {
      files.push(entryPath);
    }
  }
  return files.sort();
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nestedString(record: JsonRecord, parent: string, child: string): string | undefined {
  const parentValue = record[parent];
  if (!isRecord(parentValue)) return undefined;
  const value = parentValue[child];
  return typeof value === "string" ? value : undefined;
}

function readJson(path: string): JsonRecord {
  return JSON.parse(readFileSync(path, "utf8")) as JsonRecord;
}

function main(): void {
  const rootDir = resolve(import.meta.dirname, "..");
  const diagnostics = collectCompilerBaselineDiagnostics(rootDir);
  if (diagnostics.length > 0) {
    console.error("compiler-baseline-check: failed");
    for (const diagnostic of diagnostics) console.error(`- ${diagnostic}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `compiler-baseline-check: TypeScript ${TYPESCRIPT_BASELINE}, legacy decorators, tsconfig migration, and generated consumers verified`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}

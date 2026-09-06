#!/usr/bin/env node

/**
 * Normalize and verify publish-facing package manifest contracts.
 *
 * Policy:
 * - Workspace manifests may keep source entrypoints for local development.
 * - publishConfig is the authoritative npm publish contract and must point at dist.
 * - Export conditions use the canonical order: types, import, require, then additional conditions.
 * - Package versions are never changed here; changesets owns versioning.
 */

import fs from "node:fs";
import { builtinModules } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { parse as parseYaml } from "yaml";
import {
  formatInternalPeerDependencyRangeException,
  INTERNAL_CROCO_PACKAGE_PREFIX,
  INTERNAL_PEER_DEPENDENCY_RANGE_EXCEPTIONS_PATH,
  readInternalPeerDependencyRangeExceptions,
  validateInternalDependencyRangePolicy,
} from "./internal-croco-compatibility-policy.mjs";
import {
  bundledRuntimeDependencyNamesFor,
  canonicalExportConditionNames,
  DIRECT_DIST_ENTRYPOINT_PACKAGES,
  ENTRYPOINT_EXEMPTIONS,
  EXPECTED_PACKAGE_LICENSE,
  exportConditionOrderDiagnostics,
  exportConditionSequenceParityDiagnostics,
  expectedFilesFor,
  FILES_EXEMPTIONS,
  fieldMatchesPath,
  findPackageJsonFiles,
  packageHasSourceEntrypoint,
  packageLicenseDiagnostics,
} from "./package-manifest-contracts.mjs";
import { isBoundedPeerDependencyRange } from "./peer-dependency-range-policy.mjs";
import { apiDocPackages } from "../packages/docs/api-docs.config.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRootDir = path.dirname(__dirname);

const DIST_INDEX_MAIN = "./dist/index.js";
const DIST_INDEX_MODULE = "./dist/index.mjs";
const DIST_INDEX_TYPES = "./dist/index.d.ts";
const SRC_INDEX = "./src/index.ts";
const REPOSITORY_URL = "git+https://github.com/croco-dev/framework.git";
const DRIZZLE_ORM_PACKAGE = "drizzle-orm";
const CREATE_CROCO_APP_PACKAGE = "create-croco-app";
const GENERATED_APP_DEPENDENCIES_FIELD = "crocoGeneratedAppDependencies";
const DRIZZLE_PACKAGE_SUFFIX = "-drizzle";
const REFLECT_METADATA_PACKAGE = "reflect-metadata";
const REFLECT_METADATA_IMPORT_RE =
  /^\s*import\s+(?:[^'"]+\s+from\s+)?["']reflect-metadata["']\s*;?/m;
const FRAMEWORK_CONTEXT_PACKAGE = "@croco/framework-context";
const COMPONENT_DECORATOR_EXPORT = "Component";
const TYPESCRIPT_SOURCE_EXTENSIONS = new Set([".cts", ".mts", ".ts", ".tsx"]);
const ROOT_SIDE_EFFECT_SOURCE_PATHS = new Map([
  ["@croco/openapi-spec", ["./src/libs/emitOpenAPI.ts"]],
]);
const ADDITIONAL_SIDE_EFFECT_PATHS = new Map([
  ["@croco/cli", ["./dist/bin/croco.js"]],
  ["create-croco-app", ["./dist/bin.js"]],
  [
    "@croco/framework-routes",
    [
      "./dist/compiler.js",
      "./dist/compiler.mjs",
      "./dist/metadata-reader.js",
      "./dist/metadata-reader.mjs",
    ],
  ],
  ["@croco/migration-runner", ["./dist/cli.js", "./dist/cli.mjs"]],
  ["@croco/openapi-spec", ["./dist/cli.js", "./dist/cli.mjs"]],
  ["@croco/rpc-codegen", ["./dist/cli.cjs", "./dist/cli.js"]],
  ["@croco/ui-astryx", ["./dist/styles.css"]],
]);
const PACKAGE_MANAGER_COMMANDS = new Set(["bun", "npm", "pnpm", "yarn"]);
const PACKAGE_MANAGER_EXEC_COMMANDS = new Set(["dlx", "exec"]);
const PACKAGE_MANAGER_RUN_COMMANDS = new Set(["run", "run-script"]);
const SHELL_COMMANDS = new Set(["ash", "bash", "dash", "ksh", "sh", "zsh"]);
const EXECUTABLE_OPTIONS_WITH_VALUES = new Set([
  "--cache",
  "--call",
  "--node-options",
  "--package",
  "--registry",
  "--shell",
  "--shell-mode",
  "--userconfig",
  "-c",
  "-p",
]);
const EXECUTABLE_SCRIPT_OPTIONS = new Set(["--call", "--shell-mode", "-c"]);
const CHANGESET_BOOLEAN_OPTIONS = new Set([
  "--empty",
  "--git-tag",
  "--gitTag",
  "--open",
  "--since-master",
  "--sinceMaster",
  "--verbose",
  "-v",
]);
const CHANGESET_STRING_OPTIONS = new Set([
  "--ignore",
  "--otp",
  "--output",
  "--since",
  "--snapshot",
  "--snapshotPrereleaseTemplate",
  "--snapshot-prerelease-template",
  "--tag",
  "-o",
]);
const DRIZZLE_ORM_DEPENDENCY_SECTIONS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];
const API_DOC_PACKAGE_NAMES = new Set(apiDocPackages.map(({ packageName }) => packageName));
const API_DOC_MODEL_SCRIPT =
  "node --experimental-strip-types ../docs/scripts/generate-package-api-model.mts";
const RUNTIME_DEPENDENCY_SECTIONS = ["dependencies", "peerDependencies", "optionalDependencies"];
const CATALOG_METADATA_PATH = path.join("docs", "package-catalog.json");
const nodeBuiltinModules = new Set([
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`),
]);

const mode = parseArgs(process.argv.slice(2));

main();

function main() {
  const rootDir = mode.rootDir;
  const packageJsonFiles = findWorkspacePackageJsonFiles(rootDir);
  const violations = [];
  let checkedCount = 0;
  let skippedCount = 0;
  let modifiedCount = 0;

  const rootPackagePath = path.join(rootDir, "package.json");
  if (fs.existsSync(rootPackagePath)) {
    const rootPackageContent = fs.readFileSync(rootPackagePath, "utf-8");
    const rootPackage = JSON.parse(rootPackageContent);
    if (mode.write && rootPackage.license !== EXPECTED_PACKAGE_LICENSE) {
      const normalizedRoot = withLicenseMetadata(rootPackage, EXPECTED_PACKAGE_LICENSE);
      fs.writeFileSync(rootPackagePath, `${JSON.stringify(normalizedRoot, null, 2)}\n`, "utf-8");
      console.log("✓ Normalized root package.json license");
      modifiedCount++;
    } else if (mode.check && rootPackage.license !== EXPECTED_PACKAGE_LICENSE) {
      violations.push(`package.json: license must be ${JSON.stringify(EXPECTED_PACKAGE_LICENSE)}`);
    }
    for (const violation of validatePackageScripts(rootPackage)) {
      violations.push(`package.json: ${violation}`);
    }
  }

  const rootLicensePath = path.join(rootDir, "LICENSE");
  let rootLicenseContent = null;
  if (!fs.existsSync(rootLicensePath)) {
    violations.push("LICENSE: repository root LICENSE file is required");
  } else {
    rootLicenseContent = fs.readFileSync(rootLicensePath, "utf-8");
  }

  const workspacePackageRecords = readWorkspacePackageRecords(packageJsonFiles, rootDir);
  const workspacePackageNames = readWorkspacePackageNames(packageJsonFiles);
  const spinePackageNames = readSpinePackageNames(rootDir, workspacePackageRecords, violations);
  const internalWorkspacePackageNames = new Set(
    Array.from(workspacePackageNames).filter((packageName) =>
      packageName.startsWith(INTERNAL_CROCO_PACKAGE_PREFIX),
    ),
  );
  const internalPeerDependencyRangeExceptions = readInternalPeerDependencyRangeExceptions(
    rootDir,
    workspacePackageNames,
    internalWorkspacePackageNames,
    violations,
  );
  const usedInternalPeerDependencyRangeExceptions = new Set();

  for (const pkgPath of packageJsonFiles) {
    const relativePath = path.relative(rootDir, pkgPath);
    const content = fs.readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(content);

    for (const violation of validateWorkspacePackagePolicy(pkg, {
      internalPeerDependencyRangeExceptions,
      internalWorkspacePackageNames,
      packageScriptsWillBeNormalized: mode.write && pkg.private !== true,
      usedInternalPeerDependencyRangeExceptions,
    })) {
      violations.push(`${relativePath}: ${violation}`);
    }

    if (pkg.private === true) {
      skippedCount++;
      continue;
    }

    checkedCount++;

    const normalized = normalizePackage(pkg, pkgPath, rootDir, {
      spinePackageNames,
    });
    const normalizedContent = `${JSON.stringify(normalized, null, 2)}\n`;
    const changed = content !== normalizedContent;

    if (mode.check && changed) {
      violations.push(
        `${relativePath}: package manifest drift detected; run pnpm package-manifests:write`,
      );
    }

    const packageToValidate = mode.write ? normalized : pkg;
    for (const violation of validatePackage(packageToValidate, pkgPath, rootDir, {
      spinePackageNames,
    })) {
      violations.push(`${relativePath}: ${violation}`);
    }

    const packageLicensePath = path.join(path.dirname(pkgPath), "LICENSE");
    if (mode.write && rootLicenseContent !== null) {
      const currentPackageLicense = fs.existsSync(packageLicensePath)
        ? fs.readFileSync(packageLicensePath, "utf-8")
        : null;
      if (currentPackageLicense !== rootLicenseContent) {
        fs.writeFileSync(packageLicensePath, rootLicenseContent, "utf-8");
        console.log(`✓ Synchronized LICENSE: ${pkg.name}`);
        modifiedCount++;
      }
    } else if (mode.check) {
      if (!fs.existsSync(packageLicensePath)) {
        violations.push(
          `${relativePath}: missing package LICENSE file; run pnpm package-manifests:write`,
        );
      } else if (
        rootLicenseContent !== null &&
        fs.readFileSync(packageLicensePath, "utf-8") !== rootLicenseContent
      ) {
        violations.push(
          `${relativePath}: package LICENSE file does not match root LICENSE; run pnpm package-manifests:write`,
        );
      }
    }

    const packageReadmePath = path.join(path.dirname(pkgPath), "README.md");
    if (fs.existsSync(packageReadmePath)) {
      const readmeContent = fs.readFileSync(packageReadmePath, "utf-8");
      const licenseHeadingMatch = readmeContent.match(/^## (License|라이선스)\s*\n+([^\n#]+)/m);
      if (licenseHeadingMatch) {
        const declared = licenseHeadingMatch[2].trim();
        if (declared !== EXPECTED_PACKAGE_LICENSE) {
          if (mode.write) {
            const updatedContent = readmeContent.replace(
              /^## (License|라이선스)\s*\n+[^\n#]+/m,
              `## $1\n\n${EXPECTED_PACKAGE_LICENSE}`,
            );
            fs.writeFileSync(packageReadmePath, updatedContent, "utf-8");
            console.log(`✓ Synchronized README license: ${pkg.name}`);
            modifiedCount++;
          } else if (mode.check) {
            violations.push(
              `${relativePath}: README.md license section declares ${JSON.stringify(declared)}, expected ${JSON.stringify(EXPECTED_PACKAGE_LICENSE)}; run pnpm package-manifests:write`,
            );
          }
        }
      }
    }

    if (mode.write && changed) {
      fs.writeFileSync(pkgPath, normalizedContent, "utf-8");
      console.log(`✓ Normalized: ${pkg.name}`);
      modifiedCount++;
    } else if (mode.write) {
      console.log(`- Already normalized: ${pkg.name}`);
    }
  }

  for (const exception of internalPeerDependencyRangeExceptions.values()) {
    if (usedInternalPeerDependencyRangeExceptions.has(exception.key)) {
      continue;
    }

    violations.push(
      `${INTERNAL_PEER_DEPENDENCY_RANGE_EXCEPTIONS_PATH}: unused internal peer dependency range exception ${formatInternalPeerDependencyRangeException(exception)}`,
    );
  }

  console.log("");
  console.log("=== Package manifest summary ===");
  console.log(`Checked: ${checkedCount}`);
  console.log(`Skipped private: ${skippedCount}`);
  console.log(`Modified: ${modifiedCount}`);

  if (violations.length > 0) {
    console.log("");
    console.log("Package manifest contract violations:");
    for (const violation of violations) {
      console.log(`- ${violation}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("");
  console.log("✓ Package manifest contracts are normalized.");
}

function findWorkspacePackageJsonFiles(rootDir) {
  const workspacePackageDirs = [path.join(rootDir, "packages"), path.join(rootDir, "examples")];
  return Array.from(
    new Set(
      workspacePackageDirs.flatMap((workspacePackageDir) =>
        findPackageJsonFiles(workspacePackageDir),
      ),
    ),
  ).sort();
}

function parseArgs(args) {
  let check = false;
  let write = false;
  let rootDir = defaultRootDir;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];

    if (arg === "--check") {
      check = true;
      continue;
    }

    if (arg === "--write") {
      write = true;
      continue;
    }

    if (arg === "--root") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--root requires a path");
      }
      rootDir = path.resolve(value);
      index++;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  if (check && write) {
    throw new Error("Use either --check or --write, not both");
  }

  return {
    check,
    rootDir,
    write: write || !check,
  };
}

function normalizePackage(pkg, pkgPath, rootDir, options = {}) {
  let normalized = withRepositoryMetadata(
    structuredClone(pkg),
    expectedRepositoryFor(pkgPath, rootDir),
  );
  normalized = withLicenseMetadata(normalized, EXPECTED_PACKAGE_LICENSE);
  const hasSourceEntrypoint = packageHasSourceEntrypoint(pkgPath);
  const directDistRoot = DIRECT_DIST_ENTRYPOINT_PACKAGES.has(normalized.name);
  const spineSourceRoot =
    options.spinePackageNames?.has(normalized.name) === true && !directDistRoot;

  normalized.publishConfig = normalizeObject(normalized.publishConfig);
  normalized.publishConfig.access = "public";
  delete normalized.publishConfig.files;
  delete normalized.publishConfig.sideEffects;

  if (!FILES_EXEMPTIONS.has(normalized.name)) {
    normalized.files = expectedFilesFor(normalized.name);
  }

  normalizeTypesFields(normalized);

  if (!ENTRYPOINT_EXEMPTIONS.has(normalized.name) && hasSourceEntrypoint) {
    normalizeEntrypointFields(normalized, {
      directDistRoot,
      spineSourceRoot,
    });
  }

  const sideEffects = expectedSideEffectsFor(normalized, path.dirname(pkgPath));
  normalized = withSideEffects(normalized, sideEffects);

  normalizePackageScripts(normalized);
  normalizeGeneratedAppDependencyMetadata(normalized, rootDir);

  return normalized;
}

function normalizeGeneratedAppDependencyMetadata(pkg, rootDir) {
  if (pkg.name !== CREATE_CROCO_APP_PACKAGE) {
    return;
  }

  pkg[GENERATED_APP_DEPENDENCIES_FIELD] = {
    [DRIZZLE_ORM_PACKAGE]: readWorkspaceCatalogRange(rootDir, DRIZZLE_ORM_PACKAGE),
  };
}

function readWorkspaceCatalogRange(rootDir, packageName) {
  const workspacePath = path.join(rootDir, "pnpm-workspace.yaml");
  const workspace = parseYaml(fs.readFileSync(workspacePath, "utf-8"));
  const range = workspace?.catalog?.[packageName];

  if (typeof range !== "string" || range.length === 0) {
    throw new Error(`${workspacePath}: catalog.${packageName} must be a nonempty dependency range`);
  }

  return range;
}

function normalizePackageScripts(pkg) {
  if (!pkg.scripts || typeof pkg.scripts !== "object" || Array.isArray(pkg.scripts)) {
    return;
  }

  if (API_DOC_PACKAGE_NAMES.has(pkg.name)) {
    pkg.scripts["docs:api:model"] = API_DOC_MODEL_SCRIPT;
  }

  for (const [scriptName, command] of Object.entries(pkg.scripts)) {
    if (isDirectPublishCommand(command)) {
      if (mode.write) {
        console.log(`- Removed direct publish script ${pkg.name}: scripts.${scriptName}`);
      }
      delete pkg.scripts[scriptName];
    }
  }

  if (Object.keys(pkg.scripts).length === 0) {
    delete pkg.scripts;
  }
}

function withRepositoryMetadata(pkg, repository) {
  const withoutRepository = { ...pkg };
  delete withoutRepository.repository;
  const normalized = {};
  const insertAfterKey = Object.hasOwn(withoutRepository, "description")
    ? "description"
    : "version";
  let inserted = false;

  for (const [key, value] of Object.entries(withoutRepository)) {
    normalized[key] = value;

    if (key === insertAfterKey) {
      normalized.repository = repository;
      inserted = true;
    }
  }

  if (!inserted) {
    normalized.repository = repository;
  }

  return normalized;
}

function withLicenseMetadata(pkg, license) {
  const withoutLicense = { ...pkg };
  delete withoutLicense.license;
  const normalized = {};
  const insertAfterKey = Object.hasOwn(withoutLicense, "description")
    ? "description"
    : Object.hasOwn(withoutLicense, "version")
      ? "version"
      : Object.hasOwn(withoutLicense, "private")
        ? "private"
        : "name";
  let inserted = false;

  for (const [key, value] of Object.entries(withoutLicense)) {
    normalized[key] = value;

    if (key === insertAfterKey) {
      normalized.license = license;
      inserted = true;
    }
  }

  if (!inserted) {
    normalized.license = license;
  }

  return normalized;
}

function withSideEffects(pkg, sideEffects) {
  const withoutSideEffects = { ...pkg };
  delete withoutSideEffects.sideEffects;
  const normalized = {};
  const insertAfterKey = Object.hasOwn(withoutSideEffects, "type") ? "type" : "files";
  let inserted = false;

  for (const [key, value] of Object.entries(withoutSideEffects)) {
    normalized[key] = value;

    if (key === insertAfterKey) {
      normalized.sideEffects = sideEffects;
      inserted = true;
    }
  }

  if (!inserted) {
    normalized.sideEffects = sideEffects;
  }

  return normalized;
}

function expectedRepositoryFor(pkgPath, rootDir) {
  return {
    type: "git",
    url: REPOSITORY_URL,
    directory: toPosixPath(path.relative(rootDir, path.dirname(pkgPath))),
  };
}

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

function normalizeObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value;
}

function normalizeTypesFields(pkg) {
  if (Array.isArray(pkg.types)) {
    pkg.types = normalizeDistSpecifier(pkg.types[0]);
  } else if (typeof pkg.types === "string") {
    pkg.types = normalizeDistSpecifier(pkg.types);
  }

  if (Array.isArray(pkg.publishConfig?.types)) {
    pkg.publishConfig.types = normalizeDistSpecifier(pkg.publishConfig.types[0]);
  } else if (typeof pkg.publishConfig?.types === "string") {
    pkg.publishConfig.types = normalizeDistSpecifier(pkg.publishConfig.types);
  }

  normalizeExportTypes(pkg.exports);
  normalizeExportTypes(pkg.publishConfig?.exports);
  normalizeExportConditionOrder(pkg.exports);
  normalizeExportConditionOrder(pkg.publishConfig?.exports);
}

function normalizeExportConditionOrder(exportsValue) {
  if (!exportsValue || typeof exportsValue !== "object" || Array.isArray(exportsValue)) {
    return;
  }

  for (const [exportPath, exportValue] of Object.entries(exportsValue)) {
    if (!exportValue || typeof exportValue !== "object" || Array.isArray(exportValue)) {
      continue;
    }

    exportsValue[exportPath] = normalizeExportConditionMap(exportValue);
  }
}

function normalizeExportConditionMap(exportValue) {
  return Object.fromEntries(
    canonicalExportConditionNames(exportValue).map((conditionName) => {
      const target = exportValue[conditionName];
      return [
        conditionName,
        target && typeof target === "object" && !Array.isArray(target)
          ? normalizeExportConditionMap(target)
          : target,
      ];
    }),
  );
}

function normalizeExportTypes(exportsValue) {
  if (!exportsValue || typeof exportsValue !== "object") {
    return;
  }

  for (const value of Object.values(exportsValue)) {
    if (!value || typeof value !== "object") {
      continue;
    }

    if (Array.isArray(value.types)) {
      value.types = normalizeDistSpecifier(value.types[0]);
    } else if (typeof value.types === "string") {
      value.types = normalizeDistSpecifier(value.types);
    }
  }
}

function readWorkspacePackageNames(packageJsonFiles) {
  const workspacePackageNames = new Set();

  for (const pkgPath of packageJsonFiles) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    if (typeof pkg.name === "string" && pkg.name.length > 0) {
      workspacePackageNames.add(pkg.name);
    }
  }

  return workspacePackageNames;
}

function readWorkspacePackageRecords(packageJsonFiles, rootDir) {
  const records = [];

  for (const pkgPath of packageJsonFiles) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    if (typeof pkg.name !== "string" || pkg.name.length === 0) {
      continue;
    }

    records.push({
      directoryName: path.basename(path.dirname(pkgPath)),
      name: pkg.name,
      packagePath: pkgPath,
      relativePath: toPosixPath(path.relative(rootDir, pkgPath)),
    });
  }

  return records;
}

function readSpinePackageNames(rootDir, workspacePackageRecords, violations) {
  const catalogPath = path.join(rootDir, CATALOG_METADATA_PATH);
  if (!fs.existsSync(catalogPath)) {
    violations.push(
      `${CATALOG_METADATA_PATH}: package catalog is required for spine entrypoint policy`,
    );
    return new Set();
  }

  let catalog;
  try {
    catalog = JSON.parse(fs.readFileSync(catalogPath, "utf-8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    violations.push(`${CATALOG_METADATA_PATH}: must contain valid JSON: ${message}`);
    return new Set();
  }

  const spine = catalog.spine;
  if (!spine || typeof spine !== "object" || Array.isArray(spine)) {
    violations.push(`${CATALOG_METADATA_PATH}: spine must be an object`);
    return new Set();
  }

  if (!Array.isArray(spine.packages)) {
    violations.push(`${CATALOG_METADATA_PATH}: spine.packages must be a string array`);
    return new Set();
  }

  const packageNames = new Set();
  const seenEntries = new Set();

  for (const [index, entry] of spine.packages.entries()) {
    if (typeof entry !== "string" || entry.length === 0) {
      violations.push(
        `${CATALOG_METADATA_PATH}: spine.packages[${index}] must be a nonempty string`,
      );
      continue;
    }

    if (seenEntries.has(entry)) {
      violations.push(`${CATALOG_METADATA_PATH}: spine.packages contains duplicate ${entry}`);
      continue;
    }
    seenEntries.add(entry);

    const matches = workspacePackageRecords.filter((record) =>
      spineCatalogEntryMatchesPackage(entry, record),
    );

    if (matches.length === 0) {
      violations.push(
        `${CATALOG_METADATA_PATH}: spine.packages references missing package ${entry}`,
      );
      continue;
    }

    if (matches.length > 1) {
      violations.push(
        `${CATALOG_METADATA_PATH}: spine.packages entry ${entry} is ambiguous across ${matches.map((record) => record.relativePath).join(", ")}`,
      );
      continue;
    }

    const [record] = matches;
    if (entry !== record.directoryName) {
      violations.push(
        `${CATALOG_METADATA_PATH}: spine.packages entry ${entry} must use package directory name ${record.directoryName}`,
      );
      continue;
    }

    packageNames.add(record.name);
  }

  return packageNames;
}

function spineCatalogEntryMatchesPackage(entry, record) {
  return (
    entry === record.directoryName ||
    entry === record.name ||
    `${INTERNAL_CROCO_PACKAGE_PREFIX}${entry}` === record.name
  );
}

function normalizeDistSpecifier(value) {
  if (typeof value === "string" && value.startsWith("dist/")) {
    return `./${value}`;
  }

  return value;
}

function normalizeEntrypointFields(pkg, options = {}) {
  if (!pkg.type) {
    pkg.type = "commonjs";
  }

  if (options.spineSourceRoot) {
    pkg.main = SRC_INDEX;
    pkg.types = SRC_INDEX;
    delete pkg.module;
    delete pkg.exports;
  } else {
    if (!pkg.main) {
      pkg.main = SRC_INDEX;
    }

    if (!pkg.types) {
      pkg.types = SRC_INDEX;
    }
  }

  if (!isDistPath(pkg.publishConfig.main)) {
    pkg.publishConfig.main = DIST_INDEX_MAIN;
  }

  if (!isDistPath(pkg.publishConfig.types)) {
    pkg.publishConfig.types = DIST_INDEX_TYPES;
  }

  if (options.directDistRoot) {
    const publishedSubpaths = Object.fromEntries(
      Object.entries(normalizeObject(pkg.publishConfig.exports)).filter(
        ([subpath]) => subpath !== ".",
      ),
    );
    pkg.publishConfig.exports = {
      ".": directDistPublishedRootExportFor(pkg),
      ...publishedSubpaths,
    };
    pkg.main = pkg.publishConfig.main;
    pkg.types = pkg.publishConfig.types;
    pkg.exports = structuredClone(pkg.publishConfig.exports);

    const moduleTarget = rootImportTargetFor(pkg.exports);
    if (typeof moduleTarget === "string" && moduleTarget.endsWith(".mjs")) {
      pkg.module = moduleTarget;
    } else {
      delete pkg.module;
    }
  } else {
    if (!pkg.publishConfig.exports) {
      pkg.publishConfig.exports = {};
    }

    if (!pkg.publishConfig.exports["."]) {
      pkg.publishConfig.exports["."] = publishedRootExportFor(pkg);
    }
  }
}

function directDistPublishedRootExportFor(pkg) {
  const rootExport = pkg.publishConfig.exports?.["."];

  if (typeof rootExport === "string") {
    return isDistPath(rootExport) ? rootExport : publishedRootExportFor(pkg);
  }

  if (!rootExport || typeof rootExport !== "object" || Array.isArray(rootExport)) {
    return publishedRootExportFor(pkg);
  }

  const normalizedRootExport = {};
  for (const [conditionName, target] of Object.entries(rootExport)) {
    if (isDistPath(target)) {
      normalizedRootExport[conditionName] = target;
    }
  }

  for (const [conditionName, target] of Object.entries(publishedRootExportFor(pkg))) {
    if (!Object.hasOwn(normalizedRootExport, conditionName)) {
      normalizedRootExport[conditionName] = target;
    }
  }

  return withTypesFirstExportCondition(normalizedRootExport);
}

function publishedRootExportFor(pkg) {
  if (pkg.type === "module") {
    return {
      types: DIST_INDEX_TYPES,
      import: DIST_INDEX_MAIN,
    };
  }

  return {
    types: DIST_INDEX_TYPES,
    import: DIST_INDEX_MODULE,
    require: DIST_INDEX_MAIN,
  };
}

function withTypesFirstExportCondition(rootExport) {
  if (!Object.hasOwn(rootExport, "types")) {
    return rootExport;
  }

  const orderedRootExport = {
    types: rootExport.types,
  };

  for (const [conditionName, target] of Object.entries(rootExport)) {
    if (conditionName !== "types") {
      orderedRootExport[conditionName] = target;
    }
  }

  return orderedRootExport;
}

function rootImportTargetFor(exportsValue) {
  const rootExport = exportsValue?.["."];
  if (typeof rootExport === "string") {
    return rootExport;
  }

  if (!rootExport || typeof rootExport !== "object" || Array.isArray(rootExport)) {
    return undefined;
  }

  return rootExport.import;
}

function validateWorkspacePackagePolicy(pkg, policyContext) {
  const violations = [];
  validateInternalDependencyRangePolicy(pkg, policyContext, violations);
  validateBoundedPublishedPeerDependencies(pkg, violations);
  if (!policyContext.packageScriptsWillBeNormalized) {
    violations.push(...validatePackageScripts(pkg));
  }
  return violations;
}

function validateBoundedPublishedPeerDependencies(pkg, violations) {
  if (pkg.private === true || !pkg.peerDependencies || typeof pkg.peerDependencies !== "object") {
    return;
  }

  for (const [dependencyName, range] of Object.entries(pkg.peerDependencies)) {
    if (range === "workspace:*" || range === "catalog:") {
      continue;
    }

    if (!isBoundedPeerDependencyRange(range)) {
      violations.push(
        `peerDependencies.${dependencyName} must use a bounded semver range, not ${JSON.stringify(range)}`,
      );
    }
  }
}

function validatePackage(pkg, pkgPath, rootDir, context = {}) {
  const hasSourceEntrypoint = packageHasSourceEntrypoint(pkgPath);
  const violations = [];
  const expectedRepository = expectedRepositoryFor(pkgPath, rootDir);

  if (JSON.stringify(pkg.repository) !== JSON.stringify(expectedRepository)) {
    violations.push(`repository must be ${JSON.stringify(expectedRepository)}`);
  }

  for (const violation of packageLicenseDiagnostics(pkg)) {
    violations.push(violation);
  }

  if (pkg.publishConfig?.access !== "public") {
    violations.push("publishConfig.access must be public");
  }

  if (pkg.publishConfig?.files) {
    violations.push("publishConfig.files is not allowed; use root files instead");
  }

  if (!FILES_EXEMPTIONS.has(pkg.name)) {
    const expectedFiles = expectedFilesFor(pkg.name);
    if (JSON.stringify(pkg.files) !== JSON.stringify(expectedFiles)) {
      violations.push(`files must be ${JSON.stringify(expectedFiles)}`);
    }
  }

  validateSideEffects(pkg, path.dirname(pkgPath), violations);

  if (ENTRYPOINT_EXEMPTIONS.has(pkg.name)) {
    return violations;
  }

  if (!hasSourceEntrypoint) {
    violations.push("public packages without src/index.ts need an explicit entrypoint exemption");
    return violations;
  }

  if (!pkg.type) {
    violations.push("type must be declared");
  }

  validateDistPath(pkg.publishConfig?.main, "publishConfig.main", violations);
  validateDistPath(pkg.publishConfig?.types, "publishConfig.types", violations, {
    mustEndWith: ".d.ts",
  });

  if (!pkg.publishConfig?.exports?.["."]) {
    violations.push('publishConfig.exports["."] is required');
  }

  validateNoSrcReferences(pkg.publishConfig, "publishConfig", violations);
  validateNoArrayTypes(pkg, "root", violations);
  validateNoArrayTypes(pkg.publishConfig, "publishConfig", violations);
  validateExportMap(pkg.publishConfig?.exports, "publishConfig.exports", violations);
  violations.push(
    ...exportConditionSequenceParityDiagnostics(pkg.exports, pkg.publishConfig?.exports),
  );
  validateSpineEntrypointPolicy(pkg, context, violations);
  validateDrizzleOrmCatalogPolicy(pkg, pkgPath, violations);
  validateDirectDistEntrypoints(pkg, violations);
  validateReflectMetadataDependency(pkg, path.dirname(pkgPath), violations);
  validateSourceRuntimeDependencies(pkg, path.dirname(pkgPath), violations);

  if (pkg.name === "@croco/impersonation-core") {
    validateDistPath(pkg.types, "types", violations, { mustEndWith: ".d.ts" });
  }

  return violations;
}

function validatePackageScripts(pkg) {
  const violations = [];
  if (!pkg.scripts || typeof pkg.scripts !== "object" || Array.isArray(pkg.scripts)) {
    return violations;
  }

  for (const [scriptName, command] of Object.entries(pkg.scripts)) {
    if (isDirectPublishCommand(command)) {
      violations.push(
        `scripts.${scriptName} must not publish outside the protected Changesets workflow`,
      );
    }
  }

  return violations;
}

function isDirectPublishCommand(command) {
  return (
    typeof command === "string" &&
    (extractCommandSubstitutions(command).some(isDirectPublishCommand) ||
      tokenizeShellCommands(command).some(isDirectPublishInvocation))
  );
}

function extractCommandSubstitutions(script) {
  const substitutions = [];
  let quote = null;
  let escaped = false;

  for (let index = 0; index < script.length; index++) {
    const character = script[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }
    if (character === "'" && quote !== '"') {
      quote = quote === "'" ? null : "'";
      continue;
    }
    if (character === '"' && quote !== "'") {
      quote = quote === '"' ? null : '"';
      continue;
    }
    if (quote === "'") {
      continue;
    }
    if (character === "`") {
      const closingIndex = findClosingBacktick(script, index + 1);
      if (closingIndex >= 0) {
        substitutions.push(script.slice(index + 1, closingIndex));
        index = closingIndex;
      }
      continue;
    }
    if (character === "$" && script[index + 1] === "(") {
      const substitution = readParenthesizedCommand(script, index + 2);
      if (substitution) {
        substitutions.push(substitution.command);
        index = substitution.closingIndex;
      }
    }
  }

  return substitutions;
}

function findClosingBacktick(script, startIndex) {
  let escaped = false;
  for (let index = startIndex; index < script.length; index++) {
    const character = script[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (character === "`") {
      return index;
    }
  }

  return -1;
}

function readParenthesizedCommand(script, startIndex) {
  let depth = 1;
  let quote = null;
  let escaped = false;
  for (let index = startIndex; index < script.length; index++) {
    const character = script[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }
    if ((character === "'" || character === '"') && (!quote || quote === character)) {
      quote = quote ? null : character;
      continue;
    }
    if (quote) {
      continue;
    }
    if (character === "(") {
      depth++;
      continue;
    }
    if (character === ")") {
      depth--;
      if (depth === 0) {
        return {
          closingIndex: index,
          command: script.slice(startIndex, index),
        };
      }
    }
  }

  return null;
}

function tokenizeShellCommands(script) {
  const commands = [];
  let tokens = [];
  let token = "";
  let quote = null;
  let escaped = false;

  const pushToken = () => {
    if (token.length > 0) {
      tokens.push(token);
      token = "";
    }
  };
  const pushCommand = () => {
    pushToken();
    if (tokens.length > 0) {
      commands.push(tokens);
      tokens = [];
    }
  };

  for (let index = 0; index < script.length; index++) {
    const character = script[index];
    if (escaped) {
      if (character === "\r" && script[index + 1] === "\n") {
        index++;
      } else if (character !== "\n" && character !== "\r") {
        token += character;
      }
      escaped = false;
      continue;
    }
    if (quote !== "'" && character === "`") {
      const closingIndex = findClosingBacktick(script, index + 1);
      if (closingIndex >= 0) {
        token += "__command_substitution__";
        index = closingIndex;
        continue;
      }
    }
    if (quote !== "'" && character === "$" && script[index + 1] === "(") {
      const substitution = readParenthesizedCommand(script, index + 2);
      if (substitution) {
        token += "__command_substitution__";
        index = substitution.closingIndex;
        continue;
      }
    }
    if (character === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) {
        quote = null;
      } else {
        token += character;
      }
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (/\s/.test(character)) {
      pushToken();
      if (character === "\n" || character === "\r") {
        pushCommand();
      }
      continue;
    }
    if (
      (character === "{" || character === "}") &&
      (token.length > 0 || !isStandaloneShellBrace(script, index))
    ) {
      token += character;
      continue;
    }
    if (";&|(){}".includes(character)) {
      pushCommand();
      if ((character === "&" || character === "|") && script[index + 1] === character) {
        index++;
      }
      continue;
    }
    token += character;
  }
  pushCommand();

  return commands;
}

function isStandaloneShellBrace(script, index) {
  const isBoundary = (character) =>
    character === undefined || /\s/.test(character) || "`;&|()".includes(character);
  return isBoundary(script[index - 1]) && isBoundary(script[index + 1]);
}

function isDirectPublishInvocation(tokens) {
  let index = 0;
  while (isEnvironmentAssignment(tokens[index])) {
    index++;
  }

  while (index < tokens.length) {
    const name = executableName(tokens[index]);
    if (name === "command") {
      index++;
      while (tokens[index]?.startsWith("-")) index++;
      continue;
    }
    if (name === "env") {
      index++;
      while (tokens[index]?.startsWith("-") || isEnvironmentAssignment(tokens[index])) index++;
      continue;
    }
    break;
  }

  let executable = executableName(tokens[index]);
  if (executable === "corepack") {
    index++;
    executable = executableName(tokens[index]);
  }

  if (SHELL_COMMANDS.has(executable)) {
    const shellCommandIndex = tokens.findIndex(
      (value, tokenIndex) => tokenIndex > index && /^-[^-]*c/.test(value),
    );
    const shellCommand = tokens[shellCommandIndex + 1];
    return shellCommandIndex >= 0 && typeof shellCommand === "string"
      ? isDirectPublishCommand(shellCommand)
      : false;
  }

  if (executable === "eval") {
    return isDirectPublishCommand(tokens.slice(index + 1).join(" "));
  }

  if (isChangesetExecutable(tokens[index])) {
    return firstChangesetPositionalArgument(tokens.slice(index + 1)) === "publish";
  }

  if (executable === "node" && isChangesetNodeEntrypoint(tokens[index + 1])) {
    return firstChangesetPositionalArgument(tokens.slice(index + 2)) === "publish";
  }

  if (executable === "npx") {
    const invocation = tokens.slice(index + 1);
    if (hasDirectPublishScriptOption(invocation)) {
      return true;
    }
    const executableIndex = firstExecutableArgumentIndex(invocation);
    return executableIndex >= 0 && isDirectPublishInvocation(invocation.slice(executableIndex));
  }

  if (!PACKAGE_MANAGER_COMMANDS.has(executable)) {
    return false;
  }

  const argumentsAfterExecutable = tokens.slice(index + 1);
  const commandIndex = argumentsAfterExecutable.findIndex(
    (value) =>
      value === "publish" ||
      PACKAGE_MANAGER_EXEC_COMMANDS.has(value) ||
      PACKAGE_MANAGER_RUN_COMMANDS.has(value),
  );
  const packageManagerCommand = argumentsAfterExecutable[commandIndex];
  if (packageManagerCommand === "publish") {
    return true;
  }
  if (PACKAGE_MANAGER_RUN_COMMANDS.has(packageManagerCommand)) {
    return false;
  }
  if (!PACKAGE_MANAGER_EXEC_COMMANDS.has(packageManagerCommand)) {
    return false;
  }

  const executedArguments = argumentsAfterExecutable.slice(commandIndex + 1);
  if (hasDirectPublishScriptOption(executedArguments)) {
    return true;
  }
  const executableIndex = firstExecutableArgumentIndex(executedArguments);
  return (
    executableIndex >= 0 && isDirectPublishInvocation(executedArguments.slice(executableIndex))
  );
}

function executableName(value) {
  return typeof value === "string" ? (value.split("/").at(-1) ?? "") : "";
}

function isChangesetExecutable(value) {
  return (
    (typeof value === "string" && /^@changesets\/cli(?:@[^/]+)?$/.test(value)) ||
    executableName(value) === "changeset"
  );
}

function isChangesetNodeEntrypoint(value) {
  return (
    typeof value === "string" &&
    value.includes("/@changesets/cli/") &&
    /^(?:bin|cli)(?:\.[cm]?js)?$/.test(executableName(value))
  );
}

function firstChangesetPositionalArgument(values) {
  for (let index = 0; index < values.length; index++) {
    const value = values[index];
    if (typeof value !== "string") {
      continue;
    }
    if (value === "--") {
      return values[index + 1];
    }

    const separatorIndex = value.indexOf("=");
    const option = separatorIndex >= 0 ? value.slice(0, separatorIndex) : value;
    if (/^-[^-].+/.test(option)) {
      const finalOption = `-${option.at(-1)}`;
      if (
        separatorIndex < 0 &&
        !CHANGESET_BOOLEAN_OPTIONS.has(finalOption) &&
        typeof values[index + 1] === "string" &&
        !values[index + 1].startsWith("-")
      ) {
        index++;
      } else if (
        separatorIndex < 0 &&
        CHANGESET_BOOLEAN_OPTIONS.has(finalOption) &&
        (values[index + 1] === "true" || values[index + 1] === "false")
      ) {
        index++;
      }
      continue;
    }
    const booleanOption = option.startsWith("--no-") ? `--${option.slice(5)}` : option;
    if (
      CHANGESET_BOOLEAN_OPTIONS.has(booleanOption) ||
      (option.startsWith("--no-") && booleanOption === "--snapshot")
    ) {
      if (separatorIndex < 0 && (values[index + 1] === "true" || values[index + 1] === "false")) {
        index++;
      }
      continue;
    }
    if (CHANGESET_STRING_OPTIONS.has(option)) {
      if (
        separatorIndex < 0 &&
        typeof values[index + 1] === "string" &&
        !values[index + 1].startsWith("-")
      ) {
        index++;
      }
      continue;
    }
    if (value.startsWith("-")) {
      if (
        separatorIndex < 0 &&
        typeof values[index + 1] === "string" &&
        !values[index + 1].startsWith("-")
      ) {
        index++;
      }
      continue;
    }
    return value;
  }

  return undefined;
}

function firstExecutableArgumentIndex(values) {
  for (let index = 0; index < values.length; index++) {
    const value = values[index];
    if (value === "--") {
      continue;
    }
    if (EXECUTABLE_OPTIONS_WITH_VALUES.has(value)) {
      index++;
      continue;
    }
    if (value?.startsWith("-")) {
      continue;
    }
    return index;
  }

  return -1;
}

function hasDirectPublishScriptOption(values) {
  for (let index = 0; index < values.length; index++) {
    const value = values[index];
    if (typeof value !== "string") {
      continue;
    }
    const separatorIndex = value.indexOf("=");
    const option = separatorIndex >= 0 ? value.slice(0, separatorIndex) : value;
    if (!EXECUTABLE_SCRIPT_OPTIONS.has(option)) {
      continue;
    }
    const payload = separatorIndex >= 0 ? value.slice(separatorIndex + 1) : values[index + 1];
    if (typeof payload === "string" && isDirectPublishCommand(payload)) {
      return true;
    }
  }

  return false;
}

function isEnvironmentAssignment(value) {
  return typeof value === "string" && /^[A-Za-z_][A-Za-z0-9_]*=/.test(value);
}

function validateSpineEntrypointPolicy(pkg, context, violations) {
  if (!context.spinePackageNames?.has(pkg.name)) {
    return;
  }

  if (DIRECT_DIST_ENTRYPOINT_PACKAGES.has(pkg.name)) {
    return;
  }

  if (pkg.main !== SRC_INDEX) {
    violations.push(
      `spine root main must be ${SRC_INDEX} unless the package has a direct-dist entrypoint exception`,
    );
  }

  if (pkg.types !== SRC_INDEX) {
    violations.push(
      `spine root types must be ${SRC_INDEX} unless the package has a direct-dist entrypoint exception`,
    );
  }

  if (pkg.module !== undefined) {
    violations.push("spine root module is only allowed for direct-dist entrypoint exceptions");
  }

  if (pkg.exports !== undefined) {
    violations.push("spine root exports is only allowed for direct-dist entrypoint exceptions");
  }
}

function validateDirectDistEntrypoints(pkg, violations) {
  if (!DIRECT_DIST_ENTRYPOINT_PACKAGES.has(pkg.name)) {
    return;
  }

  validateRootPublishFieldParity(pkg, "main", "publishConfig.main", violations);
  validateRootPublishFieldParity(pkg, "types", "publishConfig.types", violations);
  validateRootPublishFieldParity(pkg, "exports", "publishConfig.exports", violations);

  validateDistPath(pkg.main, "main", violations);
  validateDistPath(pkg.types, "types", violations, { mustEndWith: ".d.ts" });

  if (!pkg.exports?.["."]) {
    violations.push('exports["."] is required');
  }

  if (pkg.module !== undefined) {
    validateDistPath(pkg.module, "module", violations, { mustEndWith: ".mjs" });

    const rootImportTarget = rootImportTargetFor(pkg.exports);
    if (pkg.module !== rootImportTarget) {
      violations.push('module must match exports["."].import for direct-dist entrypoint packages');
    }
  }

  validateNoSrcReferences(
    {
      exports: pkg.exports,
      main: pkg.main,
      module: pkg.module,
      types: pkg.types,
    },
    "root publishable entrypoints",
    violations,
  );
  validateExportMap(pkg.exports, "exports", violations);
}

function validateRootPublishFieldParity(pkg, rootFieldName, publishFieldName, violations) {
  if (!fieldMatchesPath(pkg, rootFieldName, publishFieldName)) {
    violations.push(`${rootFieldName} must match ${publishFieldName}`);
  }
}

function isDistPath(value) {
  return typeof value === "string" && value.startsWith("./dist/");
}

function validateDistPath(value, fieldName, violations, options = {}) {
  if (typeof value !== "string") {
    violations.push(`${fieldName} must be a string`);
    return;
  }

  if (!value.startsWith("./dist/")) {
    violations.push(`${fieldName} must point at ./dist`);
  }

  if (options.mustEndWith && !value.endsWith(options.mustEndWith)) {
    violations.push(`${fieldName} must end with ${options.mustEndWith}`);
  }
}

function validateNoSrcReferences(value, fieldName, violations) {
  if (typeof value === "string") {
    if (value.includes("./src/")) {
      violations.push(`${fieldName} must not reference ./src in the publish contract`);
    }
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    validateNoSrcReferences(child, `${fieldName}.${key}`, violations);
  }
}

function validateNoArrayTypes(value, fieldName, violations) {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value.types)) {
    violations.push(`${fieldName}.types must be a string, not an array`);
  }

  if (!value.exports || typeof value.exports !== "object") {
    return;
  }

  for (const [exportPath, exportValue] of Object.entries(value.exports)) {
    if (exportValue && typeof exportValue === "object" && Array.isArray(exportValue.types)) {
      violations.push(`${fieldName}.exports["${exportPath}"].types must be a string, not an array`);
    }
  }
}

function validateExportMap(exportsValue, fieldName, violations) {
  if (!exportsValue || typeof exportsValue !== "object") {
    return;
  }

  violations.push(...exportConditionOrderDiagnostics(exportsValue, fieldName));

  for (const [exportPath, exportValue] of Object.entries(exportsValue)) {
    if (typeof exportValue === "string") {
      validateDistPath(exportValue, `${fieldName}["${exportPath}"]`, violations);
      continue;
    }

    if (!exportValue || typeof exportValue !== "object") {
      violations.push(`${fieldName}["${exportPath}"] must be a string or condition object`);
      continue;
    }

    for (const [condition, target] of Object.entries(exportValue)) {
      if (condition === "types" && target && typeof target === "object" && !Array.isArray(target)) {
        validateModeSpecificTypesTarget(
          target,
          `${fieldName}["${exportPath}"].${condition}`,
          violations,
        );
        continue;
      }
      validateDistPath(target, `${fieldName}["${exportPath}"].${condition}`, violations, {
        mustEndWith: condition === "types" ? ".d.ts" : undefined,
      });
    }
  }
}

function validateModeSpecificTypesTarget(target, fieldName, violations) {
  const importTarget = target.import;
  const requireTarget = target.require;

  validateDistPath(importTarget, `${fieldName}.import`, violations, { mustEndWith: ".d.mts" });
  validateDistPath(requireTarget, `${fieldName}.require`, violations, { mustEndWith: ".d.ts" });
}

function validateDrizzleOrmCatalogPolicy(pkg, pkgPath, violations) {
  const packageDirName = path.basename(path.dirname(pkgPath));
  if (!packageDirName.endsWith(DRIZZLE_PACKAGE_SUFFIX)) {
    return;
  }

  const declarations = DRIZZLE_ORM_DEPENDENCY_SECTIONS.map((sectionName) => ({
    sectionName,
    version: pkg[sectionName]?.[DRIZZLE_ORM_PACKAGE],
  })).filter(({ version }) => version !== undefined);
  const hasRuntimeDependency = pkg.dependencies?.[DRIZZLE_ORM_PACKAGE] !== undefined;
  const hasDevDependency = pkg.devDependencies?.[DRIZZLE_ORM_PACKAGE] !== undefined;
  const hasPeerDependency = pkg.peerDependencies?.[DRIZZLE_ORM_PACKAGE] !== undefined;

  if (declarations.length === 0) {
    violations.push(
      `${DRIZZLE_ORM_PACKAGE} must be declared with catalog: in Drizzle package manifests`,
    );
    return;
  }

  for (const declaration of declarations) {
    if (declaration.version !== "catalog:") {
      violations.push(
        `${declaration.sectionName}.${DRIZZLE_ORM_PACKAGE} must use catalog:, not ${JSON.stringify(declaration.version)}`,
      );
    }
  }

  if (!hasRuntimeDependency && hasDevDependency !== hasPeerDependency) {
    violations.push(
      `${DRIZZLE_ORM_PACKAGE} devDependencies and peerDependencies must be declared together when it is not a runtime dependency`,
    );
  }
}

function validateReflectMetadataDependency(pkg, packageDir, violations) {
  const sourceImports = findReflectMetadataSourceImports(path.join(packageDir, "src"));

  if (sourceImports.length === 0) {
    return;
  }

  if (pkg.dependencies?.[REFLECT_METADATA_PACKAGE]) {
    return;
  }

  const importList = sourceImports
    .map((filePath) => path.relative(packageDir, filePath))
    .join(", ");

  if (pkg.devDependencies?.[REFLECT_METADATA_PACKAGE]) {
    violations.push(
      `source imports reflect-metadata but only devDependencies.reflect-metadata is declared; move it to dependencies: ${importList}`,
    );
    return;
  }

  violations.push(
    `source imports reflect-metadata but dependencies.reflect-metadata is missing: ${importList}`,
  );
}

function validateSideEffects(pkg, packageDir, violations) {
  const expected = expectedSideEffectsFor(pkg, packageDir);
  if (JSON.stringify(pkg.sideEffects) === JSON.stringify(expected)) {
    return;
  }

  violations.push(
    `sideEffects must be ${JSON.stringify(expected)}, received ${JSON.stringify(pkg.sideEffects)}`,
  );
}

function expectedSideEffectsFor(pkg, packageDir) {
  const discoveredSourcePaths = findRuntimeSideEffectSourceFiles(path.join(packageDir, "src")).map(
    (filePath) => `./${toPosixPath(path.relative(packageDir, filePath))}`,
  );
  const declaredRootSourcePaths = (ROOT_SIDE_EFFECT_SOURCE_PATHS.get(pkg.name) ?? []).filter(
    (sourcePath) => fs.existsSync(path.join(packageDir, sourcePath.slice(2))),
  );
  const sourcePaths = Array.from(new Set([...discoveredSourcePaths, ...declaredRootSourcePaths]));
  const emittedRootPaths =
    sourcePaths.length > 0 ? publishedRootRuntimePaths(pkg.publishConfig) : [];
  const additionalPaths = applicableAdditionalSideEffectPaths(pkg, packageDir);
  const paths = Array.from(new Set([...emittedRootPaths, ...additionalPaths])).sort();

  return paths.length > 0 ? paths : false;
}

function applicableAdditionalSideEffectPaths(pkg, packageDir) {
  const candidates = ADDITIONAL_SIDE_EFFECT_PATHS.get(pkg.name) ?? [];
  const declaredTargets = new Set([
    ...objectStringValues(pkg.bin),
    ...objectStringValues(pkg.publishConfig?.bin),
  ]);

  return candidates.filter((candidate) => {
    if (declaredTargets.has(candidate)) {
      return true;
    }

    if (!candidate.startsWith("./dist/")) {
      return false;
    }

    const relativeOutputPath = candidate.slice("./dist/".length);
    const sourceRelativePath = /\.(?:cjs|js|mjs)$/.test(relativeOutputPath)
      ? relativeOutputPath.replace(/\.(?:cjs|js|mjs)$/, ".ts")
      : relativeOutputPath;
    const sourceRoot = candidate.endsWith(".css") ? packageDir : path.join(packageDir, "src");
    return fs.existsSync(path.join(sourceRoot, sourceRelativePath));
  });
}

function objectStringValues(value) {
  if (typeof value === "string") {
    return [value];
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  return Object.values(value).filter((entry) => typeof entry === "string");
}

function publishedRootRuntimePaths(publishConfig) {
  const paths = [];
  collectRuntimePaths(publishConfig?.exports?.["."], paths);
  collectRuntimePaths(publishConfig?.main, paths);
  return Array.from(new Set(paths)).sort();
}

function collectRuntimePaths(value, paths) {
  if (typeof value === "string") {
    if (value.startsWith("./dist/") && /\.(?:cjs|js|mjs)$/.test(value)) {
      paths.push(value);
    }
    return;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return;
  }

  for (const nestedValue of Object.values(value)) {
    collectRuntimePaths(nestedValue, paths);
  }
}

function findRuntimeSideEffectSourceFiles(srcDir) {
  if (!fs.existsSync(srcDir)) {
    return [];
  }

  return findSourceFiles(srcDir)
    .filter((filePath) => !isSideEffectTestSourceFile(filePath, srcDir))
    .filter((filePath) => {
      const source = fs.readFileSync(filePath, "utf-8");
      return (
        REFLECT_METADATA_IMPORT_RE.test(source) || hasGlobalRegistrationDecorator(filePath, source)
      );
    });
}

function hasGlobalRegistrationDecorator(filePath, source) {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindForSourceFile(filePath),
  );
  const namedBindings = new Set();
  const namespaceBindings = new Set();
  let found = false;

  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== FRAMEWORK_CONTEXT_PACKAGE ||
      statement.importClause?.isTypeOnly
    ) {
      continue;
    }

    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        const importedName = element.propertyName?.text ?? element.name.text;
        if (!element.isTypeOnly && importedName === COMPONENT_DECORATOR_EXPORT) {
          namedBindings.add(element.name.text);
        }
      }
    } else if (bindings && ts.isNamespaceImport(bindings)) {
      namespaceBindings.add(bindings.name.text);
    }
  }

  function visit(node) {
    if (found) {
      return;
    }

    if (ts.isDecorator(node)) {
      const expression = unwrapParentheses(
        ts.isCallExpression(node.expression) ? node.expression.expression : node.expression,
      );
      const isNamedBinding = ts.isIdentifier(expression) && namedBindings.has(expression.text);
      const isNamespaceBinding =
        ts.isPropertyAccessExpression(expression) &&
        ts.isIdentifier(expression.expression) &&
        namespaceBindings.has(expression.expression.text) &&
        expression.name.text === COMPONENT_DECORATOR_EXPORT;
      if (isNamedBinding || isNamespaceBinding) {
        found = true;
        return;
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return found;
}

function unwrapParentheses(expression) {
  let current = expression;
  while (ts.isParenthesizedExpression(current)) {
    current = current.expression;
  }
  return current;
}

function scriptKindForSourceFile(filePath) {
  return path.extname(filePath) === ".tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

function isSideEffectTestSourceFile(filePath, srcDir) {
  const relativePath = path.relative(srcDir, filePath);
  const segments = relativePath.split(path.sep);
  return (
    isTestSourceFile(filePath, srcDir) ||
    segments.includes("type-tests") ||
    segments.includes("test-fixtures")
  );
}

function validateSourceRuntimeDependencies(pkg, packageDir, violations) {
  const srcDir = path.join(packageDir, "src");
  if (!fs.existsSync(srcDir)) {
    return;
  }

  const declaredDependencies = new Set([
    ...runtimeDependencyNames(pkg),
    ...bundledRuntimeDependencyNamesFor(pkg.name),
  ]);
  const importedDependencies = new Map();

  for (const filePath of findSourceFiles(srcDir).filter(
    (sourcePath) => !isTestSourceFile(sourcePath, srcDir),
  )) {
    for (const specifier of collectRuntimeImportSpecifiers(filePath)) {
      const dependencyName = packageNameFromSpecifier(specifier);
      if (
        !dependencyName ||
        dependencyName === pkg.name ||
        dependencyName === REFLECT_METADATA_PACKAGE ||
        nodeBuiltinModules.has(dependencyName) ||
        declaredDependencies.has(dependencyName)
      ) {
        continue;
      }

      const importFiles = importedDependencies.get(dependencyName) ?? new Set();
      importFiles.add(path.relative(packageDir, filePath));
      importedDependencies.set(dependencyName, importFiles);
    }
  }

  for (const [dependencyName, importFiles] of Array.from(importedDependencies.entries()).sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    violations.push(
      `source imports ${dependencyName} at runtime but dependencies/peerDependencies/optionalDependencies is missing: ${Array.from(importFiles).sort().join(", ")}`,
    );
  }
}

function runtimeDependencyNames(pkg) {
  return new Set(
    RUNTIME_DEPENDENCY_SECTIONS.flatMap((sectionName) => dependencyNames(pkg[sectionName])).sort(),
  );
}

function dependencyNames(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  return Object.keys(value).sort();
}

function collectRuntimeImportSpecifiers(filePath) {
  const sourceFile = ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, "utf-8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const specifiers = [];

  function visit(node) {
    if (ts.isImportDeclaration(node)) {
      if (isRuntimeImportDeclaration(node)) {
        pushStringSpecifier(specifiers, node.moduleSpecifier);
      }
      return;
    }

    if (ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && isRuntimeExportDeclaration(node)) {
        pushStringSpecifier(specifiers, node.moduleSpecifier);
      }
      return;
    }

    if (ts.isImportEqualsDeclaration(node)) {
      if (
        !node.isTypeOnly &&
        ts.isExternalModuleReference(node.moduleReference) &&
        node.moduleReference.expression
      ) {
        pushStringSpecifier(specifiers, node.moduleReference.expression);
      }
      return;
    }

    if (ts.isCallExpression(node)) {
      const firstArgument = node.arguments[0];
      if (
        firstArgument &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === "require"))
      ) {
        pushStringSpecifier(specifiers, firstArgument);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return specifiers;
}

function isRuntimeImportDeclaration(node) {
  const importClause = node.importClause;
  if (!importClause) {
    return true;
  }

  if (importClause.isTypeOnly) {
    return false;
  }

  if (importClause.name) {
    return true;
  }

  if (!importClause.namedBindings) {
    return false;
  }

  if (ts.isNamespaceImport(importClause.namedBindings)) {
    return true;
  }

  return importClause.namedBindings.elements.some((element) => !element.isTypeOnly);
}

function isRuntimeExportDeclaration(node) {
  if (node.isTypeOnly) {
    return false;
  }

  if (!node.exportClause) {
    return true;
  }

  if (ts.isNamedExports(node.exportClause)) {
    return node.exportClause.elements.some((element) => !element.isTypeOnly);
  }

  return true;
}

function pushStringSpecifier(specifiers, expression) {
  if (ts.isStringLiteralLike(expression)) {
    specifiers.push(expression.text);
  }
}

function packageNameFromSpecifier(specifier) {
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

function findReflectMetadataSourceImports(srcDir) {
  if (!fs.existsSync(srcDir)) {
    return [];
  }

  return findSourceFiles(srcDir)
    .filter((filePath) => !isTestSourceFile(filePath, srcDir))
    .filter((filePath) => REFLECT_METADATA_IMPORT_RE.test(fs.readFileSync(filePath, "utf-8")));
}

function findSourceFiles(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) {
        continue;
      }
      findSourceFiles(fullPath, results);
    } else if (entry.isFile() && TYPESCRIPT_SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }

  return results.sort();
}

function isTestSourceFile(filePath, srcDir) {
  const relativePath = path.relative(srcDir, filePath);
  const segments = relativePath.split(path.sep);
  const fileName = path.basename(filePath);

  return (
    segments.includes("tests") ||
    segments.includes("__tests__") ||
    /\.(?:spec|test|bench)\.(?:cts|mts|tsx?)$/.test(fileName)
  );
}

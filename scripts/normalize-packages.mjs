#!/usr/bin/env node

/**
 * Normalize and verify publish-facing package manifest contracts.
 *
 * Policy:
 * - Workspace manifests may keep source entrypoints for local development.
 * - publishConfig is the authoritative npm publish contract and must point at dist.
 * - Package versions are never changed here; changesets owns versioning.
 */

import fs from "node:fs";
import { builtinModules } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import {
  formatInternalPeerDependencyRangeException,
  INTERNAL_CROCO_PACKAGE_PREFIX,
  INTERNAL_PEER_DEPENDENCY_RANGE_EXCEPTIONS_PATH,
  readInternalPeerDependencyRangeExceptions,
  validateInternalDependencyRangePolicy,
} from "./internal-croco-compatibility-policy.mjs";
import {
  DIRECT_DIST_ENTRYPOINT_PACKAGES,
  ENTRYPOINT_EXEMPTIONS,
  expectedFilesFor,
  FILES_EXEMPTIONS,
  fieldMatchesPath,
  findPackageJsonFiles,
  packageHasSourceEntrypoint,
} from "./package-manifest-contracts.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRootDir = path.dirname(__dirname);

const DIST_INDEX_MAIN = "./dist/index.js";
const DIST_INDEX_MODULE = "./dist/index.mjs";
const DIST_INDEX_TYPES = "./dist/index.d.ts";
const SRC_INDEX = "./src/index.ts";
const REPOSITORY_URL = "git+https://github.com/croco-dev/framework.git";
const DRIZZLE_ORM_PACKAGE = "drizzle-orm";
const DRIZZLE_PACKAGE_SUFFIX = "-drizzle";
const REFLECT_METADATA_PACKAGE = "reflect-metadata";
const REFLECT_METADATA_IMPORT_RE =
  /^\s*import\s+(?:[^'"]+\s+from\s+)?["']reflect-metadata["']\s*;?/m;
const DRIZZLE_ORM_DEPENDENCY_SECTIONS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];
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
  let checkedCount = 0;
  let skippedCount = 0;
  let modifiedCount = 0;

  for (const pkgPath of packageJsonFiles) {
    const relativePath = path.relative(rootDir, pkgPath);
    const content = fs.readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(content);

    for (const violation of validateWorkspacePackagePolicy(pkg, {
      internalPeerDependencyRangeExceptions,
      internalWorkspacePackageNames,
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
  const normalized = withRepositoryMetadata(
    structuredClone(pkg),
    expectedRepositoryFor(pkgPath, rootDir),
  );
  const hasSourceEntrypoint = packageHasSourceEntrypoint(pkgPath);
  const directDistRoot = DIRECT_DIST_ENTRYPOINT_PACKAGES.has(normalized.name);
  const spineSourceRoot =
    options.spinePackageNames?.has(normalized.name) === true && !directDistRoot;

  normalized.publishConfig = normalizeObject(normalized.publishConfig);
  normalized.publishConfig.access = "public";
  delete normalized.publishConfig.files;

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

  return normalized;
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
    pkg.publishConfig.exports = {
      ".": directDistPublishedRootExportFor(pkg),
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
  return violations;
}

function validatePackage(pkg, pkgPath, rootDir, context = {}) {
  const hasSourceEntrypoint = packageHasSourceEntrypoint(pkgPath);
  const violations = [];
  const expectedRepository = expectedRepositoryFor(pkgPath, rootDir);

  if (JSON.stringify(pkg.repository) !== JSON.stringify(expectedRepository)) {
    violations.push(`repository must be ${JSON.stringify(expectedRepository)}`);
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
      validateDistPath(target, `${fieldName}["${exportPath}"].${condition}`, violations, {
        mustEndWith: condition === "types" ? ".d.ts" : undefined,
      });
    }
  }
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

function validateSourceRuntimeDependencies(pkg, packageDir, violations) {
  const srcDir = path.join(packageDir, "src");
  if (!fs.existsSync(srcDir)) {
    return;
  }

  const declaredDependencies = runtimeDependencyNames(pkg);
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
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
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
    fileName.endsWith(".spec.ts") ||
    fileName.endsWith(".test.ts") ||
    fileName.endsWith(".bench.ts")
  );
}

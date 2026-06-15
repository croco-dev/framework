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
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DIRECT_DIST_ENTRYPOINT_PACKAGES,
  ENTRYPOINT_EXEMPTIONS,
  FILES_EXEMPTIONS,
  expectedFilesFor,
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

const mode = parseArgs(process.argv.slice(2));

main();

function main() {
  const rootDir = mode.rootDir;
  const packagesDir = path.join(rootDir, "packages");
  const packageJsonFiles = findPackageJsonFiles(packagesDir);
  const violations = [];
  let checkedCount = 0;
  let skippedCount = 0;
  let modifiedCount = 0;

  for (const pkgPath of packageJsonFiles) {
    const relativePath = path.relative(rootDir, pkgPath);
    const content = fs.readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(content);

    if (pkg.private === true) {
      skippedCount++;
      continue;
    }

    checkedCount++;

    const normalized = normalizePackage(pkg, pkgPath);
    const normalizedContent = `${JSON.stringify(normalized, null, 2)}\n`;
    const changed = content !== normalizedContent;

    if (mode.check && changed) {
      violations.push(
        `${relativePath}: package manifest drift detected; run pnpm package-manifests:write`,
      );
    }

    const packageToValidate = mode.write ? normalized : pkg;
    for (const violation of validatePackage(packageToValidate, pkgPath)) {
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

function normalizePackage(pkg, pkgPath) {
  const normalized = structuredClone(pkg);
  const hasSourceEntrypoint = packageHasSourceEntrypoint(pkgPath);

  normalized.publishConfig = normalizeObject(normalized.publishConfig);
  normalized.publishConfig.access = "public";
  delete normalized.publishConfig.files;

  if (!FILES_EXEMPTIONS.has(normalized.name)) {
    normalized.files = expectedFilesFor(normalized.name);
  }

  normalizeTypesFields(normalized);

  if (!ENTRYPOINT_EXEMPTIONS.has(normalized.name) && hasSourceEntrypoint) {
    normalizeEntrypointFields(normalized, {
      directDistRoot: DIRECT_DIST_ENTRYPOINT_PACKAGES.has(normalized.name),
    });
  }

  return normalized;
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

  if (options.directDistRoot) {
    const directRootExport = directRootExportFor(pkg);
    pkg.main = DIST_INDEX_MAIN;
    pkg.module = DIST_INDEX_MODULE;
    pkg.types = DIST_INDEX_TYPES;
    pkg.exports = {
      ".": directRootExport,
    };
    pkg.publishConfig.exports = {
      ".": directRootExport,
    };
  }

  if (!pkg.main) {
    pkg.main = SRC_INDEX;
  }

  if (!pkg.types) {
    pkg.types = SRC_INDEX;
  }

  if (!isDistPath(pkg.publishConfig.main)) {
    pkg.publishConfig.main = DIST_INDEX_MAIN;
  }

  if (!isDistPath(pkg.publishConfig.types)) {
    pkg.publishConfig.types = DIST_INDEX_TYPES;
  }

  if (!pkg.publishConfig.exports) {
    pkg.publishConfig.exports = {};
  }

  if (!pkg.publishConfig.exports["."]) {
    pkg.publishConfig.exports["."] = publishedRootExportFor(pkg);
  }
}

function publishedRootExportFor(pkg) {
  if (pkg.type === "module") {
    return {
      import: DIST_INDEX_MAIN,
      types: DIST_INDEX_TYPES,
    };
  }

  return {
    import: DIST_INDEX_MODULE,
    require: DIST_INDEX_MAIN,
    types: DIST_INDEX_TYPES,
  };
}

function directRootExportFor(pkg) {
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

function validatePackage(pkg, pkgPath) {
  const hasSourceEntrypoint = packageHasSourceEntrypoint(pkgPath);
  const violations = [];

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
  validateDrizzleOrmCatalogPolicy(pkg, pkgPath, violations);
  validateDirectDistEntrypoints(pkg, violations);
  validateReflectMetadataDependency(pkg, path.dirname(pkgPath), violations);

  if (pkg.name === "@croco/impersonation-core") {
    validateDistPath(pkg.types, "types", violations, { mustEndWith: ".d.ts" });
  }

  return violations;
}

function validateDirectDistEntrypoints(pkg, violations) {
  if (!DIRECT_DIST_ENTRYPOINT_PACKAGES.has(pkg.name)) {
    return;
  }

  validateDistPath(pkg.main, "main", violations);
  validateDistPath(pkg.module, "module", violations, { mustEndWith: ".mjs" });
  validateDistPath(pkg.types, "types", violations, { mustEndWith: ".d.ts" });

  if (!pkg.exports?.["."]) {
    violations.push('exports["."] is required');
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

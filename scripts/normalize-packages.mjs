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
    normalizeEntrypointFields(normalized);
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

function normalizeEntrypointFields(pkg) {
  if (!pkg.type) {
    pkg.type = "commonjs";
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

  if (pkg.name === "@croco/impersonation-core") {
    validateDistPath(pkg.types, "types", violations, { mustEndWith: ".d.ts" });
  }

  return violations;
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

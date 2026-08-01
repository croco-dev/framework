import fs from "node:fs";
import path from "node:path";

export const ENTRYPOINT_EXEMPTIONS = new Map([
  ["create-croco-app", "Bin-only project generator; importing it would execute the CLI."],
]);

export const FILES_EXEMPTIONS = new Map();

export const DIRECT_DIST_ENTRYPOINT_EXCEPTIONS = new Map([
  [
    "@croco/problems-core",
    "Problem contracts are imported by ESM runtime policy checks while the package keeps CommonJS publish semantics.",
  ],
  ["@croco/rpc-codegen", "Codegen exposes a built CLI and dual ESM/CJS library surface from dist."],
  [
    "@croco/storage-cloudinary",
    "Storage adapters keep root entrypoints aligned with packed dist artifacts for provider smoke checks.",
  ],
  [
    "@croco/storage-core",
    "Storage packages use direct dist roots so adapter consumers resolve the same files locally and from npm.",
  ],
  [
    "@croco/storage-r2",
    "Storage adapters keep root entrypoints aligned with packed dist artifacts for provider smoke checks.",
  ],
  [
    "@croco/telemetry-api",
    "Telemetry decorators and helpers are consumed as built runtime artifacts across Node and browser smokes.",
  ],
]);

export const DIRECT_DIST_ENTRYPOINT_PACKAGES = new Set(DIRECT_DIST_ENTRYPOINT_EXCEPTIONS.keys());

export const EXPECTED_FILES_BY_PACKAGE = new Map([
  ["create-croco-app", ["dist", "templates"]],
  ["@croco/utils-next-font-pretendard", ["dist", "PretendardVariable.woff2"]],
]);

export function expectedFilesFor(packageName) {
  return EXPECTED_FILES_BY_PACKAGE.get(packageName) ?? ["dist"];
}

export function fieldMatchesPath(source, rootFieldName, publishFieldPath) {
  const rootValue = source[rootFieldName];
  const publishValue = publishFieldPath.split(".").reduce((value, propertyName) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }

    return value[propertyName];
  }, source);

  return valuesMatch(rootValue, publishValue);
}

export function effectivePublishManifest(sourceManifest) {
  const publishManifest = {
    ...sourceManifest,
    ...sourceManifest.publishConfig,
  };
  delete publishManifest.publishConfig;
  return publishManifest;
}

function valuesMatch(left, right) {
  if (Object.is(left, right)) {
    return true;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => valuesMatch(value, right[index]))
    );
  }

  if (!left || !right || typeof left !== "object" || typeof right !== "object") {
    return false;
  }

  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();

  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key, index) => key === rightKeys[index] && valuesMatch(left[key], right[key]))
  );
}

export function findPackageJsonFiles(dir, results = []) {
  if (!fs.existsSync(dir)) {
    return results;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) {
        continue;
      }
      findPackageJsonFiles(fullPath, results);
    } else if (entry.isFile() && entry.name === "package.json") {
      results.push(fullPath);
    }
  }

  return results.sort();
}

export function packageHasSourceEntrypoint(pkgPath) {
  return fs.existsSync(path.join(path.dirname(pkgPath), "src", "index.ts"));
}

import fs from "node:fs";
import path from "node:path";

export const ENTRYPOINT_EXEMPTIONS = new Map([
  ["@croco/docs", "Astro documentation site; not imported as a runtime package."],
  ["create-croco-app", "Bin-only project generator; importing it would execute the CLI."],
]);

export const FILES_EXEMPTIONS = new Map([
  [
    "@croco/docs",
    "Astro documentation site output is not part of the package entrypoint contract.",
  ],
]);

export const EXPECTED_FILES_BY_PACKAGE = new Map([
  ["create-croco-app", ["dist", "templates"]],
  ["@croco/utils-next-font-pretendard", ["dist", "PretendardVariable.woff2"]],
]);

export function expectedFilesFor(packageName) {
  return EXPECTED_FILES_BY_PACKAGE.get(packageName) ?? ["dist"];
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

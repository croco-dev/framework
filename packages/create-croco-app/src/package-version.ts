import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type PackageManifest = {
  version?: unknown;
};

export function getPackageVersion(): string {
  const manifest = JSON.parse(readFileSync(resolvePackageJsonPath(), "utf8")) as PackageManifest;

  if (typeof manifest.version !== "string" || manifest.version.length === 0) {
    throw new Error("Missing package version in package.json");
  }

  return manifest.version;
}

function resolvePackageJsonPath(): string {
  const currentDir =
    typeof __dirname === "string" ? __dirname : dirname(fileURLToPath(import.meta.url));
  return resolve(currentDir, "../package.json");
}

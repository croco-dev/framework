import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ProblemFactory } from "@croco/problems-core";

type PackageManifest = {
  version?: unknown;
  crocoGeneratedAppDependencies?: unknown;
};

export function getPackageVersion(): string {
  const manifest = readPackageManifest();

  if (typeof manifest.version !== "string" || manifest.version.length === 0) {
    throw new Error("Missing package version in package.json");
  }

  return manifest.version;
}

export function getGeneratedAppDependencyRange(packageName: string): string {
  const dependencies = readPackageManifest().crocoGeneratedAppDependencies;
  const range =
    dependencies !== null && typeof dependencies === "object"
      ? (dependencies as Record<string, unknown>)[packageName]
      : undefined;

  if (typeof range !== "string" || range.length === 0) {
    throw ProblemFactory.internalServerError(
      "create-croco-app/generated-dependency-range-missing",
      `Missing generated app dependency range for ${packageName} in package.json`,
      {
        extensions: {
          packageName,
          recovery:
            "Reinstall create-croco-app. Package maintainers must run pnpm package-manifests:write before building or publishing.",
        },
      },
    );
  }

  return range;
}

function readPackageManifest(): PackageManifest {
  return JSON.parse(readFileSync(resolvePackageJsonPath(), "utf8")) as PackageManifest;
}

function resolvePackageJsonPath(): string {
  const currentDir =
    typeof __dirname === "string" ? __dirname : dirname(fileURLToPath(import.meta.url));
  return resolve(currentDir, "../package.json");
}

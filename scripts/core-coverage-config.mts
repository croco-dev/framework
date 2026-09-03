import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = fileURLToPath(new URL("../", import.meta.url));

export function toCoreCoveragePackageDirectory(packageName: string): string {
  return packageName.startsWith("@croco/") ? packageName.slice("@croco/".length) : packageName;
}

export function defineCoreCoveragePackages<const Packages extends readonly string[]>(
  packageNames: Packages,
  repositoryRoot = REPOSITORY_ROOT,
): Packages {
  const seen = new Set<string>();

  for (const packageName of packageNames) {
    if (seen.has(packageName)) {
      throw new Error(`duplicate core coverage package: ${packageName}`);
    }
    seen.add(packageName);

    const manifestPath = resolve(
      repositoryRoot,
      "packages",
      toCoreCoveragePackageDirectory(packageName),
      "package.json",
    );
    if (!existsSync(manifestPath)) {
      throw new Error(
        `${packageName} does not map to an existing workspace directory: ${manifestPath}`,
      );
    }

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { readonly name?: string };
    if (manifest.name !== packageName) {
      throw new Error(
        `${packageName} maps to a workspace manifest owned by ${manifest.name ?? "an unnamed package"}`,
      );
    }
  }

  return packageNames;
}

export const CORE_COVERAGE_PACKAGES = defineCoreCoveragePackages([
  "@croco/framework-context",
  "@croco/problems-core",
  "@croco/protocols-core",
  "@croco/protocols-rest",
  "@croco/openapi-spec",
  "@croco/rpc-codegen",
  "@croco/transports-http",
  "@croco/telemetry-api",
  "@croco/telemetry-sdk-node",
  "@croco/tx-core",
  "@croco/tx-drizzle",
  "@croco/events-core",
  "@croco/events-tx",
  "@croco/retry-core",
  "@croco/idempotency-core",
  "@croco/testing",
  "create-croco-app",
  "@croco/cli",
  "@croco/auth-core",
] as const);

export const CORE_COVERAGE_PACKAGE_DIRECTORIES = CORE_COVERAGE_PACKAGES.map(
  toCoreCoveragePackageDirectory,
);

export function isCoreCoveragePackageDirectory(directory: string): boolean {
  const normalizedDirectory = directory.replaceAll("\\", "/");
  return CORE_COVERAGE_PACKAGE_DIRECTORIES.some((packageDirectory) =>
    normalizedDirectory.endsWith(`packages/${packageDirectory}`),
  );
}

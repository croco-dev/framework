import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { generatedSaasProviderProfileManifest } from "./generatedSaasProviderProfile";

type ProfileManifest = typeof generatedSaasProviderProfileManifest;

const MANIFEST_FILE = "croco-saas-profile.manifest.json";

function main(): void {
  const mode = readMode(process.argv.slice(2));
  const manifest = readManifest();

  assertManifestMatchesGeneratedSource(manifest);
  assertManifestPackagesDeclared(manifest);

  if (mode === "real-provider") {
    assertRealProviderEnv(manifest);
  }

  console.log(`SaaS provider profile ${mode} check passed for ${manifest.profile.name}`);
}

function readMode(args: readonly string[]): "manifest" | "real-provider" {
  const modeArg = args.find((arg) => arg.startsWith("--mode="));
  const mode = modeArg?.slice("--mode=".length) ?? "manifest";

  if (mode === "manifest" || mode === "real-provider") {
    return mode;
  }

  throw new Error(`CROCO_SAAS_PROFILE_CHECK_MODE_INVALID: ${mode}`);
}

function readManifest(): ProfileManifest {
  const manifestPath = findManifestPath();
  const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as unknown;

  if (!isProfileManifest(parsed)) {
    throw new Error("CROCO_SAAS_PROFILE_MANIFEST_INVALID: manifest shape does not match v1");
  }

  return parsed;
}

function findManifestPath(): string {
  const candidatePaths = [
    resolve(process.cwd(), MANIFEST_FILE),
    resolve(process.cwd(), "..", "..", MANIFEST_FILE),
  ];
  const manifestPath = candidatePaths.find((candidatePath) => existsSync(candidatePath));

  if (!manifestPath) {
    throw new Error(`CROCO_SAAS_PROFILE_MANIFEST_MISSING: ${MANIFEST_FILE}`);
  }

  return manifestPath;
}

function assertManifestMatchesGeneratedSource(manifest: ProfileManifest): void {
  if (JSON.stringify(manifest) === JSON.stringify(generatedSaasProviderProfileManifest)) {
    return;
  }

  throw new Error(
    "CROCO_SAAS_PROFILE_MANIFEST_DRIFT: croco-saas-profile.manifest.json differs from generatedSaasProviderProfile.ts",
  );
}

function assertManifestPackagesDeclared(manifest: ProfileManifest): void {
  const packageJson = readApiPackageJson();
  const declaredDependencies = new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.devDependencies ?? {}),
    ...Object.keys(packageJson.peerDependencies ?? {}),
    ...Object.keys(packageJson.optionalDependencies ?? {}),
  ]);
  const missingPackages = manifest.packages.filter(
    (packageName) => !declaredDependencies.has(packageName),
  );

  if (missingPackages.length === 0) {
    return;
  }

  throw new Error(`CROCO_SAAS_PROFILE_PACKAGE_MISSING: ${missingPackages.join(", ")}`);
}

function readApiPackageJson(): {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
} {
  const packageJsonPath = findApiPackageJsonPath();
  const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as unknown;

  if (!isPackageJson(parsed)) {
    throw new Error("CROCO_SAAS_PROFILE_PACKAGE_MANIFEST_INVALID: apps/api-server/package.json");
  }

  return parsed;
}

function findApiPackageJsonPath(): string {
  const candidatePaths = [
    resolve(process.cwd(), "apps", "api-server", "package.json"),
    resolve(process.cwd(), "package.json"),
    resolve(process.cwd(), "..", "..", "apps", "api-server", "package.json"),
  ];
  const packageJsonPath = candidatePaths.find((candidatePath) => existsSync(candidatePath));

  if (!packageJsonPath) {
    throw new Error("CROCO_SAAS_PROFILE_PACKAGE_MANIFEST_MISSING: apps/api-server/package.json");
  }

  return packageJsonPath;
}

function assertRealProviderEnv(manifest: ProfileManifest): void {
  const configuredProfile = process.env.SAAS_PROVIDER_PROFILE;

  if (configuredProfile !== manifest.profile.name) {
    throw new Error(
      `CROCO_SAAS_PROFILE_MISMATCH: expected SAAS_PROVIDER_PROFILE=${manifest.profile.name}`,
    );
  }

  const missingEnv = manifest.env.required
    .map((entry) => entry.name)
    .filter((name) => !isEnvConfigured(process.env[name]));

  if (missingEnv.length > 0) {
    throw new Error(`CROCO_SAAS_PROFILE_ENV_MISSING: ${missingEnv.join(", ")}`);
  }
}

function isEnvConfigured(value: string | undefined): boolean {
  return value !== undefined && value !== "" && !value.startsWith("<");
}

function isProfileManifest(value: unknown): value is ProfileManifest {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== "croco.saas-provider-profile/v1") return false;
  if (!isRecord(value.profile)) return false;
  if (typeof value.profile.name !== "string") return false;
  if (!isRecord(value.env)) return false;
  if (!Array.isArray(value.packages)) return false;
  if (!Array.isArray(value.env.required)) return false;
  if (!Array.isArray(value.env.optional)) return false;
  if (!Array.isArray(value.capabilities)) return false;
  if (!isRecord(value.smoke)) return false;
  if (!isRecord(value.compatibility)) return false;
  if (!Array.isArray(value.deployNotes)) return false;

  return (
    value.packages.every((packageName) => typeof packageName === "string") &&
    value.env.required.every(isEnvVar)
  );
}

function isEnvVar(value: unknown): value is ProfileManifest["env"]["required"][number] {
  return isRecord(value) && typeof value.name === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPackageJson(value: unknown): value is {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
} {
  if (!isRecord(value)) return false;

  return (
    isOptionalDependencyMap(value.dependencies) &&
    isOptionalDependencyMap(value.devDependencies) &&
    isOptionalDependencyMap(value.peerDependencies) &&
    isOptionalDependencyMap(value.optionalDependencies)
  );
}

function isOptionalDependencyMap(value: unknown): value is Record<string, string> | undefined {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;

  return Object.values(value).every((range) => typeof range === "string");
}

main();

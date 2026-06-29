import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateTenantModelCompatibility } from "@croco/tenant-core/tenant-model";
import { generatedSaasProviderProfileManifest } from "./generatedSaasProviderProfile";
import {
  generatedTenantModelManifest,
  generatedTenantModelManifestSchema,
  generatedTenantModelPlaybook,
} from "./generatedTenantModel";

type ProfileManifest = typeof generatedSaasProviderProfileManifest;
type TenantModelManifest = typeof generatedTenantModelManifest;
type TenantModelManifestSchema = typeof generatedTenantModelManifestSchema;

const PROFILE_MANIFEST_FILE = "croco-saas-profile.manifest.json";
const TENANT_MODEL_MANIFEST_FILE = "croco-tenant-model.manifest.json";
const TENANT_MODEL_SCHEMA_FILE = "croco-tenant-model.schema.json";
const TENANT_MODEL_PLAYBOOK_FILE = "docs/tenant-model-playbook.md";

function main(): void {
  const mode = readMode(process.argv.slice(2));
  const manifest = readProfileManifest();
  const tenantModelManifest = readTenantModelManifest();
  const tenantModelSchema = readTenantModelSchema();
  const tenantModelPlaybook = readTenantModelPlaybook();

  assertManifestMatchesGeneratedSource(manifest);
  assertTenantModelArtifactsMatchGeneratedSource(
    tenantModelManifest,
    tenantModelSchema,
    tenantModelPlaybook,
  );
  assertTenantModelManifestLinked(manifest, tenantModelManifest);
  assertTenantModelCompatibility(manifest, tenantModelManifest);
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

function readProfileManifest(): ProfileManifest {
  const manifestPath = findRootArtifactPath(
    PROFILE_MANIFEST_FILE,
    "CROCO_SAAS_PROFILE_MANIFEST_MISSING",
  );
  const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as unknown;

  if (!isProfileManifest(parsed)) {
    throw new Error("CROCO_SAAS_PROFILE_MANIFEST_INVALID: manifest shape does not match v1");
  }

  return parsed;
}

function readTenantModelManifest(): TenantModelManifest {
  const manifestPath = findRootArtifactPath(
    TENANT_MODEL_MANIFEST_FILE,
    "CROCO_TENANT_MODEL_MANIFEST_MISSING",
  );
  const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as unknown;

  if (!isTenantModelManifest(parsed)) {
    throw new Error("CROCO_TENANT_MODEL_MANIFEST_INVALID: manifest shape does not match v1");
  }

  return parsed;
}

function readTenantModelSchema(): TenantModelManifestSchema {
  const schemaPath = findRootArtifactPath(
    TENANT_MODEL_SCHEMA_FILE,
    "CROCO_TENANT_MODEL_SCHEMA_MISSING",
  );
  const parsed = JSON.parse(readFileSync(schemaPath, "utf8")) as unknown;

  if (!isTenantModelSchema(parsed)) {
    throw new Error("CROCO_TENANT_MODEL_SCHEMA_INVALID: schema shape does not match v1");
  }

  return parsed;
}

function readTenantModelPlaybook(): string {
  const playbookPath = findRootArtifactPath(
    TENANT_MODEL_PLAYBOOK_FILE,
    "CROCO_TENANT_MODEL_PLAYBOOK_MISSING",
  );

  return readFileSync(playbookPath, "utf8");
}

function findRootArtifactPath(file: string, diagnosticCode: string): string {
  const candidatePaths = [resolve(process.cwd(), file), resolve(process.cwd(), "..", "..", file)];
  const artifactPath = candidatePaths.find((candidatePath) => existsSync(candidatePath));

  if (!artifactPath) {
    throw new Error(`${diagnosticCode}: ${file}`);
  }

  return artifactPath;
}

function assertManifestMatchesGeneratedSource(manifest: ProfileManifest): void {
  if (JSON.stringify(manifest) === JSON.stringify(generatedSaasProviderProfileManifest)) {
    return;
  }

  throw new Error(
    "CROCO_SAAS_PROFILE_MANIFEST_DRIFT: croco-saas-profile.manifest.json differs from generatedSaasProviderProfile.ts",
  );
}

function assertTenantModelArtifactsMatchGeneratedSource(
  manifest: TenantModelManifest,
  schema: TenantModelManifestSchema,
  playbook: string,
): void {
  if (JSON.stringify(manifest) !== JSON.stringify(generatedTenantModelManifest)) {
    throw new Error(
      "CROCO_TENANT_MODEL_MANIFEST_DRIFT: croco-tenant-model.manifest.json differs from generatedTenantModel.ts",
    );
  }

  if (JSON.stringify(schema) !== JSON.stringify(generatedTenantModelManifestSchema)) {
    throw new Error(
      "CROCO_TENANT_MODEL_SCHEMA_DRIFT: croco-tenant-model.schema.json differs from generatedTenantModel.ts",
    );
  }

  if (playbook !== generatedTenantModelPlaybook) {
    throw new Error(
      "CROCO_TENANT_MODEL_PLAYBOOK_DRIFT: docs/tenant-model-playbook.md differs from generatedTenantModel.ts",
    );
  }
}

function assertTenantModelManifestLinked(
  profileManifest: ProfileManifest,
  tenantModelManifest: TenantModelManifest,
): void {
  const tenantModel = profileManifest.tenantModel;
  const mismatches = [
    tenantModel.currentModel === tenantModelManifest.currentModel ? undefined : "currentModel",
    tenantModel.defaultModel === tenantModelManifest.defaultModel ? undefined : "defaultModel",
    tenantModel.manifest === TENANT_MODEL_MANIFEST_FILE ? undefined : "manifest",
    tenantModel.schema === TENANT_MODEL_SCHEMA_FILE ? undefined : "schema",
    tenantModel.playbook === TENANT_MODEL_PLAYBOOK_FILE ? undefined : "playbook",
  ].filter((mismatch): mismatch is string => mismatch !== undefined);

  if (mismatches.length === 0) return;

  throw new Error(`CROCO_TENANT_MODEL_PROFILE_LINK_DRIFT: ${mismatches.join(", ")}`);
}

function assertTenantModelCompatibility(
  profileManifest: ProfileManifest,
  tenantModelManifest: TenantModelManifest,
): void {
  const result = validateTenantModelCompatibility({
    tenantModel: tenantModelManifest.currentModel,
    providerProfileName: profileManifest.profile.name,
    runtimeTarget: profileManifest.profile.runtimeTarget,
    packages: [
      ...profileManifest.packages,
      ...profileManifest.tenantModel.requiredPackages,
      ...tenantModelManifest.selected.requiredPackages,
    ],
    capabilities: profileManifest.tenantModel.requiredCapabilities,
  });

  if (result.ok) return;

  throw new Error(
    [
      `CROCO_TENANT_MODEL_COMPATIBILITY_FAILED: ${profileManifest.profile.name} cannot use tenant model '${tenantModelManifest.currentModel}'`,
      ...result.diagnostics.map((diagnostic) => `- ${diagnostic.code}: ${diagnostic.message}`),
    ].join("\n"),
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
  const requiredPackages = [
    ...new Set([...manifest.packages, ...manifest.tenantModel.requiredPackages]),
  ];
  const missingPackages = requiredPackages.filter(
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
  if (!isRecord(value.tenantModel)) return false;
  if (typeof value.tenantModel.currentModel !== "string") return false;
  if (typeof value.tenantModel.defaultModel !== "string") return false;
  if (value.tenantModel.manifest !== TENANT_MODEL_MANIFEST_FILE) return false;
  if (value.tenantModel.schema !== TENANT_MODEL_SCHEMA_FILE) return false;
  if (value.tenantModel.playbook !== TENANT_MODEL_PLAYBOOK_FILE) return false;
  if (!Array.isArray(value.tenantModel.requiredPackages)) return false;
  if (!Array.isArray(value.tenantModel.requiredAdapters)) return false;
  if (!Array.isArray(value.tenantModel.requiredCapabilities)) return false;
  if (!Array.isArray(value.deployNotes)) return false;

  return (
    value.packages.every((packageName) => typeof packageName === "string") &&
    value.tenantModel.requiredPackages.every((packageName) => typeof packageName === "string") &&
    value.tenantModel.requiredAdapters.every((adapter) => typeof adapter === "string") &&
    value.tenantModel.requiredCapabilities.every((capability) => typeof capability === "string") &&
    value.env.required.every(isEnvVar)
  );
}

function isTenantModelManifest(value: unknown): value is TenantModelManifest {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== "croco.tenant-model/v1") return false;
  if (typeof value.currentModel !== "string") return false;
  if (typeof value.defaultModel !== "string") return false;
  if (!isRecord(value.selected)) return false;
  if (typeof value.selected.name !== "string") return false;
  if (!Array.isArray(value.selected.requiredPackages)) return false;
  if (!Array.isArray(value.selected.requiredAdapters)) return false;
  if (!Array.isArray(value.selected.requiredCapabilities)) return false;
  if (!Array.isArray(value.models)) return false;
  if (!isRecord(value.schema)) return false;
  if (value.schema.file !== TENANT_MODEL_SCHEMA_FILE) return false;
  if (!isRecord(value.migration)) return false;
  if (!Array.isArray(value.qualityGates)) return false;

  return (
    value.selected.requiredPackages.every((packageName) => typeof packageName === "string") &&
    value.selected.requiredAdapters.every((adapter) => typeof adapter === "string") &&
    value.selected.requiredCapabilities.every((capability) => typeof capability === "string")
  );
}

function isTenantModelSchema(value: unknown): value is TenantModelManifestSchema {
  if (!isRecord(value)) return false;

  return (
    value.$schema === "https://json-schema.org/draft/2020-12/schema" &&
    value.$id === "https://croco.dev/schemas/tenant-model-manifest.v1.json" &&
    value.type === "object" &&
    Array.isArray(value.required) &&
    isRecord(value.properties)
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

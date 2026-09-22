import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createRuntimeCapabilityManifest } from "../../packages/framework-context/src/libs/runtimeCapabilities.ts";
import {
  loadCrocoSkillCatalog,
  renderPackageSelectionReference,
  resolveCapabilitySelection,
  resolveCapabilityVerificationCommands,
  validateCrocoSkill,
} from "../croco-skill.mts";

const rootDir = resolve(import.meta.dirname, "../..");
const inspectorPath = resolve(rootDir, ".agents/skills/croco/scripts/inspect-croco-project.mjs");
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("official Croco Skill", () => {
  it("keeps the Skill, generated reference, and create-croco-app copy in sync", () => {
    expect(validateCrocoSkill(rootDir)).toEqual([]);
  });

  it("renders required capability navigation from canonical catalog metadata", () => {
    const catalog = loadCrocoSkillCatalog(rootDir);
    const reference = renderPackageSelectionReference(catalog);

    expect(reference).toContain("@croco/auth-core/AuthProvider");
    expect(reference).toContain("@croco/billing-core/BillingGateway");
    expect(reference).toContain("@croco/tx-core/TxManager");
    expect(reference).toContain("@croco/tasks-core/TaskDispatcher");
    expect(reference).toContain("@croco/telemetry-api/Trace");
    expect(reference).toContain("@croco/framework-context/RuntimeCompositionManifest");
    expect(reference).toContain("@croco/billing-polar: beta");
    expect(reference).toContain("@croco/billing-polar: uncertified");
    expect(reference).toContain("@croco/tx-drizzle: production");
    expect(reference).toContain("unclaimed");
  });

  it("selects a compatible first-party plugin instead of a custom billing adapter", () => {
    const catalog = loadCrocoSkillCatalog(rootDir);
    const selection = resolveCapabilitySelection(catalog, "billing", "node");

    expect(selection).toEqual({
      mode: "plugin",
      implementation: "polar",
      packages: ["billing-polar"],
    });
    expect(resolveCapabilityVerificationCommands(catalog, "billing", "node")).toEqual([
      "pnpm --filter @croco/billing-polar test",
      "pnpm --filter @croco-example/first-party-plugin-composition... build",
      "pnpm --filter @croco-example/first-party-plugin-composition test",
    ]);
  });

  it("keeps an unsupported runtime fallback at the core contract boundary", () => {
    const catalog = loadCrocoSkillCatalog(rootDir);
    const selection = resolveCapabilitySelection(catalog, "auth", "cloudflare-workers");

    expect(selection).toEqual({
      mode: "application-adapter",
      contract: "@croco/auth-core/AuthProvider",
    });
    expect(resolveCapabilityVerificationCommands(catalog, "auth", "cloudflare-workers")).toEqual([
      "pnpm --filter @croco/auth-core test",
    ]);
  });

  it("selects canonical Lambda composition examples and verification", () => {
    const catalog = loadCrocoSkillCatalog(rootDir);

    expect(resolveCapabilitySelection(catalog, "transport-runtime", "lambda")).toEqual({
      mode: "plugin",
      implementation: "lambda-http",
      packages: ["transports-http", "preset-lambda"],
    });
    expect(resolveCapabilityVerificationCommands(catalog, "transport-runtime", "lambda")).toEqual([
      "pnpm --filter @croco/transports-http test",
      "pnpm --filter @croco/preset-lambda test",
      "pnpm create-croco-app:smoke",
    ]);
  });

  it("reports verification script names without exposing configured secret values", () => {
    const projectRoot = createProject({
      name: "secret-inspection-fixture",
      scripts: {
        smoke: "API_TOKEN=verification-sentinel node smoke.mjs",
        build: "tsc --noEmit",
      },
    });
    const inspection = runInspector(projectRoot);

    expect(inspection.status).toBe(0);
    expect(inspection.stderr).toBe("");
    expect(inspection.stdout).not.toContain("verification-sentinel");
    expect(JSON.parse(inspection.stdout)).toMatchObject({ verificationScripts: ["smoke"] });
  });

  it("fails explicitly when a present manifest has a malformed root", () => {
    const projectRoot = createProject({ name: "malformed-manifest-fixture" });
    writeFileSync(resolve(projectRoot, "croco-runtime-capability.manifest.json"), "[]\n");
    const inspection = runInspector(projectRoot);

    expect(inspection.status).toBe(1);
    expect(inspection.stdout).toBe("");
    expect(inspection.stderr).toContain(
      "croco-runtime-capability.manifest.json must contain a JSON object.",
    );
  });

  it("accepts a canonical runtime capability manifest without optional composition", () => {
    const projectRoot = createProject({ name: "minimal-runtime-manifest-fixture" });
    writeFileSync(
      resolve(projectRoot, "croco-runtime-capability.manifest.json"),
      `${JSON.stringify(createRuntimeCapabilityManifest("node"), null, 2)}\n`,
    );
    const inspection = runInspector(projectRoot);

    expect(inspection.status).toBe(0);
    expect(inspection.stderr).toBe("");
    const output = JSON.parse(inspection.stdout);
    expect(output).toMatchObject({
      manifests: {
        runtimeCapability: {
          found: true,
          platform: "node",
        },
      },
    });
    expect(output.manifests.runtimeCapability).not.toHaveProperty("composition");
  });

  it("accepts SaaS capabilities without an optional package name", () => {
    const projectRoot = createProject({ name: "saas-manifest-fixture" });
    writeFileSync(
      resolve(projectRoot, "croco-saas-profile.manifest.json"),
      `${JSON.stringify(
        {
          schemaVersion: "croco.saas-provider-profile/v1",
          profile: { name: "fixture", runtimeTarget: "node" },
          capabilities: [
            {
              capability: "webhookVerification",
              provider: "documented",
              status: "documented",
              zeroCredentialState: "documented",
              productionState: "documented",
            },
          ],
          smoke: {},
        },
        null,
        2,
      )}\n`,
    );
    const inspection = runInspector(projectRoot);

    expect(inspection.status).toBe(0);
    expect(inspection.stderr).toBe("");
    const output = JSON.parse(inspection.stdout);
    expect(output.manifests.saasProfile.capabilities[0]).not.toHaveProperty("packageName");
  });

  it("rejects an invalid SaaS capability package name when it is present", () => {
    const projectRoot = createProject({ name: "invalid-saas-manifest-fixture" });
    writeFileSync(
      resolve(projectRoot, "croco-saas-profile.manifest.json"),
      `${JSON.stringify(
        {
          schemaVersion: "croco.saas-provider-profile/v1",
          profile: { name: "fixture", runtimeTarget: "node" },
          capabilities: [
            {
              capability: "billing",
              packageName: null,
              provider: "polar",
              status: "enabled",
              zeroCredentialState: "skipped",
              productionState: "configured",
            },
          ],
          smoke: {},
        },
        null,
        2,
      )}\n`,
    );
    const inspection = runInspector(projectRoot);

    expect(inspection.status).toBe(1);
    expect(inspection.stdout).toBe("");
    expect(inspection.stderr).toContain(
      "croco-saas-profile.manifest.json.capabilities[0].packageName must contain a string.",
    );
  });

  it("collects Croco dependencies from workspace manifests", () => {
    const projectRoot = createProject({
      name: "workspace-inspection-fixture",
      devDependencies: { "@croco/cli": "workspace:^" },
    });
    writePackageJson(projectRoot, "apps/api-server", {
      name: "@fixture/api-server",
      dependencies: { "@croco/billing-polar": "^1.2.3" },
    });

    const inspection = runInspector(projectRoot);

    expect(inspection.status).toBe(0);
    expect(JSON.parse(inspection.stdout)).toMatchObject({
      crocoDependencies: {
        "@croco/billing-polar": "^1.2.3",
        "@croco/cli": "workspace:^",
      },
    });
  });

  it("redacts credentials and sensitive query parameters from dependency specifiers", () => {
    const projectRoot = createProject({
      name: "dependency-redaction-fixture",
      dependencies: {
        "@croco/auth-core":
          "git+https://oauth-user:credential-sentinel@github.com/croco-dev/framework.git?token=query-sentinel&ref=trunk",
        "@croco/billing-core":
          "https://download.example.com/billing.tgz?X-Amz-Credential=credential-query-sentinel&version=1",
        "@croco/repository-core":
          "HTTPS://download-user:download-password@example.com/repository.tgz?sig=signature-sentinel&version=2",
        "@croco/tx-core":
          "https://storage.example.com/tx.tgz?AWSAccessKeyId=access-key-sentinel&ref=release",
      },
    });

    const inspection = runInspector(projectRoot);

    expect(inspection.status).toBe(0);
    expect(inspection.stdout).not.toContain("credential-sentinel");
    expect(inspection.stdout).not.toContain("query-sentinel");
    expect(inspection.stdout).not.toContain("credential-query-sentinel");
    expect(inspection.stdout).not.toContain("download-password");
    expect(inspection.stdout).not.toContain("signature-sentinel");
    expect(inspection.stdout).not.toContain("access-key-sentinel");
    expect(JSON.parse(inspection.stdout)).toMatchObject({
      crocoDependencies: {
        "@croco/auth-core": "git+https://github.com/croco-dev/framework.git?ref=trunk",
        "@croco/billing-core": "https://download.example.com/billing.tgz?version=1",
        "@croco/repository-core": "https://example.com/repository.tgz?version=2",
        "@croco/tx-core": "https://storage.example.com/tx.tgz?ref=release",
      },
    });
  });

  it("rejects malformed optional composition when it is present", () => {
    const projectRoot = createProject({ name: "malformed-composition-fixture" });
    writeFileSync(
      resolve(projectRoot, "croco-runtime-capability.manifest.json"),
      `${JSON.stringify({ ...createRuntimeCapabilityManifest("node"), composition: [] }, null, 2)}\n`,
    );
    const inspection = runInspector(projectRoot);

    expect(inspection.status).toBe(1);
    expect(inspection.stdout).toBe("");
    expect(inspection.stderr).toContain(
      "croco-runtime-capability.manifest.json.composition must contain a JSON object.",
    );
  });

  it("ships a project inspector without direct environment access", () => {
    const source = readFileSync(inspectorPath, "utf8");

    expect(source).toContain("croco.skill-inspection/v1");
    expect(source).not.toMatch(/process\.env|secretKey|accessToken|webhookSecret/);
  });
});

function createProject(packageJson: Record<string, unknown>): string {
  const projectRoot = mkdtempSync(resolve(tmpdir(), "croco-skill-inspector-"));
  temporaryDirectories.push(projectRoot);
  writeFileSync(resolve(projectRoot, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`);
  return projectRoot;
}

function writePackageJson(
  projectRoot: string,
  directory: string,
  packageJson: Record<string, unknown>,
): void {
  const packageRoot = resolve(projectRoot, directory);
  mkdirSync(packageRoot, { recursive: true });
  writeFileSync(resolve(packageRoot, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`);
}

function runInspector(projectRoot: string) {
  return spawnSync(process.execPath, [inspectorPath, projectRoot], { encoding: "utf8" });
}

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { renderUsage } from "citty";
import { afterEach, describe, expect, it } from "vitest";
import { doctor, formatDoctorReport, getDoctorExitCode, runDoctor } from "../commands/doctor.js";
import type { DoctorDiagnostic, DoctorLocation, DoctorReport } from "../commands/doctor.js";
import { createCrocoCommand } from "../commands/root.js";
import { CLI_DIAGNOSTIC_CODES, CLI_LEGACY_DIAGNOSTIC_CODES } from "../libs/diagnosticCodes.js";

const tempRepos: string[] = [];

describe("doctor", () => {
  afterEach(() => {
    for (const repo of tempRepos.splice(0)) {
      rmSync(repo, { force: true, recursive: true });
    }
  });

  it("reports a stable workspace diagnostic when run outside a Croco monorepo", () => {
    const repo = createTempRepo();
    const report = runDoctor({ cwd: repo });

    expect(report.summary).toBe("issues_detected");
    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        code: CLI_DIAGNOSTIC_CODES.doctorWorkspaceNotFound,
        legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.doctorWorkspaceNotFound,
        severity: "error",
        action: expect.stringContaining("--cwd"),
      }),
    ]);
    expect(formatDoctorReport(report)).toContain("Location:");
    expect(getDoctorExitCode(report)).toBe(1);
  });

  it("passes when workspace discovery, repository-core boundary, and Lambda telemetry flush are healthy", () => {
    const repo = createCrocoWorkspace();
    writePackage(repo, "repository-core", "@croco/repository-core");
    writeFile(repo, "packages/repository-core/src/index.ts", "export type Repository = {};\n");
    writePackage(repo, "api", "@croco/api");
    writeFile(
      repo,
      "packages/api/src/handler.ts",
      [
        'import { lambdaPreset, TelemetryRuntime } from "@croco/telemetry-sdk-node";',
        "const telemetry = TelemetryRuntime.getInstance();",
        "const telemetryReady = telemetry.init(lambdaPreset({ serviceName: 'api' }));",
        "export const handler = async () => {",
        "  try {",
        "    await telemetryReady;",
        "    return { statusCode: 200 };",
        "  } finally {",
        "    await telemetry.forceFlush();",
        "  }",
        "};",
        "",
      ].join("\n"),
    );

    const report = runDoctor({ cwd: join(repo, "packages", "api") });

    expect(report.summary).toBe("healthy");
    expect(report.packageCount).toBe(2);
    expect(report.diagnostics).toEqual([]);
    expect(formatDoctorReport(report)).toContain("Diagnostics: none");
    expect(getDoctorExitCode(report)).toBe(0);
  });

  it("snapshots the healthy croco.doctor.v1 JSON report", () => {
    const repo = createCrocoWorkspace();
    writePackage(repo, "repository-core", "@croco/repository-core");
    writeFile(repo, "packages/repository-core/src/index.ts", "export type Repository = {};\n");
    writePackage(repo, "api", "@croco/api");
    writeFile(
      repo,
      "packages/api/src/handler.ts",
      [
        'import { lambdaPreset, TelemetryRuntime } from "@croco/telemetry-sdk-node";',
        "const telemetry = TelemetryRuntime.getInstance();",
        "const telemetryReady = telemetry.init(lambdaPreset({ serviceName: 'api' }));",
        "export const handler = async () => {",
        "  try {",
        "    await telemetryReady;",
        "    return { statusCode: 200 };",
        "  } finally {",
        "    await telemetry.forceFlush();",
        "  }",
        "};",
        "",
      ].join("\n"),
    );

    const report = runDoctor({ cwd: join(repo, "packages", "api") });

    expect(normalizeDoctorReportForSnapshot(report, repo)).toMatchInlineSnapshot(`
      {
        "checks": [
          {
            "diagnostics": [],
            "id": "workspace-discovery",
            "note": "2 package(s) discovered from pnpm-workspace.yaml",
            "status": "pass",
            "title": "Workspace discovery",
          },
          {
            "diagnostics": [],
            "id": "workspace-version-consistency",
            "note": "2 workspace package manifest(s) use consistent local dependency ranges.",
            "status": "pass",
            "title": "Workspace package version consistency",
          },
          {
            "diagnostics": [],
            "id": "spine-package-state",
            "note": "No external @croco spine package dependencies were declared.",
            "status": "skipped",
            "title": "Spine package install and build state",
          },
          {
            "diagnostics": [],
            "id": "contract-graph-readiness",
            "note": "No contract graph script or snapshot artifact was found.",
            "status": "skipped",
            "title": "ContractGraph artifact",
          },
          {
            "diagnostics": [],
            "id": "project-manifest-bundle",
            "note": ".croco/manifest was not found.",
            "status": "skipped",
            "title": "Project manifest bundle",
          },
          {
            "diagnostics": [],
            "id": "problem-registry-readiness",
            "note": "No ProblemRegistry artifact or drift-check script was found.",
            "status": "skipped",
            "title": "ProblemRegistry artifact drift gate",
          },
          {
            "diagnostics": [],
            "id": "runtime-capability-manifest",
            "note": "No runtime capability manifest or runtime-policy check script was found.",
            "status": "skipped",
            "title": "RuntimeCapabilityManifest presence",
          },
          {
            "diagnostics": [],
            "id": "http-security-middleware-contract",
            "note": "No @croco/transports-http createApp source was discovered.",
            "status": "skipped",
            "title": "HTTP security middleware contract",
          },
          {
            "diagnostics": [],
            "id": "di-graph-bootstrap",
            "note": ".croco/build/di-graph.manifest.json was not found.",
            "status": "skipped",
            "title": "DI graph bootstrap errors",
          },
          {
            "diagnostics": [],
            "id": "provider-certification",
            "note": "croco-saas-profile.manifest.json was not found.",
            "status": "skipped",
            "title": "Provider certification gaps",
          },
          {
            "diagnostics": [],
            "id": "repository-core-boundary",
            "note": "No Drizzle references found in packages/repository-core/src.",
            "status": "pass",
            "title": "repository-core dependency boundary",
          },
          {
            "diagnostics": [],
            "id": "lambda-telemetry-flush",
            "note": "No Lambda telemetry entrypoints are missing forceFlush().",
            "status": "pass",
            "title": "Lambda telemetry flush boundary",
          },
        ],
        "diagnostics": [],
        "packageCount": 2,
        "rootDir": "<workspace-root>",
        "summary": "healthy",
        "version": "croco.doctor.v1",
      }
    `);
  });

  it("snapshots the failing croco.doctor.v1 JSON report", () => {
    const repo = createTempRepo();

    const report = runDoctor({ cwd: repo });

    expect(normalizeDoctorReportForSnapshot(report, repo)).toMatchInlineSnapshot(`
      {
        "checks": [
          {
            "diagnostics": [
              {
                "action": "Run croco doctor from inside a Croco monorepo, or pass --cwd to a directory under the workspace root.",
                "cause": "croco doctor could not find pnpm-workspace.yaml by walking up from the execution directory.",
                "checkId": "workspace-discovery",
                "code": "CROCO_CLI_DOCTOR_001",
                "legacyCode": "doctor/workspace-not-found",
                "location": {
                  "file": "<cwd>",
                },
                "severity": "error",
              },
            ],
            "id": "workspace-discovery",
            "status": "fail",
            "title": "Workspace discovery",
          },
        ],
        "diagnostics": [
          {
            "action": "Run croco doctor from inside a Croco monorepo, or pass --cwd to a directory under the workspace root.",
            "cause": "croco doctor could not find pnpm-workspace.yaml by walking up from the execution directory.",
            "checkId": "workspace-discovery",
            "code": "CROCO_CLI_DOCTOR_001",
            "legacyCode": "doctor/workspace-not-found",
            "location": {
              "file": "<cwd>",
            },
            "severity": "error",
          },
        ],
        "packageCount": 0,
        "rootDir": null,
        "summary": "issues_detected",
        "version": "croco.doctor.v1",
      }
    `);
  });

  it("discovers packages from inline workspace arrays and excludes negated globs", () => {
    const repo = createTempRepo();
    writeFile(repo, "pnpm-workspace.yaml", "packages: ['apps/*', 'libs/**', '!libs/legacy/**']\n");
    writeWorkspacePackage(repo, "apps/api", "@croco/app-api");
    writeWorkspacePackage(repo, "libs/shared/provider", "@croco/provider");
    writeWorkspacePackage(repo, "libs/legacy/provider", "@croco/legacy-provider");

    const report = runDoctor({ cwd: repo });

    expect(report.summary).toBe("healthy");
    expect(report.packageCount).toBe(2);
    expect(formatDoctorReport(report)).toContain("2 package(s) discovered");
  });

  it("fails workspace discovery when configured package globs resolve no packages", () => {
    const repo = createTempRepo();
    writeFile(repo, "pnpm-workspace.yaml", "packages: ['apps/*']\n");

    const report = runDoctor({ cwd: repo });

    expect(report.summary).toBe("issues_detected");
    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        code: CLI_DIAGNOSTIC_CODES.doctorWorkspacePackagesEmpty,
        legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.doctorWorkspacePackagesEmpty,
        location: expect.objectContaining({ file: "pnpm-workspace.yaml" }),
      }),
    ]);
  });

  it("reports invalid package manifests as stable doctor diagnostics", () => {
    const repo = createCrocoWorkspace();
    writeFile(repo, "packages/api/package.json", "{ not json");

    const report = runDoctor({ cwd: repo });

    expect(report.summary).toBe("issues_detected");
    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        code: CLI_DIAGNOSTIC_CODES.doctorWorkspacePackageInvalid,
        legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.doctorWorkspacePackageInvalid,
        location: expect.objectContaining({ file: "packages/api/package.json" }),
        action: expect.stringContaining("valid JSON"),
      }),
    ]);
  });

  it("flags repository-core Drizzle implementation leakage with location and recovery action", () => {
    const repo = createCrocoWorkspace();
    writePackage(repo, "repository-core", "@croco/repository-core");
    writeFile(
      repo,
      "packages/repository-core/src/index.ts",
      "export type LeakedTable = import('drizzle-orm').Table;\n",
    );

    const report = runDoctor({ cwd: repo });
    const markdown = formatDoctorReport(report);

    expect(report.summary).toBe("issues_detected");
    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        code: CLI_DIAGNOSTIC_CODES.doctorRepositoryCoreDrizzleBoundary,
        legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.doctorRepositoryCoreDrizzleBoundary,
        location: expect.objectContaining({
          file: "packages/repository-core/src/index.ts",
          line: 1,
          packageName: "@croco/repository-core",
        }),
      }),
    ]);
    expect(markdown).toContain("Cause: @croco/repository-core is an interface layer");
    expect(markdown).toContain("Action: Move Drizzle-specific types");
  });

  it("flags Lambda telemetry initialization that cannot prove forceFlush before return", () => {
    const repo = createCrocoWorkspace();
    writePackage(repo, "api", "@croco/api");
    writeFile(
      repo,
      "packages/api/src/handler.ts",
      [
        'import { lambdaPreset, TelemetryRuntime } from "@croco/telemetry-sdk-node";',
        "const telemetry = TelemetryRuntime.getInstance();",
        "const telemetryReady = telemetry.init(lambdaPreset({ serviceName: 'api' }));",
        "export const handler = async () => {",
        "  await telemetryReady;",
        "  return { statusCode: 200 };",
        "};",
        "",
      ].join("\n"),
    );

    const report = runDoctor({ cwd: repo });

    expect(report.summary).toBe("issues_detected");
    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        code: CLI_DIAGNOSTIC_CODES.doctorLambdaTelemetryFlushMissing,
        legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.doctorLambdaTelemetryFlushMissing,
        location: expect.objectContaining({
          file: "packages/api/src/handler.ts",
          line: 1,
          packageName: "@croco/api",
        }),
        action: expect.stringContaining("finally"),
      }),
    ]);
  });

  it("does not treat comments or unused helpers as Lambda telemetry flush evidence", () => {
    const repo = createCrocoWorkspace();
    writePackage(repo, "api", "@croco/api");
    writeFile(
      repo,
      "packages/api/src/handler.ts",
      [
        'import { lambdaPreset, TelemetryRuntime } from "@croco/telemetry-sdk-node";',
        "const telemetry = TelemetryRuntime.getInstance();",
        "const telemetryReady = telemetry.init(lambdaPreset({ serviceName: 'api' }));",
        "async function flushTelemetry() {",
        "  await telemetry.forceFlush();",
        "}",
        "export const handler = async () => {",
        "  await telemetryReady;",
        "  // TODO: call telemetry.forceFlush() before returning",
        "  return { statusCode: 200 };",
        "};",
        "",
      ].join("\n"),
    );

    const report = runDoctor({ cwd: repo });

    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        code: CLI_DIAGNOSTIC_CODES.doctorLambdaTelemetryFlushMissing,
        legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.doctorLambdaTelemetryFlushMissing,
      }),
    ]);
  });

  it("passes generated SaaS-style readiness artifacts without live provider credentials", () => {
    const repo = createCrocoWorkspace();
    writeRootPackage(repo, {
      scripts: {
        "contract:snapshot": "croco contracts check --json --out contract-graph.snapshot.json",
        "runtime-policy:check":
          "croco runtime-policy check --manifest croco-runtime-policy.manifest.json",
      },
      devDependencies: {
        "@croco/cli": "file:../packs/croco-cli.tgz",
      },
    });
    writeWorkspacePackage(repo, "packages/api", "@smoke/api-server", {
      dependencies: {
        "@croco/auth-better-auth": "file:../packs/croco-auth-better-auth.tgz",
        "@croco/problems-core": "file:../packs/croco-problems-core.tgz",
        "@croco/transports-http": "file:../packs/croco-transports-http.tgz",
      },
    });
    writeFile(
      repo,
      "packages/api/src/app.ts",
      [
        'import { bodyLimitMiddleware, corsMiddleware, createApp, rateLimitHttpMiddleware, securityHeadersMiddleware } from "@croco/transports-http";',
        "export function createApiApp() {",
        "  return createApp({",
        "    controllers: [],",
        "    middlewares: [",
        "      securityHeadersMiddleware(),",
        "      corsMiddleware({ origins: ['http://localhost:5173'] }),",
        "      bodyLimitMiddleware({ limit: 1024 }),",
        "      rateLimitHttpMiddleware({ rateLimiter: {} as never, policy: {} as never }),",
        "    ],",
        "  });",
        "}",
        "",
      ].join("\n"),
    );
    writeNodeModulePackage(repo, "@croco/cli");
    for (const packageName of [
      "@croco/auth-better-auth",
      "@croco/problems-core",
      "@croco/transports-http",
    ]) {
      writeNodeModulePackage(repo, packageName, "packages/api");
    }
    writeJson(repo, "contract-graph.snapshot.json", {
      snapshotVersion: "croco.contract-graph.snapshot.v1",
      graphVersion: "croco.contract-graph.v1",
      controllerCount: 0,
      routeCount: 0,
      operationIds: [],
      controllers: [],
      routes: [],
      diagnostics: [],
    });
    writeJson(repo, "croco-runtime-policy.manifest.json", {
      schemaVersion: "croco.runtime-policy/v1",
      runtime: { platform: "node" },
      table: { plans: [] },
    });
    writeJson(repo, "croco-saas-profile.manifest.json", {
      schemaVersion: "croco.saas-provider-profile/v1",
      profile: {
        name: "saas-node-postgres",
        displayName: "Node/Postgres SaaS",
        runtimeTarget: "node",
      },
      packages: ["@croco/auth-better-auth"],
      capabilities: [
        "runtime",
        "auth",
        "billing",
        "metering",
        "storage",
        "tasks",
        "telemetry",
        "webhookVerification",
      ].map((capability) => ({
        capability,
        provider: "zero-credential",
        status: "configured",
        env: [],
        notes: "covered by generated smoke",
      })),
    });

    const report = runDoctor({ cwd: repo });

    expect(report.summary).toBe("healthy");
    expect(report.diagnostics).toEqual([]);
    expect(getDoctorExitCode(report)).toBe(0);
    expect(report.checks.map((check) => check.id)).toEqual([
      "workspace-discovery",
      "workspace-version-consistency",
      "spine-package-state",
      "contract-graph-readiness",
      "project-manifest-bundle",
      "problem-registry-readiness",
      "runtime-capability-manifest",
      "http-security-middleware-contract",
      "di-graph-bootstrap",
      "provider-certification",
      "repository-core-boundary",
      "lambda-telemetry-flush",
    ]);
  });

  it("reads schema-versioned Project manifest bundle artifacts", () => {
    const repo = createCrocoWorkspace();
    writePackage(repo, "api", "@croco/api");
    writeProjectManifestBundle(repo);

    const report = runDoctor({ cwd: repo });
    const bundleCheck = report.checks.find((check) => check.id === "project-manifest-bundle");

    expect(report.summary).toBe("healthy");
    expect(bundleCheck).toMatchObject({
      status: "pass",
      note: "6 schema-versioned manifest bundle artifact(s) are readable.",
    });
  });

  it("fails Project manifest bundle readiness when project-map scripts expect missing artifacts", () => {
    const repo = createCrocoWorkspace();
    writeRootPackage(repo, {
      scripts: {
        "project-map:check":
          "croco project map --check --manifest croco.project-map.json --manifest-bundle .croco/manifest",
      },
    });
    writePackage(repo, "api", "@croco/api");

    const report = runDoctor({ cwd: repo });

    expect(report.summary).toBe("issues_detected");
    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        code: CLI_DIAGNOSTIC_CODES.projectMapManifestMissing,
        legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.projectMapManifestMissing,
        checkId: "project-manifest-bundle",
        location: expect.objectContaining({ file: ".croco/manifest" }),
      }),
    ]);
  });

  it("reports readiness failures with stable CROCO diagnostic codes", () => {
    const repo = createCrocoWorkspace();
    writeRootPackage(repo, {
      scripts: {
        "contract:snapshot": "croco contracts check --json --out contract-graph.snapshot.json",
        "problem-registry:check": "node scripts/problem-registry.mts --check",
        "runtime-policy:check":
          "croco runtime-policy check --manifest croco-runtime-policy.manifest.json",
      },
      devDependencies: {
        "@croco/cli": "file:../packs/croco-cli.tgz",
      },
    });
    writeWorkspacePackage(repo, "packages/api", "@smoke/api-server", {
      dependencies: {
        "@croco/transports-http": "file:../packs/croco-transports-http.tgz",
      },
    });
    writeFile(
      repo,
      "packages/api/src/app.ts",
      [
        'import { createApp, securityHeadersMiddleware } from "@croco/transports-http";',
        "export function createApiApp() {",
        "  return createApp({",
        "    controllers: [],",
        "    securityValidation: 'off',",
        "    middlewares: [securityHeadersMiddleware()],",
        "  });",
        "}",
        "",
      ].join("\n"),
    );
    writeJson(repo, ".croco/build/di-graph.manifest.json", {
      version: "croco.di-graph.manifest.v1",
      status: "failed",
      diagnostics: [
        {
          code: "CROCO_DI_001",
          legacyCode: "framework-context/di-missing-provider",
          severity: "error",
          message: "Provider ApiController is not registered",
        },
      ],
    });

    const report = runDoctor({ cwd: repo });
    const codes = report.diagnostics.map((diagnostic) => diagnostic.code);

    expect(report.summary).toBe("issues_detected");
    expect(codes).toEqual(
      expect.arrayContaining([
        "CROCO_DOCTOR_SPINE_PACKAGE_NOT_INSTALLED",
        "CROCO_DOCTOR_CONTRACT_GRAPH_MISSING",
        "CROCO_DOCTOR_PROBLEM_REGISTRY_MISSING",
        "CROCO_DOCTOR_RUNTIME_CAPABILITY_MANIFEST_MISSING",
        "CROCO_DOCTOR_HTTP_SECURITY_VALIDATION_DISABLED",
        "CROCO_DOCTOR_HTTP_SECURITY_MIDDLEWARE_MISSING",
        "CROCO_DOCTOR_DI_BOOTSTRAP_ERRORS",
      ]),
    );
    expect(codes.every((code) => code.startsWith("CROCO_"))).toBe(true);
    expect(getDoctorExitCode(report)).toBe(1);
  });

  it("flags root package dependencies that drift from local workspace package versions", () => {
    const repo = createCrocoWorkspace();
    writeRootPackage(repo, {
      devDependencies: {
        "@croco/cli": "^0.0.1",
      },
    });
    writePackage(repo, "cli", "@croco/cli", { version: "0.0.3" });

    const report = runDoctor({ cwd: repo });

    expect(report.summary).toBe("issues_detected");
    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        code: "CROCO_DOCTOR_WORKSPACE_VERSION_CONFLICT",
        location: expect.objectContaining({
          file: "package.json",
          packageName: "croco-doctor-test",
        }),
      }),
    ]);
  });

  it("does not count HTTP security middleware tokens outside createApp middlewares", () => {
    const repo = createCrocoWorkspace();
    writeWorkspacePackage(repo, "packages/api", "@smoke/api-server", {
      dependencies: {
        "@croco/transports-http": "file:../packs/croco-transports-http.tgz",
      },
    });
    writeNodeModulePackage(repo, "@croco/transports-http", "packages/api");
    writeFile(
      repo,
      "packages/api/src/app.ts",
      [
        'import { bodyLimitMiddleware, corsMiddleware, createApp, rateLimitHttpMiddleware, securityHeadersMiddleware } from "@croco/transports-http";',
        "function unusedSecuritySetup() {",
        "  securityHeadersMiddleware();",
        "  corsMiddleware({ origins: ['http://localhost:5173'] });",
        "  bodyLimitMiddleware({ limit: 1024 });",
        "  rateLimitHttpMiddleware({ rateLimiter: {} as never, policy: {} as never });",
        "}",
        "export function createApiApp() {",
        "  return createApp({",
        "    controllers: [],",
        "    middlewares: [",
        "      'securityHeadersMiddleware()',",
        "      'corsMiddleware()',",
        "      'bodyLimitMiddleware()',",
        "      'rateLimitHttpMiddleware()',",
        "    ],",
        "  });",
        "}",
        "",
      ].join("\n"),
    );

    const report = runDoctor({ cwd: repo });

    expect(report.summary).toBe("issues_detected");
    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        code: "CROCO_DOCTOR_HTTP_SECURITY_MIDDLEWARE_MISSING",
        location: expect.objectContaining({
          file: "packages/api/src/app.ts",
          packageName: "@smoke/api-server",
        }),
      }),
    ]);
  });

  it("accepts HTTP security middleware through a local helper referenced by createApp", () => {
    const repo = createCrocoWorkspace();
    writeWorkspacePackage(repo, "packages/api", "@smoke/api-server", {
      dependencies: {
        "@croco/transports-http": "file:../packs/croco-transports-http.tgz",
      },
    });
    writeNodeModulePackage(repo, "@croco/transports-http", "packages/api");
    writeFile(
      repo,
      "packages/api/src/app.ts",
      [
        'import { bodyLimitMiddleware, corsMiddleware, createApp, rateLimitHttpMiddleware, securityHeadersMiddleware } from "@croco/transports-http";',
        "export function createApiApp() {",
        "  return createApp({",
        "    controllers: [],",
        "    middlewares: [",
        "      securityHeadersMiddleware(),",
        "      corsMiddleware({ origins: ['http://localhost:5173'] }),",
        "      bodyLimitMiddleware({ limit: 1024 }),",
        "      createApiRateLimitMiddleware(),",
        "    ],",
        "  });",
        "}",
        "function createApiRateLimitMiddleware() {",
        "  return rateLimitHttpMiddleware({ rateLimiter: {} as never, policy: {} as never });",
        "}",
        "",
      ].join("\n"),
    );

    const report = runDoctor({ cwd: repo });

    expect(report.summary).toBe("healthy");
    expect(report.diagnostics).toEqual([]);
  });

  it("fails ProblemRegistry readiness when the declared drift gate fails", () => {
    const repo = createCrocoWorkspace();
    writeRootPackage(repo, {
      scripts: {
        "problem-registry:check": "node -e \"console.error('registry drift'); process.exit(1)\"",
      },
    });
    writePackage(repo, "api", "@croco/api");
    writeJson(repo, "docs/problem-code-registry.json", {
      version: "croco.problem-code-registry.v1",
      problemCount: 0,
      problems: [],
    });
    writeFile(
      repo,
      "packages/docs/src/content/docs/en/reference/problem-recovery-cookbook.md",
      "# Problem recovery cookbook\n",
    );

    const report = runDoctor({ cwd: repo });

    expect(report.summary).toBe("issues_detected");
    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        code: "CROCO_DOCTOR_PROBLEM_REGISTRY_DRIFT",
        cause: expect.stringContaining("registry drift"),
        location: expect.objectContaining({ file: "docs/problem-code-registry.json" }),
      }),
    ]);
  });

  it("validates nested package export build targets including require outputs", () => {
    const repo = createCrocoWorkspace();
    writeWorkspacePackage(repo, "packages/api", "@smoke/api-server", {
      dependencies: {
        "@croco/problems-core": "file:../packs/croco-problems-core.tgz",
      },
    });
    writeNodeModulePackage(repo, "@croco/problems-core", "packages/api", {
      publishConfig: {
        exports: {
          ".": {
            import: "./dist/index.mjs",
            require: "./dist/index.cjs",
            types: "./dist/index.d.ts",
          },
        },
      },
    });
    writeFile(
      repo,
      "packages/api/node_modules/@croco/problems-core/dist/index.mjs",
      "export {};\n",
    );

    const report = runDoctor({ cwd: repo });

    expect(report.summary).toBe("issues_detected");
    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        code: "CROCO_DOCTOR_SPINE_PACKAGE_NOT_BUILT",
        location: expect.objectContaining({
          file: "packages/api/node_modules/@croco/problems-core/dist/index.cjs",
          packageName: "@croco/problems-core",
        }),
      }),
    ]);
  });

  it("registers the doctor command metadata", () => {
    expect(Object.keys(doctor.args ?? {})).toEqual(["cwd", "dryRun", "overwrite", "path", "json"]);
  });

  it("renders top-level CLI help without loading implementation-heavy subcommands", async () => {
    const usage = await renderUsage(createCrocoCommand());

    expect(usage).toContain("Croco framework CLI");
    expect(usage).toContain("`contracts`");
    expect(usage).toContain("`doctor`");
    expect(usage).toContain("`runtime-policy`");
  });
});

function createTempRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), "croco-doctor-"));
  tempRepos.push(repo);
  return repo;
}

function createCrocoWorkspace(): string {
  const repo = createTempRepo();
  writeFile(repo, "pnpm-workspace.yaml", "packages:\n  - packages/*\n");
  writeRootPackage(repo);
  return repo;
}

function writeRootPackage(repo: string, manifest: Record<string, unknown> = {}): void {
  writeJson(repo, "package.json", {
    name: "croco-doctor-test",
    private: true,
    packageManager: "pnpm@11.9.0",
    ...manifest,
  });
}

function writePackage(
  repo: string,
  dirName: string,
  packageName: string,
  manifest: Record<string, unknown> = {},
): void {
  writeWorkspacePackage(repo, `packages/${dirName}`, packageName, manifest);
}

function writeWorkspacePackage(
  repo: string,
  relativeDir: string,
  packageName: string,
  manifest: Record<string, unknown> = {},
): void {
  writeJson(repo, `${relativeDir}/package.json`, { name: packageName, ...manifest });
  writeFile(repo, `${relativeDir}/src/index.ts`, "export const value = 1;\n");
}

function writeNodeModulePackage(
  repo: string,
  packageName: string,
  importerDir = ".",
  manifest: Record<string, unknown> = {},
): void {
  const packagePath = `${importerDir}/node_modules/${packageName}/package.json`;
  writeJson(repo, packagePath, {
    name: packageName,
    version: "0.0.0-smoke",
    publishConfig: {
      main: "./dist/index.js",
      types: "./dist/index.d.ts",
    },
    ...manifest,
  });
  writeFile(repo, `${importerDir}/node_modules/${packageName}/dist/index.js`, "export {};\n");
  writeFile(repo, `${importerDir}/node_modules/${packageName}/dist/index.d.ts`, "export {};\n");
}

function writeProjectManifestBundle(repo: string): void {
  for (const artifact of [
    { path: "contract-graph.json", schemaVersion: "croco.manifest.contract-graph.v1" },
    { path: "problems.json", schemaVersion: "croco.manifest.problems.v1" },
    { path: "di-graph.json", schemaVersion: "croco.manifest.di-graph.v1" },
    { path: "runtime.json", schemaVersion: "croco.manifest.runtime.v1" },
    { path: "policies.json", schemaVersion: "croco.manifest.policies.v1" },
    { path: "providers.json", schemaVersion: "croco.manifest.providers.v1" },
  ]) {
    writeJson(repo, `.croco/manifest/${artifact.path}`, {
      schemaVersion: artifact.schemaVersion,
      source: {
        schemaVersion: "croco.project-map.manifest.v1",
        artifact: "croco.project-map.json",
      },
    });
  }
}

function writeJson(repo: string, relativePath: string, value: unknown): void {
  writeFile(repo, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function normalizeDoctorReportForSnapshot(report: DoctorReport, rootDir: string): DoctorReport {
  return {
    ...report,
    rootDir: normalizeRootDirForSnapshot(report.rootDir, rootDir),
    checks: report.checks.map((check) => ({
      ...check,
      diagnostics: check.diagnostics.map((diagnostic) =>
        normalizeDiagnosticForSnapshot(diagnostic, rootDir),
      ),
    })),
    diagnostics: report.diagnostics.map((diagnostic) =>
      normalizeDiagnosticForSnapshot(diagnostic, rootDir),
    ),
  };
}

function normalizeRootDirForSnapshot(
  actualRootDir: string | null,
  expectedRootDir: string,
): string | null {
  if (actualRootDir === null) {
    return null;
  }

  if (actualRootDir !== expectedRootDir) {
    throw new Error(`Expected doctor rootDir ${expectedRootDir}, received ${actualRootDir}`);
  }

  return "<workspace-root>";
}

function normalizeDiagnosticForSnapshot(
  diagnostic: DoctorDiagnostic,
  rootDir: string,
): DoctorDiagnostic {
  return {
    ...diagnostic,
    location: normalizeLocationForSnapshot(diagnostic.location, rootDir),
  };
}

function normalizeLocationForSnapshot(
  location: DoctorLocation | null,
  rootDir: string,
): DoctorLocation | null {
  if (!location?.file) {
    return location;
  }

  if (location.file === rootDir) {
    return { ...location, file: "<cwd>" };
  }

  if (location.file.startsWith(`${rootDir}/`)) {
    return {
      ...location,
      file: `<workspace-root>/${relative(rootDir, location.file).split("\\").join("/")}`,
    };
  }

  return location;
}

function writeFile(repo: string, relativePath: string, content: string): void {
  const filePath = join(repo, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { renderUsage } from "citty";
import { afterEach, describe, expect, it } from "vitest";
import { doctor, formatDoctorReport, getDoctorExitCode, runDoctor } from "../commands/doctor.js";
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
      "advisory-gate-readiness",
      "problem-registry-readiness",
      "runtime-capability-manifest",
      "http-security-middleware-contract",
      "di-graph-bootstrap",
      "provider-certification",
      "repository-core-boundary",
      "lambda-telemetry-flush",
    ]);
  });

  it("passes advisory release-hardening readiness when local evidence is present", () => {
    const repo = createCrocoWorkspace();
    writeRootPackage(repo, {
      scripts: {
        "test:coverage:core":
          "CORE_COVERAGE=true pnpm --filter @croco/framework-context exec vitest run",
        "bench:readiness": "node scripts/benchmark-readiness-report.mts",
      },
    });
    writeWorkspacePackage(repo, "packages/framework-context", "@croco/framework-context", {
      scripts: { build: "tsup" },
    });
    writePackageCatalog(repo, ["framework-context"], { spine: [] });
    writeBundleSizeBaseline(repo);
    writeBenchmarkVarianceEvidence(repo);
    writeJson(repo, "scripts/static-misuse-raw-error-allowlist.json", {
      schemaVersion: 1,
      entries: [
        {
          package: "@croco/framework-context",
          file: "packages/framework-context/src/index.ts",
          line: 1,
          excerpt: "throw new Error('internal invariant');",
          reason: "Reviewed internal invariant while migrating static misuse diagnostics.",
          owner: "framework-error-handling",
        },
      ],
    });

    const report = runDoctor({ cwd: repo });
    const check = report.checks.find((candidate) => candidate.id === "advisory-gate-readiness");

    expect(report.summary).toBe("healthy");
    expect(check).toMatchObject({ status: "pass", diagnostics: [] });
    expect(report.diagnostics).toEqual([]);
    expect(getDoctorExitCode(report)).toBe(0);
  });

  it("accepts preserved benchmark pre-promotion baseline failures as advisory evidence", () => {
    const repo = createCrocoWorkspace();
    writeRootPackage(repo, {
      scripts: {
        "test:coverage:core":
          "CORE_COVERAGE=true pnpm --filter @croco/framework-context exec vitest run",
        "bench:readiness": "node scripts/benchmark-readiness-report.mts",
      },
    });
    writeWorkspacePackage(repo, "packages/framework-context", "@croco/framework-context", {
      scripts: { build: "tsup" },
    });
    writePackageCatalog(repo, ["framework-context"], { spine: [] });
    writeBundleSizeBaseline(repo);
    writeBenchmarkVarianceEvidence(repo, { prePromotionBaselineFailuresPerRun: 1 });
    writeValidStaticMisuseAllowlist(repo);

    const report = runDoctor({ cwd: repo });
    const check = report.checks.find((candidate) => candidate.id === "advisory-gate-readiness");

    expect(report.summary).toBe("healthy");
    expect(check).toMatchObject({ status: "pass", diagnostics: [] });
    expect(report.diagnostics).toEqual([]);
    expect(getDoctorExitCode(report)).toBe(0);
  });

  it("honors temporary core coverage selection exclusions", () => {
    const repo = createCrocoWorkspace();
    writeRootPackage(repo, {
      scripts: {
        "test:coverage:core":
          "CORE_COVERAGE=true pnpm --filter @croco/problems-core exec vitest run",
        "bench:readiness": "node scripts/benchmark-readiness-report.mts",
      },
    });
    writeWorkspacePackage(repo, "packages/framework-context", "@croco/framework-context", {
      scripts: { build: "tsup" },
    });
    writePackageCatalog(repo, ["framework-context"], { spine: [] });
    writeCoreCoverageTemporaryExclusion(
      repo,
      "@croco/framework-context",
      "Temporary baseline stabilization while coverage rows are reviewed.",
    );
    writeBundleSizeBaseline(repo);
    writeBenchmarkVarianceEvidence(repo);
    writeValidStaticMisuseAllowlist(repo);

    const report = runDoctor({ cwd: repo });
    const check = report.checks.find((candidate) => candidate.id === "advisory-gate-readiness");

    expect(report.summary).toBe("healthy");
    expect(check).toMatchObject({ status: "pass", diagnostics: [] });
    expect(report.diagnostics).toEqual([]);
    expect(getDoctorExitCode(report)).toBe(0);
  });

  it("keeps spine packages visible even when temporary core coverage exclusions are configured", () => {
    const repo = createCrocoWorkspace();
    writeRootPackage(repo, {
      scripts: {
        "test:coverage:core":
          "CORE_COVERAGE=true pnpm --filter @croco/problems-core exec vitest run",
        "bench:readiness": "node scripts/benchmark-readiness-report.mts",
      },
    });
    writeWorkspacePackage(repo, "packages/framework-context", "@croco/framework-context", {
      scripts: { build: "tsup" },
    });
    writePackageCatalog(repo, ["framework-context"]);
    writeCoreCoverageTemporaryExclusion(
      repo,
      "@croco/framework-context",
      "Temporary baseline stabilization while coverage rows are reviewed.",
    );
    writeBundleSizeBaseline(repo);
    writeBenchmarkVarianceEvidence(repo);
    writeValidStaticMisuseAllowlist(repo);

    const report = runDoctor({ cwd: repo });
    const diagnostics = report.diagnostics.filter(
      (diagnostic) => diagnostic.code === CLI_DIAGNOSTIC_CODES.doctorCoreCoverageCandidateMissing,
    );

    expect(report.summary).toBe("healthy");
    expect(getDoctorExitCode(report)).toBe(0);
    expect(diagnostics).toEqual([
      expect.objectContaining({
        cause: expect.stringContaining("1.0 spine package"),
      }),
    ]);
  });

  it("reports core coverage filter and threshold-set mismatches", () => {
    const repo = createCrocoWorkspace();
    writeRootPackage(repo, {
      scripts: {
        "test:coverage:core":
          "CORE_COVERAGE=true pnpm --filter @croco/framework-context exec vitest run",
        "bench:readiness": "node scripts/benchmark-readiness-report.mts",
      },
    });
    writeWorkspacePackage(repo, "packages/framework-context", "@croco/framework-context", {
      scripts: { build: "tsup" },
    });
    writePackageCatalog(repo, ["framework-context"]);
    writeCoreCoverageVitestConfig(repo, ["@croco/problems-core"]);
    writeBundleSizeBaseline(repo);
    writeBenchmarkVarianceEvidence(repo);
    writeValidStaticMisuseAllowlist(repo);

    const report = runDoctor({ cwd: repo });
    const causes = report.diagnostics
      .filter(
        (diagnostic) => diagnostic.code === CLI_DIAGNOSTIC_CODES.doctorCoreCoverageCandidateMissing,
      )
      .map((diagnostic) => diagnostic.cause);

    expect(report.summary).toBe("healthy");
    expect(getDoctorExitCode(report)).toBe(0);
    expect(causes).toEqual([
      expect.stringContaining("missing from vitest CORE_COVERAGE_PACKAGES"),
      expect.stringContaining("missing from test:coverage:core filters"),
    ]);
  });

  it("rejects malformed bundle-size baseline entries as advisory readiness warning", () => {
    const repo = createCrocoWorkspace();
    writeRootPackage(repo, {
      scripts: {
        "test:coverage:core":
          "CORE_COVERAGE=true pnpm --filter @croco/framework-context exec vitest run",
        "bench:readiness": "node scripts/benchmark-readiness-report.mts",
      },
    });
    writeWorkspacePackage(repo, "packages/framework-context", "@croco/framework-context", {
      scripts: { build: "tsup" },
    });
    writePackageCatalog(repo, ["framework-context"]);
    writeJson(repo, "ci-reports/bundle-size/baseline.json", {
      schemaVersion: 1,
      artifacts: {
        "@croco/framework-context:packages/framework-context/dist/index.js": "1024",
      },
    });
    writeBenchmarkVarianceEvidence(repo);
    writeJson(repo, "scripts/static-misuse-raw-error-allowlist.json", {
      schemaVersion: 1,
      entries: [
        {
          package: "@croco/framework-context",
          file: "packages/framework-context/src/index.ts",
          line: 1,
          excerpt: "throw new Error('internal invariant');",
          reason: "Reviewed internal invariant while migrating static misuse diagnostics.",
          owner: "framework-error-handling",
        },
      ],
    });

    const report = runDoctor({ cwd: repo });
    const check = report.checks.find((candidate) => candidate.id === "advisory-gate-readiness");

    expect(report.summary).toBe("healthy");
    expect(check).toMatchObject({ status: "fail" });
    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        code: CLI_DIAGNOSTIC_CODES.doctorBundleSizeBaselineMissing,
        cause: expect.stringContaining("must be a non-negative byte number"),
      }),
    ]);
    expect(getDoctorExitCode(report)).toBe(0);
  });

  it("rejects empty bundle-size baseline artifacts as advisory readiness warning", () => {
    const repo = createCrocoWorkspace();
    writeRootPackage(repo, {
      scripts: {
        "test:coverage:core":
          "CORE_COVERAGE=true pnpm --filter @croco/framework-context exec vitest run",
        "bench:readiness": "node scripts/benchmark-readiness-report.mts",
      },
    });
    writeWorkspacePackage(repo, "packages/framework-context", "@croco/framework-context", {
      scripts: { build: "tsup" },
    });
    writePackageCatalog(repo, ["framework-context"]);
    writeJson(repo, "ci-reports/bundle-size/baseline.json", {
      schemaVersion: 1,
      artifacts: {},
    });
    writeBenchmarkVarianceEvidence(repo);
    writeJson(repo, "scripts/static-misuse-raw-error-allowlist.json", {
      schemaVersion: 1,
      entries: [
        {
          package: "@croco/framework-context",
          file: "packages/framework-context/src/index.ts",
          line: 1,
          excerpt: "throw new Error('internal invariant');",
          reason: "Reviewed internal invariant while migrating static misuse diagnostics.",
          owner: "framework-error-handling",
        },
      ],
    });

    const report = runDoctor({ cwd: repo });
    const check = report.checks.find((candidate) => candidate.id === "advisory-gate-readiness");

    expect(report.summary).toBe("healthy");
    expect(check).toMatchObject({ status: "fail" });
    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        code: CLI_DIAGNOSTIC_CODES.doctorBundleSizeBaselineMissing,
        cause: expect.stringContaining("does not contain any baseline entries"),
      }),
    ]);
    expect(getDoctorExitCode(report)).toBe(0);
  });

  it("reports advisory release-hardening readiness warnings without failing the doctor summary", () => {
    const repo = createCrocoWorkspace();
    writeRootPackage(repo, {
      scripts: {
        "test:coverage:core":
          "CORE_COVERAGE=true pnpm --filter @croco/problems-core exec vitest run",
        "bench:readiness": "node scripts/benchmark-readiness-report.mts",
      },
    });
    writeWorkspacePackage(repo, "packages/framework-context", "@croco/framework-context", {
      scripts: { build: "tsup" },
    });
    writePackageCatalog(repo, ["framework-context"]);
    writeJson(repo, "scripts/static-misuse-raw-error-allowlist.json", {
      schemaVersion: 1,
      entries: [
        {
          package: "@croco/framework-context",
          file: "packages/framework-context/src/index.ts",
          line: 1,
          excerpt: "throw new Error('internal invariant');",
          reason: "Reviewed internal invariant while migrating static misuse diagnostics.",
        },
      ],
    });

    const report = runDoctor({ cwd: repo });
    const check = report.checks.find((candidate) => candidate.id === "advisory-gate-readiness");
    const codes = report.diagnostics.map((diagnostic) => diagnostic.code);

    expect(report.summary).toBe("healthy");
    expect(getDoctorExitCode(report)).toBe(0);
    expect(check).toMatchObject({ status: "fail" });
    expect(report.diagnostics.map((diagnostic) => diagnostic.severity)).toEqual([
      "warning",
      "warning",
      "warning",
      "warning",
    ]);
    expect(codes).toEqual([
      CLI_DIAGNOSTIC_CODES.doctorCoreCoverageCandidateMissing,
      CLI_DIAGNOSTIC_CODES.doctorBundleSizeBaselineMissing,
      CLI_DIAGNOSTIC_CODES.doctorBenchmarkVarianceEvidenceMissing,
      CLI_DIAGNOSTIC_CODES.doctorSecurityAllowlistMetadataInvalid,
    ]);
    expect(report.diagnostics[0].action).toContain("pnpm test:coverage:core");
    expect(report.diagnostics[1].action).toContain("pnpm package-quality:report");
    expect(report.diagnostics[2].action).toContain("pnpm bench:readiness");
    expect(report.diagnostics[3].action).toContain("owner or expiresOn");
  });

  it("rejects incomplete benchmark variance evidence as advisory readiness warning", () => {
    const repo = createCrocoWorkspace();
    writeRootPackage(repo, {
      scripts: {
        "test:coverage:core":
          "CORE_COVERAGE=true pnpm --filter @croco/framework-context exec vitest run",
        "bench:readiness": "node scripts/benchmark-readiness-report.mts",
      },
    });
    writeWorkspacePackage(repo, "packages/framework-context", "@croco/framework-context", {
      scripts: { build: "tsup" },
    });
    writePackageCatalog(repo, ["framework-context"]);
    writeBundleSizeBaseline(repo);
    writeBenchmarkResult(repo);
    writeFile(
      repo,
      "ci-reports/benchmark/latest-five-green-runs.md",
      [
        "# Benchmark variance evidence",
        "",
        "<!-- croco-benchmark-variance-evidence:v1 -->",
        "```json",
        JSON.stringify({
          version: 1,
          runs: [],
          checks: {},
          rows: [],
        }),
        "```",
        "",
      ].join("\n"),
    );
    writeJson(repo, "scripts/static-misuse-raw-error-allowlist.json", {
      schemaVersion: 1,
      entries: [],
    });

    const report = runDoctor({ cwd: repo });
    const diagnostics = report.diagnostics.filter(
      (diagnostic) =>
        diagnostic.code === CLI_DIAGNOSTIC_CODES.doctorBenchmarkVarianceEvidenceMissing,
    );

    expect(report.summary).toBe("healthy");
    expect(getDoctorExitCode(report)).toBe(0);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].cause).toContain("exactly 5 GitHub Actions runs");
  });

  it("rejects normalized benchmark variance timestamps as advisory readiness warning", () => {
    const repo = createCrocoWorkspace();
    writeRootPackage(repo, {
      scripts: {
        "test:coverage:core":
          "CORE_COVERAGE=true pnpm --filter @croco/framework-context exec vitest run",
        "bench:readiness": "node scripts/benchmark-readiness-report.mts",
      },
    });
    writeWorkspacePackage(repo, "packages/framework-context", "@croco/framework-context", {
      scripts: { build: "tsup" },
    });
    writePackageCatalog(repo, ["framework-context"]);
    writeBundleSizeBaseline(repo);
    writeBenchmarkVarianceEvidence(repo, { reviewedAt: "2026-02-31T00:00:00Z" });
    writeValidStaticMisuseAllowlist(repo);

    const report = runDoctor({ cwd: repo });
    const diagnostics = report.diagnostics.filter(
      (diagnostic) =>
        diagnostic.code === CLI_DIAGNOSTIC_CODES.doctorBenchmarkVarianceEvidenceMissing,
    );

    expect(report.summary).toBe("healthy");
    expect(getDoctorExitCode(report)).toBe(0);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].cause).toContain("reviewedAt must be an ISO timestamp");
  });

  it("accepts benchmark run attempt URLs as advisory evidence", () => {
    const repo = createCrocoWorkspace();
    writeRootPackage(repo, {
      scripts: {
        "test:coverage:core":
          "CORE_COVERAGE=true pnpm --filter @croco/framework-context exec vitest run",
        "bench:readiness": "node scripts/benchmark-readiness-report.mts",
      },
    });
    writeWorkspacePackage(repo, "packages/framework-context", "@croco/framework-context", {
      scripts: { build: "tsup" },
    });
    writePackageCatalog(repo, ["framework-context"]);
    writeBundleSizeBaseline(repo);
    writeBenchmarkVarianceEvidence(repo, { runUrlSuffix: "/attempts/1" });
    writeValidStaticMisuseAllowlist(repo);

    const report = runDoctor({ cwd: repo });
    const diagnostics = report.diagnostics.filter(
      (diagnostic) =>
        diagnostic.code === CLI_DIAGNOSTIC_CODES.doctorBenchmarkVarianceEvidenceMissing,
    );

    expect(report.summary).toBe("healthy");
    expect(getDoctorExitCode(report)).toBe(0);
    expect(diagnostics).toEqual([]);
  });

  it("rejects benchmark variance evidence that drifts from current benchmark rows", () => {
    const repo = createCrocoWorkspace();
    writeRootPackage(repo, {
      scripts: {
        "test:coverage:core":
          "CORE_COVERAGE=true pnpm --filter @croco/framework-context exec vitest run",
        "bench:readiness": "node scripts/benchmark-readiness-report.mts",
      },
    });
    writeWorkspacePackage(repo, "packages/framework-context", "@croco/framework-context", {
      scripts: { build: "tsup" },
    });
    writePackageCatalog(repo, ["framework-context"]);
    writeBundleSizeBaseline(repo);
    writeBenchmarkVarianceEvidence(repo, {
      resultReports: [
        { name: "Example benchmark", p75: 10, baseline: 10 },
        { name: "New benchmark", p75: 1, baseline: 1 },
      ],
    });
    writeValidStaticMisuseAllowlist(repo);

    const report = runDoctor({ cwd: repo });
    const diagnostics = report.diagnostics.filter(
      (diagnostic) =>
        diagnostic.code === CLI_DIAGNOSTIC_CODES.doctorBenchmarkVarianceEvidenceMissing,
    );

    expect(report.summary).toBe("healthy");
    expect(getDoctorExitCode(report)).toBe(0);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].cause).toContain("row set must match benchmark-result.json");
  });

  it("rejects benchmark variance evidence with a stale committed baseline", () => {
    const repo = createCrocoWorkspace();
    writeRootPackage(repo, {
      scripts: {
        "test:coverage:core":
          "CORE_COVERAGE=true pnpm --filter @croco/framework-context exec vitest run",
        "bench:readiness": "node scripts/benchmark-readiness-report.mts",
      },
    });
    writeWorkspacePackage(repo, "packages/framework-context", "@croco/framework-context", {
      scripts: { build: "tsup" },
    });
    writePackageCatalog(repo, ["framework-context"]);
    writeBundleSizeBaseline(repo);
    writeBenchmarkVarianceEvidence(repo, {
      resultReports: [{ name: "Example benchmark", p75: 10, baseline: 9 }],
    });
    writeValidStaticMisuseAllowlist(repo);

    const report = runDoctor({ cwd: repo });
    const diagnostics = report.diagnostics.filter(
      (diagnostic) =>
        diagnostic.code === CLI_DIAGNOSTIC_CODES.doctorBenchmarkVarianceEvidenceMissing,
    );

    expect(report.summary).toBe("healthy");
    expect(getDoctorExitCode(report)).toBe(0);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].cause).toContain("committed baseline must match");
  });

  it("rejects non-positive security allowlist line numbers", () => {
    const repo = createCrocoWorkspace();
    writeRootPackage(repo, {
      scripts: {
        "test:coverage:core":
          "CORE_COVERAGE=true pnpm --filter @croco/framework-context exec vitest run",
        "bench:readiness": "node scripts/benchmark-readiness-report.mts",
      },
    });
    writeWorkspacePackage(repo, "packages/framework-context", "@croco/framework-context", {
      scripts: { build: "tsup" },
    });
    writePackageCatalog(repo, ["framework-context"]);
    writeBundleSizeBaseline(repo);
    writeBenchmarkVarianceEvidence(repo);
    writeValidStaticMisuseAllowlist(repo, { line: 0 });

    const report = runDoctor({ cwd: repo });
    const diagnostics = report.diagnostics.filter(
      (diagnostic) =>
        diagnostic.code === CLI_DIAGNOSTIC_CODES.doctorSecurityAllowlistMetadataInvalid,
    );

    expect(report.summary).toBe("healthy");
    expect(getDoctorExitCode(report)).toBe(0);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].cause).toContain("line must be a positive integer");
  });

  it("rejects stale security allowlist source references", () => {
    const repo = createCrocoWorkspace();
    writeRootPackage(repo, {
      scripts: {
        "test:coverage:core":
          "CORE_COVERAGE=true pnpm --filter @croco/framework-context exec vitest run",
        "bench:readiness": "node scripts/benchmark-readiness-report.mts",
      },
    });
    writeWorkspacePackage(repo, "packages/framework-context", "@croco/framework-context", {
      scripts: { build: "tsup" },
    });
    writePackageCatalog(repo, ["framework-context"]);
    writeBundleSizeBaseline(repo);
    writeBenchmarkVarianceEvidence(repo);
    writeValidStaticMisuseAllowlist(repo, { excerpt: "throw new Error('stale');" });

    const report = runDoctor({ cwd: repo });
    const diagnostics = report.diagnostics.filter(
      (diagnostic) =>
        diagnostic.code === CLI_DIAGNOSTIC_CODES.doctorSecurityAllowlistMetadataInvalid,
    );

    expect(report.summary).toBe("healthy");
    expect(getDoctorExitCode(report)).toBe(0);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].cause).toContain("excerpt does not match the current source line");
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
          code: "framework-context/di-missing-provider",
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
    packageManager: "pnpm@10.15.1",
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
  writeFile(repo, `${relativeDir}/src/index.ts`, "throw new Error('internal invariant');\n");
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

function writePackageCatalog(
  repo: string,
  packages: readonly string[],
  options: { readonly spine?: readonly string[] } = {},
): void {
  writeJson(repo, "docs/package-catalog.json", {
    schemaVersion: 1,
    spine: { packages: options.spine ?? packages },
    groups: {
      Core: { packages },
    },
    maturity: {
      production: { packages },
    },
  });
}

function writeCoreCoverageVitestConfig(repo: string, packages: readonly string[]): void {
  writeFile(
    repo,
    "vitest.config.ts",
    [
      "export const CORE_COVERAGE_PACKAGES = [",
      ...packages.map((packageName) => `  "${packageName}",`),
      "];",
      "",
    ].join("\n"),
  );
}

function writeCoreCoverageTemporaryExclusion(
  repo: string,
  packageName: string,
  reason: string,
): void {
  writeFile(
    repo,
    "scripts/core-coverage-warning-check.mts",
    [
      "const TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS: Record<string, string> = {",
      `  "${packageName}": "${reason}",`,
      "};",
      "",
    ].join("\n"),
  );
}

function writeBundleSizeBaseline(repo: string): void {
  writeJson(repo, "ci-reports/bundle-size/baseline.json", {
    schemaVersion: 1,
    artifacts: {
      "@croco/framework-context:packages/framework-context/dist/index.js": 1024,
      "@croco/framework-context:packages/framework-context/dist/index.mjs": {
        bytes: 768,
      },
    },
  });
}

type BenchmarkVarianceEvidenceOptions = {
  readonly prePromotionBaselineFailuresPerRun?: number;
  readonly reviewedAt?: string;
  readonly runUrlSuffix?: string;
  readonly resultReports?: readonly BenchmarkResultReport[];
};

type BenchmarkResultReport = {
  readonly name: string;
  readonly p75: number;
  readonly baseline: number;
};

function writeBenchmarkVarianceEvidence(
  repo: string,
  options: BenchmarkVarianceEvidenceOptions = {},
): void {
  const runIds = [1, 2, 3, 4, 5];
  const prePromotionBaselineFailuresPerRun = options.prePromotionBaselineFailuresPerRun ?? 0;
  const gateFailures = Array.from(
    { length: prePromotionBaselineFailuresPerRun },
    (_, index) =>
      `Example benchmark ${index + 1}: p75 10.0ms exceeds baseline 1.0ms by more than 20%`,
  );
  const p75ByRun = {
    "1": 10,
    "2": 10.2,
    "3": 9.9,
    "4": 10.1,
    "5": 10,
  };
  const resultReports = options.resultReports ?? [
    { name: "Example benchmark", p75: 10, baseline: 10 },
  ];

  writeBenchmarkResult(repo, resultReports);

  writeFile(
    repo,
    "ci-reports/benchmark/latest-five-green-runs.md",
    [
      "# Benchmark variance evidence",
      "",
      "<!-- croco-benchmark-variance-evidence:v1 -->",
      "```json",
      JSON.stringify({
        version: 1,
        source: "github-actions",
        reviewedAt: options.reviewedAt ?? "2026-07-01T00:00:00Z",
        tolerance: 0.15,
        selection: {
          workflowName: "Performance Benchmark",
          qualifyingBaseBranch: "trunk",
          qualifyingWorkflowStatus: "completed",
          qualifyingWorkflowConclusion: "success",
          orderedBy: "createdAt-desc",
          latestGreenTrunkRunIds: runIds,
        },
        runs: runIds.map((runId) => ({
          id: runId,
          url: `https://github.com/croco-dev/framework/actions/runs/${runId}${options.runUrlSuffix ?? ""}`,
          headSha: `${String.fromCharCode(96 + runId).repeat(40)}`,
          headBranch: "trunk",
          baseBranch: "trunk",
          createdAt: `2026-06-30T0${5 - runId}:00:00Z`,
          workflowStatus: "completed",
          workflowConclusion: "success",
          artifact: {
            allPassed: gateFailures.length === 0,
            reportCount: 1,
            gateFailures,
          },
        })),
        checks: {
          sameRowSet: true,
          runnerFailures: 0,
          moduleFailures: 0,
          emptyReports: 0,
          missingReports: 0,
          thresholdFailures: 0,
          thresholdSkips: 0,
          baselineSkips: 0,
          prePromotionBaselineFailures: prePromotionBaselineFailuresPerRun * runIds.length,
          promotedBaselineFailures: 0,
        },
        rows: [
          {
            name: "Example benchmark",
            min: 9.9,
            median: 10,
            max: 10.2,
            spread: 0.03,
            status: "pass",
            p75ByRun,
          },
        ],
      }),
      "```",
      "",
    ].join("\n"),
  );
}

function writeBenchmarkResult(
  repo: string,
  reports: readonly BenchmarkResultReport[] = [
    { name: "Example benchmark", p75: 10, baseline: 10 },
  ],
): void {
  writeJson(repo, "benchmark-result.json", {
    allPassed: true,
    gateFailures: [],
    reports: reports.map((report) => ({
      name: report.name,
      p75: report.p75,
      threshold: report.p75 * 2,
      baseline: report.baseline,
      thresholdStatus: "pass",
      baselineStatus: "pass",
    })),
  });
}

function writeValidStaticMisuseAllowlist(
  repo: string,
  entry: Partial<{
    package: string;
    file: string;
    line: number;
    excerpt: string;
    reason: string;
    owner: string;
  }> = {},
): void {
  writeJson(repo, "scripts/static-misuse-raw-error-allowlist.json", {
    schemaVersion: 1,
    entries: [
      {
        package: "@croco/framework-context",
        file: "packages/framework-context/src/index.ts",
        line: 1,
        excerpt: "throw new Error('internal invariant');",
        reason: "Reviewed internal invariant while migrating static misuse diagnostics.",
        owner: "framework-error-handling",
        ...entry,
      },
    ],
  });
}

function writeJson(repo: string, relativePath: string, value: unknown): void {
  writeFile(repo, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeFile(repo: string, relativePath: string, content: string): void {
  const filePath = join(repo, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

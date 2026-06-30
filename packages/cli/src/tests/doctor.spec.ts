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

  it("passes generated app spine readiness artifacts without live provider credentials", () => {
    const repo = createGeneratedAppWorkspace();
    writeInstalledPackage(repo, "@croco/cli");
    writeInstalledPackage(repo, "@croco/transports-http");
    writeContractGraphSnapshot(repo);
    writeRuntimeCapabilityManifest(repo);
    writeProviderProfileManifest(repo);
    writeHttpAppBootstrap(repo, { secure: true });

    const report = runDoctor({ cwd: repo });
    const statuses = Object.fromEntries(report.checks.map((check) => [check.id, check.status]));

    expect(report.summary).toBe("healthy");
    expect(report.diagnostics).toEqual([]);
    expect(statuses).toMatchObject({
      "spine-package-state": "pass",
      "contract-graph": "pass",
      "runtime-capability-manifest": "pass",
      "http-security-middleware": "pass",
      "provider-certification": "pass",
    });
    expect(JSON.parse(JSON.stringify(report))).toMatchObject({
      version: "croco.doctor.v1",
      summary: "healthy",
    });
  });

  it("reports stable spine readiness diagnostics for missing or failing generated app artifacts", () => {
    const repo = createGeneratedAppWorkspace({
      scripts: {
        "contract:snapshot": "croco contracts check --json --out contract-graph.snapshot.json",
        "runtime-policy:check":
          "croco runtime-policy check --manifest croco-runtime-policy.manifest.json",
        "di:check": "croco di check croco.di-graph.manifest.json",
      },
    });
    writeInstalledPackage(repo, "@croco/cli");
    writeInstalledPackage(repo, "@croco/transports-http");
    writeContractGraphSnapshot(repo, {
      diagnostics: [
        {
          code: "contract-route-missing-path-param",
          severity: "error",
          target: "route",
          message: "Route path declares ':id' but no @Param metadata was found.",
        },
      ],
    });
    writeFile(
      repo,
      "croco-saas-profile.manifest.json",
      `${JSON.stringify(
        {
          schemaVersion: "croco.saas-provider-profile/v1",
          packages: ["@croco/transports-http"],
          compatibility: { requiredCapabilities: ["runtime"] },
        },
        null,
        2,
      )}\n`,
    );
    writeHttpAppBootstrap(repo, { secure: false });

    const report = runDoctor({ cwd: repo });
    const codes = report.diagnostics.map((diagnostic) => diagnostic.code);

    expect(report.summary).toBe("issues_detected");
    expect(codes).toEqual(
      expect.arrayContaining([
        CLI_DIAGNOSTIC_CODES.doctorContractGraphErrors,
        CLI_DIAGNOSTIC_CODES.doctorRuntimeCapabilityManifestMissing,
        CLI_DIAGNOSTIC_CODES.doctorHttpSecurityMiddlewareMissing,
        CLI_DIAGNOSTIC_CODES.doctorDiGraphManifestMissing,
        CLI_DIAGNOSTIC_CODES.doctorProviderCertificationGap,
      ]),
    );
    expect(codes.every((code) => code.startsWith("CROCO_CLI_DOCTOR_"))).toBe(true);
  });

  it("reports workspace version drift and ProblemRegistry drift with stable codes", () => {
    const repo = createCrocoWorkspace();
    writePackage(repo, "core", "@croco/core");
    writeFile(repo, "packages/core/dist/index.js", "export {};\n");
    writeFile(
      repo,
      "packages/api/package.json",
      `${JSON.stringify(
        {
          name: "@croco/api",
          dependencies: {
            "@croco/core": "^1.0.0",
          },
        },
        null,
        2,
      )}\n`,
    );
    writeFile(repo, "packages/api/src/index.ts", "export const value = 1;\n");
    writeFile(repo, "packages/problems-core/src/index.ts", "export const registry = true;\n");
    writeFile(
      repo,
      "docs/problem-code-registry.json",
      `${JSON.stringify(
        {
          version: "croco.problem-code-registry.v1",
          problemCount: 2,
          problems: [{ code: "example/problem" }],
        },
        null,
        2,
      )}\n`,
    );

    const report = runDoctor({ cwd: repo });
    const codes = report.diagnostics.map((diagnostic) => diagnostic.code);

    expect(codes).toEqual(
      expect.arrayContaining([
        CLI_DIAGNOSTIC_CODES.doctorWorkspaceVersionInconsistent,
        CLI_DIAGNOSTIC_CODES.doctorProblemRegistryDrift,
      ]),
    );
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
  return repo;
}

function createGeneratedAppWorkspace(
  options: {
    readonly scripts?: Record<string, string>;
  } = {},
): string {
  const repo = createTempRepo();
  writeFile(repo, "pnpm-workspace.yaml", "packages:\n  - apps/*\n");
  writeFile(
    repo,
    "package.json",
    `${JSON.stringify(
      {
        name: "generated-app",
        private: true,
        packageManager: "pnpm@10.15.1",
        scripts: {
          "contract:snapshot": "croco contracts check --json --out contract-graph.snapshot.json",
          "runtime-policy:check":
            "croco runtime-policy check --manifest croco-runtime-policy.manifest.json",
          ...options.scripts,
        },
        devDependencies: {
          "@croco/cli": "workspace:*",
        },
      },
      null,
      2,
    )}\n`,
  );
  writeFile(
    repo,
    "apps/api/package.json",
    `${JSON.stringify(
      {
        name: "@demo/api",
        dependencies: {
          "@croco/transports-http": "workspace:*",
        },
      },
      null,
      2,
    )}\n`,
  );
  writeFile(repo, "apps/api/src/index.ts", "export const value = 1;\n");
  return repo;
}

function writePackage(repo: string, dirName: string, packageName: string): void {
  writeWorkspacePackage(repo, `packages/${dirName}`, packageName);
}

function writeWorkspacePackage(repo: string, relativeDir: string, packageName: string): void {
  writeFile(
    repo,
    `${relativeDir}/package.json`,
    `${JSON.stringify({ name: packageName }, null, 2)}\n`,
  );
  writeFile(repo, `${relativeDir}/src/index.ts`, "export const value = 1;\n");
}

function writeInstalledPackage(repo: string, packageName: string): void {
  const packageDir = join(repo, "node_modules", ...packageName.split("/"));
  writeFile(
    repo,
    join("node_modules", ...packageName.split("/"), "package.json"),
    `${JSON.stringify({ name: packageName, version: "0.0.3" }, null, 2)}\n`,
  );
  writeFile(packageDir, "dist/index.js", "export {};\n");
}

function writeContractGraphSnapshot(
  repo: string,
  options: {
    readonly diagnostics?: readonly Record<string, unknown>[];
  } = {},
): void {
  writeFile(
    repo,
    "contract-graph.snapshot.json",
    `${JSON.stringify(
      {
        snapshotVersion: "croco.contract-graph.snapshot.v1",
        graphVersion: "croco.contract-graph.v1",
        controllerCount: 0,
        routeCount: 0,
        operationIds: [],
        controllers: [],
        routes: [],
        diagnostics: options.diagnostics ?? [],
      },
      null,
      2,
    )}\n`,
  );
}

function writeRuntimeCapabilityManifest(repo: string): void {
  writeFile(
    repo,
    "croco-runtime-policy.manifest.json",
    `${JSON.stringify(
      {
        schemaVersion: "croco.runtime-policy/v1",
        runtime: { platform: "node" },
        table: { plans: [] },
      },
      null,
      2,
    )}\n`,
  );
}

function writeProviderProfileManifest(repo: string): void {
  writeFile(
    repo,
    "croco-saas-profile.manifest.json",
    `${JSON.stringify(
      {
        schemaVersion: "croco.saas-provider-profile/v1",
        profile: { name: "saas-node-postgres", runtimeTarget: "node" },
        packages: ["@croco/transports-http"],
        capabilities: [{ capability: "runtime", status: "configured" }],
        compatibility: { requiredCapabilities: ["runtime"] },
      },
      null,
      2,
    )}\n`,
  );
}

function writeHttpAppBootstrap(
  repo: string,
  options: {
    readonly secure: boolean;
  },
): void {
  const imports = options.secure
    ? [
        "bodyLimitMiddleware",
        "corsMiddleware",
        "createCrocoApp",
        "rateLimitHttpMiddleware",
        "securityHeadersMiddleware",
      ]
    : ["createCrocoApp"];
  const middlewares = options.secure
    ? [
        "securityHeadersMiddleware()",
        "corsMiddleware({ origins: ['http://localhost:5173'] })",
        "bodyLimitMiddleware()",
        "rateLimitHttpMiddleware({ rateLimiter })",
      ]
    : [];

  writeFile(
    repo,
    "apps/api/src/app.ts",
    [
      `import { ${imports.join(", ")} } from "@croco/transports-http";`,
      "const rateLimiter = {};",
      `export const app = createCrocoApp({ middlewares: [${middlewares.join(", ")}] });`,
      "",
    ].join("\n"),
  );
}

function writeFile(repo: string, relativePath: string, content: string): void {
  const filePath = join(repo, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { renderUsage } from "citty";
import { afterEach, describe, expect, it } from "vitest";
import { doctor, formatDoctorReport, getDoctorExitCode, runDoctor } from "../commands/doctor.js";
import { createCrocoCommand } from "../commands/root.js";

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
        code: "doctor/workspace-not-found",
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
        code: "doctor/workspace-packages-empty",
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
        code: "doctor/workspace-package-invalid",
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
        code: "doctor/repository-core-drizzle-boundary",
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
        code: "doctor/lambda-telemetry-flush-missing",
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
        code: "doctor/lambda-telemetry-flush-missing",
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

function writeFile(repo: string, relativePath: string, content: string): void {
  const filePath = join(repo, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

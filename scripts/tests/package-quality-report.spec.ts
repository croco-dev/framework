import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  buildReportMarkdown,
  createPackageQualityReport,
  parseWorkspacePackagePatterns,
  scanDependencyBoundaries,
  writePackageQualityReport,
} from "../package-quality-report.mts";

const tempRepos: string[] = [];

describe("package-quality-report.mts", () => {
  afterEach(() => {
    for (const repo of tempRepos.splice(0)) {
      rmSync(repo, { force: true, recursive: true });
    }
  });

  it("renders package task status from Turbo run summaries", () => {
    const repo = createTempRepo();
    writePackage(repo, "alpha", "@croco/alpha", {
      build: "tsup",
      test: "vitest run",
      typecheck: "tsc --noEmit",
    });
    writePackage(repo, "beta", "@croco/beta", {
      build: "tsup",
    });
    writeTurboSummary(repo, "build.json", "turbo run build --summarize", 100, [
      task("@croco/alpha", "build", 0, "packages/alpha/.turbo/turbo-build.log"),
      task("@croco/beta", "build", 1, "packages/beta/.turbo/turbo-build.log"),
    ]);
    writeTurboSummary(repo, "typecheck.json", "turbo run typecheck --summarize", 200, [
      task("@croco/alpha", "typecheck", 0, "packages/alpha/.turbo/turbo-typecheck.log"),
    ]);

    const report = createPackageQualityReport({
      rootDir: repo,
      summaryDir: join(repo, ".turbo", "runs"),
    });
    const markdown = buildReportMarkdown(report);

    expect(markdown).toContain(
      "| `@croco/beta` | fail; log: `packages/beta/.turbo/turbo-build.log`",
    );
    expect(markdown).toContain("| `@croco/alpha` | pass");
    expect(markdown).toContain("not-collected");
    expect(markdown).toContain("not-configured");
    expect(markdown).toContain(
      "- `@croco/beta` build failed; log: `packages/beta/.turbo/turbo-build.log`",
    );
  });

  it("includes example workspace package failures", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "pnpm-workspace.yaml",
      "packages:\n  - packages/**/*\n  - examples/*\n\nonlyBuiltDependencies:\n  - esbuild\n",
    );
    writeWorkspacePackage(repo, "examples/demo", "@croco-example/demo", {
      build: "tsc --noEmit",
    });
    writeTurboSummary(repo, "build.json", "turbo run build --summarize", 100, [
      task(
        "@croco-example/demo",
        "build",
        1,
        "examples/demo/.turbo/turbo-build.log",
        "examples/demo",
      ),
    ]);

    const report = createPackageQualityReport({
      rootDir: repo,
      summaryDir: join(repo, ".turbo", "runs"),
    });
    const markdown = buildReportMarkdown(report);

    expect(markdown).toContain(
      "| `@croco-example/demo` | fail; log: `examples/demo/.turbo/turbo-build.log`",
    );
    expect(markdown).toContain(
      "- `@croco-example/demo` build failed; log: `examples/demo/.turbo/turbo-build.log`",
    );
  });

  it("writes markdown and JSON dashboard artifacts", () => {
    const repo = createTempRepo();
    writePackage(repo, "alpha", "@croco/alpha", {
      build: "tsup",
    });
    writeFile(
      repo,
      "ci-reports/package-quality/public-api-summary.json",
      `${JSON.stringify(
        {
          status: "fail",
          packageCount: 1,
          changedPackages: 1,
          runtimeAdded: 1,
          runtimeRemoved: 0,
          typeAdded: 0,
          typeRemoved: 1,
          snapshotPath: "public-api-surface.snapshot.json",
          reportPath: "ci-reports/package-quality/public-api-diff.md",
          updateCommand: "pnpm public-api:write",
        },
        null,
        2,
      )}\n`,
    );

    const report = createPackageQualityReport({
      rootDir: repo,
      summaryDir: join(repo, ".turbo", "runs"),
    });
    const markdownPath = writePackageQualityReport(
      report,
      join(repo, "ci-reports", "package-quality"),
    );
    const markdown = readFileSync(markdownPath, "utf-8");
    const summaryJson = readFileSync(
      join(repo, "ci-reports", "package-quality", "summary.json"),
      "utf-8",
    );

    expect(markdown).toContain("# Package Quality Dashboard");
    expect(markdown).toContain("`static-misuse:check`");
    expect(markdown).toContain("| `public-api:check` | package public export surface drift");
    expect(markdown).toContain("- Runtime exports added/removed: 1 / 0");
    expect(markdown).toContain("- Type exports added/removed: 0 / 1");
    expect(markdown).toContain("run `pnpm public-api:write`");
    expect(summaryJson).toContain('"packageName": "@croco/alpha"');
    expect(summaryJson).toContain('"publicApi"');
  });

  it("flags repository-core Drizzle boundary violations", () => {
    const repo = createTempRepo();
    writePackage(repo, "repository-core", "@croco/repository-core", {
      build: "tsup",
    });
    writeFile(
      repo,
      "packages/repository-core/src/index.ts",
      "export const leak = 'drizzle-orm';\n",
    );

    const results = scanDependencyBoundaries(repo);

    expect(results).toEqual([
      expect.objectContaining({
        id: "repository-core-drizzle-free",
        packageName: "@croco/repository-core",
        status: "fail",
        violations: [
          expect.objectContaining({
            file: "packages/repository-core/src/index.ts",
            line: 1,
          }),
        ],
      }),
    ]);
  });

  it("reads package globs from pnpm-workspace.yaml", () => {
    expect(
      parseWorkspacePackagePatterns(`
packages:
  - packages/**/*
  - "examples/*"
  - '!ignored/*'

onlyBuiltDependencies:
  - esbuild
`),
    ).toEqual(["packages/**/*", "examples/*"]);
  });
});

function createTempRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), "croco-package-quality-"));
  tempRepos.push(repo);
  mkdirSync(join(repo, "packages"), { recursive: true });
  mkdirSync(join(repo, ".turbo", "runs"), { recursive: true });
  return repo;
}

function writePackage(
  repo: string,
  dirName: string,
  packageName: string,
  scripts: Record<string, string>,
): void {
  writeWorkspacePackage(repo, `packages/${dirName}`, packageName, scripts);
}

function writeWorkspacePackage(
  repo: string,
  relativeDir: string,
  packageName: string,
  scripts: Record<string, string>,
): void {
  writeFile(
    repo,
    `${relativeDir}/package.json`,
    `${JSON.stringify(
      {
        name: packageName,
        scripts,
      },
      null,
      2,
    )}\n`,
  );
  writeFile(repo, `${relativeDir}/src/index.ts`, "export const value = 1;\n");
}

function writeTurboSummary(
  repo: string,
  fileName: string,
  command: string,
  endTime: number,
  tasks: readonly ReturnType<typeof task>[],
): void {
  writeFile(
    repo,
    `.turbo/runs/${fileName}`,
    `${JSON.stringify(
      {
        execution: {
          command,
          endTime,
          exitCode: tasks.some((entry) => entry.execution.exitCode !== 0) ? 1 : 0,
        },
        tasks,
      },
      null,
      2,
    )}\n`,
  );
}

function task(
  packageName: string,
  taskName: string,
  exitCode: number,
  logFile: string,
  directory = `packages/${packageName.replace(/^@croco\/?/, "")}`,
) {
  return {
    taskId: `${packageName}#${taskName}`,
    task: taskName,
    package: packageName,
    directory,
    logFile,
    cache: {
      status: exitCode === 0 ? "HIT" : "MISS",
    },
    execution: {
      exitCode,
    },
  };
}

function writeFile(repo: string, relativePath: string, content: string): void {
  const filePath = join(repo, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  buildProductionReadyMarkdown,
  createProductionReadyReport,
  hasProductionReadyFailures,
  writeProductionReadyReport,
} from "../production-ready-check.mts";

const tempRepos: string[] = [];

describe("production-ready-check.mts", () => {
  afterEach(() => {
    for (const repo of tempRepos.splice(0)) {
      rmSync(repo, { force: true, recursive: true });
    }
  });

  it("passes for production packages with README, API docs, tests, scripts, and public API snapshot evidence", () => {
    const repo = createTempRepo();
    writePackage(repo, "stable");
    writeGeneratedApiDocs(repo, "stable");
    writeCatalogMetadata(repo, ["stable"], { productionPackages: ["stable"] });
    writeDocsBaseline(repo);
    writePublicApiSnapshot(repo, ["@croco/stable"]);
    writeTurboSummaries(repo, ["@croco/stable"]);

    const report = createReport(repo, { requireTaskSummaries: true });

    expect(hasProductionReadyFailures(report)).toBe(false);
    expect(buildProductionReadyMarkdown(report)).toContain("| `@croco/stable` | Core | pass:");
  });

  it("fails when a production package is missing README evidence", () => {
    const repo = createTempRepo();
    writePackage(repo, "stable", { readme: false });
    writeGeneratedApiDocs(repo, "stable");
    writeCatalogMetadata(repo, ["stable"], { productionPackages: ["stable"] });
    writeDocsBaseline(repo);
    writePublicApiSnapshot(repo, ["@croco/stable"]);

    const report = createReport(repo);
    const markdown = buildProductionReadyMarkdown(report);

    expect(hasProductionReadyFailures(report)).toBe(true);
    expect(markdown).toContain("packages/stable/README.md is missing");
  });

  it("fails when a production package is missing API docs without a temporary exception", () => {
    const repo = createTempRepo();
    writePackage(repo, "stable");
    writeCatalogMetadata(repo, ["stable"], { productionPackages: ["stable"] });
    writeDocsBaseline(repo);
    writePublicApiSnapshot(repo, ["@croco/stable"]);

    const report = createReport(repo);
    const markdown = buildProductionReadyMarkdown(report);

    expect(hasProductionReadyFailures(report)).toBe(true);
    expect(markdown).toContain("packages/docs/src/content/docs/api/stable is missing");
  });

  it("allows a production package missing API docs only with a temporary justified exception", () => {
    const repo = createTempRepo();
    writePackage(repo, "stable");
    writeCatalogMetadata(repo, ["stable"], { productionPackages: ["stable"] });
    writeDocsBaseline(repo, {
      temporaryProductionApiDocExceptions: {
        stable: "TypeDoc generation is blocked by a short-lived upstream parser issue.",
      },
    });
    writePublicApiSnapshot(repo, ["@croco/stable"]);

    const report = createReport(repo);
    const markdown = buildProductionReadyMarkdown(report);

    expect(hasProductionReadyFailures(report)).toBe(false);
    expect(markdown).toContain("temporary production API-docs exception");
  });

  it("fails when a temporary production API docs exception is stale", () => {
    const repo = createTempRepo();
    writePackage(repo, "stable");
    writeGeneratedApiDocs(repo, "stable");
    writeCatalogMetadata(repo, ["stable"], { productionPackages: ["stable"] });
    writeDocsBaseline(repo, {
      temporaryProductionApiDocExceptions: {
        stable: "TypeDoc generation is blocked by a short-lived upstream parser issue.",
      },
    });
    writePublicApiSnapshot(repo, ["@croco/stable"]);

    const report = createReport(repo);
    const markdown = buildProductionReadyMarkdown(report);

    expect(hasProductionReadyFailures(report)).toBe(true);
    expect(markdown).toContain("temporaryProductionApiDocExceptions still contains stable");
  });

  it("fails when a production package is missing package tests", () => {
    const repo = createTempRepo();
    writePackage(repo, "stable", { tests: false });
    writeGeneratedApiDocs(repo, "stable");
    writeCatalogMetadata(repo, ["stable"], { productionPackages: ["stable"] });
    writeDocsBaseline(repo);
    writePublicApiSnapshot(repo, ["@croco/stable"]);

    const report = createReport(repo);
    const markdown = buildProductionReadyMarkdown(report);

    expect(hasProductionReadyFailures(report)).toBe(true);
    expect(markdown).toContain("packages/stable/src/tests and src/__tests__ are missing");
  });

  it("reports non-production package gaps without failing the production-ready gate", () => {
    const repo = createTempRepo();
    writePackage(repo, "stable");
    writeGeneratedApiDocs(repo, "stable");
    writePackage(repo, "beta", { readme: false, tests: false });
    writeCatalogMetadata(repo, ["stable", "beta"], { productionPackages: ["stable"] });
    writeDocsBaseline(repo);
    writePublicApiSnapshot(repo, ["@croco/stable", "@croco/beta"]);

    const report = createReport(repo);
    const markdown = buildProductionReadyMarkdown(report);

    expect(hasProductionReadyFailures(report)).toBe(false);
    expect(markdown).toContain("Non-production packages are reported for visibility");
    expect(markdown).toContain("| beta | 1 | 1 | 1 | 1 |");
  });

  it("fails CI-level task reporting when required Turbo summaries are missing", () => {
    const repo = createTempRepo();
    writePackage(repo, "stable");
    writeGeneratedApiDocs(repo, "stable");
    writeCatalogMetadata(repo, ["stable"], { productionPackages: ["stable"] });
    writeDocsBaseline(repo);
    writePublicApiSnapshot(repo, ["@croco/stable"]);

    const report = createReport(repo, { requireTaskSummaries: true });
    const markdown = buildProductionReadyMarkdown(report);

    expect(hasProductionReadyFailures(report)).toBe(true);
    expect(markdown).toContain("build status is not-collected");
  });

  it("requires adapter and provider maturity evidence in reference docs for production packages", () => {
    const repo = createTempRepo();
    writePackage(repo, "provider");
    writeGeneratedApiDocs(repo, "provider");
    writeCatalogMetadata(repo, ["provider"], {
      extensionGroups: ["Provider"],
      groupName: "Provider",
      productionPackages: ["provider"],
    });
    writeDocsBaseline(repo);
    writePublicApiSnapshot(repo, ["@croco/provider"]);

    const report = createReport(repo);
    const markdown = buildProductionReadyMarkdown(report);

    expect(hasProductionReadyFailures(report)).toBe(true);
    expect(markdown).toContain("missing @croco/provider reference");
  });

  it("writes the production-ready markdown report artifact", () => {
    const repo = createTempRepo();
    writePackage(repo, "stable");
    writeGeneratedApiDocs(repo, "stable");
    writeCatalogMetadata(repo, ["stable"], { productionPackages: ["stable"] });
    writeDocsBaseline(repo);
    writePublicApiSnapshot(repo, ["@croco/stable"]);

    const report = createReport(repo);
    const markdownPath = writeProductionReadyReport(
      report,
      join(repo, "ci-reports", "package-quality"),
    );
    const markdown = readFileSync(markdownPath, "utf-8");

    expect(markdownPath).toBe(join(repo, "ci-reports", "package-quality", "production-ready.md"));
    expect(markdown).toContain("# Production-Ready Package Gate");
  });
});

function createReport(repo: string, options: { readonly requireTaskSummaries?: boolean } = {}) {
  return createProductionReadyReport({
    generatedAt: "2026-01-01T00:00:00.000Z",
    requireTaskSummaries: options.requireTaskSummaries ?? false,
    rootDir: repo,
    summaryDir: join(repo, ".turbo", "runs"),
  });
}

function createTempRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), "croco-production-ready-"));
  tempRepos.push(repo);
  mkdirSync(join(repo, "packages"), { recursive: true });
  mkdirSync(join(repo, ".turbo", "runs"), { recursive: true });
  writeReferenceDocs(repo);
  return repo;
}

function writePackage(
  repo: string,
  dirName: string,
  options: {
    readonly readme?: boolean;
    readonly scripts?: Record<string, string>;
    readonly tests?: boolean;
  } = {},
): void {
  const packageDir = join(repo, "packages", dirName);
  mkdirSync(join(packageDir, "src"), { recursive: true });
  writeFile(
    repo,
    `packages/${dirName}/src/index.ts`,
    "export const fixture = true;\nexport type Fixture = { readonly value: string };\n",
  );

  if (options.readme !== false) {
    writeFile(repo, `packages/${dirName}/README.md`, `# @croco/${dirName}\n\nFixture package.\n`);
  }

  if (options.tests !== false) {
    mkdirSync(join(packageDir, "src", "tests"), { recursive: true });
  }

  writeJson(join(packageDir, "package.json"), {
    name: `@croco/${dirName}`,
    scripts: options.scripts ?? {
      build: "tsup",
      test: "vitest run",
      typecheck: "tsc --noEmit",
    },
  });
}

function writeGeneratedApiDocs(repo: string, dirName: string): void {
  mkdirSync(join(repo, "packages", "docs", "src", "content", "docs", "api", dirName), {
    recursive: true,
  });
}

function writeCatalogMetadata(
  repo: string,
  packageNames: readonly string[],
  options: {
    readonly extensionGroups?: readonly string[];
    readonly groupName?: string;
    readonly productionPackages?: readonly string[];
  } = {},
): void {
  const groupName = options.groupName ?? "Core";
  const productionPackages = options.productionPackages ?? [];
  const productionSet = new Set(productionPackages);

  writeJson(join(repo, "docs", "package-catalog.json"), {
    schemaVersion: 1,
    groups: {
      [groupName]: {
        description: "Fixture packages",
        packages: packageNames,
      },
    },
    maturity: {
      production: {
        label: "production-ready",
        packages: productionPackages,
      },
      beta: {
        label: "beta",
        packages: packageNames.filter((packageName) => !productionSet.has(packageName)),
      },
      alpha: {
        label: "alpha",
        packages: [],
      },
      deprecated: {
        label: "deprecated",
        packages: [],
      },
    },
    extensionMatrix: {
      groups: options.extensionGroups ?? [],
      packages: {},
    },
  });
}

function writeDocsBaseline(
  repo: string,
  options: { readonly temporaryProductionApiDocExceptions?: Record<string, string> } = {},
): void {
  writeJson(join(repo, "docs", "package-docs-baseline.json"), {
    schemaVersion: 1,
    allowedMissingReadme: [],
    allowedMissingApiDocs: [],
    allowedMissingTests: [],
    temporaryProductionApiDocExceptions: options.temporaryProductionApiDocExceptions ?? {},
  });
}

function writePublicApiSnapshot(repo: string, packageNames: readonly string[]): void {
  writeJson(join(repo, "public-api-surface.snapshot.json"), {
    schemaVersion: 1,
    packages: packageNames.map((packageName) => ({
      packageName,
      relativeDir: `packages/${packageName.replace(/^@croco\//, "")}`,
      entrypoint: `packages/${packageName.replace(/^@croco\//, "")}/src/index.ts`,
      runtimeExports: [],
      typeExports: [],
    })),
  });
}

function writeTurboSummaries(repo: string, packageNames: readonly string[]): void {
  for (const taskName of ["build", "typecheck", "test"]) {
    writeJson(join(repo, ".turbo", "runs", `${taskName}.json`), {
      execution: {
        command: `turbo run ${taskName} --summarize`,
        endTime: taskName === "build" ? 100 : taskName === "typecheck" ? 200 : 300,
        exitCode: 0,
      },
      tasks: packageNames.map((packageName) => ({
        taskId: `${packageName}#${taskName}`,
        task: taskName,
        package: packageName,
        directory: `packages/${packageName.replace(/^@croco\//, "")}`,
        execution: {
          exitCode: 0,
        },
        cache: {
          status: "MISS",
        },
      })),
    });
  }
}

function writeReferenceDocs(repo: string): void {
  const referenceRoot = join(repo, "packages", "docs", "src", "content", "docs", "en", "reference");
  writeFile(
    repo,
    "packages/docs/src/content/docs/en/reference/adapter-ecosystem.md",
    "# Adapter Ecosystem\n\nEvidence for other adapters.\n",
  );
  writeFile(
    repo,
    "packages/docs/src/content/docs/en/reference/extension-matrix.md",
    "# Extension Matrix\n\nEvidence for other adapters.\n",
  );
  writeFile(
    repo,
    "packages/docs/src/content/docs/en/reference/presentation-runtime-support.md",
    "# Presentation Runtime Support\n\nEvidence for other adapters.\n",
  );
  writeFile(
    repo,
    "packages/docs/src/content/docs/en/reference/provider-maturity.md",
    "# Provider Maturity\n\nEvidence for other adapters.\n",
  );
  mkdirSync(referenceRoot, { recursive: true });
}

function writeFile(repo: string, relativePath: string, content: string): void {
  const filePath = join(repo, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

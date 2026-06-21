#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { argv, exit } from "node:process";
import { pathToFileURL } from "node:url";

import {
  createPackageQualityReport,
  readPackages,
  type PackageQualityRow,
  type QualityTask,
} from "./package-quality-report.mts";

type CheckStatus = "pass" | "fail" | "not-applicable" | "not-collected";
type MaturityKey = (typeof maturityOrder)[number];

type Options = {
  readonly rootDir: string;
  readonly outputDir: string;
  readonly summaryDir: string;
  readonly requireTaskSummaries: boolean;
};

type WorkspacePackage = {
  readonly name: string;
  readonly shortName: string;
  readonly relativeDir: string;
  readonly scripts: Readonly<Record<string, string>>;
  readonly group: string;
  readonly maturity: MaturityKey;
  readonly hasApiDocs: boolean;
  readonly hasEntrypoint: boolean;
  readonly hasReadme: boolean;
  readonly hasTests: boolean;
};

type CatalogEvidence = {
  readonly errors: readonly string[];
  readonly extensionGroups: ReadonlySet<string>;
  readonly extensionPackages: ReadonlySet<string>;
  readonly groupByPackage: ReadonlyMap<string, string>;
  readonly maturityByPackage: ReadonlyMap<string, MaturityKey>;
  readonly productionPackages: readonly string[];
};

type BaselineEvidence = {
  readonly errors: readonly string[];
  readonly temporaryProductionApiDocExceptions: ReadonlyMap<string, string>;
};

type PublicApiSnapshotEvidence = {
  readonly errors: readonly string[];
  readonly missingSnapshot: boolean;
  readonly packageNames: ReadonlySet<string>;
};

export type ProductionReadyCheck = {
  readonly id: string;
  readonly label: string;
  readonly status: CheckStatus;
  readonly evidence: string;
  readonly recovery: string | null;
};

export type ProductionReadyPackageRow = {
  readonly packageName: string;
  readonly relativeDir: string;
  readonly group: string;
  readonly checks: readonly ProductionReadyCheck[];
};

export type NonProductionSummary = {
  readonly maturity: MaturityKey;
  readonly packageCount: number;
  readonly missingApiDocs: number;
  readonly missingReadme: number;
  readonly missingTests: number;
};

export type ProductionReadyReport = {
  readonly generatedAt: string;
  readonly rootDir: string;
  readonly summaryDir: string;
  readonly requireTaskSummaries: boolean;
  readonly catalogErrors: readonly string[];
  readonly productionRows: readonly ProductionReadyPackageRow[];
  readonly nonProduction: readonly NonProductionSummary[];
};

const reportDirectory = join("ci-reports", "package-quality");
const reportFileName = "production-ready.md";
const turboRunsDirectory = join(".turbo", "runs");
const catalogMetadataPath = join("docs", "package-catalog.json");
const docsBaselinePath = join("docs", "package-docs-baseline.json");
const publicApiSnapshotPath = "public-api-surface.snapshot.json";
const apiDocsRoot = join("packages", "docs", "src", "content", "docs", "api");
const referenceDocsRoot = join("packages", "docs", "src", "content", "docs", "en", "reference");
const maturityOrder = ["production", "beta", "alpha", "deprecated"] as const;
const qualityTasks = ["build", "typecheck", "test"] as const satisfies readonly QualityTask[];
const extensionEvidenceDocsByGroup: Readonly<Record<string, readonly string[]>> = {
  Integration: [
    join(referenceDocsRoot, "adapter-ecosystem.md"),
    join(referenceDocsRoot, "extension-matrix.md"),
  ],
  Presentation: [
    join(referenceDocsRoot, "presentation-runtime-support.md"),
    join(referenceDocsRoot, "extension-matrix.md"),
  ],
  Provider: [
    join(referenceDocsRoot, "adapter-ecosystem.md"),
    join(referenceDocsRoot, "provider-maturity.md"),
    join(referenceDocsRoot, "extension-matrix.md"),
  ],
  Transport: [
    join(referenceDocsRoot, "adapter-ecosystem.md"),
    join(referenceDocsRoot, "extension-matrix.md"),
  ],
};

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function toShortPackageName(packageName: string): string {
  return packageName.replace(/^@croco\//, "");
}

function toPosixPath(path: string): string {
  return path.split("\\").join("/");
}

function readJsonFile(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf-8")) as unknown;
}

function parseCatalogGroups(groupsValue: unknown, errors: string[]): ReadonlyMap<string, string> {
  const groupByPackage = new Map<string, string>();

  if (!isRecord(groupsValue)) {
    errors.push(`${catalogMetadataPath}: groups must be an object`);
    return groupByPackage;
  }

  for (const [groupName, groupValue] of Object.entries(groupsValue)) {
    if (!isRecord(groupValue)) {
      errors.push(`${catalogMetadataPath}: groups.${groupName} must be an object`);
      continue;
    }

    if (!isStringArray(groupValue.packages)) {
      errors.push(`${catalogMetadataPath}: groups.${groupName}.packages must be a string array`);
      continue;
    }

    for (const packageName of groupValue.packages) {
      const previousGroup = groupByPackage.get(packageName);
      if (previousGroup) {
        errors.push(
          `${catalogMetadataPath}: package ${packageName} appears in multiple groups (${previousGroup}, ${groupName})`,
        );
        continue;
      }
      groupByPackage.set(packageName, groupName);
    }
  }

  return groupByPackage;
}

function readMaturityPackages(
  maturityValue: unknown,
  maturity: MaturityKey,
  errors: string[],
): readonly string[] {
  if (!isRecord(maturityValue)) {
    errors.push(`${catalogMetadataPath}: maturity.${maturity} must be an object`);
    return [];
  }

  if (!isStringArray(maturityValue.packages)) {
    errors.push(`${catalogMetadataPath}: maturity.${maturity}.packages must be a string array`);
    return [];
  }

  return maturityValue.packages;
}

function parseCatalogMaturity(
  maturityRoot: unknown,
  errors: string[],
): {
  readonly maturityByPackage: ReadonlyMap<string, MaturityKey>;
  readonly productionPackages: readonly string[];
} {
  const maturityByPackage = new Map<string, MaturityKey>();
  let productionPackages: readonly string[] = [];

  if (!isRecord(maturityRoot)) {
    errors.push(`${catalogMetadataPath}: maturity must be an object`);
    return { maturityByPackage, productionPackages };
  }

  for (const maturity of maturityOrder) {
    const packageNames = readMaturityPackages(maturityRoot[maturity], maturity, errors);
    if (maturity === "production") {
      productionPackages = packageNames;
    }

    for (const packageName of packageNames) {
      const previousMaturity = maturityByPackage.get(packageName);
      if (previousMaturity) {
        errors.push(
          `${catalogMetadataPath}: package ${packageName} appears in multiple maturity buckets (${previousMaturity}, ${maturity})`,
        );
        continue;
      }
      maturityByPackage.set(packageName, maturity);
    }
  }

  return { maturityByPackage, productionPackages };
}

function parseExtensionEvidence(extensionMatrix: unknown): {
  readonly extensionGroups: ReadonlySet<string>;
  readonly extensionPackages: ReadonlySet<string>;
} {
  if (!isRecord(extensionMatrix)) {
    return {
      extensionGroups: new Set(),
      extensionPackages: new Set(),
    };
  }

  const extensionGroups = isStringArray(extensionMatrix.groups)
    ? new Set(extensionMatrix.groups)
    : new Set<string>();
  const extensionPackages = isRecord(extensionMatrix.packages)
    ? new Set(Object.keys(extensionMatrix.packages))
    : new Set<string>();

  return {
    extensionGroups,
    extensionPackages,
  };
}

function loadCatalogEvidence(rootDir: string): CatalogEvidence {
  const errors: string[] = [];
  const catalog = readJsonFile(join(rootDir, catalogMetadataPath));

  if (!isRecord(catalog)) {
    return {
      errors: [`${catalogMetadataPath}: must contain an object`],
      extensionGroups: new Set(),
      extensionPackages: new Set(),
      groupByPackage: new Map(),
      maturityByPackage: new Map(),
      productionPackages: [],
    };
  }

  const groupByPackage = parseCatalogGroups(catalog.groups, errors);
  const maturity = parseCatalogMaturity(catalog.maturity, errors);
  const extension = parseExtensionEvidence(catalog.extensionMatrix);

  return {
    errors,
    extensionGroups: extension.extensionGroups,
    extensionPackages: extension.extensionPackages,
    groupByPackage,
    maturityByPackage: maturity.maturityByPackage,
    productionPackages: maturity.productionPackages,
  };
}

function loadBaselineEvidence(
  rootDir: string,
  productionPackageNames: ReadonlySet<string>,
  actualPackageNames: ReadonlySet<string>,
): BaselineEvidence {
  const errors: string[] = [];
  const baseline = readJsonFile(join(rootDir, docsBaselinePath));
  const value = isRecord(baseline) ? baseline.temporaryProductionApiDocExceptions : undefined;

  if (value === undefined) {
    return {
      errors,
      temporaryProductionApiDocExceptions: new Map(),
    };
  }

  if (!isRecord(value)) {
    return {
      errors: [
        `${docsBaselinePath}: temporaryProductionApiDocExceptions must be an object mapping production package names to non-empty justification strings`,
      ],
      temporaryProductionApiDocExceptions: new Map(),
    };
  }

  const exceptions = new Map<string, string>();
  for (const [packageName, reason] of Object.entries(value)) {
    if (!actualPackageNames.has(packageName)) {
      errors.push(
        `${docsBaselinePath}: temporaryProductionApiDocExceptions references missing package ${packageName}`,
      );
      continue;
    }

    if (!productionPackageNames.has(packageName)) {
      errors.push(
        `${docsBaselinePath}: temporaryProductionApiDocExceptions.${packageName} is only valid for production-ready packages`,
      );
      continue;
    }

    if (typeof reason !== "string" || reason.trim().length === 0) {
      errors.push(
        `${docsBaselinePath}: temporaryProductionApiDocExceptions.${packageName} must include a non-empty justification`,
      );
      continue;
    }

    exceptions.set(packageName, reason.trim());
  }

  return {
    errors,
    temporaryProductionApiDocExceptions: exceptions,
  };
}

function loadPublicApiSnapshotEvidence(rootDir: string): PublicApiSnapshotEvidence {
  const snapshotPath = join(rootDir, publicApiSnapshotPath);
  if (!existsSync(snapshotPath)) {
    return {
      errors: [],
      missingSnapshot: true,
      packageNames: new Set(),
    };
  }

  const snapshot = readJsonFile(snapshotPath);
  if (!isRecord(snapshot) || !Array.isArray(snapshot.packages)) {
    return {
      errors: [`${publicApiSnapshotPath}: packages must be an array`],
      missingSnapshot: false,
      packageNames: new Set(),
    };
  }

  const errors: string[] = [];
  const packageNames = new Set<string>();
  for (const [index, value] of snapshot.packages.entries()) {
    if (!isRecord(value) || typeof value.packageName !== "string") {
      errors.push(`${publicApiSnapshotPath}: packages[${index}].packageName must be a string`);
      continue;
    }
    packageNames.add(value.packageName);
  }

  return {
    errors,
    missingSnapshot: false,
    packageNames,
  };
}

function toWorkspacePackage(
  rootDir: string,
  groupByPackage: ReadonlyMap<string, string>,
  maturityByPackage: ReadonlyMap<string, MaturityKey>,
  packageInfo: ReturnType<typeof readPackages>[number],
): WorkspacePackage {
  const shortName = toShortPackageName(packageInfo.name);
  const packageRoot = join(rootDir, packageInfo.relativeDir);

  return {
    name: packageInfo.name,
    shortName,
    relativeDir: packageInfo.relativeDir,
    scripts: packageInfo.scripts,
    group: groupByPackage.get(shortName) ?? "Unassigned",
    maturity: maturityByPackage.get(shortName) ?? "alpha",
    hasApiDocs: existsSync(join(rootDir, apiDocsRoot, shortName)),
    hasEntrypoint: existsSync(join(packageRoot, "src", "index.ts")),
    hasReadme: existsSync(join(packageRoot, "README.md")),
    hasTests:
      existsSync(join(packageRoot, "src", "tests")) ||
      existsSync(join(packageRoot, "src", "__tests__")),
  };
}

function pass(id: string, label: string, evidence: string): ProductionReadyCheck {
  return { id, label, status: "pass", evidence, recovery: null };
}

function fail(id: string, label: string, evidence: string, recovery: string): ProductionReadyCheck {
  return { id, label, status: "fail", evidence, recovery };
}

function notApplicable(id: string, label: string, evidence: string): ProductionReadyCheck {
  return { id, label, status: "not-applicable", evidence, recovery: null };
}

function notCollected(
  id: string,
  label: string,
  evidence: string,
  recovery: string,
): ProductionReadyCheck {
  return { id, label, status: "not-collected", evidence, recovery };
}

function createReadmeCheck(pkg: WorkspacePackage): ProductionReadyCheck {
  if (pkg.hasReadme) {
    return pass("readme", "README", `${pkg.relativeDir}/README.md exists`);
  }

  return fail(
    "readme",
    "README",
    `${pkg.relativeDir}/README.md is missing`,
    `Add ${pkg.relativeDir}/README.md before marking the package production-ready.`,
  );
}

function createApiDocsCheck(
  pkg: WorkspacePackage,
  temporaryExceptions: ReadonlyMap<string, string>,
): ProductionReadyCheck {
  const temporaryReason = temporaryExceptions.get(pkg.shortName);
  if (pkg.hasApiDocs && temporaryReason) {
    return fail(
      "api-docs",
      "API docs",
      `${apiDocsRoot}/${pkg.shortName} exists but temporaryProductionApiDocExceptions still contains ${pkg.shortName}`,
      `Remove ${pkg.shortName} from docs/package-docs-baseline.json temporaryProductionApiDocExceptions.`,
    );
  }

  if (pkg.hasApiDocs) {
    return pass("api-docs", "API docs", `${apiDocsRoot}/${pkg.shortName} exists`);
  }

  if (temporaryReason) {
    return pass(
      "api-docs",
      "API docs",
      `temporary production API-docs exception: ${temporaryReason}`,
    );
  }

  return fail(
    "api-docs",
    "API docs",
    `${apiDocsRoot}/${pkg.shortName} is missing`,
    `Generate ${apiDocsRoot}/${pkg.shortName} or add a short-lived justified temporaryProductionApiDocExceptions entry.`,
  );
}

function createTestsCheck(pkg: WorkspacePackage): ProductionReadyCheck {
  if (pkg.hasTests) {
    return pass("tests", "Tests", `${pkg.relativeDir}/src/tests or src/__tests__ exists`);
  }

  return fail(
    "tests",
    "Tests",
    `${pkg.relativeDir}/src/tests and src/__tests__ are missing`,
    `Add focused package tests under ${pkg.relativeDir}/src/tests before production-ready promotion.`,
  );
}

function createTaskCheck(
  pkg: WorkspacePackage,
  row: PackageQualityRow | undefined,
  task: QualityTask,
  requireTaskSummaries: boolean,
): ProductionReadyCheck {
  const id = `${task}-report`;
  const label = `${task} report`;

  if (!pkg.scripts[task]) {
    return fail(
      id,
      label,
      `${pkg.relativeDir}/package.json has no ${task} script`,
      `Add a ${task} script or keep the package out of production-ready maturity.`,
    );
  }

  const result = row?.tasks[task];
  if (!result) {
    return fail(
      id,
      label,
      "package quality row is missing",
      "Run the package quality report after workspace package discovery succeeds.",
    );
  }

  if (result.status === "pass") {
    return pass(id, label, result.taskId ? `${result.taskId} passed` : `${task} passed`);
  }

  if (result.status === "fail") {
    const log = result.logFile ? `; log: ${result.logFile}` : "";
    return fail(id, label, `${task} failed${log}`, `Fix the ${task} failure for ${pkg.name}.`);
  }

  if (requireTaskSummaries) {
    return fail(
      id,
      label,
      `${task} status is ${result.status}`,
      `Run pnpm turbo run ${task} --summarize before the production-ready gate.`,
    );
  }

  return notCollected(
    id,
    label,
    `${task} status is ${result.status}; local report does not require Turbo summaries`,
    `Run pnpm turbo run ${task} --summarize for CI-level package task evidence.`,
  );
}

function createPublicApiCheck(
  pkg: WorkspacePackage,
  snapshot: PublicApiSnapshotEvidence,
): ProductionReadyCheck {
  if (!pkg.hasEntrypoint) {
    return notApplicable(
      "public-api-snapshot",
      "Public API snapshot",
      `${pkg.relativeDir}/src/index.ts is absent`,
    );
  }

  if (snapshot.missingSnapshot) {
    return fail(
      "public-api-snapshot",
      "Public API snapshot",
      `${publicApiSnapshotPath} is missing`,
      "Run pnpm public-api:write and commit the generated snapshot.",
    );
  }

  if (snapshot.packageNames.has(pkg.name)) {
    return pass("public-api-snapshot", "Public API snapshot", `${pkg.name} is listed`);
  }

  return fail(
    "public-api-snapshot",
    "Public API snapshot",
    `${pkg.name} is missing from ${publicApiSnapshotPath}`,
    "Run pnpm public-api:write and review the generated snapshot before promotion.",
  );
}

function docsMentionPackage(rootDir: string, docsPath: string, pkg: WorkspacePackage): boolean {
  const absolutePath = join(rootDir, docsPath);
  if (!existsSync(absolutePath)) {
    return false;
  }

  const content = readFileSync(absolutePath, "utf-8");
  return content.includes(pkg.name) || content.includes(pkg.shortName);
}

function requiredEvidenceDocs(pkg: WorkspacePackage, catalog: CatalogEvidence): readonly string[] {
  const docsForGroup = extensionEvidenceDocsByGroup[pkg.group] ?? [];
  if (docsForGroup.length > 0) {
    return docsForGroup;
  }

  if (catalog.extensionGroups.has(pkg.group) || catalog.extensionPackages.has(pkg.shortName)) {
    return [join(referenceDocsRoot, "extension-matrix.md")];
  }

  return [];
}

function createMaturityEvidenceCheck(
  rootDir: string,
  pkg: WorkspacePackage,
  catalog: CatalogEvidence,
): ProductionReadyCheck {
  const docsPaths = requiredEvidenceDocs(pkg, catalog);
  if (docsPaths.length === 0) {
    return notApplicable(
      "maturity-evidence",
      "Maturity evidence",
      `${pkg.group} packages do not require adapter/presentation/provider reference evidence`,
    );
  }

  const missingDocs = docsPaths.filter((docsPath) => !docsMentionPackage(rootDir, docsPath, pkg));
  if (missingDocs.length === 0) {
    return pass(
      "maturity-evidence",
      "Maturity evidence",
      `linked from ${docsPaths.map((docsPath) => `\`${docsPath}\``).join(", ")}`,
    );
  }

  return fail(
    "maturity-evidence",
    "Maturity evidence",
    `missing ${pkg.name} reference in ${missingDocs.join(", ")}`,
    "Link the production-ready evidence from the relevant reference docs before promotion.",
  );
}

function createProductionRow(
  rootDir: string,
  pkg: WorkspacePackage,
  qualityRow: PackageQualityRow | undefined,
  catalog: CatalogEvidence,
  baseline: BaselineEvidence,
  snapshot: PublicApiSnapshotEvidence,
  requireTaskSummaries: boolean,
): ProductionReadyPackageRow {
  return {
    packageName: pkg.name,
    relativeDir: pkg.relativeDir,
    group: pkg.group,
    checks: [
      createReadmeCheck(pkg),
      createApiDocsCheck(pkg, baseline.temporaryProductionApiDocExceptions),
      createTestsCheck(pkg),
      ...qualityTasks.map((task) => createTaskCheck(pkg, qualityRow, task, requireTaskSummaries)),
      createPublicApiCheck(pkg, snapshot),
      createMaturityEvidenceCheck(rootDir, pkg, catalog),
    ],
  };
}

function createNonProductionSummary(
  packages: readonly WorkspacePackage[],
): readonly NonProductionSummary[] {
  return maturityOrder
    .filter((maturity) => maturity !== "production")
    .map((maturity) => {
      const matchingPackages = packages.filter((pkg) => pkg.maturity === maturity);

      return {
        maturity,
        packageCount: matchingPackages.length,
        missingApiDocs: matchingPackages.filter((pkg) => !pkg.hasApiDocs).length,
        missingReadme: matchingPackages.filter((pkg) => !pkg.hasReadme).length,
        missingTests: matchingPackages.filter((pkg) => !pkg.hasTests).length,
      };
    });
}

export function createProductionReadyReport(
  options: Pick<Options, "rootDir" | "summaryDir" | "requireTaskSummaries"> & {
    readonly generatedAt?: string;
  },
): ProductionReadyReport {
  const catalog = loadCatalogEvidence(options.rootDir);
  const packages = readPackages(options.rootDir)
    .filter((pkg) => !pkg.private && pkg.name.startsWith("@croco/"))
    .map((pkg) =>
      toWorkspacePackage(options.rootDir, catalog.groupByPackage, catalog.maturityByPackage, pkg),
    );
  const packageByShortName = new Map(packages.map((pkg) => [pkg.shortName, pkg]));
  const actualPackageNames = new Set(packages.map((pkg) => pkg.shortName));
  const productionPackageNames = new Set(catalog.productionPackages);
  const baseline = loadBaselineEvidence(
    options.rootDir,
    productionPackageNames,
    actualPackageNames,
  );
  const snapshot = loadPublicApiSnapshotEvidence(options.rootDir);
  const qualityReport = createPackageQualityReport({
    rootDir: options.rootDir,
    summaryDir: options.summaryDir,
  });
  const qualityRowsByPackage = new Map(
    qualityReport.rows.map((row) => [row.packageName, row] as const),
  );
  const missingProductionPackages = catalog.productionPackages.filter(
    (packageName) => !packageByShortName.has(packageName),
  );
  const catalogErrors = [
    ...catalog.errors,
    ...baseline.errors,
    ...snapshot.errors,
    ...missingProductionPackages.map(
      (packageName) =>
        `${catalogMetadataPath}: maturity.production references missing package ${packageName}`,
    ),
  ];

  return {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    rootDir: options.rootDir,
    summaryDir: options.summaryDir,
    requireTaskSummaries: options.requireTaskSummaries,
    catalogErrors,
    productionRows: catalog.productionPackages.flatMap((packageName) => {
      const pkg = packageByShortName.get(packageName);
      if (!pkg) {
        return [];
      }

      return [
        createProductionRow(
          options.rootDir,
          pkg,
          qualityRowsByPackage.get(pkg.name),
          catalog,
          baseline,
          snapshot,
          options.requireTaskSummaries,
        ),
      ];
    }),
    nonProduction: createNonProductionSummary(
      packages.filter((pkg) => pkg.maturity !== "production"),
    ),
  };
}

function formatTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

function formatCheckCell(check: ProductionReadyCheck): string {
  const recovery = check.recovery ? `<br>Recovery: ${check.recovery}` : "";
  return formatTableCell(`${check.status}: ${check.evidence}${recovery}`);
}

function formatSummaryCheck(row: ProductionReadyPackageRow, id: string): string {
  const check = row.checks.find((candidate) => candidate.id === id);
  return check ? formatCheckCell(check) : "missing check";
}

export function countProductionReadyFailures(report: ProductionReadyReport): number {
  const packageFailures = report.productionRows.reduce(
    (count, row) => count + row.checks.filter((check) => check.status === "fail").length,
    0,
  );

  return report.catalogErrors.length + packageFailures;
}

export function hasProductionReadyFailures(report: ProductionReadyReport): boolean {
  return countProductionReadyFailures(report) > 0;
}

export function buildProductionReadyMarkdown(report: ProductionReadyReport): string {
  const failureCount = countProductionReadyFailures(report);
  const lines = [
    "# Production-Ready Package Gate",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Root: \`${toPosixPath(report.rootDir)}\``,
    `- Turbo summary directory: \`${toPosixPath(relative(report.rootDir, report.summaryDir))}\``,
    `- Task summaries required: ${report.requireTaskSummaries ? "yes" : "no"}`,
    `- Production-ready packages: ${report.productionRows.length}`,
    `- Blocking failures: ${failureCount}`,
    "",
    "## Catalog and baseline errors",
    "",
    ...(report.catalogErrors.length > 0
      ? report.catalogErrors.map((error) => `- ${error}`)
      : ["- none"]),
    "",
    "## Production package evidence",
    "",
    "| Package | Group | README | API docs | Tests | Build | Typecheck | Test | Public API | Maturity evidence |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...report.productionRows.map(
      (row) =>
        `| \`${row.packageName}\` | ${formatTableCell(row.group)} | ${formatSummaryCheck(row, "readme")} | ${formatSummaryCheck(row, "api-docs")} | ${formatSummaryCheck(row, "tests")} | ${formatSummaryCheck(row, "build-report")} | ${formatSummaryCheck(row, "typecheck-report")} | ${formatSummaryCheck(row, "test-report")} | ${formatSummaryCheck(row, "public-api-snapshot")} | ${formatSummaryCheck(row, "maturity-evidence")} |`,
    ),
    "",
    "## Non-production package summary",
    "",
    "Non-production packages are reported for visibility but do not fail this production-ready gate.",
    "",
    "| Maturity | Packages | Missing README | Missing API docs | Missing tests |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...report.nonProduction.map(
      (row) =>
        `| ${row.maturity} | ${row.packageCount} | ${row.missingReadme} | ${row.missingApiDocs} | ${row.missingTests} |`,
    ),
    "",
    "## Recovery",
    "",
    "- Add `packages/<name>/README.md` for production packages missing README evidence.",
    "- Generate `packages/docs/src/content/docs/api/<name>/` for production packages missing API docs.",
    "- Use `docs/package-docs-baseline.json` `temporaryProductionApiDocExceptions` only for a production package that currently lacks generated API docs, and include a short-lived justification. Stale entries fail this gate.",
    "- Add focused tests under `src/tests` or `src/__tests__` for production packages missing package test evidence.",
    "- Keep production package `build`, `typecheck`, and `test` scripts wired into Turbo summaries before CI runs this gate with required task summaries.",
    "- Run `pnpm public-api:write` when a publishable package entrypoint is intentionally added to the public API snapshot.",
    "- Link adapter, provider, integration, transport, or presentation production evidence from the relevant reference docs before promotion.",
  ];

  return `${lines.join("\n")}\n`;
}

export function writeProductionReadyReport(
  report: ProductionReadyReport,
  outputDir: string,
): string {
  mkdirSync(outputDir, { recursive: true });
  const markdownPath = join(outputDir, reportFileName);
  writeFileSync(markdownPath, buildProductionReadyMarkdown(report));
  return markdownPath;
}

export function parseArgs(args: readonly string[]): Options {
  let rootDir = process.cwd();
  let outputDir = join(rootDir, reportDirectory);
  let summaryDir = join(rootDir, turboRunsDirectory);
  let requireTaskSummaries = false;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];

    if (arg === "--") {
      continue;
    }

    if (arg === "--root") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--root requires a path");
      }
      rootDir = resolve(value);
      outputDir = join(rootDir, reportDirectory);
      summaryDir = join(rootDir, turboRunsDirectory);
      index++;
      continue;
    }

    if (arg === "--output-dir") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--output-dir requires a path");
      }
      outputDir = resolve(value);
      index++;
      continue;
    }

    if (arg === "--summary-dir") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--summary-dir requires a path");
      }
      summaryDir = resolve(value);
      index++;
      continue;
    }

    if (arg === "--require-task-summaries") {
      requireTaskSummaries = true;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return {
    rootDir,
    outputDir,
    summaryDir,
    requireTaskSummaries,
  };
}

async function main(): Promise<void> {
  const options = parseArgs(argv.slice(2));
  const report = createProductionReadyReport(options);
  const markdownPath = writeProductionReadyReport(report, options.outputDir);
  const failureCount = countProductionReadyFailures(report);

  console.log(`production-ready-check: wrote ${markdownPath}`);
  console.log(`production-ready-check: production packages=${report.productionRows.length}`);
  console.log(`production-ready-check: blocking failures=${failureCount}`);

  if (failureCount > 0) {
    exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`production-ready-check: failed: ${message}`);
    exit(1);
  });
}

#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { argv, exit } from "node:process";
import { pathToFileURL } from "node:url";

import { readPackages, type PackageInfo } from "./package-quality-report.mts";

const reportDirectory = join("ci-reports", "package-quality");
const reportFileName = "spine-promotion.md";
const catalogMetadataPath = join("docs", "package-catalog.json");
const maturityOrder = ["production", "beta", "alpha", "deprecated"] as const;

type MaturityKey = (typeof maturityOrder)[number];

type Options = {
  readonly rootDir: string;
  readonly outputDir: string;
};

type PromotionMetadata = {
  readonly owner: string;
  readonly targetEvidence: readonly string[];
  readonly recoveryAction: string;
};

export type BetaSpinePromotionRow = {
  readonly packageName: string;
  readonly shortName: string;
  readonly relativeDir: string;
  readonly group: string;
  readonly maturity: "beta";
  readonly owner: string | null;
  readonly targetEvidence: readonly string[];
  readonly recoveryAction: string | null;
  readonly status: "accounted" | "unaccounted";
  readonly missingFields: readonly string[];
};

export type SpinePromotionReport = {
  readonly generatedAt: string;
  readonly rootDir: string;
  readonly catalogErrors: readonly string[];
  readonly catalogWarnings: readonly string[];
  readonly betaSpineRows: readonly BetaSpinePromotionRow[];
  readonly ignoredNonSpineNonProductionCount: number;
};

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function readJsonFile(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf-8")) as unknown;
}

function toShortPackageName(packageName: string): string {
  return packageName.replace(/^@croco\//, "");
}

function toPosixPath(path: string): string {
  return path.split("\\").join("/");
}

function readStringArrayField(
  record: Readonly<Record<string, unknown>>,
  fieldPath: string,
  errors: string[],
): readonly string[] {
  const value = record.packages;
  if (!isStringArray(value)) {
    errors.push(`${catalogMetadataPath}: ${fieldPath}.packages must be a string array`);
    return [];
  }

  return value;
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

    const packageNames = readStringArrayField(groupValue, `groups.${groupName}`, errors);
    for (const packageName of packageNames) {
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

function parseCatalogMaturity(
  maturityRoot: unknown,
  errors: string[],
): ReadonlyMap<string, MaturityKey> {
  const maturityByPackage = new Map<string, MaturityKey>();

  if (!isRecord(maturityRoot)) {
    errors.push(`${catalogMetadataPath}: maturity must be an object`);
    return maturityByPackage;
  }

  for (const maturity of maturityOrder) {
    const maturityValue = maturityRoot[maturity];
    if (!isRecord(maturityValue)) {
      errors.push(`${catalogMetadataPath}: maturity.${maturity} must be an object`);
      continue;
    }

    const packageNames = readStringArrayField(maturityValue, `maturity.${maturity}`, errors);
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

  return maturityByPackage;
}

function parseCatalogSpine(
  catalog: Readonly<Record<string, unknown>>,
  errors: string[],
): readonly string[] {
  if (!isRecord(catalog.spine)) {
    errors.push(`${catalogMetadataPath}: spine must be an object`);
    return [];
  }

  return readStringArrayField(catalog.spine, "spine", errors);
}

function parsePromotionPackages(
  catalog: Readonly<Record<string, unknown>>,
  errors: string[],
): ReadonlyMap<string, PromotionMetadata | null> {
  const spine = isRecord(catalog.spine) ? catalog.spine : {};
  const promotion = isRecord(spine.promotion) ? spine.promotion : {};

  if (spine.promotion !== undefined && !isRecord(spine.promotion)) {
    errors.push(`${catalogMetadataPath}: spine.promotion must be an object`);
    return new Map();
  }

  if (promotion.packages !== undefined && !isRecord(promotion.packages)) {
    errors.push(`${catalogMetadataPath}: spine.promotion.packages must be an object`);
    return new Map();
  }

  const promotionPackages = isRecord(promotion.packages) ? promotion.packages : {};
  return new Map(
    Object.entries(promotionPackages).map(([packageName, metadata]) => [
      packageName,
      parsePromotionMetadata(metadata),
    ]),
  );
}

function parsePromotionMetadata(value: unknown): PromotionMetadata | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    owner: typeof value.owner === "string" ? value.owner : "",
    targetEvidence: isStringArray(value.targetEvidence) ? value.targetEvidence : [],
    recoveryAction: typeof value.recoveryAction === "string" ? value.recoveryAction : "",
  };
}

function getMissingPromotionFields(metadata: PromotionMetadata | null | undefined): string[] {
  if (!metadata) {
    return ["owner", "targetEvidence", "recoveryAction"];
  }

  const missingFields: string[] = [];
  if (metadata.owner.trim().length === 0) {
    missingFields.push("owner");
  }
  if (metadata.targetEvidence.filter((entry) => entry.trim().length > 0).length === 0) {
    missingFields.push("targetEvidence");
  }
  if (metadata.recoveryAction.trim().length === 0) {
    missingFields.push("recoveryAction");
  }

  return missingFields;
}

function indexWorkspacePackages(
  packages: readonly PackageInfo[],
  errors: string[],
): ReadonlyMap<string, PackageInfo> {
  const byShortName = new Map<string, PackageInfo>();

  for (const pkg of packages) {
    if (pkg.private) {
      continue;
    }

    const shortName = toShortPackageName(pkg.name);
    const existing = byShortName.get(shortName);
    if (existing) {
      errors.push(
        `${catalogMetadataPath}: workspace contains duplicate package short name ${shortName} (${existing.name}, ${pkg.name})`,
      );
      continue;
    }
    byShortName.set(shortName, pkg);
  }

  return byShortName;
}

function createBetaSpineRow(input: {
  readonly group: string;
  readonly metadata: PromotionMetadata | null | undefined;
  readonly pkg: PackageInfo;
  readonly shortName: string;
}): BetaSpinePromotionRow {
  const missingFields = getMissingPromotionFields(input.metadata);
  const targetEvidence =
    input.metadata?.targetEvidence.filter((entry) => entry.trim().length > 0) ?? [];

  return {
    packageName: input.pkg.name,
    shortName: input.shortName,
    relativeDir: input.pkg.relativeDir,
    group: input.group,
    maturity: "beta",
    owner: input.metadata?.owner.trim() ? input.metadata.owner.trim() : null,
    targetEvidence,
    recoveryAction: input.metadata?.recoveryAction.trim()
      ? input.metadata.recoveryAction.trim()
      : null,
    status: missingFields.length === 0 ? "accounted" : "unaccounted",
    missingFields,
  };
}

export function createSpinePromotionReport(options: {
  readonly generatedAt?: string;
  readonly rootDir: string;
}): SpinePromotionReport {
  const catalogErrors: string[] = [];
  const catalog = readJsonFile(join(options.rootDir, catalogMetadataPath));

  if (!isRecord(catalog)) {
    return {
      generatedAt: options.generatedAt ?? new Date().toISOString(),
      rootDir: options.rootDir,
      catalogErrors: [`${catalogMetadataPath}: must contain an object`],
      catalogWarnings: [],
      betaSpineRows: [],
      ignoredNonSpineNonProductionCount: 0,
    };
  }

  const groupByPackage = parseCatalogGroups(catalog.groups, catalogErrors);
  const maturityByPackage = parseCatalogMaturity(catalog.maturity, catalogErrors);
  const spinePackages = parseCatalogSpine(catalog, catalogErrors);
  const promotionPackages = parsePromotionPackages(catalog, catalogErrors);
  const workspaceByShortName = indexWorkspacePackages(readPackages(options.rootDir), catalogErrors);
  const spinePackageSet = new Set(spinePackages);
  const catalogWarnings: string[] = [];
  const betaSpinePackageSet = new Set(
    spinePackages.filter((packageName) => maturityByPackage.get(packageName) === "beta"),
  );

  for (const packageName of betaSpinePackageSet) {
    if (!workspaceByShortName.has(packageName)) {
      catalogErrors.push(
        `${catalogMetadataPath}: spine package ${packageName} is beta but has no public workspace package`,
      );
    }
  }

  for (const packageName of promotionPackages.keys()) {
    if (!betaSpinePackageSet.has(packageName)) {
      catalogWarnings.push(
        `${catalogMetadataPath}: spine.promotion.packages.${packageName} is outside the current beta spine and should be removed when promotion is complete or out of scope`,
      );
    }
  }

  const betaSpineRows = [...betaSpinePackageSet].sort().flatMap((shortName) => {
    const pkg = workspaceByShortName.get(shortName);
    if (!pkg) {
      return [];
    }

    return [
      createBetaSpineRow({
        group: groupByPackage.get(shortName) ?? "Unassigned",
        metadata: promotionPackages.get(shortName),
        pkg,
        shortName,
      }),
    ];
  });

  const ignoredNonSpineNonProductionCount = [...workspaceByShortName.keys()].filter((shortName) => {
    if (spinePackageSet.has(shortName)) {
      return false;
    }

    const maturity = maturityByPackage.get(shortName);
    return maturity === "beta" || maturity === "alpha" || maturity === "deprecated";
  }).length;

  return {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    rootDir: options.rootDir,
    catalogErrors,
    catalogWarnings,
    betaSpineRows,
    ignoredNonSpineNonProductionCount,
  };
}

function formatCatalogErrors(errors: readonly string[]): string[] {
  return errors.length === 0 ? ["- none"] : errors.map((error) => `- ${error}`);
}

function formatCatalogWarnings(warnings: readonly string[]): string[] {
  return warnings.length === 0 ? ["- none"] : warnings.map((warning) => `- ${warning}`);
}

function escapeTableCell(value: string): string {
  return value.replaceAll("|", "\\|");
}

function formatCell(value: string | null): string {
  return value ? escapeTableCell(value) : "_missing_";
}

function formatEvidenceCell(targetEvidence: readonly string[]): string {
  return targetEvidence.length === 0
    ? "_missing_"
    : targetEvidence.map((entry) => escapeTableCell(entry)).join("<br>");
}

function formatStatusCell(row: BetaSpinePromotionRow): string {
  return row.status === "accounted"
    ? "accounted"
    : `unaccounted: missing ${row.missingFields.join(", ")}`;
}

function formatBetaSpineRows(rows: readonly BetaSpinePromotionRow[]): string[] {
  if (rows.length === 0) {
    return ["| _none_ | _none_ | _none_ | _none_ | _none_ | _none_ | _none_ |"];
  }

  return rows.map(
    (row) =>
      `| \`${row.packageName}\` | ${row.group} | \`${toPosixPath(row.relativeDir)}\` | ${formatCell(row.owner)} | ${formatEvidenceCell(row.targetEvidence)} | ${formatCell(row.recoveryAction)} | ${formatStatusCell(row)} |`,
  );
}

export function countSpinePromotionFailures(report: SpinePromotionReport): number {
  return (
    report.catalogErrors.length +
    report.betaSpineRows.filter((row) => row.status === "unaccounted").length
  );
}

export function hasSpinePromotionFailures(report: SpinePromotionReport): boolean {
  return countSpinePromotionFailures(report) > 0;
}

export function buildSpinePromotionMarkdown(report: SpinePromotionReport): string {
  const failureCount = countSpinePromotionFailures(report);
  const lines = [
    "# Beta Spine Promotion Gate",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Root: \`${toPosixPath(report.rootDir)}\``,
    `- Beta spine packages: ${report.betaSpineRows.length}`,
    `- Blocking failures: ${failureCount}`,
    "",
    "## Catalog errors",
    ...formatCatalogErrors(report.catalogErrors),
    "",
    "## Catalog warnings",
    ...formatCatalogWarnings(report.catalogWarnings),
    "",
    "## Beta spine promotion accountability",
    "| Package | Group | Directory | Owner | Target evidence | Recovery action | Status |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...formatBetaSpineRows(report.betaSpineRows),
    "",
    "## Non-spine non-production scope",
    `- Non-spine beta, alpha, or deprecated packages ignored by this blocking gate: ${report.ignoredNonSpineNonProductionCount}`,
    "- Non-spine non-production packages stay outside this gate unless another release path explicitly pulls them into scope.",
    "",
    "## Recovery",
    `1. Add or fix \`docs/package-catalog.json\` \`spine.promotion.packages.<name>\` with non-empty \`owner\`, \`targetEvidence\`, and \`recoveryAction\`.`,
    "2. Rerun `pnpm spine-promotion:check` and review this report.",
    "3. When the target evidence is complete, move the package from `maturity.beta.packages` to `maturity.production.packages` and rerun `pnpm production-ready:check`.",
  ];

  return `${lines.join("\n")}\n`;
}

export function writeSpinePromotionReport(report: SpinePromotionReport, outputDir: string): string {
  mkdirSync(outputDir, { recursive: true });
  const markdownPath = join(outputDir, reportFileName);
  writeFileSync(markdownPath, buildSpinePromotionMarkdown(report));
  return markdownPath;
}

export function parseArgs(args: readonly string[] = argv.slice(2)): Options {
  const normalizedArgs = args[0] === "--" ? args.slice(1) : args;
  let rootDir = process.cwd();
  let outputDir = reportDirectory;

  for (let index = 0; index < normalizedArgs.length; index += 1) {
    const arg = normalizedArgs[index];
    if (arg === "--root") {
      const value = normalizedArgs[index + 1];
      if (!value) {
        throw new Error("--root requires a path");
      }
      rootDir = resolve(value);
      index += 1;
      continue;
    }

    if (arg === "--output-dir") {
      const value = normalizedArgs[index + 1];
      if (!value) {
        throw new Error("--output-dir requires a path");
      }
      outputDir = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    rootDir,
    outputDir: resolve(rootDir, outputDir),
  };
}

function main(): void {
  const options = parseArgs();
  const report = createSpinePromotionReport({ rootDir: options.rootDir });
  const markdownPath = writeSpinePromotionReport(report, options.outputDir);
  const failureCount = countSpinePromotionFailures(report);

  console.log(`spine-promotion-check: wrote ${markdownPath}`);
  console.log(`spine-promotion-check: beta spine packages=${report.betaSpineRows.length}`);
  console.log(`spine-promotion-check: blocking failures=${failureCount}`);

  if (failureCount > 0) {
    exit(1);
  }
}

if (import.meta.url === pathToFileURL(argv[1] ?? "").href) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`spine-promotion-check: failed: ${message}`);
    exit(1);
  }
}

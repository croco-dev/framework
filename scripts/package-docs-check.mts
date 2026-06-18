#!/usr/bin/env node

/**
 * Keeps the root package catalog and package documentation coverage report in sync
 * with package manifests plus the curated group/maturity metadata.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { exit, stdout } from "node:process";
import { fileURLToPath } from "node:url";

type Mode = "check" | "write";

type Options = {
  readonly mode: Mode;
  readonly rootDir: string;
};

type PackageJson = {
  readonly peerDependencies?: unknown;
  readonly name?: unknown;
  readonly private?: unknown;
};

type PackageInfo = {
  readonly dir: string;
  readonly hasApiDocs: boolean;
  readonly hasReadme: boolean;
  readonly hasTests: boolean;
  readonly name: string;
  readonly peerDependencies: readonly string[];
  readonly private: boolean;
  readonly shortName: string;
};

type PackageRecord = PackageInfo & {
  readonly group: string;
  readonly maturity: MaturityKey;
};

type CatalogMetadata = {
  readonly extensionMatrix?: unknown;
  readonly schemaVersion?: unknown;
  readonly groups?: unknown;
  readonly maturity?: unknown;
};

type CatalogGroup = {
  readonly description: string;
  readonly packages: readonly string[];
};

type MaturityConfig = {
  readonly label: string;
  readonly packages: readonly string[];
};

type RuntimeKey = (typeof runtimeOrder)[number];

type ExtensionMetadata = {
  readonly adapter: string;
  readonly domain: string;
  readonly features: readonly string[];
  readonly requiredEnv: readonly string[];
  readonly runtimes: readonly RuntimeKey[];
};

type ExtensionRecord = PackageRecord & {
  readonly extension: ExtensionMetadata;
};

type ExtensionMatrixState = {
  readonly groups: readonly string[];
  readonly packages: readonly ExtensionRecord[];
};

type DocsBaseline = {
  readonly schemaVersion?: unknown;
  readonly allowedMissingApiDocs?: unknown;
  readonly allowedMissingReadme?: unknown;
  readonly allowedMissingTests?: unknown;
  readonly temporaryProductionApiDocExceptions?: unknown;
};

type Baseline = {
  readonly allowedMissingApiDocs: ReadonlySet<string>;
  readonly allowedMissingReadme: ReadonlySet<string>;
  readonly allowedMissingTests: ReadonlySet<string>;
  readonly temporaryProductionApiDocExceptions: ReadonlyMap<string, string>;
};

type CoverageSet = {
  readonly missingApiDocs: readonly PackageRecord[];
  readonly missingReadme: readonly PackageRecord[];
  readonly missingTests: readonly PackageRecord[];
};

type CatalogState = {
  readonly extensionMatrix: ExtensionMatrixState;
  readonly groups: ReadonlyMap<string, CatalogGroup>;
  readonly maturity: ReadonlyMap<MaturityKey, MaturityConfig>;
  readonly packages: readonly PackageRecord[];
  readonly privatePackageCount: number;
};

const catalogStart = "<!-- CROCO:PACKAGE-CATALOG:START -->";
const catalogEnd = "<!-- CROCO:PACKAGE-CATALOG:END -->";
const readmeCatalogHeading = "## 📦 패키지 카탈로그";
const readmeCatalogNextSection = "---\n\n## 🛠 개발 환경";
const docsDirName = "docs";
const catalogMetadataPath = join(docsDirName, "package-catalog.json");
const docsBaselinePath = join(docsDirName, "package-docs-baseline.json");
const docsReportPath = join(docsDirName, "package-docs-report.md");
const publicDocsRootPath = join("packages", "docs", "src", "content", "docs", "en");
const architectureGuidePath = join(publicDocsRootPath, "guides", "architecture.mdx");
const extensionMatrixDocsPath = join(
  "packages",
  "docs",
  "src",
  "content",
  "docs",
  "en",
  "reference",
  "extension-matrix.md",
);
const readmePath = "README.md";
const maturityOrder = ["production", "beta", "alpha", "deprecated"] as const;
const runtimeOrder = ["node", "lambda", "cloudflare-workers", "browser"] as const;
const scriptRootDir = dirname(dirname(fileURLToPath(import.meta.url)));

type MaturityKey = (typeof maturityOrder)[number];

main();

function main(): void {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = run(options);

    if (result.length > 0) {
      stdout.write("package-docs-check: documentation catalog drift detected.\n");
      for (const violation of result) {
        stdout.write(`- ${violation}\n`);
      }
      exit(1);
    }

    stdout.write("package-docs-check: package catalog and documentation report are in sync.\n");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stdout.write(`package-docs-check: ${message}\n`);
    exit(1);
  }
}

function run(options: Options): string[] {
  const violations: string[] = [];
  const state = loadCatalogState(options.rootDir, violations);
  validateArchitectureDocs(options.rootDir, state, violations);
  const baseline = loadDocsBaseline(options.rootDir, state.packages, violations);
  const coverage = getCoverageSet(state.packages);
  validateCoverageBaseline(coverage, baseline, violations);

  const generatedCatalog = formatMarkdown(readmePath, generateReadmeCatalog(state));
  const generatedExtensionMatrixDocs = formatMarkdown(
    extensionMatrixDocsPath,
    generateExtensionMatrixDocs(state),
  );
  const generatedReport = formatMarkdown(
    docsReportPath,
    generateDocsReport(state, coverage, baseline),
  );

  if (options.mode === "write") {
    writeReadmeCatalog(options.rootDir, generatedCatalog);
    writeGeneratedFile(
      join(options.rootDir, extensionMatrixDocsPath),
      generatedExtensionMatrixDocs,
    );
    writeGeneratedFile(join(options.rootDir, docsReportPath), generatedReport);
    return violations;
  }

  const readme = readRequiredFile(join(options.rootDir, readmePath));
  const expectedReadme = replaceReadmeCatalog(readme, generatedCatalog);
  if (readme !== expectedReadme) {
    violations.push(`README.md package catalog drift detected; run pnpm docs:catalog:write`);
  }

  const extensionMatrixPath = join(options.rootDir, extensionMatrixDocsPath);
  const currentExtensionMatrix = existsSync(extensionMatrixPath)
    ? readFileSync(extensionMatrixPath, "utf-8")
    : "";
  if (currentExtensionMatrix !== generatedExtensionMatrixDocs) {
    violations.push(`${extensionMatrixDocsPath} drift detected; run pnpm docs:catalog:write`);
  }

  const reportPath = join(options.rootDir, docsReportPath);
  const currentReport = existsSync(reportPath) ? readFileSync(reportPath, "utf-8") : "";
  if (currentReport !== generatedReport) {
    violations.push(`${docsReportPath} drift detected; run pnpm docs:catalog:write`);
  }

  return violations;
}

function parseArgs(args: readonly string[]): Options {
  let mode: Mode = "check";
  let rootDir = process.cwd();

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];

    if (arg === "--check") {
      mode = "check";
      continue;
    }

    if (arg === "--write") {
      mode = "write";
      continue;
    }

    if (arg === "--root") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--root requires a path");
      }
      rootDir = resolve(value);
      index++;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return {
    mode,
    rootDir,
  };
}

function loadCatalogState(rootDir: string, violations: string[]): CatalogState {
  const packages = readPackages(rootDir);
  const publicPackages = packages.filter((pkg) => !pkg.private);
  const metadata = readJsonFile<CatalogMetadata>(join(rootDir, catalogMetadataPath));
  const groups = parseCatalogGroups(metadata.groups, violations);
  const maturity = parseMaturity(metadata.maturity, violations);
  const groupByPackage = validateAssignments("group", groups, publicPackages, violations);
  const maturityByPackage = validateAssignments("maturity", maturity, publicPackages, violations);
  const records = publicPackages.map((pkg) => {
    const group = groupByPackage.get(pkg.shortName) ?? "Unassigned";
    const maturityKey = (maturityByPackage.get(pkg.shortName) ?? "alpha") as MaturityKey;

    return {
      ...pkg,
      group,
      maturity: maturityKey,
    };
  });
  const extensionMatrix = parseExtensionMatrix(
    metadata.extensionMatrix,
    groups,
    records,
    violations,
  );

  return {
    extensionMatrix,
    groups,
    maturity,
    packages: records,
    privatePackageCount: packages.length - publicPackages.length,
  };
}

function readPackages(rootDir: string): PackageInfo[] {
  const packagesDir = join(rootDir, "packages");
  const entries = readdirSync(packagesDir, { withFileTypes: true });
  const packages: PackageInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const packageDir = join(packagesDir, entry.name);
    const packageJsonPath = join(packageDir, "package.json");
    if (!existsSync(packageJsonPath)) {
      continue;
    }

    const pkg = readJsonFile<PackageJson>(packageJsonPath);
    if (typeof pkg.name !== "string" || pkg.name.length === 0) {
      throw new Error(`${relative(rootDir, packageJsonPath)} is missing a string name`);
    }

    packages.push({
      dir: entry.name,
      hasApiDocs: existsSync(
        join(rootDir, "packages", "docs", "src", "content", "docs", "api", entry.name),
      ),
      hasReadme: existsSync(join(packageDir, "README.md")),
      hasTests:
        existsSync(join(packageDir, "src", "tests")) ||
        existsSync(join(packageDir, "src", "__tests__")),
      name: pkg.name,
      peerDependencies: readDependencyKeys(pkg.peerDependencies),
      private: pkg.private === true,
      shortName: toShortPackageName(pkg.name),
    });
  }

  return packages.sort((left, right) => left.shortName.localeCompare(right.shortName));
}

function parseCatalogGroups(
  value: unknown,
  violations: string[],
): ReadonlyMap<string, CatalogGroup> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    violations.push(`${catalogMetadataPath}: groups must be an object`);
    return new Map();
  }

  const groups = new Map<string, CatalogGroup>();
  for (const [group, config] of Object.entries(value)) {
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      violations.push(`${catalogMetadataPath}: groups.${group} must be an object`);
      continue;
    }

    const description = (config as { readonly description?: unknown }).description;
    const packages = (config as { readonly packages?: unknown }).packages;
    if (typeof description !== "string" || description.length === 0) {
      violations.push(`${catalogMetadataPath}: groups.${group}.description must be a string`);
    }
    if (!isStringArray(packages)) {
      violations.push(`${catalogMetadataPath}: groups.${group}.packages must be a string array`);
      continue;
    }

    groups.set(group, {
      description: typeof description === "string" ? description : "",
      packages,
    });
  }

  return groups;
}

function parseMaturity(
  value: unknown,
  violations: string[],
): ReadonlyMap<MaturityKey, MaturityConfig> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    violations.push(`${catalogMetadataPath}: maturity must be an object`);
    return new Map();
  }

  const maturity = new Map<MaturityKey, MaturityConfig>();
  for (const key of maturityOrder) {
    const config = (value as Record<string, unknown>)[key];
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      violations.push(`${catalogMetadataPath}: maturity.${key} must be an object`);
      continue;
    }

    const label = (config as { readonly label?: unknown }).label;
    const packages = (config as { readonly packages?: unknown }).packages;
    if (typeof label !== "string" || label.length === 0) {
      violations.push(`${catalogMetadataPath}: maturity.${key}.label must be a string`);
    }
    if (!isStringArray(packages)) {
      violations.push(`${catalogMetadataPath}: maturity.${key}.packages must be a string array`);
      continue;
    }

    maturity.set(key, {
      label: typeof label === "string" ? label : key,
      packages,
    });
  }

  return maturity;
}

function parseExtensionMatrix(
  value: unknown,
  groups: ReadonlyMap<string, CatalogGroup>,
  packages: readonly PackageRecord[],
  violations: string[],
): ExtensionMatrixState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    violations.push(`${catalogMetadataPath}: extensionMatrix must be an object`);
    return {
      groups: [],
      packages: [],
    };
  }

  const groupValue = (value as { readonly groups?: unknown }).groups;
  const packageValue = (value as { readonly packages?: unknown }).packages;
  if (!isStringArray(groupValue)) {
    violations.push(`${catalogMetadataPath}: extensionMatrix.groups must be a string array`);
  }
  if (!packageValue || typeof packageValue !== "object" || Array.isArray(packageValue)) {
    violations.push(`${catalogMetadataPath}: extensionMatrix.packages must be an object`);
    return {
      groups: isStringArray(groupValue) ? groupValue : [],
      packages: [],
    };
  }

  const extensionGroups = isStringArray(groupValue) ? groupValue : [];
  for (const group of extensionGroups) {
    if (!groups.has(group)) {
      violations.push(
        `${catalogMetadataPath}: extensionMatrix.groups references missing group ${group}`,
      );
    }
  }

  const packageByName = new Map(packages.map((pkg) => [pkg.shortName, pkg]));
  const extensionGroupSet = new Set(extensionGroups);
  const targetPackages = packages.filter((pkg) => extensionGroupSet.has(pkg.group));
  const records: ExtensionRecord[] = [];

  for (const [packageName, metadataValue] of Object.entries(packageValue)) {
    const pkg = packageByName.get(packageName);
    if (!pkg) {
      violations.push(
        `${catalogMetadataPath}: extensionMatrix.packages references missing package ${packageName}`,
      );
      continue;
    }
    if (!extensionGroupSet.has(pkg.group)) {
      violations.push(
        `${catalogMetadataPath}: extensionMatrix.packages.${packageName} is not in an extension group`,
      );
      continue;
    }

    const metadata = parseExtensionMetadata(packageName, metadataValue, violations);
    if (!metadata) {
      continue;
    }

    records.push({
      ...pkg,
      extension: metadata,
    });
  }

  const metadataPackageNames = new Set(records.map((pkg) => pkg.shortName));
  for (const pkg of targetPackages) {
    if (!metadataPackageNames.has(pkg.shortName)) {
      violations.push(
        `${catalogMetadataPath}: extensionMatrix is missing metadata for ${pkg.group} package ${pkg.shortName}`,
      );
    }
  }

  return {
    groups: extensionGroups,
    packages: records.sort(
      (left, right) =>
        extensionGroups.indexOf(left.group) - extensionGroups.indexOf(right.group) ||
        left.extension.domain.localeCompare(right.extension.domain) ||
        left.shortName.localeCompare(right.shortName),
    ),
  };
}

function parseExtensionMetadata(
  packageName: string,
  value: unknown,
  violations: string[],
): ExtensionMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    violations.push(
      `${catalogMetadataPath}: extensionMatrix.packages.${packageName} must be an object`,
    );
    return null;
  }

  const metadata = value as Record<string, unknown>;
  const adapter = readRequiredString(
    metadata.adapter,
    `extensionMatrix.packages.${packageName}.adapter`,
    violations,
  );
  const domain = readRequiredString(
    metadata.domain,
    `extensionMatrix.packages.${packageName}.domain`,
    violations,
  );
  const features = readRequiredStringArray(
    metadata.features,
    `extensionMatrix.packages.${packageName}.features`,
    violations,
  );
  const requiredEnv = readRequiredStringArray(
    metadata.requiredEnv,
    `extensionMatrix.packages.${packageName}.requiredEnv`,
    violations,
  );
  const runtimes = readRuntimeArray(
    metadata.runtimes,
    `extensionMatrix.packages.${packageName}.runtimes`,
    violations,
  );

  if (
    !adapter ||
    !domain ||
    features.length === 0 ||
    requiredEnv.length === 0 ||
    runtimes.length === 0
  ) {
    return null;
  }

  return {
    adapter,
    domain,
    features,
    requiredEnv,
    runtimes,
  };
}

function readRequiredString(value: unknown, key: string, violations: string[]): string {
  if (typeof value !== "string" || value.length === 0) {
    violations.push(`${catalogMetadataPath}: ${key} must be a non-empty string`);
    return "";
  }

  return value;
}

function readRequiredStringArray(
  value: unknown,
  key: string,
  violations: string[],
): readonly string[] {
  if (!isStringArray(value) || value.length === 0) {
    violations.push(`${catalogMetadataPath}: ${key} must be a non-empty string array`);
    return [];
  }

  return value;
}

function readRuntimeArray(
  value: unknown,
  key: string,
  violations: string[],
): readonly RuntimeKey[] {
  const runtimes = readRequiredStringArray(value, key, violations);
  const validRuntimes = new Set<string>(runtimeOrder);

  for (const runtime of runtimes) {
    if (!validRuntimes.has(runtime)) {
      violations.push(
        `${catalogMetadataPath}: ${key} contains unsupported runtime ${runtime}; expected one of ${runtimeOrder.join(", ")}`,
      );
    }
  }

  return runtimes.filter((runtime): runtime is RuntimeKey => validRuntimes.has(runtime));
}

function validateAssignments(
  label: string,
  assignments: ReadonlyMap<string, { readonly packages: readonly string[] }>,
  packages: readonly PackageInfo[],
  violations: string[],
): ReadonlyMap<string, string> {
  const actualPackages = new Set(packages.map((pkg) => pkg.shortName));
  const seen = new Map<string, string>();

  for (const [bucket, config] of assignments) {
    for (const packageName of config.packages) {
      if (!actualPackages.has(packageName)) {
        violations.push(
          `${catalogMetadataPath}: ${label} ${bucket} references missing package ${packageName}`,
        );
        continue;
      }

      const previousBucket = seen.get(packageName);
      if (previousBucket) {
        violations.push(
          `${catalogMetadataPath}: package ${packageName} appears in multiple ${label} buckets (${previousBucket}, ${bucket})`,
        );
        continue;
      }

      seen.set(packageName, bucket);
    }
  }

  for (const pkg of packages) {
    if (!seen.has(pkg.shortName)) {
      violations.push(
        `${catalogMetadataPath}: public package ${pkg.shortName} is missing ${label} metadata`,
      );
    }
  }

  return seen;
}

function loadDocsBaseline(
  rootDir: string,
  packages: readonly PackageRecord[],
  violations: string[],
): Baseline {
  const baseline = readJsonFile<DocsBaseline>(join(rootDir, docsBaselinePath));
  const actualPackages = new Set(packages.map((pkg) => pkg.shortName));
  const productionPackages = new Set(
    packages.filter((pkg) => pkg.maturity === "production").map((pkg) => pkg.shortName),
  );
  const allowedMissingReadme = readBaselineArray(
    "allowedMissingReadme",
    baseline.allowedMissingReadme,
    actualPackages,
    violations,
  );
  const allowedMissingApiDocs = readBaselineArray(
    "allowedMissingApiDocs",
    baseline.allowedMissingApiDocs,
    actualPackages,
    violations,
  );
  const allowedMissingTests = readBaselineArray(
    "allowedMissingTests",
    baseline.allowedMissingTests,
    actualPackages,
    violations,
  );
  const temporaryProductionApiDocExceptions = readTemporaryProductionApiDocExceptions(
    baseline.temporaryProductionApiDocExceptions,
    actualPackages,
    productionPackages,
    violations,
  );

  return {
    allowedMissingApiDocs,
    allowedMissingReadme,
    allowedMissingTests,
    temporaryProductionApiDocExceptions,
  };
}

function readBaselineArray(
  key: string,
  value: unknown,
  actualPackages: ReadonlySet<string>,
  violations: string[],
): ReadonlySet<string> {
  if (!isStringArray(value)) {
    violations.push(`${docsBaselinePath}: ${key} must be a string array`);
    return new Set();
  }

  const names = new Set<string>();
  for (const packageName of value) {
    if (!actualPackages.has(packageName)) {
      violations.push(`${docsBaselinePath}: ${key} references missing package ${packageName}`);
      continue;
    }
    names.add(packageName);
  }

  return names;
}

function readTemporaryProductionApiDocExceptions(
  value: unknown,
  actualPackages: ReadonlySet<string>,
  productionPackages: ReadonlySet<string>,
  violations: string[],
): ReadonlyMap<string, string> {
  if (value === undefined) {
    return new Map();
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    violations.push(
      `${docsBaselinePath}: temporaryProductionApiDocExceptions must be an object mapping production package names to non-empty justification strings`,
    );
    return new Map();
  }

  const exceptions = new Map<string, string>();
  for (const [packageName, reason] of Object.entries(value)) {
    if (!actualPackages.has(packageName)) {
      violations.push(
        `${docsBaselinePath}: temporaryProductionApiDocExceptions references missing package ${packageName}`,
      );
      continue;
    }

    if (!productionPackages.has(packageName)) {
      violations.push(
        `${docsBaselinePath}: temporaryProductionApiDocExceptions.${packageName} is only valid for production-ready packages`,
      );
      continue;
    }

    if (typeof reason !== "string" || reason.trim().length === 0) {
      violations.push(
        `${docsBaselinePath}: temporaryProductionApiDocExceptions.${packageName} must include a non-empty justification`,
      );
      continue;
    }

    exceptions.set(packageName, reason.trim());
  }

  return exceptions;
}

function validateCoverageBaseline(
  coverage: CoverageSet,
  baseline: Baseline,
  violations: string[],
): void {
  addUnexpectedCoverageGaps(
    "README",
    coverage.missingReadme,
    baseline.allowedMissingReadme,
    "Add packages/<name>/README.md or add a justified legacy baseline entry.",
    violations,
  );
  validateProductionApiDocsBaseline(coverage.missingApiDocs, baseline, violations);
  addUnexpectedCoverageGaps(
    "API docs",
    coverage.missingApiDocs.filter((pkg) => pkg.maturity !== "production"),
    baseline.allowedMissingApiDocs,
    "Generate packages/docs/src/content/docs/api/<name>/ or add a justified legacy baseline entry.",
    violations,
  );
  addUnexpectedCoverageGaps(
    "tests",
    coverage.missingTests,
    baseline.allowedMissingTests,
    "Add src/tests coverage or add a justified legacy baseline entry.",
    violations,
  );
}

function validateProductionApiDocsBaseline(
  missingApiDocs: readonly PackageRecord[],
  baseline: Baseline,
  violations: string[],
): void {
  const missingProductionPackages = missingApiDocs.filter((pkg) => pkg.maturity === "production");
  const productionPackageNames = new Set(missingProductionPackages.map((pkg) => pkg.shortName));
  const legacyProductionEntries = [...baseline.allowedMissingApiDocs].filter((packageName) =>
    productionPackageNames.has(packageName),
  );
  const unapprovedProductionGaps = missingProductionPackages.filter(
    (pkg) => !baseline.temporaryProductionApiDocExceptions.has(pkg.shortName),
  );
  const staleTemporaryEntries = [...baseline.temporaryProductionApiDocExceptions.keys()].filter(
    (packageName) => !productionPackageNames.has(packageName),
  );

  if (legacyProductionEntries.length > 0) {
    violations.push(
      `production-ready packages cannot remain in allowedMissingApiDocs: ${legacyProductionEntries.join(", ")}. Generate API docs or move a short-lived, justified exception to temporaryProductionApiDocExceptions.`,
    );
  }

  if (unapprovedProductionGaps.length > 0) {
    violations.push(
      `production-ready packages missing API docs: ${unapprovedProductionGaps.map((pkg) => pkg.name).join(", ")}. Generate packages/docs/src/content/docs/api/<name>/ or add a short-lived, justified temporaryProductionApiDocExceptions entry.`,
    );
  }

  if (staleTemporaryEntries.length > 0) {
    violations.push(
      `temporaryProductionApiDocExceptions entries must match production-ready packages currently missing API docs: ${staleTemporaryEntries.join(", ")}`,
    );
  }
}

function addUnexpectedCoverageGaps(
  label: string,
  missingPackages: readonly PackageRecord[],
  allowedMissingPackages: ReadonlySet<string>,
  guidance: string,
  violations: string[],
): void {
  const unexpected = missingPackages.filter((pkg) => !allowedMissingPackages.has(pkg.shortName));
  if (unexpected.length === 0) {
    return;
  }

  violations.push(
    `new public packages missing ${label}: ${unexpected.map((pkg) => pkg.name).join(", ")}. ${guidance}`,
  );
}

function getCoverageSet(packages: readonly PackageRecord[]): CoverageSet {
  return {
    missingApiDocs: packages.filter((pkg) => !pkg.hasApiDocs),
    missingReadme: packages.filter((pkg) => !pkg.hasReadme),
    missingTests: packages.filter((pkg) => !pkg.hasTests),
  };
}

function validateArchitectureDocs(
  rootDir: string,
  state: CatalogState,
  violations: string[],
): void {
  for (const docsPath of collectMarkdownFiles(rootDir, publicDocsRootPath)) {
    const content = readRequiredFile(join(rootDir, docsPath));
    validateNoStaleLayerCount(docsPath, content, violations);
  }

  const architectureGuideAbsolutePath = join(rootDir, architectureGuidePath);
  if (!existsSync(architectureGuideAbsolutePath)) {
    violations.push(`${architectureGuidePath} must exist and describe the current architecture`);
    return;
  }

  const architectureGuide = readRequiredFile(architectureGuideAbsolutePath);
  validateArchitecturePackageReferences(architectureGuide, state, violations);
  validatePresentationLayerMention(architectureGuide, state, violations);
}

function collectMarkdownFiles(rootDir: string, docsPath: string): string[] {
  const absolutePath = join(rootDir, docsPath);
  if (!existsSync(absolutePath)) {
    return [];
  }

  const files: string[] = [];
  for (const entry of readdirSync(absolutePath, { withFileTypes: true })) {
    const childPath = join(docsPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(rootDir, childPath));
      continue;
    }

    if (entry.isFile() && /\.(md|mdx)$/.test(entry.name)) {
      files.push(childPath);
    }
  }

  return files.sort();
}

function validateNoStaleLayerCount(docsPath: string, content: string, violations: string[]): void {
  const staleLayerPatterns = [
    /\b4-layer\b/i,
    /\b4 layer\b/i,
    /\bfour clear layers\b/i,
    /\bfour layers\b/i,
  ];

  if (staleLayerPatterns.some((pattern) => pattern.test(content))) {
    violations.push(`${docsPath}: must not describe the current architecture as four layers`);
  }
}

function validateArchitecturePackageReferences(
  architectureGuide: string,
  state: CatalogState,
  violations: string[],
): void {
  const actualPackages = new Set(state.packages.map((pkg) => pkg.shortName));
  const packagePrefixes = new Set(state.packages.map((pkg) => `${pkg.shortName.split("-")[0]}-`));
  const packageReferences = collectPackageReferences(architectureGuide, packagePrefixes);

  for (const packageName of packageReferences) {
    if (!actualPackages.has(packageName)) {
      violations.push(
        `${architectureGuidePath}: references package ${packageName} that is not in ${catalogMetadataPath}`,
      );
    }
  }
}

function collectPackageReferences(
  content: string,
  packagePrefixes: ReadonlySet<string>,
): readonly string[] {
  const references = new Set<string>();
  const codeSpanPackageReferencePattern = /`(?:@croco\/)?([a-z][a-z0-9]*(?:-[a-z0-9]+)+)`/g;
  const packageReferencePattern = /(?:@croco\/)?([a-z][a-z0-9]*(?:-[a-z0-9]+)+)/g;

  for (const match of content.matchAll(codeSpanPackageReferencePattern)) {
    references.add(match[1]);
  }

  for (const match of content.matchAll(packageReferencePattern)) {
    const rawReference = match[0];
    const packageName = match[1];
    if (rawReference.startsWith("@croco/") || hasPackagePrefix(packageName, packagePrefixes)) {
      references.add(packageName);
    }
  }

  return [...references].sort();
}

function hasPackagePrefix(packageName: string, packagePrefixes: ReadonlySet<string>): boolean {
  for (const prefix of packagePrefixes) {
    if (packageName.startsWith(prefix)) {
      return true;
    }
  }

  return false;
}

function validatePresentationLayerMention(
  architectureGuide: string,
  state: CatalogState,
  violations: string[],
): void {
  const presentationGroup = state.groups.get("Presentation");
  if (!presentationGroup || presentationGroup.packages.length === 0) {
    return;
  }

  if (!/\bPresentation\b/.test(architectureGuide)) {
    violations.push(`${architectureGuidePath}: must include the Presentation layer`);
  }

  const referencesPresentationPackage = presentationGroup.packages.some(
    (packageName) =>
      architectureGuide.includes(packageName) ||
      architectureGuide.includes(`@croco/${packageName}`),
  );
  if (!referencesPresentationPackage) {
    violations.push(
      `${architectureGuidePath}: must reference at least one Presentation package from ${catalogMetadataPath}`,
    );
  }
}

function generateReadmeCatalog(state: CatalogState): string {
  const lines: string[] = [
    catalogStart,
    "",
    readmeCatalogHeading,
    "",
    "> 이 섹션은 `pnpm docs:catalog:write`로 생성됩니다. 패키지 이름과 경로는 `packages/*/package.json`에서 읽고, 그룹/성숙도는 `docs/package-catalog.json`에서 관리합니다.",
    "",
    `현재 카탈로그는 **${state.packages.length}개 public package**를 추적합니다. Private package ${state.privatePackageCount}개는 publish 카탈로그에서 제외됩니다. 문서 커버리지 상세는 [docs/package-docs-report.md](docs/package-docs-report.md)를 확인하세요.`,
    "",
    "### Package Groups",
    "",
    "| 그룹 | 역할 | 패키지 수 |",
    "| --- | --- | ---: |",
  ];

  for (const [group, config] of state.groups) {
    const count = state.packages.filter((pkg) => pkg.group === group).length;
    lines.push(`| ${group} | ${config.description} | ${count} |`);
  }

  lines.push(
    "",
    "### Maturity Guide",
    "",
    "Adapter 경계와 공식 우선순위는 [Adapter Ecosystem](packages/docs/src/content/docs/en/reference/adapter-ecosystem.md)에 정의되어 있습니다. 성숙도 승급 기준은 [Provider Maturity Gates](packages/docs/src/content/docs/en/reference/provider-maturity.md)와 [Presentation Runtime Support](packages/docs/src/content/docs/en/reference/presentation-runtime-support.md)에 정의되어 있으며, package test 존재 여부만으로 production-ready를 의미하지 않습니다.",
    "",
    "| 상태 | 의미 | 패키지 수 |",
    "| --- | --- | ---: |",
  );

  for (const maturity of maturityOrder) {
    const config = state.maturity.get(maturity);
    if (!config) {
      continue;
    }
    const count = state.packages.filter((pkg) => pkg.maturity === maturity).length;
    lines.push(`| ${config.label} | ${maturityDescription(maturity)} | ${count} |`);
  }

  lines.push(
    "",
    "### Extension & Adapter Matrix",
    "",
    "> 이 섹션은 `docs/package-catalog.json`의 `extensionMatrix` metadata에서 생성됩니다. 성숙도와 package test 존재 여부는 별도 열로 표시합니다.",
    "",
    "Adapter category definitions, official priorities, package naming rules, and minimum compatibility criteria live in [Adapter Ecosystem](packages/docs/src/content/docs/en/reference/adapter-ecosystem.md).",
    "",
    "Runtime columns: Node는 장기 실행 서버/CLI, Lambda는 서버리스 함수, Workers는 Cloudflare Workers, Frontend는 browser/SSR frontend integration을 의미합니다.",
  );
  appendExtensionMatrixTables(lines, state, "####");

  for (const maturity of maturityOrder) {
    const config = state.maturity.get(maturity);
    if (!config) {
      continue;
    }

    const packages = state.packages
      .filter((pkg) => pkg.maturity === maturity)
      .sort(
        (left, right) =>
          left.group.localeCompare(right.group) || left.shortName.localeCompare(right.shortName),
      );
    if (packages.length === 0) {
      continue;
    }

    lines.push(
      "",
      `### ${config.label}`,
      "",
      "| 패키지 | 그룹 | 디렉터리 | 문서 |",
      "| --- | --- | --- | --- |",
    );
    for (const pkg of packages) {
      lines.push(
        `| \`${pkg.name}\` | ${pkg.group} | \`packages/${pkg.dir}\` | ${formatDocsStatus(pkg)} |`,
      );
    }
  }

  lines.push(
    "",
    "### Documentation Gate",
    "",
    "- `pnpm docs:catalog:check`는 README 카탈로그, extension matrix reference 문서, 문서 커버리지 리포트 drift를 검증합니다.",
    "- 신규 public package는 `docs/package-catalog.json`에 그룹/성숙도 metadata가 있어야 합니다.",
    "- 신규 public package의 README, API docs, tests 누락은 `docs/package-docs-baseline.json`에 없는 한 실패합니다.",
    "- production-ready package의 API docs 누락은 legacy baseline으로 숨길 수 없고, 생성하거나 짧은 사유가 있는 `temporaryProductionApiDocExceptions`에만 임시로 둘 수 있습니다.",
    "",
    catalogEnd,
    "",
  );

  return lines.join("\n");
}

function generateDocsReport(
  state: CatalogState,
  coverage: CoverageSet,
  baseline: Baseline,
): string {
  const lines: string[] = [
    "# Package Documentation Report",
    "",
    "> Generated by `pnpm docs:catalog:write`. Do not edit this file by hand.",
    "",
    "## Summary",
    "",
    "| Metric | Count |",
    "| --- | ---: |",
    `| Public packages | ${state.packages.length} |`,
    `| Private packages skipped | ${state.privatePackageCount} |`,
    `| Missing package README | ${coverage.missingReadme.length} |`,
    `| Missing generated API docs | ${coverage.missingApiDocs.length} |`,
    `| Missing package test directory | ${coverage.missingTests.length} |`,
    `| Extension matrix packages | ${state.extensionMatrix.packages.length} |`,
    "",
    "New public packages must not add missing README, API docs, or test coverage unless the gap is explicitly listed in `docs/package-docs-baseline.json`. Production-ready packages must have generated API docs unless they have a short-lived justification in `temporaryProductionApiDocExceptions`.",
    "",
    "## Missing Package README",
    "",
    ...formatMissingPackages(coverage.missingReadme, baseline.allowedMissingReadme),
    "",
    "## Missing Generated API Docs",
    "",
    ...formatMissingApiDocs(coverage.missingApiDocs, baseline),
    "",
    "## Missing Test Directory",
    "",
    ...formatMissingPackages(coverage.missingTests, baseline.allowedMissingTests),
    "",
    "## Catalog Metadata",
    "",
    "| Group | Packages |",
    "| --- | ---: |",
  ];

  for (const [group] of state.groups) {
    lines.push(`| ${group} | ${state.packages.filter((pkg) => pkg.group === group).length} |`);
  }

  lines.push("", "| Maturity | Packages |", "| --- | ---: |");
  for (const maturity of maturityOrder) {
    const config = state.maturity.get(maturity);
    if (!config) {
      continue;
    }
    lines.push(
      `| ${config.label} | ${state.packages.filter((pkg) => pkg.maturity === maturity).length} |`,
    );
  }

  lines.push(
    "",
    "## Extension Matrix",
    "",
    "Extension matrix metadata is maintained in `docs/package-catalog.json` and rendered to the root README plus the docs reference page.",
    "",
    "| Group | Packages | Without package tests |",
    "| --- | ---: | ---: |",
  );
  for (const group of state.extensionMatrix.groups) {
    const packages = state.extensionMatrix.packages.filter((pkg) => pkg.group === group);
    lines.push(
      `| ${group} | ${packages.length} | ${packages.filter((pkg) => !pkg.hasTests).length} |`,
    );
  }

  lines.push("");
  return lines.join("\n");
}

function generateExtensionMatrixDocs(state: CatalogState): string {
  const lines: string[] = [
    "---",
    "title: Extension Matrix",
    "description: Official Croco provider and adapter compatibility matrix.",
    "---",
    "",
    "# Extension Matrix",
    "",
    "> Generated by `pnpm docs:catalog:write`. Do not edit this file by hand.",
    "",
    "This page lists Croco provider, integration, transport, and presentation adapter compatibility from `docs/package-catalog.json`. Required configuration, runtime support, package peer dependencies, maturity, and package test presence are intentionally separate so users can evaluate production readiness without treating a passing unit test as a maturity claim.",
    "",
    "Adapter category definitions, official priorities, package naming rules, and minimum compatibility criteria are defined in [Adapter Ecosystem](../adapter-ecosystem/). Provider promotion criteria are defined in [Provider Maturity Gates](../provider-maturity/). Presentation runtime and promotion criteria are defined in [Presentation Runtime Support](../presentation-runtime-support/).",
    "",
    "Runtime columns: Node covers long-running server and CLI use, Lambda covers serverless functions, Workers covers Cloudflare Workers, and Frontend covers browser or SSR frontend integration.",
  ];

  appendExtensionMatrixTables(lines, state, "##");

  lines.push("");
  return lines.join("\n");
}

function appendExtensionMatrixTables(
  lines: string[],
  state: CatalogState,
  headingPrefix: "##" | "####",
): void {
  for (const group of state.extensionMatrix.groups) {
    const packages = state.extensionMatrix.packages.filter((pkg) => pkg.group === group);
    if (packages.length === 0) {
      continue;
    }

    lines.push(
      "",
      `${headingPrefix} ${group}`,
      "",
      "| Package | Domain | Adapter | Node | Lambda | Workers | Frontend | Required env/config | Peer deps | Features | Maturity | Package tests |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    );

    for (const pkg of packages) {
      const maturity = state.maturity.get(pkg.maturity)?.label ?? pkg.maturity;
      lines.push(
        `| \`${pkg.name}\` | ${pkg.extension.domain} | ${pkg.extension.adapter} | ${formatRuntimeSupport(pkg, "node")} | ${formatRuntimeSupport(pkg, "lambda")} | ${formatRuntimeSupport(pkg, "cloudflare-workers")} | ${formatRuntimeSupport(pkg, "browser")} | ${formatList(pkg.extension.requiredEnv)} | ${formatList(pkg.peerDependencies)} | ${formatList(pkg.extension.features)} | ${maturity} | ${formatPackageTestStatus(pkg)} |`,
      );
    }
  }
}

function formatMissingPackages(
  packages: readonly PackageRecord[],
  allowedMissingPackages: ReadonlySet<string>,
): string[] {
  if (packages.length === 0) {
    return ["None."];
  }

  return packages.map((pkg) => {
    const baseline = allowedMissingPackages.has(pkg.shortName) ? "legacy baseline" : "new gap";
    return `- \`${pkg.name}\` (\`packages/${pkg.dir}\`) — ${baseline}`;
  });
}

function formatMissingApiDocs(packages: readonly PackageRecord[], baseline: Baseline): string[] {
  if (packages.length === 0) {
    return ["None."];
  }

  return packages.map((pkg) => {
    const temporaryReason = baseline.temporaryProductionApiDocExceptions.get(pkg.shortName);
    const status = temporaryReason
      ? `temporary production exception: ${temporaryReason}`
      : baseline.allowedMissingApiDocs.has(pkg.shortName)
        ? "legacy baseline"
        : "new gap";

    return `- \`${pkg.name}\` (\`packages/${pkg.dir}\`) — ${status}`;
  });
}

function formatRuntimeSupport(pkg: ExtensionRecord, runtime: RuntimeKey): string {
  return pkg.extension.runtimes.includes(runtime) ? "yes" : "-";
}

function formatList(values: readonly string[]): string {
  return values.length > 0 ? values.join("<br>") : "-";
}

function formatPackageTestStatus(pkg: PackageRecord): string {
  return pkg.hasTests ? "has package tests" : "no package tests";
}

function writeReadmeCatalog(rootDir: string, generatedCatalog: string): void {
  const readmeFilePath = join(rootDir, readmePath);
  const readme = readRequiredFile(readmeFilePath);
  writeGeneratedFile(readmeFilePath, replaceReadmeCatalog(readme, generatedCatalog));
}

function replaceReadmeCatalog(readme: string, generatedCatalog: string): string {
  const markerStartIndex = readme.indexOf(catalogStart);
  const markerEndIndex = readme.indexOf(catalogEnd);

  if (markerStartIndex !== -1 && markerEndIndex !== -1 && markerEndIndex > markerStartIndex) {
    const afterMarker = markerEndIndex + catalogEnd.length;
    return `${readme.slice(0, markerStartIndex)}${generatedCatalog}${readme.slice(afterMarker).replace(/^\n+/, "\n")}`;
  }

  const headingIndex = readme.indexOf(readmeCatalogHeading);
  const nextSectionIndex = readme.indexOf(readmeCatalogNextSection, headingIndex);

  if (headingIndex === -1 || nextSectionIndex === -1) {
    throw new Error(
      `README.md must contain ${readmeCatalogHeading} before ${readmeCatalogNextSection}`,
    );
  }

  return `${readme.slice(0, headingIndex).trimEnd()}\n\n${generatedCatalog}${readme.slice(nextSectionIndex)}`;
}

function writeGeneratedFile(filePath: string, content: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf-8");
}

function formatMarkdown(filePath: string, content: string): string {
  const result = spawnSync("pnpm", ["exec", "oxfmt", "--stdin-filepath", filePath], {
    cwd: scriptRootDir,
    encoding: "utf-8",
    input: content,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `oxfmt failed for ${filePath}`);
  }

  return result.stdout;
}

function formatDocsStatus(pkg: PackageRecord): string {
  const labels = [];
  if (pkg.hasReadme) {
    labels.push("README");
  }
  if (pkg.hasApiDocs) {
    labels.push("API");
  }
  if (pkg.hasTests) {
    labels.push("tests");
  }

  return labels.length > 0 ? labels.join(", ") : "report gap";
}

function maturityDescription(maturity: MaturityKey): string {
  switch (maturity) {
    case "production":
      return "안정화, 적극 사용 권장";
    case "beta":
      return "기능 완성, 실사용 검증 중";
    case "alpha":
      return "개발 중, 사용 시 주의 필요";
    case "deprecated":
      return "대체 패키지 존재, 마이그레이션 권장";
  }
}

function toShortPackageName(packageName: string): string {
  return packageName.replace(/^@croco\//, "");
}

function readDependencyKeys(value: unknown): readonly string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  return Object.keys(value).sort((left, right) => left.localeCompare(right));
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readRequiredFile(filePath)) as T;
}

function readRequiredFile(filePath: string): string {
  if (!existsSync(filePath)) {
    throw new Error(`${filePath} does not exist`);
  }

  return readFileSync(filePath, "utf-8");
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

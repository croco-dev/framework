import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export type CoverageMetric = "lines" | "branches" | "functions" | "statements";

export type CoverageTotals = Record<CoverageMetric, { pct: number }>;

type CoverageSummary = {
  total: CoverageTotals;
};

export type PackageCoverageResult = {
  packageName: string;
  packagePath: string;
  summaryPath: string;
  totals: CoverageTotals | null;
  thresholdWarnings: string[];
  baselineWarnings: string[];
  missingSummaryWarning: string | null;
};

export type BaselineEntry = {
  packageName: string;
  statements: number;
  branches: number;
  functions: number;
  lines: number;
};

export type PackageCatalog = {
  groups?: Record<string, { packages?: string[] }>;
  maturity?: Record<string, { packages?: string[] }>;
  spine?: { packages?: string[] };
};

export type CoreCoverageSelectionStatus = "included" | "missing" | "temporarily-excluded";

export type CoreCoverageSelectionCandidate = {
  packageName: string;
  packageSlug: string;
  inCoreCoverageSet: boolean;
  status: CoreCoverageSelectionStatus;
  signals: string[];
  exclusionReason: string | null;
  recoveryAction: string;
};

export type CoreCoverageConfigurationInput = {
  coreCoveragePackages: readonly string[];
  thresholdPackages: readonly string[];
  selectionCandidates: readonly CoreCoverageSelectionCandidate[];
};

const BASELINE_METRICS: CoverageMetric[] = ["statements", "branches", "functions", "lines"];
const INTENTIONAL_ZERO_BASELINE_REASONS: Record<string, string> = {};
const TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS: Record<string, string> = {};

const CORE_COVERAGE_SELECTION_FRAMEWORK_GROUPS = new Set([
  "Core",
  "Integration",
  "Protocol",
  "Transport",
]);

const CORE_COVERAGE_SELECTION_RELEASE_CRITICAL_RULES: {
  signal: string;
  matches: (packageSlug: string) => boolean;
}[] = [
  {
    signal: "framework-level contract",
    matches: (packageSlug) => packageSlug.startsWith("framework-"),
  },
  {
    signal: "request/context contract",
    matches: (packageSlug) => packageSlug.includes("context"),
  },
  {
    signal: "retry/reliability contract",
    matches: (packageSlug) => packageSlug.startsWith("retry-"),
  },
  {
    signal: "events contract",
    matches: (packageSlug) => packageSlug.startsWith("events-"),
  },
  {
    signal: "auth contract",
    matches: (packageSlug) => packageSlug.startsWith("auth-"),
  },
  {
    signal: "telemetry contract",
    matches: (packageSlug) => packageSlug.startsWith("telemetry-"),
  },
  {
    signal: "transport runtime contract",
    matches: (packageSlug) => packageSlug.startsWith("transports-"),
  },
  {
    signal: "health/readiness contract",
    matches: (packageSlug) => packageSlug.startsWith("health-"),
  },
  {
    signal: "failure/problem contract",
    matches: (packageSlug) => packageSlug.startsWith("problems-"),
  },
];

const projectRoot = process.cwd();
const baselinePath = join(projectRoot, "ci-reports", "coverage", "core-baseline.txt");
const reportDirectory = join(projectRoot, "ci-reports", "coverage", "core-warning");
const reportPath = join(reportDirectory, "report.md");
const packageJsonPath = join(projectRoot, "package.json");
const packageCatalogPath = join(projectRoot, "docs", "package-catalog.json");
const packagesDirectory = join(projectRoot, "packages");
const vitestConfigPath = join(projectRoot, "vitest.config.ts");

const CORE_COVERAGE_PACKAGES = readCoreCoveragePackages();
const CORE_COVERAGE_THRESHOLD_PACKAGES = readVitestCoreCoveragePackages();
const CORE_COVERAGE_THRESHOLDS = readCoreCoverageThresholds();
const WORKSPACE_PACKAGE_NAMES = readWorkspacePackageNames();
const PACKAGE_CATALOG = readPackageCatalog();

function readCoreCoveragePackages(): string[] {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
    scripts?: Record<string, string>;
  };
  const coreCoverageCommand = packageJson.scripts?.["test:coverage:core"];

  if (!coreCoverageCommand) {
    throw new Error(`failed to read test:coverage:core script from ${packageJsonPath}`);
  }

  const packages = parseCoreCoveragePackageFilters(coreCoverageCommand);

  if (packages.length === 0) {
    throw new Error(`failed to read core coverage package filters from ${packageJsonPath}`);
  }

  return packages;
}

export function parseCoreCoveragePackageFilters(coreCoverageCommand: string): string[] {
  const coverageCommandStart = coreCoverageCommand.indexOf("CORE_COVERAGE=true");
  const coverageCommand =
    coverageCommandStart === -1
      ? coreCoverageCommand
      : coreCoverageCommand.slice(coverageCommandStart);
  const packageFilter = "((?:@croco\\/)?[\\w-]+)";
  const filterPattern = new RegExp(
    `--filter\\s+(?:"${packageFilter}"|'${packageFilter}'|${packageFilter})`,
    "g",
  );
  const matches = coverageCommand.matchAll(filterPattern);

  return Array.from(matches, (match) => match[1] ?? match[2] ?? match[3]).filter(
    (packageName): packageName is string => Boolean(packageName),
  );
}

function readVitestCoreCoveragePackages(): string[] {
  return parseStringArrayExport(readFileSync(vitestConfigPath, "utf-8"), "CORE_COVERAGE_PACKAGES");
}

export function parseStringArrayExport(source: string, exportName: string): string[] {
  const arrayDeclaration = source.match(
    new RegExp(`export\\s+const\\s+${escapeRegExp(exportName)}\\s*=\\s*\\[([\\s\\S]*?)\\];`),
  );
  const arrayItems = arrayDeclaration?.[1];

  if (!arrayItems) {
    throw new Error(`failed to read ${exportName} from ${vitestConfigPath}`);
  }

  return [...arrayItems.matchAll(/["']([^"']+)["']/g)].map(([, value]) => value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readCoreCoverageThresholds(): Record<CoverageMetric, number> {
  return parseCoreCoverageThresholds(readFileSync(vitestConfigPath, "utf-8"));
}

export function parseCoreCoverageThresholds(source: string): Record<CoverageMetric, number> {
  const thresholdSection = source.match(
    /export const CORE_COVERAGE_THRESHOLDS = \{([\s\S]*?)\}\s*;?/,
  );
  const thresholdItems = thresholdSection?.[1];

  if (!thresholdItems) {
    throw new Error(`failed to read core coverage config from ${vitestConfigPath}`);
  }

  const coreCoverageThresholds = thresholdItems
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce<Record<CoverageMetric, number>>(
      (thresholds, line) => {
        const [metric, value] = line
          .replace(",", "")
          .split(":")
          .map((part) => part.trim());

        if (
          metric === "lines" ||
          metric === "branches" ||
          metric === "functions" ||
          metric === "statements"
        ) {
          thresholds[metric] = Number.parseFloat(value);
        }

        return thresholds;
      },
      {
        lines: 0,
        branches: 0,
        functions: 0,
        statements: 0,
      },
    );

  return coreCoverageThresholds;
}

function readPackageCatalog(): PackageCatalog {
  return JSON.parse(readFileSync(packageCatalogPath, "utf-8")) as PackageCatalog;
}

function readWorkspacePackageNames(): Set<string> {
  if (!existsSync(packagesDirectory)) {
    return new Set();
  }

  const packageNames = readdirSync(packagesDirectory, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory()) {
      return [];
    }

    const manifestPath = join(packagesDirectory, entry.name, "package.json");

    if (!existsSync(manifestPath)) {
      return [];
    }

    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
      name?: string;
      private?: boolean;
    };

    if (!manifest.name || manifest.private === true) {
      return [];
    }

    return [manifest.name];
  });

  return new Set(packageNames);
}

function toPackagePath(packageName: string): string {
  return join(projectRoot, "packages", toPackageSlug(packageName));
}

function toPackageSlug(packageName: string): string {
  return packageName.replace(/^@croco\//, "");
}

function readCoverageSummary(packageName: string): PackageCoverageResult {
  const packagePath = toPackagePath(packageName);
  const summaryPath = join(packagePath, "coverage", "coverage-summary.json");

  if (!existsSync(summaryPath)) {
    return {
      packageName,
      packagePath,
      summaryPath,
      totals: null,
      thresholdWarnings: [],
      baselineWarnings: [],
      missingSummaryWarning: `coverage summary not found: ${summaryPath}`,
    };
  }

  const coverageSummary = JSON.parse(readFileSync(summaryPath, "utf-8")) as CoverageSummary;
  const totals = coverageSummary.total;
  const thresholdWarnings = getThresholdWarnings(totals);
  const baselineWarnings = getBaselineWarnings(packageName, totals);

  return {
    packageName,
    packagePath,
    summaryPath,
    totals,
    thresholdWarnings,
    baselineWarnings,
    missingSummaryWarning: null,
  };
}

function getThresholdWarnings(totals: CoverageTotals): string[] {
  return (Object.entries(CORE_COVERAGE_THRESHOLDS) as [CoverageMetric, number][])
    .filter(([metric, threshold]) => totals[metric].pct < threshold)
    .map(([metric, threshold]) => `${metric} ${totals[metric].pct.toFixed(2)}% < ${threshold}%`);
}

export function parseBaselineContent(source: string): Map<string, BaselineEntry> {
  const baselineEntries = new Map<string, BaselineEntry>();
  const lines = source.split(/\r?\n/);

  for (const line of lines) {
    const cells = line
      .split("|")
      .map((cell) => cell.trim())
      .filter(Boolean);

    const packageCell = cells[0];

    if (cells.length !== 5 || !packageCell.startsWith("`") || !packageCell.endsWith("`")) {
      continue;
    }

    const packageName = packageCell.slice(1, -1);

    if (!isBaselinePackageName(packageName)) {
      continue;
    }

    baselineEntries.set(packageName, {
      packageName,
      statements: Number.parseFloat(cells[1]),
      branches: Number.parseFloat(cells[2]),
      functions: Number.parseFloat(cells[3]),
      lines: Number.parseFloat(cells[4]),
    });
  }

  return baselineEntries;
}

function isBaselinePackageName(packageName: string): boolean {
  return /^@croco\/[\w-]+$/.test(packageName) || /^[a-z][\w-]*$/.test(packageName);
}

function parseBaseline(): Map<string, BaselineEntry> {
  if (!existsSync(baselinePath)) {
    return new Map();
  }

  return parseBaselineContent(readFileSync(baselinePath, "utf-8"));
}

const baselineByPackage = parseBaseline();

export function getBaselineWarnings(
  packageName: string,
  totals: CoverageTotals,
  baselineEntries: ReadonlyMap<string, BaselineEntry> = baselineByPackage,
): string[] {
  const baseline = baselineEntries.get(packageName);

  if (!baseline) {
    return ["baseline missing"];
  }

  return BASELINE_METRICS.filter((metric) => totals[metric].pct < baseline[metric]).map(
    (metric) =>
      `${metric} ${totals[metric].pct.toFixed(2)}% < baseline ${baseline[metric].toFixed(2)}%`,
  );
}

export function validateBaselineEntries(
  results: readonly Pick<PackageCoverageResult, "packageName" | "totals">[],
  baselineEntries: ReadonlyMap<string, BaselineEntry>,
  intentionalZeroBaselineReasons: Record<string, string> = INTENTIONAL_ZERO_BASELINE_REASONS,
): string[] {
  const errors: string[] = [];

  for (const result of results) {
    if (!result.totals) {
      continue;
    }

    const baseline = baselineEntries.get(result.packageName);

    if (!baseline) {
      continue;
    }

    const nonNumericMetrics = BASELINE_METRICS.filter(
      (metric) => !Number.isFinite(baseline[metric]),
    );

    if (nonNumericMetrics.length > 0) {
      errors.push(
        `${result.packageName}: baseline ${nonNumericMetrics.join(", ")} must be numeric.`,
      );
    }

    const zeroMetrics = BASELINE_METRICS.filter((metric) => baseline[metric] === 0);
    const intentionalZeroReason = intentionalZeroBaselineReasons[result.packageName]?.trim();

    if (zeroMetrics.length > 0 && !intentionalZeroReason) {
      errors.push(
        `${result.packageName}: baseline ${zeroMetrics.join(", ")} cannot be 0 when coverage summary exists. Run \`pnpm test:coverage:core\`, update \`ci-reports/coverage/core-baseline.txt\` from measured totals, then run \`pnpm test:coverage:core:warning\`. Add an intentional zero-baseline reason only for bootstrap exceptions.`,
      );
    }
  }

  return errors;
}

function getCatalogPackageGroups(catalog: PackageCatalog): Map<string, string[]> {
  const packageGroups = new Map<string, string[]>();

  for (const [groupName, group] of Object.entries(catalog.groups ?? {})) {
    for (const packageSlug of group.packages ?? []) {
      packageGroups.set(packageSlug, [...(packageGroups.get(packageSlug) ?? []), groupName]);
    }
  }

  return packageGroups;
}

function getCatalogPackageMaturity(catalog: PackageCatalog): Map<string, string[]> {
  const packageMaturity = new Map<string, string[]>();

  for (const [maturityName, maturity] of Object.entries(catalog.maturity ?? {})) {
    for (const packageSlug of maturity.packages ?? []) {
      packageMaturity.set(packageSlug, [...(packageMaturity.get(packageSlug) ?? []), maturityName]);
    }
  }

  return packageMaturity;
}

function getCatalogSpinePackages(catalog: PackageCatalog): Set<string> {
  return new Set(catalog.spine?.packages ?? []);
}

function uniqueSignals(signals: string[]): string[] {
  return [...new Set(signals)].sort((left, right) => left.localeCompare(right));
}

function getReleaseCriticalSignals(packageSlug: string): string[] {
  return CORE_COVERAGE_SELECTION_RELEASE_CRITICAL_RULES.filter((rule) =>
    rule.matches(packageSlug),
  ).map((rule) => rule.signal);
}

function getSelectionRecoveryAction(
  packageName: string,
  status: CoreCoverageSelectionStatus,
  exclusionReason: string | null,
): string {
  if (status === "included") {
    return "현재 core coverage set에 포함됨.";
  }

  if (status === "temporarily-excluded") {
    return `임시 제외 사유 확인 후 제거하거나 core set에 추가: ${exclusionReason}`;
  }

  return `\`package.json\`의 \`test:coverage:core\`에 \`--filter ${packageName}\`를 추가하고 \`pnpm test:coverage:core\`로 baseline row를 만든다. 아직 준비되지 않았다면 \`TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS\`에 사유를 기록한다.`;
}

export function getCoreCoverageSelectionCandidates({
  catalog,
  workspacePackageNames,
  coreCoveragePackages,
  temporaryExclusions = {},
}: {
  catalog: PackageCatalog;
  workspacePackageNames: ReadonlySet<string>;
  coreCoveragePackages: readonly string[];
  temporaryExclusions?: Record<string, string>;
}): CoreCoverageSelectionCandidate[] {
  const packageGroups = getCatalogPackageGroups(catalog);
  const packageMaturity = getCatalogPackageMaturity(catalog);
  const spinePackages = getCatalogSpinePackages(catalog);
  const workspacePackageBySlug = new Map(
    [...workspacePackageNames].map((packageName) => [toPackageSlug(packageName), packageName]),
  );
  const coreCoverageSet = new Set(coreCoveragePackages);
  const packageSlugs = new Set([
    ...packageGroups.keys(),
    ...packageMaturity.keys(),
    ...spinePackages,
    ...workspacePackageBySlug.keys(),
  ]);

  return [...packageSlugs]
    .flatMap<CoreCoverageSelectionCandidate>((packageSlug) => {
      const packageName = workspacePackageBySlug.get(packageSlug);

      if (!packageName) {
        return [];
      }

      const groupSignals = (packageGroups.get(packageSlug) ?? [])
        .filter((groupName) => CORE_COVERAGE_SELECTION_FRAMEWORK_GROUPS.has(groupName))
        .map((groupName) => `catalog group: ${groupName}`);
      const maturitySignals = (packageMaturity.get(packageSlug) ?? [])
        .filter((maturityName) => maturityName === "production")
        .map(() => "production-ready maturity");
      const spineSignals = spinePackages.has(packageSlug) ? ["1.0 spine package"] : [];
      const signals = uniqueSignals([
        ...groupSignals,
        ...maturitySignals,
        ...spineSignals,
        ...getReleaseCriticalSignals(packageSlug),
      ]);

      if (signals.length === 0) {
        return [];
      }

      const inCoreCoverageSet = coreCoverageSet.has(packageName);
      const exclusionReason = temporaryExclusions[packageName]?.trim() || null;
      const status: CoreCoverageSelectionStatus = inCoreCoverageSet
        ? "included"
        : exclusionReason
          ? "temporarily-excluded"
          : "missing";

      return [
        {
          packageName,
          packageSlug,
          inCoreCoverageSet,
          status,
          signals,
          exclusionReason,
          recoveryAction: getSelectionRecoveryAction(packageName, status, exclusionReason),
        },
      ];
    })
    .sort((left, right) => left.packageName.localeCompare(right.packageName));
}

export function getCoreCoverageSelectionWarnings(
  candidates: readonly CoreCoverageSelectionCandidate[],
): string[] {
  return candidates
    .filter((candidate) => candidate.status === "missing")
    .map(
      (candidate) =>
        `${candidate.packageName}: candidate signals [${candidate.signals.join(", ")}] but missing from test:coverage:core. ${candidate.recoveryAction}`,
    );
}

export function getCoreCoverageConfigurationErrors({
  coreCoveragePackages,
  thresholdPackages,
  selectionCandidates,
}: CoreCoverageConfigurationInput): string[] {
  const coreCoverageSet = new Set(coreCoveragePackages);
  const thresholdSet = new Set(thresholdPackages);
  const errors: string[] = [];

  for (const candidate of selectionCandidates) {
    if (candidate.signals.includes("1.0 spine package") && candidate.status !== "included") {
      errors.push(
        `${candidate.packageName}: 1.0 spine package must be included in test:coverage:core. ${candidate.recoveryAction}`,
      );
    }
  }

  for (const packageName of coreCoveragePackages) {
    if (!thresholdSet.has(packageName)) {
      errors.push(
        `${packageName}: test:coverage:core package is missing from vitest CORE_COVERAGE_PACKAGES, so core coverage thresholds would not apply.`,
      );
    }
  }

  for (const packageName of thresholdPackages) {
    if (!coreCoverageSet.has(packageName)) {
      errors.push(
        `${packageName}: vitest CORE_COVERAGE_PACKAGES entry is missing from test:coverage:core filters.`,
      );
    }
  }

  return errors;
}

function formatWarnings(warnings: string[]): string {
  return warnings.length > 0 ? warnings.join("; ") : "없음";
}

function formatCoveragePct(totals: CoverageTotals | null, metric: CoverageMetric): string {
  return totals ? totals[metric].pct.toFixed(2) : "n/a";
}

function formatSelectionMembership(candidate: CoreCoverageSelectionCandidate): string {
  return candidate.inCoreCoverageSet ? "included" : "not included";
}

function formatSelectionStatus(candidate: CoreCoverageSelectionCandidate): string {
  switch (candidate.status) {
    case "included":
      return "included";
    case "temporarily-excluded":
      return "temporary exclusion";
    case "missing":
      return "warning";
  }
}

function writeReport(
  results: PackageCoverageResult[],
  baselineValidationErrors: string[],
  configurationErrors: string[],
  selectionCandidates: CoreCoverageSelectionCandidate[],
) {
  mkdirSync(reportDirectory, { recursive: true });

  const missingSummaryWarnings = results
    .filter((result) => result.missingSummaryWarning)
    .map((result) => `- ${result.packageName}: ${result.missingSummaryWarning}`);
  const thresholdWarnings = results.flatMap((result) =>
    result.thresholdWarnings.map((warning) => `- ${result.packageName}: ${warning}`),
  );
  const baselineWarnings = results.flatMap((result) =>
    result.baselineWarnings.map((warning) => `- ${result.packageName}: ${warning}`),
  );
  const selectionWarnings = getCoreCoverageSelectionWarnings(selectionCandidates);

  const reportLines = [
    "# Core Coverage Warning Report",
    "",
    "- coverage 실행: gate step (`pnpm test:coverage:core`)에서 별도 실행",
    "- PR 표시: CI job summary와 `core-coverage-warning-report` artifact에 동일 report 게시",
    "- 종료 코드: 1.0 spine 누락, coverage/threshold set 불일치, invalid baseline data는 실패한다. 비-spine selection warning과 baseline regression warning은 advisory로 남긴다.",
    "",
    "## 현재 core coverage set",
    ...CORE_COVERAGE_PACKAGES.map((packageName) => `- ${packageName}`),
    "",
    "## 현재 core coverage threshold set",
    ...CORE_COVERAGE_THRESHOLD_PACKAGES.map((packageName) => `- ${packageName}`),
    "",
    "## Selection 정책 신호",
    "- 후보 입력: `docs/package-catalog.json`, public workspace package manifest, `package.json`의 `test:coverage:core` filter.",
    "- 후보 신호: 1.0 spine package, production-ready maturity, Core/Integration/Protocol/Transport catalog group, retry/events/context/auth/telemetry/transport/health/problem/framework contract package.",
    "- 1.0 spine 누락과 coverage/threshold set 불일치는 실패한다. 비-spine 누락 후보는 warning-only로 보고한다.",
    "- 임시 제외가 필요하면 `scripts/core-coverage-warning-check.mts`의 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 package name과 사유를 추가한다.",
    "",
    "## Core coverage selection candidates",
    "| 패키지 | Current set | Status | Signals | Recovery action |",
    "| --- | --- | --- | --- | --- |",
    ...selectionCandidates.map(
      (candidate) =>
        `| \`${candidate.packageName}\` | ${formatSelectionMembership(candidate)} | ${formatSelectionStatus(candidate)} | ${candidate.signals.join(", ")} | ${candidate.recoveryAction} |`,
    ),
    "",
    "## Threshold 규칙",
    `- lines: ${CORE_COVERAGE_THRESHOLDS.lines}%`,
    `- branches: ${CORE_COVERAGE_THRESHOLDS.branches}%`,
    `- functions: ${CORE_COVERAGE_THRESHOLDS.functions}%`,
    `- statements: ${CORE_COVERAGE_THRESHOLDS.statements}%`,
    "- 적용 조건: `CORE_COVERAGE=true`이고 현재 cwd가 핵심 패키지 경로일 때만 강제 threshold 적용",
    "",
    "## 예외/범위 제한",
    "- threshold 강제 범위는 `vitest.config.ts`의 `CORE_COVERAGE_PACKAGES`에 포함된 패키지로 고정한다.",
    "- selection report는 core coverage 후보를 별도로 표시하지만, 자동으로 `test:coverage:core` filter를 확장하지 않는다.",
    "- 전 저장소 일괄 threshold 강제는 이번 단계에서 도입하지 않는다.",
    "- baseline 부재는 실패 대신 warning으로 기록한다.",
    "- coverage summary가 있는 패키지의 0 baseline은 `INTENTIONAL_ZERO_BASELINE_REASONS`에 bootstrap 예외 사유가 없는 한 invalid data로 실패한다.",
    "",
    "## 패키지별 결과",
    "| 패키지 | Statements | Branches | Functions | Lines | Threshold warning | Baseline warning |",
    "| --- | ---: | ---: | ---: | ---: | --- | --- |",
    ...results.map(
      (result) =>
        `| \`${result.packageName}\` | ${formatCoveragePct(result.totals, "statements")} | ${formatCoveragePct(result.totals, "branches")} | ${formatCoveragePct(result.totals, "functions")} | ${formatCoveragePct(result.totals, "lines")} | ${formatWarnings(result.thresholdWarnings)} | ${formatWarnings(result.baselineWarnings)} |`,
    ),
    "",
    "## Warning summary",
    selectionWarnings.length > 0 ? "### Selection warnings" : "### Selection warnings\n- 없음",
    ...selectionWarnings.map((warning) => `- ${warning}`),
    "",
    missingSummaryWarnings.length > 0
      ? "### Missing coverage summaries"
      : "### Missing coverage summaries\n- 없음",
    ...(missingSummaryWarnings.length > 0 ? missingSummaryWarnings : []),
    "",
    thresholdWarnings.length > 0 ? "### Threshold warnings" : "### Threshold warnings\n- 없음",
    ...(thresholdWarnings.length > 0 ? thresholdWarnings : []),
    "",
    configurationErrors.length > 0
      ? "### Core coverage configuration errors"
      : "### Core coverage configuration errors\n- 없음",
    ...configurationErrors.map((warning) => `- ${warning}`),
    "",
    baselineValidationErrors.length > 0
      ? "### Baseline data errors"
      : "### Baseline data errors\n- 없음",
    ...baselineValidationErrors.map((warning) => `- ${warning}`),
    "",
    baselineWarnings.length > 0 ? "### Baseline regressions" : "### Baseline regressions\n- 없음",
    ...(baselineWarnings.length > 0 ? baselineWarnings : []),
    "",
    "## Enforce 전환 메모",
    "- 대상 유지: `CORE_COVERAGE_PACKAGES`에 포함된 패키지부터 threshold를 유지한다.",
    "- 신규 1.0 spine package는 `test:coverage:core`, `CORE_COVERAGE_PACKAGES`, baseline row가 모두 준비되어야 한다.",
    "- 비-spine core 후보는 selection warning, coverage summary, baseline row가 PR summary에 표시된 뒤 core set에 추가한다.",
    "- 비-spine selection warning을 blocking으로 전환하려면 누락 후보가 0이거나 각 후보에 만료 가능한 temporary exclusion 사유가 있어야 한다.",
    "- baseline을 의도적으로 갱신할 때는 `pnpm test:coverage:core`를 먼저 실행하고, 생성된 `coverage-summary.json`의 total percentages를 `ci-reports/coverage/core-baseline.txt`에 반영한 뒤 `pnpm test:coverage:core:warning`을 실행한다.",
    "- threshold 상향은 `retry-core functions` 개선 이후 별도 태스크에서 검토한다.",
    "- baseline regression이 연속 0회가 아니라 안정적으로 해소된 이후에만 hard fail 전환을 검토한다.",
  ];

  writeFileSync(reportPath, `${reportLines.join("\n")}\n`);
}

async function main() {
  const results = CORE_COVERAGE_PACKAGES.map((packageName) => readCoverageSummary(packageName));
  const baselineValidationErrors = validateBaselineEntries(results, baselineByPackage);
  const selectionCandidates = getCoreCoverageSelectionCandidates({
    catalog: PACKAGE_CATALOG,
    workspacePackageNames: WORKSPACE_PACKAGE_NAMES,
    coreCoveragePackages: CORE_COVERAGE_PACKAGES,
    temporaryExclusions: TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS,
  });
  const configurationErrors = getCoreCoverageConfigurationErrors({
    coreCoveragePackages: CORE_COVERAGE_PACKAGES,
    thresholdPackages: CORE_COVERAGE_THRESHOLD_PACKAGES,
    selectionCandidates,
  });

  writeReport(results, baselineValidationErrors, configurationErrors, selectionCandidates);

  console.log(`\n⚠️  Core coverage warning report written to ${resolve(reportPath)}`);

  const totalSelectionWarnings = getCoreCoverageSelectionWarnings(selectionCandidates).length;
  const totalWarnings = results.reduce(
    (count, result) =>
      count +
      (result.missingSummaryWarning ? 1 : 0) +
      result.thresholdWarnings.length +
      result.baselineWarnings.length,
    totalSelectionWarnings,
  );
  const totalErrors = baselineValidationErrors.length + configurationErrors.length;

  console.log(`⚠️  Total core coverage selection warnings: ${totalSelectionWarnings}`);
  console.log(`⚠️  Total core coverage warnings: ${totalWarnings}`);
  if (totalErrors > 0) {
    for (const error of configurationErrors) {
      console.error(`❌ ${error}`);
    }
    for (const error of baselineValidationErrors) {
      console.error(`❌ ${error}`);
    }
    console.error(`❌ Total core coverage hard errors: ${totalErrors}`);
  } else {
    console.log("✅ Total core coverage hard errors: 0");
  }
  process.exit(totalErrors > 0 ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error("Failed to generate core coverage warning report:", error);
    process.exit(1);
  });
}

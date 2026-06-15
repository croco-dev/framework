import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

const BASELINE_METRICS: CoverageMetric[] = ["statements", "branches", "functions", "lines"];
const INTENTIONAL_ZERO_BASELINE_REASONS: Record<string, string> = {};

const projectRoot = process.cwd();
const baselinePath = join(projectRoot, "ci-reports", "coverage", "core-baseline.txt");
const reportDirectory = join(projectRoot, "ci-reports", "coverage", "core-warning");
const reportPath = join(reportDirectory, "report.md");
const packageJsonPath = join(projectRoot, "package.json");
const vitestConfigPath = join(projectRoot, "vitest.config.ts");

const CORE_COVERAGE_PACKAGES = readCoreCoveragePackages();
const CORE_COVERAGE_THRESHOLDS = readCoreCoverageThresholds();

function readCoreCoveragePackages(): string[] {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
    scripts?: Record<string, string>;
  };
  const coreCoverageCommand = packageJson.scripts?.["test:coverage:core"];

  if (!coreCoverageCommand) {
    throw new Error(`failed to read test:coverage:core script from ${packageJsonPath}`);
  }

  const matches = coreCoverageCommand.matchAll(/--filter\s+(@croco\/[\w-]+)/g);
  const packages = Array.from(matches, ([, packageName]) => packageName);

  if (packages.length === 0) {
    throw new Error(`failed to read core coverage package filters from ${packageJsonPath}`);
  }

  return packages;
}

function readCoreCoverageThresholds(): Record<CoverageMetric, number> {
  const source = readFileSync(vitestConfigPath, "utf-8");
  const thresholdSection = source.match(/export const CORE_COVERAGE_THRESHOLDS = \{([\s\S]*?)\};/);
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

function toPackagePath(packageName: string): string {
  return join(projectRoot, packageName.replace("@croco/", "packages/"));
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

    if (cells.length !== 5 || !cells[0].startsWith("`@croco/")) {
      continue;
    }

    const packageName = cells[0].slice(1, -1);

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

function formatWarnings(warnings: string[]): string {
  return warnings.length > 0 ? warnings.join("; ") : "없음";
}

function formatCoveragePct(totals: CoverageTotals | null, metric: CoverageMetric): string {
  return totals ? totals[metric].pct.toFixed(2) : "n/a";
}

function writeReport(results: PackageCoverageResult[], baselineValidationErrors: string[]) {
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

  const reportLines = [
    "# Core Coverage Baseline Report",
    "",
    "- coverage 실행: gate step (`pnpm test:coverage:core`)에서 별도 실행",
    "- PR 표시: CI job summary와 `core-coverage-warning-report` artifact에 동일 report 게시",
    "- warning-only 종료 코드: baseline data가 valid하면 warning 수와 무관하게 0, invalid baseline data는 1",
    "",
    "## 적용 대상",
    ...CORE_COVERAGE_PACKAGES.map((packageName) => `- ${packageName}`),
    "",
    "## Threshold 규칙",
    `- lines: ${CORE_COVERAGE_THRESHOLDS.lines}%`,
    `- branches: ${CORE_COVERAGE_THRESHOLDS.branches}%`,
    `- functions: ${CORE_COVERAGE_THRESHOLDS.functions}%`,
    `- statements: ${CORE_COVERAGE_THRESHOLDS.statements}%`,
    "- 적용 조건: `CORE_COVERAGE=true`이고 현재 cwd가 핵심 패키지 경로일 때만 강제 threshold 적용",
    "",
    "## 예외/범위 제한",
    "- 1차 warning-only 범위는 `vitest.config.ts`의 `CORE_COVERAGE_PACKAGES`에 포함된 패키지로 고정한다.",
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
    missingSummaryWarnings.length > 0
      ? "### Missing coverage summaries"
      : "### Missing coverage summaries\n- 없음",
    ...(missingSummaryWarnings.length > 0 ? missingSummaryWarnings : []),
    "",
    thresholdWarnings.length > 0 ? "### Threshold warnings" : "### Threshold warnings\n- 없음",
    ...(thresholdWarnings.length > 0 ? thresholdWarnings : []),
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
    "- 대상 유지: `CORE_COVERAGE_PACKAGES`에 포함된 패키지부터 유지한다.",
    "- 신규 core package는 coverage summary와 baseline row가 PR summary에 표시된 뒤 core set에 추가한다.",
    "- baseline을 의도적으로 갱신할 때는 `pnpm test:coverage:core`를 먼저 실행하고, 생성된 `coverage-summary.json`의 total percentages를 `ci-reports/coverage/core-baseline.txt`에 반영한 뒤 `pnpm test:coverage:core:warning`을 실행한다.",
    "- threshold 상향은 `retry-core functions` 개선 이후 별도 태스크에서 검토한다.",
    "- baseline regression이 연속 0회가 아니라 안정적으로 해소된 이후에만 hard fail 전환을 검토한다.",
  ];

  writeFileSync(reportPath, `${reportLines.join("\n")}\n`);
}

async function main() {
  const results = CORE_COVERAGE_PACKAGES.map((packageName) => readCoverageSummary(packageName));
  const baselineValidationErrors = validateBaselineEntries(results, baselineByPackage);

  writeReport(results, baselineValidationErrors);

  console.log(`\n⚠️  Core coverage baseline report written to ${resolve(reportPath)}`);

  const totalWarnings = results.reduce(
    (count, result) =>
      count +
      (result.missingSummaryWarning ? 1 : 0) +
      result.thresholdWarnings.length +
      result.baselineWarnings.length,
    0,
  );
  const totalErrors = baselineValidationErrors.length;

  console.log(`⚠️  Total core coverage warnings: ${totalWarnings}`);
  if (totalErrors > 0) {
    for (const error of baselineValidationErrors) {
      console.error(`❌ ${error}`);
    }
    console.error(`❌ Total core coverage baseline errors: ${totalErrors}`);
  } else {
    console.log("✅ Total core coverage baseline errors: 0");
  }
  process.exit(totalErrors > 0 ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error("Failed to generate core coverage warning report:", error);
    process.exit(1);
  });
}

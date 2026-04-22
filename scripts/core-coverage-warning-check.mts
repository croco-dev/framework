import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { hrtime } from 'node:process';

type CoverageMetric = 'lines' | 'branches' | 'functions' | 'statements';

type CoverageTotals = Record<CoverageMetric, { pct: number }>;

type CoverageSummary = {
  total: CoverageTotals;
};

type PackageCoverageResult = {
  packageName: string;
  packagePath: string;
  summaryPath: string;
  totals: CoverageTotals;
  thresholdWarnings: string[];
  baselineWarnings: string[];
};

type BaselineEntry = {
  packageName: string;
  statements: number;
  branches: number;
  functions: number;
  lines: number;
};

const projectRoot = process.cwd();
const baselinePath = join(projectRoot, '.sisyphus/evidence/task-3-coverage-baseline.txt');
const reportDirectory = join(projectRoot, 'coverage', 'core-warning');
const reportPath = join(reportDirectory, 'report.md');
const vitestConfigPath = join(projectRoot, 'vitest.config.ts');

const { coreCoveragePackages: CORE_COVERAGE_PACKAGES, coreCoverageThresholds: CORE_COVERAGE_THRESHOLDS } =
  readVitestCoverageConfig();

function readVitestCoverageConfig(): {
  coreCoveragePackages: string[];
  coreCoverageThresholds: Record<CoverageMetric, number>;
} {
  const source = readFileSync(vitestConfigPath, 'utf-8');
  const packageSection = source.match(/export const CORE_COVERAGE_PACKAGES = \[([\s\S]*?)\];/);
  const thresholdSection = source.match(/export const CORE_COVERAGE_THRESHOLDS = \{([\s\S]*?)\};/);

  const packageItems = packageSection?.[1];
  const thresholdItems = thresholdSection?.[1];

  if (!packageItems || !thresholdItems) {
    throw new Error(`failed to read core coverage config from ${vitestConfigPath}`);
  }

  const coreCoveragePackages = packageItems
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/[' ,]/g, ''));

  const coreCoverageThresholds = thresholdItems
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce<Record<CoverageMetric, number>>(
      (thresholds, line) => {
        const [metric, value] = line
          .replace(',', '')
          .split(':')
          .map((part) => part.trim());

        if (metric === 'lines' || metric === 'branches' || metric === 'functions' || metric === 'statements') {
          thresholds[metric] = Number.parseFloat(value);
        }

        return thresholds;
      },
      {
        lines: 0,
        branches: 0,
        functions: 0,
        statements: 0,
      }
    );

  return {
    coreCoveragePackages,
    coreCoverageThresholds,
  };
}

function toPackagePath(packageName: string): string {
  return join(projectRoot, packageName.replace('@croco/', 'packages/'));
}

function removeCoverageOutputs() {
  for (const packageName of CORE_COVERAGE_PACKAGES) {
    rmSync(join(toPackagePath(packageName), 'coverage'), { recursive: true, force: true });
  }
}

function runCoverageCommand(): number {
  const result = spawnSync('pnpm', ['test:coverage:core'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      SKIP_ENV_VALIDATION: 'true',
    },
  });

  if (typeof result.status === 'number') {
    return result.status;
  }

  return 1;
}

function readCoverageSummary(packageName: string): PackageCoverageResult {
  const packagePath = toPackagePath(packageName);
  const summaryPath = join(packagePath, 'coverage', 'coverage-summary.json');

  if (!existsSync(summaryPath)) {
    throw new Error(`coverage summary not found: ${summaryPath}`);
  }

  const coverageSummary = JSON.parse(readFileSync(summaryPath, 'utf-8')) as CoverageSummary;
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
  };
}

function getThresholdWarnings(totals: CoverageTotals): string[] {
  return (Object.entries(CORE_COVERAGE_THRESHOLDS) as [CoverageMetric, number][])
    .filter(([metric, threshold]) => totals[metric].pct < threshold)
    .map(([metric, threshold]) => `${metric} ${totals[metric].pct.toFixed(2)}% < ${threshold}%`);
}

function parseBaseline(): Map<string, BaselineEntry> {
  if (!existsSync(baselinePath)) {
    return new Map();
  }

  const baselineEntries = new Map<string, BaselineEntry>();
  const lines = readFileSync(baselinePath, 'utf-8').split(/\r?\n/);

  for (const line of lines) {
    const cells = line
      .split('|')
      .map((cell) => cell.trim())
      .filter(Boolean);

    if (cells.length !== 5 || !cells[0].startsWith('`@croco/')) {
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

const baselineByPackage = parseBaseline();

function getBaselineWarnings(packageName: string, totals: CoverageTotals): string[] {
  const baseline = baselineByPackage.get(packageName);

  if (!baseline) {
    return ['baseline missing'];
  }

  return (Object.keys(CORE_COVERAGE_THRESHOLDS) as CoverageMetric[])
    .filter((metric) => totals[metric].pct < baseline[metric])
    .map((metric) => `${metric} ${totals[metric].pct.toFixed(2)}% < baseline ${baseline[metric].toFixed(2)}%`);
}

function formatWarnings(warnings: string[]): string {
  return warnings.length > 0 ? warnings.join('; ') : '없음';
}

function writeReport(results: PackageCoverageResult[], durationMs: number, commandExitCode: number) {
  mkdirSync(reportDirectory, { recursive: true });

  const thresholdWarnings = results.flatMap((result) =>
    result.thresholdWarnings.map((warning) => `- ${result.packageName}: ${warning}`)
  );
  const baselineWarnings = results.flatMap((result) =>
    result.baselineWarnings.map((warning) => `- ${result.packageName}: ${warning}`)
  );

  const reportLines = [
    '# Core Coverage Warning Report',
    '',
    `- 실행 명령: \`pnpm test:coverage:core\``,
    `- 소요 시간: ${durationMs.toFixed(0)}ms`,
    `- coverage 명령 종료 코드: ${commandExitCode}`,
    `- warning-only 종료 코드: 0`,
    '',
    '## 적용 대상',
    ...CORE_COVERAGE_PACKAGES.map((packageName) => `- ${packageName}`),
    '',
    '## Threshold 규칙',
    `- lines: ${CORE_COVERAGE_THRESHOLDS.lines}%`,
    `- branches: ${CORE_COVERAGE_THRESHOLDS.branches}%`,
    `- functions: ${CORE_COVERAGE_THRESHOLDS.functions}%`,
    `- statements: ${CORE_COVERAGE_THRESHOLDS.statements}%`,
    '- 적용 조건: `CORE_COVERAGE=true`이고 현재 cwd가 핵심 패키지 경로일 때만 강제 threshold 적용',
    '',
    '## 예외/범위 제한',
    '- 1차 warning-only 범위는 기존 5개 core 패키지로 고정한다.',
    '- 전 저장소 일괄 threshold 강제는 이번 단계에서 도입하지 않는다.',
    '- baseline 부재는 실패 대신 warning으로 기록한다.',
    '',
    '## 패키지별 결과',
    '| 패키지 | Statements | Branches | Functions | Lines | Threshold warning | Baseline warning |',
    '| --- | ---: | ---: | ---: | ---: | --- | --- |',
    ...results.map(
      (result) =>
        `| \`${result.packageName}\` | ${result.totals.statements.pct.toFixed(2)} | ${result.totals.branches.pct.toFixed(2)} | ${result.totals.functions.pct.toFixed(2)} | ${result.totals.lines.pct.toFixed(2)} | ${formatWarnings(result.thresholdWarnings)} | ${formatWarnings(result.baselineWarnings)} |`
    ),
    '',
    '## Warning summary',
    thresholdWarnings.length > 0 ? '### Threshold warnings' : '### Threshold warnings\n- 없음',
    ...(thresholdWarnings.length > 0 ? thresholdWarnings : []),
    '',
    baselineWarnings.length > 0 ? '### Baseline regressions' : '### Baseline regressions\n- 없음',
    ...(baselineWarnings.length > 0 ? baselineWarnings : []),
    '',
    '## Enforce 전환 메모',
    '- 대상 유지: `CORE_COVERAGE_PACKAGES`에 포함된 5개 core 패키지부터 유지한다.',
    '- threshold 상향은 `retry-core functions` 개선 이후 별도 태스크에서 검토한다.',
    '- baseline regression이 연속 0회가 아니라 안정적으로 해소된 이후에만 hard fail 전환을 검토한다.',
  ];

  writeFileSync(reportPath, `${reportLines.join('\n')}\n`);
}

async function main() {
  removeCoverageOutputs();

  const startedAt = hrtime.bigint();
  const commandExitCode = runCoverageCommand();
  const durationMs = Number(hrtime.bigint() - startedAt) / 1_000_000;

  const results = CORE_COVERAGE_PACKAGES.map((packageName) => readCoverageSummary(packageName));

  writeReport(results, durationMs, commandExitCode);

  console.log(`\n⚠️  Core coverage warning-only report written to ${resolve(reportPath)}`);

  if (commandExitCode !== 0) {
    console.warn(
      `⚠️  Core coverage command exited with code ${commandExitCode}, but warning-only stage is forcing success.`
    );
  }

  const totalWarnings = results.reduce(
    (count, result) => count + result.thresholdWarnings.length + result.baselineWarnings.length,
    0
  );

  console.log(`⚠️  Total core coverage warnings: ${totalWarnings}`);
  process.exit(0);
}

main().catch((error) => {
  console.error('Failed to generate core coverage warning report:', error);
  process.exit(1);
});

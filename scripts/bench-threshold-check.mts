import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Benchmark } from 'vitest';
import { createVitest } from 'vitest/node';

interface Thresholds {
  [benchmarkName: string]: {
    p75: number;
  };
}

interface Baseline {
  [benchmarkName: string]: {
    p75: number;
  };
}

interface BenchmarkReport {
  name: string;
  p75: number;
  threshold?: number;
  baseline?: number;
  thresholdStatus?: 'pass' | 'fail' | 'skip';
  baselineStatus?: 'pass' | 'fail' | 'skip';
  thresholdDiff?: number;
  baselineDiff?: number;
}

const projectRoot = process.cwd();
const thresholdsPath = join(projectRoot, 'benchmarks', 'thresholds.json');
const baselinePath = join(projectRoot, 'benchmarks', 'baseline.json');

const args = process.argv.slice(2);
const isUpdateBaseline = args.includes('--update-baseline');
const outputJsonArg = args.find((a) => a.startsWith('--output-json='));
const outputJsonPath = outputJsonArg ? outputJsonArg.split('=')[1] : null;

const BASELINE_TOLERANCE = 0.2;
const CI_THRESHOLD_MULTIPLIER = 2;
const LOCAL_THRESHOLD_MULTIPLIER = 1;
const BOX_WIDTH = 62;

function loadThresholds(): Thresholds {
  if (!existsSync(thresholdsPath)) {
    console.error(`⚠️  thresholds.json not found at ${thresholdsPath}`);
    process.exit(1);
  }
  try {
    return JSON.parse(readFileSync(thresholdsPath, 'utf-8'));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to parse thresholds.json at ${thresholdsPath}: ${message}`);
    process.exit(1);
  }
}

function loadBaseline(): Baseline | null {
  if (!existsSync(baselinePath)) {
    return null;
  }
  return JSON.parse(readFileSync(baselinePath, 'utf-8'));
}

function saveBaseline(results: BenchmarkReport[]) {
  const baseline: Baseline = {};
  for (const result of results) {
    baseline[result.name] = { p75: result.p75 };
  }
  writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));
  console.log(`\n✅ Baseline updated at ${baselinePath}`);
}

function extractP75(benchmark: Benchmark): number {
  const result = benchmark.result;
  if (!result || !result.benchmark || !result.benchmark.samples) {
    return Number.NaN;
  }
  const samples = result.benchmark.samples;
  if (samples.length === 0) {
    return Number.NaN;
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const p75Index = Math.min(Math.floor(sorted.length * 0.75), sorted.length - 1);
  const value = sorted[p75Index];
  return value === undefined ? Number.NaN : value;
}

function formatDuration(ms: number): string {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(1)}μs`;
  }
  return `${ms.toFixed(1)}ms`;
}

function formatDiff(actual: number, expected: number): string {
  const diff = actual - expected;
  if (expected === 0) {
    if (diff === 0) return '+0.0%';
    return diff > 0 ? '+∞' : '-∞';
  }
  const percent = ((diff / expected) * 100).toFixed(1);
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${percent}%`;
}

async function main() {
  const thresholds = loadThresholds();
  const baseline = loadBaseline();

  const vitest = await createVitest('benchmark', {
    config: './vitest.config.bench.ts',
    reporters: [],
  });

  try {
    await vitest.start();

    const files = vitest.state.getFiles();
    const reports: BenchmarkReport[] = [];
    let allPassed = true;

    for (const file of files) {
      for (const task of file.tasks) {
        if (task.result?.benchmark) {
          const benchmark = task.result.benchmark;
          const p75 = extractP75({ result: { benchmark } } as Benchmark);
          const name = task.name;

          const report: BenchmarkReport = {
            name,
            p75,
          };

          if (thresholds[name]) {
            const threshold = thresholds[name].p75;
            report.threshold = threshold;
            const ciMargin = process.env.CI ? CI_THRESHOLD_MULTIPLIER : LOCAL_THRESHOLD_MULTIPLIER;
            const effectiveThreshold = threshold * ciMargin;
            report.thresholdDiff = p75 - threshold;

            if (p75 > effectiveThreshold) {
              report.thresholdStatus = 'fail';
              allPassed = false;
            } else {
              report.thresholdStatus = 'pass';
            }
          } else {
            report.thresholdStatus = 'skip';
            console.warn(`⚠️  No threshold defined for "${name}" - skipping threshold check`);
          }

          if (baseline?.[name]) {
            const baselineP75 = baseline[name].p75;
            report.baseline = baselineP75;
            report.baselineDiff = p75 - baselineP75;

            if (Math.abs(p75 - baselineP75) > baselineP75 * BASELINE_TOLERANCE) {
              report.baselineStatus = 'fail';
              allPassed = false;
            } else {
              report.baselineStatus = 'pass';
            }
          } else {
            report.baselineStatus = 'skip';
          }

          reports.push(report);
        }
      }
    }

    if (isUpdateBaseline) {
      saveBaseline(reports);
      process.exit(0);
    }

    if (outputJsonPath) {
      writeFileSync(outputJsonPath, JSON.stringify({ allPassed, reports }, null, 2));
    }

    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║ Cold-Start Benchmark Report                            ║');
    console.log('╠══════════════════════════════════════════════════════════╣');

    for (const report of reports) {
      const thresholdPart = report.threshold ? `threshold: ${formatDuration(report.threshold)}` : 'no threshold';
      const baselinePart = report.baseline ? `baseline: ${formatDuration(report.baseline)}` : '';

      const statusIcon =
        report.thresholdStatus === 'fail' || report.baselineStatus === 'fail'
          ? '❌'
          : report.thresholdStatus === 'skip' && report.baselineStatus === 'skip'
            ? '⚠️ '
            : '✅';

      let line = `║ ${report.name.padEnd(30)} p75: ${formatDuration(report.p75).padEnd(10)}`;

      if (report.threshold) {
        line += ` ${thresholdPart.padEnd(20)}`;
      }
      if (report.baseline) {
        const diff = report.baselineDiff !== undefined ? formatDiff(report.p75, report.baseline) : '';
        line += ` ${baselinePart.padEnd(20)} (${diff})`;
      }

      line += ` ${statusIcon} ║`;
      console.log(line.substring(0, BOX_WIDTH));
    }

    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║ Result: ${allPassed ? 'ALL PASSED' : 'FAILED'}${' '.repeat(40)} ║`);
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    process.exit(allPassed ? 0 : 1);
  } finally {
    await vitest.close();
  }
}

main().catch((err) => {
  console.error('Error running benchmark checks:', err);
  process.exit(1);
});

# Coverage and Benchmark Gate Transition Guide

## Current State

- Benchmark gate mode: `enforce` (`BENCHMARK_GATE_MODE=enforce` in
  `.github/workflows/benchmark.yml`).
- Benchmark command: `pnpm bench:check --output-json=benchmark-result.json`.
- Benchmark environment: the benchmark runner defaults `TELEMETRY_ENABLED=false` before Vitest starts so
  telemetry exporter setup does not dominate cold-start timing. Set `TELEMETRY_ENABLED=true` explicitly only for
  ad hoc telemetry-enabled benchmark investigations.
- Benchmark workflow behavior: the benchmark and readiness steps keep `continue-on-error: true` so artifacts and
  PR comments are published even when a gate check exits non-zero. The final hard-fail step runs in `enforce` mode
  when either the benchmark checker or enforce-readiness reporter fails.
- Benchmark result contract: `benchmark-result.json` is not enforce-ready unless every emitted benchmark row has
  `thresholdStatus` and `baselineStatus` values other than `skip`, and no runner/module failure is recorded in
  `gateFailures`.
- Latest-five-green evidence: `ci-reports/benchmark/latest-five-green-runs.md` carries the structured
  `croco-benchmark-variance-evidence:v1` contract used by `pnpm bench:readiness`.
- Core coverage gate: `pnpm test:coverage:core` already enforces the configured Vitest thresholds for the core
  package set. `pnpm test:coverage:core:warning` publishes the package baseline/threshold drift report without
  making that report a second hard gate.

## Benchmark Enforce-Ready Checklist

Keep `BENCHMARK_GATE_MODE=enforce` only while all items below remain true.

### Threshold And Baseline Coverage

- [x] `benchmark-result.json` has no `thresholdStatus: "skip"` rows.
- [x] `benchmark-result.json` has no `baselineStatus: "skip"` rows.
- [x] `gateFailures` does not include runner failures, module failures, missing reports, threshold skips, or
      baseline skips.
- [x] Every emitted benchmark row has a matching key in both `benchmarks/thresholds.json` and
      `benchmarks/baseline.json`.

### Baseline Stability

- [x] The latest five green benchmark workflow runs for the same emitted benchmark row set have been reviewed.
- [x] Each row's p75 spread across those runs is at or below 15%.
- [x] No reviewed run contains benchmark runner errors, empty reports, threshold skips, or baseline skips.
- [x] Baseline updates are taken from the reviewed GitHub Actions benchmark environment with the benchmark runner's
      telemetry default, not from a noisy local-only run.
- [x] The variance review is provided to the readiness reporter at
      `ci-reports/benchmark/latest-five-green-runs.md` or with `pnpm bench:readiness --variance-evidence=<path>`.

Use this variance check for each benchmark row:

```text
spread = (max(p75) - min(p75)) / median(p75)
enforce-ready when spread <= 0.15 across the latest five green runs
```

### Variance Tolerance

- Current latest-five-green evidence tolerance: `VARIANCE_SPREAD_TOLERANCE = 0.15`.
- Current baseline tolerance: `BASELINE_TOLERANCE = 0.2`.
- Current threshold margin: local uses `1x`; CI uses `CI_THRESHOLD_MULTIPLIER = 2`.
- Enforce promotion should not tighten either value in the same PR that flips `BENCHMARK_GATE_MODE`; first
  prove stable warning-only output, then tighten in a follow-up.

### PR Visibility

- `benchmark-result.json`, `ci-reports/benchmark/summary.md`, and
  `ci-reports/benchmark/latest-five-green-runs.md` are uploaded as the benchmark readiness report
  artifact.
- The benchmark PR comment must include `gateFailures`, skip reasons, and an explicit empty-report row when no
  benchmarks were collected.
- Core coverage baseline regressions are published to the CI job summary and uploaded as the
  `core-coverage-warning-report` artifact.

### Skip Policy

- Documentation-only changes rely on the benchmark workflow `paths` filter and should not run the benchmark job.
- Source, benchmark, config, or lockfile changes that trigger the benchmark workflow must produce a report with no
  threshold or baseline skips.
- New benchmark rows must land with both threshold and baseline entries, or the checker should remain non-zero in
  warning-only mode until those entries are added.
- Manual benchmark skip is allowed only for unavailable external infrastructure, and the PR must state why the
  skipped run does not affect the changed code path.

### False Positive Handling

- For an apparent noisy benchmark failure, rerun the same commit up to three total attempts.
- Treat the benchmark as transient only when at least two of the three attempts pass without runner failures,
  empty reports, threshold skips, or baseline skips.
- If two attempts fail the same row against baseline or threshold, update code, threshold, or baseline policy
  before retrying again.

## Core Coverage Expansion Policy

The current core coverage set is read from the `test:coverage:core` script in `package.json`.

Add a package to the core coverage set when at least one of these is true:

- It defines framework-level contracts used by multiple downstream packages.
- It owns retry, events, context, auth, telemetry, transport, health, or release-critical behavior.
- A recent regression would be user-visible or would weaken release confidence.

Before adding a package:

- [ ] Its tests pass under `CORE_COVERAGE=true`.
- [ ] It can meet the configured 60% line/branch/function/statement thresholds, or the gap has a documented
      follow-up before enforce promotion.
- [ ] The package emits `coverage/coverage-summary.json` in the core coverage run.
- [ ] The baseline report shows the package row in the PR job summary and artifact.

## Promotion Steps

1. Keep `BENCHMARK_GATE_MODE=enforce`.
2. Run `pnpm build`.
3. Run `pnpm bench:check --output-json=benchmark-result.json`.
4. Confirm `benchmark-result.json` has no threshold or baseline skips.
5. Review the latest five green benchmark workflow artifacts for the variance rule above and update
   `ci-reports/benchmark/latest-five-green-runs.md`.
6. Run `pnpm test:coverage:core` and `pnpm test:coverage:core:warning`.
7. Confirm the core coverage baseline report appears in the CI job summary and artifact.
8. Preserve `BENCHMARK_GATE_MODE=enforce` only after the structured evidence remains valid.

## Workflow Reference

- `.github/workflows/benchmark.yml`: `BENCHMARK_GATE_MODE`, readiness artifact/comment publication, enforce
  hard-fail step.
- `.github/workflows/ci.yml`: core coverage threshold gate and core coverage baseline report publication.
- `scripts/bench-threshold-check.mts`: benchmark runner, threshold, baseline, skip, and result validation.
- `scripts/benchmark-readiness-report.mts`: enforce-readiness report generation from `benchmark-result.json`
  plus structured latest-five-green-run variance evidence.
- `scripts/post-benchmark-comment.mjs`: benchmark PR comment formatter.
- `scripts/core-coverage-warning-check.mts`: core coverage baseline/threshold report generator.
- `benchmarks/thresholds.json`: benchmark p75 absolute thresholds in milliseconds.
- `benchmarks/baseline.json`: benchmark p75 baselines in milliseconds from accepted green runs.

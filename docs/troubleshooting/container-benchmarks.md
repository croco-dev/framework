# Container benchmark investigation (#3435)

[Issue #3435](https://github.com/croco-dev/framework/issues/3435) investigated local Container benchmark
failures at commit `0e786bfbddf6cd983e1e62d88ed0f30d6d2aee9e`. The local failure reproduced; four independent
CI runs, including one at that exact commit, did not reproduce the threshold regression. Host contention is a
plausible contributor, but the precise local cause remains unresolved. These results do not establish a
transient local pass or justify changing the thresholds.

## What the benchmark measures

The timed callbacks in [Container.bench.ts](../../packages/framework-context/src/tests/Container.bench.ts)
include setup work:

- `Container.register × 50 components` measures `Container.reset()` followed by registration of 50 singleton
  classes. Its local p75 limit is 10 ms.
- `Container.validate (50 components)` measures `Container.reset()`, registration of those 50 classes plus
  `DepServiceA`, and `Container.validate({ force: true })`. Its local p75 limit is 20 ms. Despite the row name,
  it registers 51 classes and includes their registration cost.

[Container.register()](../../packages/framework-context/src/libs/Container.ts) captures a source location
when no explicit location is supplied. These fixtures use that path, which constructs and parses an error
stack for each registration. A slow validation row therefore does not isolate validation algorithm cost.

[The Vitest configuration](../../vitest.config.bench.ts) sets `fileParallelism: false`. This serializes
benchmark files within that run; it does not isolate the host from builds or tests in other worktrees.
[The runner](../../scripts/bench-threshold-check.mts) defaults `TELEMETRY_ENABLED=false` and applies the
[configured thresholds](../../benchmarks/thresholds.json) at 1× locally and 2× when `CI` is set.

## Observed results

The two local reports from the investigation commit contain these p75 values, rounded to three decimal
places in milliseconds:

| Attempt | Register × 50 | Validate | Gate result                                                     |
| ------- | ------------: | -------: | --------------------------------------------------------------- |
| Initial |        16.166 |   16.211 | Failed: registration exceeds 10 ms                              |
| Repeat  |        19.044 |   39.942 | Failed: registration exceeds 10 ms and validation exceeds 20 ms |

The initial process snapshot shows another worktree running repository typechecks and build processes.
The accompanying host load averages were `174.10`, `94.89`, and `46.71`. This records concurrent load;
it is not a controlled measurement of how much time these benchmarks lost to scheduling or contention.

A separate local diagnostic repeated the same reset-and-register workload 60 times in an ordinary
Vitest test. After discarding 10 warmup samples, wall-time p75 was 6.8925 ms and process CPU-time p75
was 5.753 ms. The slowest sample took 56.456709 ms elapsed while consuming 3.415 ms of process CPU time.
This supports investigating off-CPU delays, but it neither proves the cause of the earlier failures nor
counts as an official benchmark gate pass: the diagnostic used a different measurement harness.

The following completed GitHub Actions runs provide independent comparisons. Values are raw p75 timings
from each run's `benchmark-result.json`, displayed to six decimal places:

| Run                                                                            | Commit                                     | Register × 50 (ms) | Validate (ms) | Threshold gate     |
| ------------------------------------------------------------------------------ | ------------------------------------------ | -----------------: | ------------: | ------------------ |
| [38111923992](https://github.com/croco-dev/framework/actions/runs/38111923992) | `09c5b6d435bce035bc65b70b2dcc29f8d0eabf4b` |           3.191509 |      3.484054 | All 17 rows passed |
| [38112023227](https://github.com/croco-dev/framework/actions/runs/38112023227) | `60a3cf06be395409692c31d9940e50aea52d59b6` |           2.185391 |      2.489199 | All 17 rows passed |
| [38112143853](https://github.com/croco-dev/framework/actions/runs/38112143853) | `057d53bcb82b06c7ffb5aa3a97b61fd0c4b3162b` |           2.748974 |      3.116170 | All 17 rows passed |
| [38114868970](https://github.com/croco-dev/framework/actions/runs/38114868970) | `0e786bfbddf6cd983e1e62d88ed0f30d6d2aee9e` |           2.982708 |      3.371239 | All 17 rows passed |

For each comparison commit, the diff to the investigation commit is empty for `Container.ts`,
`Container.bench.ts`, `scripts/bench-threshold-check.mts`, `vitest.config.bench.ts`,
`benchmarks/thresholds.json`, `benchmarks/baseline.json`, and `.github/workflows/benchmark.yml`.
This establishes equivalence for those inspected inputs, not for every dependency or host condition.
Although CI uses the 2× margin, all eight registration/validation measurements also satisfy the local
10 ms and 20 ms limits. Each report has 17 rows, `allPassed: true`, and no `gateFailures`.

Passing the gate does not mean there was no baseline drift. The four reports respectively contain
12, 10, 11, and 12 rows with `baselineStatus: "fail"`, including rows outside registration and validation.
Both investigated rows have `baselineStatus: "pass"` in all four CI reports. The runner reports baseline
regressions above its 20% tolerance as advisory; threshold failures, runner failures, missing reports,
and threshold/baseline skips affect the gate. Keep the baseline warnings visible when interpreting a
green result.

## How to handle another local failure

Keep the existing [benchmark gate transition policy](../../benchmarks/benchmark-gate-transition.md).
It permits at most three total attempts on the same commit and requires at least two qualifying passes
to classify a failure as transient. Two failures of the same row require a code or policy update before
another retry. The two local failures here do not meet the transient-pass condition; independent CI
evidence does not relabel them.

Preserve the failed report and inspect host load and concurrent work before drawing a performance
conclusion. Any further investigation should distinguish registration, stack capture, validation, and
scheduling costs under controlled conditions. Do not retry until green, set `CI=true` locally to obtain
the larger margin, skip the row, disable source capture, or raise thresholds or baselines to absorb an
unexplained failure. Those changes would alter what the result proves.

No threshold regression reproduced in the inspected independent CI runs. This does not prove a causal
explanation for the repeatable local failure. No runtime, benchmark scope, threshold, baseline, or workflow change follows
from that inference.

# Package Quality Dashboard

Croco CI publishes a package quality dashboard from Turbo run summaries, dependency boundary scans, public API drift, and bundle-size warnings.
The dashboard is written to `ci-reports/package-quality/report.md`, appended to the GitHub Actions job summary, and uploaded as the `package-quality-dashboard` artifact.

## What It Shows

- Per-package `build`, `typecheck`, and `test` outcomes from the latest Turbo summaries.
- Provider, integration, transport, and presentation certification evidence from `pnpm provider-certification:check`, written to `ci-reports/package-quality/provider-certification.md` and `provider-certification.json`.
- Production-ready package evidence from `pnpm production-ready:check`, written to `ci-reports/package-quality/production-ready.md`.
- Failure evidence narrowed to the package, check, and Turbo log path.
- Repository dependency boundary results, starting with the `@croco/repository-core` Drizzle-free rule.
- Release metadata linkage through the `changeset-required:check` PR gate.
- The current rollout state for warning-only gates such as benchmark and bundle-size checks.
- Bundle-size artifact ownership from `ci-reports/package-quality/bundle-size.md`.

## Trunk Gate Strategy

The protected `trunk` branch keeps the existing hard gates:

- `changeset-required:check` for release-significant public package changes.
- `pnpm check`, including package manifest drift, docs catalog drift, release docs drift, circular dependency policy, dependency boundaries, lint, and format.
- `build`, `typecheck`, and `test` through Turbo package tasks.
- `provider-certification:check` after package tests, blocking production-ready extension packages without certified catalog evidence.
- `production-ready:check` after Turbo summaries, blocking production-ready packages that lack required maturity evidence.
- Package entrypoint and binary smoke checks.
- Generated app smoke, CLI integration tests, and core coverage.

The Croco 1.0 blocker scope comes from `docs/package-catalog.json` `spine.packages`.
Spine membership is release scope, not maturity: a beta spine package can still require 1.0
release-gate evidence, while a non-spine beta or alpha package does not block 1.0 unless it is
pulled into a generated-app golden path or certified adapter path.

Warning-only gates stay advisory until they have stable baselines and a clear owner:

- Production dependency audit is advisory in CI and remains visible in the security report.
- Core coverage selection and baseline warnings are posted to the job summary and artifact.
- Benchmark warnings stay warning-only unless `BENCHMARK_GATE_MODE=enforce` is explicitly set.
- Bundle-size warnings stay advisory while `ci-reports/bundle-size/baseline.json` is missing, incomplete, or still being stabilized.

Promote an advisory gate to a blocking trunk gate only when:

1. The dashboard identifies the exact package and check responsible for failures.
2. The baseline is committed or otherwise reproducible from protected-branch history.
3. New packages either participate in the gate or carry an explicit documented exemption.
4. The recovery action is local and deterministic for contributors.

## Core Coverage Warning Report

`pnpm test:coverage:core:warning` writes `ci-reports/coverage/core-warning/report.md`, appends it to the GitHub Actions job summary, and uploads it as the `core-coverage-warning-report` artifact.
The first rollout is warning-only: missing selection candidates are visible in CI, but only invalid baseline data can make the reporter exit non-zero.

Selection candidates come from executable repository signals:

- public workspace package manifests under `packages/*/package.json`;
- `docs/package-catalog.json` spine, maturity, and group membership;
- the current `package.json` `test:coverage:core` filter list;
- release-critical package names around framework contracts, retry/events/auth/telemetry/transport/health/problem surfaces.

Add a package to core coverage by updating the `test:coverage:core` script with a new `--filter @croco/<package>` entry, running `pnpm test:coverage:core`, adding the measured row to `ci-reports/coverage/core-baseline.txt`, then rerunning `pnpm test:coverage:core:warning`.
If the package is intentionally deferred, record a temporary reason in `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS` in `scripts/core-coverage-warning-check.mts` so the report preserves the decision instead of silently dropping the candidate.

Promote selection warnings to a blocking trunk gate only after:

1. Every candidate is either included in `test:coverage:core` or has a short-lived temporary exclusion reason.
2. Each included package has a coverage summary and committed baseline row from a reproducible protected-branch run.
3. New production-ready or release-critical packages trigger a deterministic local recovery action in the report.
4. Several PRs show no unexplained selection warnings and no invalid baseline rows.

## Bundle-Size Warning Report

`pnpm package-quality:report` writes `ci-reports/package-quality/bundle-size.md` and embeds the same warning status in the package quality dashboard.
The first rollout is warning-only: missing baselines are reported as setup work instead of being silently ignored or failing CI.
Baseline entries that do not match a measured artifact are also reported as warning-only stale setup work.

Measurement scope:

- publishable workspace packages (`private !== true`) that define a `build` script;
- generated `dist` artifacts ending in `.js`, `.mjs`, `.cjs`, `.css`, `.wasm`, `.map`, `.json`, or `.d.ts`;
- exact package and artifact paths for each measured size row.

Baseline input:

- Optional baseline file: `ci-reports/bundle-size/baseline.json`.
- Supported artifact keys: `<artifact path>` or `<package name>:<artifact path>`.
- Supported values: a byte number or an object with a `bytes` number.
- Unmatched baseline keys appear in the report until they are removed, renamed, or the generated artifact path is restored.

Local recovery:

```bash
pnpm build
pnpm package-quality:report
```

Promote bundle-size warnings to a blocking trunk gate only after:

1. `ci-reports/bundle-size/baseline.json` is committed from a green protected-branch build or another reproducible protected-branch source.
2. Every measured artifact resolves to exactly one package and artifact row with a local recovery command.
3. New publishable build packages either produce measured `dist` artifacts or carry a documented exemption.
4. Several PRs show stable package ownership, no missing baselines, no unmatched baselines, and acceptable bundle variance.

## Provider Certification Gate

`pnpm provider-certification:check` validates the certification source of truth in `docs/package-catalog.json`.
Certification is separate from maturity, but a production-ready package in the extension matrix groups (`Provider`, `Integration`, `Transport`, or `Presentation`) must have a `certification.records.<package>` entry with `state: "certified"`.

For each certified or production-ready extension package, the gate requires package-scoped evidence for:

- conformance;
- no-credential smoke;
- diagnostics;
- redaction;
- documented live-smoke behavior.

The gate also blocks `knownGaps` for certified or production-ready packages unless every gap has a package-scoped allowance under `certification.policy.knownGapAllowances.<package>.<gap>` with a non-empty `reason` and `owner`.
There is no global known-gap bypass.

Manual docs badges and compatibility claims are checked by scanning unfenced markdown for the Croco compatibility claim phrase in the root README, `docs`, package READMEs, and public docs content.
A claim must either live in the certified package README or name `@croco/<package>` with a matching certified catalog record.

Local recovery:

```bash
pnpm provider-certification:check
```

The CI gate appends `ci-reports/package-quality/provider-certification.md` to the GitHub Actions job summary and uploads both markdown and JSON with the package quality dashboard artifact.

## Production-Ready Package Gate

`pnpm production-ready:check` verifies every package listed under `maturity.production.packages` in `docs/package-catalog.json`.
The CI gate runs after Turbo `build`, `typecheck`, and `test` summaries, writes `ci-reports/package-quality/production-ready.md`, appends that report to the GitHub Actions job summary, and uploads it with the package quality dashboard artifact.

For each production-ready package, the gate requires:

- `packages/<name>/README.md`;
- generated API docs under `packages/docs/src/content/docs/api/<name>/`;
- package tests under `src/tests` or `src/__tests__`;
- `build`, `typecheck`, and `test` scripts with CI Turbo summary evidence;
- public API snapshot participation when `src/index.ts` is the package entrypoint;
- adapter, provider, integration, transport, or presentation maturity evidence linked from the relevant reference docs.

Fix failures by adding the missing artifact and rerunning the matching local command:

```bash
pnpm production-ready:check
pnpm turbo run build typecheck test --summarize --continue=always
pnpm production-ready:check -- --require-task-summaries
```

Use `docs/package-docs-baseline.json` `temporaryProductionApiDocExceptions` only when a production-ready package currently lacks generated API docs for a short-lived, justified reason.
The exception must name an existing production-ready package and include a non-empty reason.
Once API docs exist, the exception is stale and the production-ready gate fails until the entry is removed.

## Dependency Boundary Policy

`@croco/repository-core` is an interface layer. Its `src` tree must not reference Drizzle implementation details, `drizzle-orm`, or `@croco/tx-drizzle`.

Run the boundary gate locally with:

```bash
pnpm dependency-boundaries:check
```

The rule is intentionally simple and conservative: if `grep -r "drizzle" packages/repository-core/src/` would find a result, the boundary gate fails.

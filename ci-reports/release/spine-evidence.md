# Release Spine Evidence

- Status: passed
- Generated at: 2026-10-03T20:12:12.580Z
- Completed at: 2026-10-03T21:08:01.006Z
- Root: `/home/runner/work/framework/framework`
- Output directory: `/home/runner/work/framework/framework/ci-reports/release`
- Profile: `publish`
- Commit: `7501b7c1c6f734bbf5fa6d07bf77d90828d3ea7e`
- Run: `37150629419` attempt `1`
- Total timeout: 9000s
- Checks: 52/54 passed, 2 not applicable, 0 failed, 0 timed out, 0 interrupted, 0 skipped after timeout, 0 skipped by prerequisite

## Check summary

| Check | Category | Command | Status | Exit | Duration | Timeout | Evidence artifacts |
| --- | --- | --- | --- | --- | ---: | ---: | --- |
| Release metadata | metadata | `node --experimental-strip-types scripts/release-metadata-check.mts --allow-pending-changesets` | passed | 0 | 0.15s | 600s | - |
| Read-only verification policy | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Guard or classify the reported verification path -- node --experimental-strip-types scripts/verification-policy.mts` | passed | 0 | 0.77s | 300s | - |
| Authoritative test inventory | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery node --experimental-strip-types scripts/test-inventory.mts --write -- node --experimental-strip-types scripts/test-inventory.mts --check --profile publish --output ci-reports/package-quality/test-inventory.json` | passed | 0 | 0.76s | 300s | Resolved test inventory (present, modified: 2026-10-03T20:12:13.266Z, copied: `ci-reports/release/artifacts/test-inventory/test-inventory.json`) |
| Turbo cache reuse and invalidation contract | quality | `node --experimental-strip-types scripts/turbo-cache-contract.mts` | passed | 0 | 8.59s | 300s | - |
| Verification profile contracts | quality | `pnpm exec vitest run scripts/tests/verification-command.spec.ts scripts/tests/verification-change-classifier.spec.ts scripts/tests/verification-manifest.spec.ts scripts/tests/release-spine-evidence.spec.ts scripts/tests/ci-workflow.spec.ts scripts/tests/ci-performance-budget.spec.ts scripts/tests/release-workflow.spec.ts scripts/tests/turbo-task-contract.spec.ts scripts/tests/branch-protection-policy.spec.ts scripts/tests/repository-policy-audit-workflow.spec.ts scripts/tests/verification-policy.spec.ts scripts/tests/test-inventory.spec.ts scripts/tests/test-lane-runner.spec.ts scripts/tests/turbo-cache-contract.spec.ts` | not_applicable | - | not collected | not started | - |
| Changeset requirement | metadata | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm changeset or revert the publishable change -- node --experimental-strip-types scripts/changeset-required-check.mts --base a661a90abc2a0b690717abf096d56750e847fa4e --head HEAD` | passed | 0 | 0.58s | 300s | - |
| Package manifests | metadata | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm package-manifests:write -- node scripts/normalize-packages.mjs --check` | passed | 0 | 4.46s | 300s | - |
| Release version-derived metadata | metadata | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm release-version-sync:write && pnpm docs:catalog:write -- node --experimental-strip-types scripts/release-version-sync.mts --check` | passed | 0 | 0.95s | 300s | - |
| Package documentation catalog | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm docs:catalog:write -- node --experimental-strip-types scripts/package-docs-check.mts --check` | passed | 0 | 1.73s | 300s | - |
| API documentation triggers | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm docs:api-triggers:write -- node --experimental-strip-types scripts/api-docs-trigger-check.mts --check` | passed | 0 | 0.57s | 300s | - |
| Problem registry | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm problem-registry:write -- node --experimental-strip-types scripts/problem-registry.mts --check --base a661a90abc2a0b690717abf096d56750e847fa4e` | passed | 0 | 9.25s | 300s | - |
| Documentation examples | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm docs:examples:write -- node --experimental-strip-types scripts/doc-examples-check.mts --check` | passed | 0 | 9.41s | 300s | - |
| Release documentation | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported release documentation contract -- node --experimental-strip-types scripts/release-docs-check.mts` | passed | 0 | 0.58s | 300s | - |
| CI executable supply chain | security | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Pin the reported CI executable to an immutable source -- node --experimental-strip-types scripts/ci-executable-policy.mts` | passed | 0 | 1.92s | 300s | - |
| Pull-request CI performance budget | quality | `node --experimental-strip-types scripts/ci-performance-budget.mts` | passed | 0 | 0.28s | 300s | - |
| Verification runtime prerequisites | build | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the verification runtime build prerequisites -- pnpm --filter @croco/architecture-policy... --filter @croco/tenant-core... build` | passed | 0 | 19.84s | 600s | - |
| Architecture policy | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported architecture violation -- node --experimental-strip-types scripts/architecture-policy-check.mts --manifest croco.arch.json` | passed | 0 | 3.51s | 600s | - |
| Architecture circular allowlist | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Update code or intentionally update the circular dependency allowlist -- node --experimental-strip-types scripts/verify-circular-allowlist.mts` | passed | 0 | 15.26s | 600s | - |
| Dependency boundaries | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported package boundary -- node --experimental-strip-types scripts/package-quality-report.mts --boundary-check-only` | passed | 0 | 0.58s | 600s | - |
| Security allowlists | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported security allowlist metadata -- node --experimental-strip-types scripts/security-allowlist-metadata-check.mts` | passed | 0 | 6.87s | 300s | - |
| Generated secret placeholders | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported template placeholder -- node --experimental-strip-types scripts/generated-secret-placeholder-policy.mts` | passed | 0 | 0.53s | 300s | - |
| TypeScript compiler baseline | typecheck | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Restore the documented TypeScript compiler and tsconfig contract -- node --experimental-strip-types scripts/compiler-baseline-check.mts` | passed | 0 | 0.66s | 300s | - |
| Legacy decorator signature spike | typecheck | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Restore the reviewed TypeScript 6 decorator signature fixtures and policy -- node --experimental-strip-types scripts/decorator-signature-spike.mts` | passed | 0 | 6.52s | 600s | - |
| Strict contract typecheck | typecheck | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported strict contract diagnostic -- node --experimental-strip-types scripts/strict-contract-typecheck.mts` | passed | 0 | 59.44s | 600s | - |
| Static misuse | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported source misuse -- node --experimental-strip-types scripts/static-misuse-check.mts` | passed | 0 | 12.26s | 600s | - |
| Lint | quality | `pnpm exec oxlint .` | passed | 0 | 1.80s | 900s | - |
| Format | quality | `pnpm exec oxfmt --check . --ignore-path=.gitignore --ignore-path=.prettierignore --ignore-path=.oxfmtignore` | passed | 0 | 8.57s | 900s | - |
| Architecture circular dependencies | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported circular dependency -- pnpm exec madge --circular --extensions ts packages` | passed | 0 | 13.94s | 600s | - |
| Benchmark thresholds | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm bench:update -- node --experimental-strip-types scripts/bench-threshold-check.mts` | passed | 0 | 18.25s | 600s | - |
| Affected build | build | `pnpm turbo run build --filter=create-croco-app --filter=@croco/problems-core --filter=@croco/diagnostics-core --filter=@croco/framework-context --filter=@croco/protocols-core --filter=@croco/protocols-rest --filter=@croco/cli --filter=create-croco-app --filter=@croco/openapi-spec --filter=@croco/migration-runner --filter=@croco/rpc-codegen --summarize --continue=always` | passed | 0 | 0.61s | 1800s | - |
| Quick-start Lambda smoke | runtime-smoke | `node --experimental-strip-types scripts/quick-start-lambda-smoke.mts` | passed | 0 | 122.05s | 600s | - |
| First-success contract | generated-app | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Follow the reported scaffold or documentation recovery command -- node --experimental-strip-types scripts/first-success-verify.mts` | passed | 0 | 1.14s | 600s | - |
| Package entrypoint smoke | package-smoke | `node --experimental-strip-types scripts/package-entrypoint-smoke.mts --build-missing` | passed | 0 | 163.76s | 900s | - |
| Package binary smoke | package-smoke | `node --experimental-strip-types scripts/package-bin-smoke.mts` | passed | 0 | 19.37s | 1200s | - |
| create-croco-app spine smoke | generated-app | `node --experimental-strip-types scripts/create-croco-app-generated-smoke.mts goal-saas-api goal-spa-backend-split goal-worker goal-internal-tool graphql-lambda-api trpc-lambda-api graphql-vite-spa-docker meta-vite-fullstack-workers production-app-starter saas-golden-path saas-single-tenant rest-spa-contracts admin-console-starter ai-saas-golden-path` | passed | 0 | 2055.59s | 4500s | Spine-blocking generated app smoke matrix markdown (present, modified: 2026-10-03T20:48:29.078Z, copied: `ci-reports/release/artifacts/generated-app-smoke/spine-blocking-matrix.md`)<br>Spine-blocking generated app smoke matrix JSON (present, modified: 2026-10-03T20:48:29.077Z, copied: `ci-reports/release/artifacts/generated-app-smoke/spine-blocking-matrix.json`)<br>Ecosystem-advisory generated app smoke matrix JSON (present, modified: 2026-10-03T20:48:29.078Z, copied: `ci-reports/release/artifacts/generated-app-smoke/ecosystem-advisory-matrix.json`)<br>Aggregate generated app smoke matrix JSON (present, modified: 2026-10-03T20:48:29.078Z, copied: `ci-reports/release/artifacts/generated-app-smoke/matrix.json`)<br>Generated app smoke journey bundle (missing)<br>Generated test materialization evidence (present, modified: 2026-10-03T20:48:29.077Z, copied: `ci-reports/release/artifacts/generated-app-smoke/materialization-evidence.json`)<br>Generated test materializations (present, modified: 2026-10-03T20:23:04.330Z, copied: `ci-reports/release/artifacts/generated-app-smoke/materialized-tests`) |
| Packed decorator consumers | package-smoke | `node --experimental-strip-types scripts/packed-decorator-consumers.mts` | passed | 0 | 11.13s | 900s | - |
| Packed generated app release smoke | generated-app | `node --experimental-strip-types scripts/alpha-release-smoke.mts` | not_applicable | - | not collected | not started | Packed generated app smoke report (missing) |
| Summarized TypeScript check | typecheck | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported TypeScript diagnostics -- pnpm turbo run typecheck --summarize --continue=always` | passed | 0 | 101.35s | 1800s | - |
| Summarized tests | quality | `node --experimental-strip-types scripts/test-lane-runner.mts --lane fast --output ci-reports/package-quality/fast-test-lane.json` | passed | 0 | 255.68s | 2700s | Fast test lane evidence (present, modified: 2026-10-03T20:57:14.278Z, copied: `ci-reports/release/artifacts/test/fast-test-lane.json`) |
| Inventory integration test lane | quality | `node --experimental-strip-types scripts/test-lane-runner.mts --lane integration --output ci-reports/package-quality/integration-test-lane.json` | passed | 0 | 320.65s | 1800s | Integration test lane evidence (present, modified: 2026-10-03T21:02:34.936Z, copied: `ci-reports/release/artifacts/integration-test-lane/integration-test-lane.json`) |
| Inventory published-consumer test lane | package-smoke | `node --experimental-strip-types scripts/test-lane-runner.mts --lane published --output ci-reports/package-quality/published-test-lane.json` | passed | 0 | 46.66s | 2700s | Published-consumer test lane evidence (present, modified: 2026-10-03T21:03:21.596Z, copied: `ci-reports/release/artifacts/published-test-lane/published-test-lane.json`) |
| Enforced test execution evidence | quality | `node --experimental-strip-types scripts/test-evidence-reconcile.mts --profile publish --lane-report ci-reports/package-quality/fast-test-lane.json --lane-report ci-reports/package-quality/integration-test-lane.json --lane-report ci-reports/package-quality/published-test-lane.json --materialization-evidence ci-reports/generated-apps/materialization-evidence.json --generated-root ci-reports/generated-apps/materialized-tests --required-generated-path packages/create-croco-app/templates/addons/graphql-standalone/apps/graphql-api/src/formatGraphQLError.spec.ts --required-generated-path packages/create-croco-app/templates/admin-console/apps/api-server/src/tests/AdminConsole.spec.ts --required-generated-path packages/create-croco-app/templates/admin-console/apps/api-server/src/tests/CreditOperations.spec.ts --required-generated-path packages/create-croco-app/templates/admin-console/tests/journeys/plan-release.spec.ts --required-generated-path packages/create-croco-app/templates/ai-saas/apps/api-server/src/tests/AiGenerate.spec.ts --required-generated-path packages/create-croco-app/templates/ai-saas/apps/api-server/src/tests/AiReceipts.spec.ts --required-generated-path packages/create-croco-app/templates/ai-saas/apps/api-server/src/tests/AiSaas.spec.ts --required-generated-path packages/create-croco-app/templates/base-ddd/libs/shared/utils-env/src/tests/createEnv.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/ContractFuzz.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/ExecutableAssurance.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/FileBillableUsageJournal.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/FileUsageBillingGateway.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/GeneratedTelemetryEndpoint.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/ProviderProfileEnv.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/SaasDemo.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/node-lifecycle.spec.ts --required-generated-path packages/create-croco-app/templates/spa-be-split/apps/api-server/src/tests/app.spec.ts --required-generated-path packages/create-croco-app/templates/spa-be-split/apps/api-server/src/tests/env.spec.ts --required-generated-path packages/create-croco-app/templates/spa-be-split/apps/api-server/src/tests/node-lifecycle.spec.ts --required-generated-path packages/create-croco-app/templates/spa-be-split/apps/console-web/src/tests/ProblemNotice.spec.tsx --required-generated-path packages/create-croco-app/templates/spa-be-split/tests/journeys/create-user.spec.ts --required-generated-path packages/create-croco-app/templates/spa-be-split/tests/journeys/problem-rendering.spec.ts --output ci-reports/package-quality/test-evidence.json` | passed | 0 | 0.16s | 300s | Enforced test evidence (present, modified: 2026-10-03T21:03:21.757Z, copied: `ci-reports/release/artifacts/test-evidence-reconcile/test-evidence.json`) |
| Packed installed CLI integration evidence | quality | `node --experimental-strip-types scripts/test-lane-evidence-check.mts --report ci-reports/package-quality/integration-test-lane.json --lane integration --path packages/cli/src/tests/integration/CliCommandIntegration.spec.ts` | passed | 0 | 0.14s | 120s | - |
| Provider certification | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported provider certification metadata -- node --experimental-strip-types scripts/provider-certification-check.mts` | passed | 0 | 0.64s | 600s | Provider certification markdown (present, modified: 2026-10-03T20:16:10.133Z, copied: `ci-reports/release/artifacts/provider-certification/provider-certification.md`)<br>Provider certification JSON (present, modified: 2026-10-03T20:16:10.134Z, copied: `ci-reports/release/artifacts/provider-certification/provider-certification.json`) |
| Production-ready package evidence | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported production-ready package violations -- node --experimental-strip-types scripts/production-ready-check.mts` | passed | 0 | 1.23s | 600s | Production-ready package markdown (present, modified: 2026-10-03T21:03:22.692Z, copied: `ci-reports/release/artifacts/production-ready/production-ready.md`) |
| Beta spine promotion accountability | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported beta spine promotion violations -- node --experimental-strip-types scripts/spine-promotion-check.mts --package batch-core` | passed | 0 | 1.12s | 600s | Beta spine promotion markdown (present, modified: 2026-10-03T21:03:23.882Z, copied: `ci-reports/release/artifacts/spine-promotion/spine-promotion.md`) |
| Core coverage gate | coverage | `node --experimental-strip-types scripts/core-coverage-runner.mts` | passed | 0 | 205.44s | 2700s | - |
| Core coverage warning report | coverage | `node --experimental-strip-types scripts/core-coverage-warning-check.mts` | passed | 0 | 0.11s | 600s | Core coverage warning markdown (present, modified: 2026-10-03T21:06:47.299Z, copied: `ci-reports/release/artifacts/core-coverage-warning/report.md`) |
| Public API snapshot | public-api | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm public-api:write -- node --experimental-strip-types scripts/public-api-surface.mts --check` | passed | 0 | 2.53s | 600s | Public API diff markdown (present, modified: 2026-10-03T20:16:12.652Z, copied: `ci-reports/release/artifacts/public-api/public-api-diff.md`)<br>Public API summary JSON (present, modified: 2026-10-03T20:16:12.652Z, copied: `ci-reports/release/artifacts/public-api/public-api-summary.json`) |
| Release-gate maintenance test evidence | quality | `node --experimental-strip-types scripts/test-lane-evidence-check.mts --report ci-reports/package-quality/fast-test-lane.json --lane fast --path scripts/tests/alpha-release-smoke.spec.ts --path scripts/tests/api-docs-trigger-check.spec.ts --path scripts/tests/architecture-policy-check.spec.ts --path scripts/tests/bench-threshold-check.spec.ts --path scripts/tests/benchmark-workflow.spec.ts --path scripts/tests/branch-protection-policy.spec.ts --path scripts/tests/changeset-required-check.spec.ts --path scripts/tests/ci-executable-policy.spec.ts --path scripts/tests/ci-performance-budget.spec.ts --path scripts/tests/ci-verification-identity.spec.ts --path scripts/tests/ci-workflow.spec.ts --path scripts/tests/compiler-baseline-check.spec.ts --path scripts/tests/core-coverage-warning-check.spec.ts --path scripts/tests/create-croco-app-generated-smoke.spec.ts --path scripts/tests/dependency-audit-policy.spec.ts --path scripts/tests/doc-examples-check.spec.ts --path scripts/tests/first-success-verify.spec.ts --path scripts/tests/generated-secret-placeholder-policy.spec.ts --path scripts/tests/live-tests-workflow.spec.ts --path scripts/tests/normalize-packages.spec.ts --path scripts/tests/package-bin-smoke.spec.ts --path scripts/tests/package-docs-check.spec.ts --path scripts/tests/package-entrypoint-smoke.spec.ts --path scripts/tests/package-manifest-contracts.spec.ts --path scripts/tests/package-quality-report.spec.ts --path scripts/tests/package-roles.spec.ts --path scripts/tests/problem-registry.spec.ts --path scripts/tests/production-ready-check.spec.ts --path scripts/tests/provenance-config-check.spec.ts --path scripts/tests/provider-certification-check.spec.ts --path scripts/tests/public-api-surface.spec.ts --path scripts/tests/release-docs-check.spec.ts --path scripts/tests/release-metadata-check.spec.ts --path scripts/tests/release-spine-evidence.spec.ts --path scripts/tests/release-version-sync.spec.ts --path scripts/tests/release-workflow.spec.ts --path scripts/tests/repository-policy-audit-workflow.spec.ts --path scripts/tests/security-allowlist-metadata-check.spec.ts --path scripts/tests/spine-promotion-check.spec.ts --path scripts/tests/static-misuse-check.spec.ts --path scripts/tests/strict-contract-typecheck.spec.ts --path scripts/tests/test-evidence-reconcile.spec.ts --path scripts/tests/test-inventory.spec.ts --path scripts/tests/test-lane-evidence-check.spec.ts --path scripts/tests/test-lane-runner.spec.ts --path scripts/tests/tracked-file-mutation-guard.spec.ts --path scripts/tests/turbo-cache-contract.spec.ts --path scripts/tests/turbo-canonical-cache.spec.ts --path scripts/tests/turbo-task-contract.spec.ts --path scripts/tests/verification-change-classifier.spec.ts --path scripts/tests/verification-command.spec.ts --path scripts/tests/verification-manifest.spec.ts --path scripts/tests/verification-policy.spec.ts --path scripts/tests/verify-circular-allowlist.spec.ts` | passed | 0 | 0.16s | 120s | - |
| Spine bundle-size warning report | quality | `node --experimental-strip-types scripts/package-quality-report.mts` | passed | 0 | 0.27s | 600s | Package quality dashboard markdown (present, modified: 2026-10-03T21:03:24.363Z, copied: `ci-reports/release/artifacts/spine-bundle-size/report.md`)<br>Package quality dashboard JSON (present, modified: 2026-10-03T21:03:24.366Z, copied: `ci-reports/release/artifacts/spine-bundle-size/summary.json`)<br>Bundle-size enforcement markdown (present, modified: 2026-10-03T21:03:24.370Z, copied: `ci-reports/release/artifacts/spine-bundle-size/bundle-size.md`) |
| Production dependency audit policy | quality | `node --experimental-strip-types scripts/dependency-audit-policy.mts` | passed | 0 | 5.71s | 600s | - |
| npm provenance configuration | metadata | `node --experimental-strip-types scripts/provenance-config-check.mts` | passed | 0 | 0.20s | 300s | - |
| Publish dry run | metadata | `pnpm -r publish --dry-run --no-git-checks` | passed | 0 | 73.80s | 1800s | - |

## Check details

### Release metadata

- ID: `release-metadata`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/release-metadata-check.mts --allow-pending-changesets`
- Started at: 2026-10-03T20:12:12.582Z
- Completed at: 2026-10-03T20:12:12.732Z
- Duration: 0.15s
- Timeout: 600s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
=== Release metadata summary ===
Checked publishable: 130
Skipped private/non-published tooling: 2
Pending changeset recoveries: 21

Pending changeset metadata recoveries:
- packages/ai-usage/package.json (@croco/ai-usage): CHANGELOG.md is missing
- packages/analytics-drizzle/package.json (@croco/analytics-drizzle): version is "0.0.0"; CHANGELOG.md is missing
- packages/cohort-core/package.json (@croco/cohort-core): CHANGELOG.md is missing
- packages/cohort-drizzle/package.json (@croco/cohort-drizzle): CHANGELOG.md is missing
- packages/credits-core/package.json (@croco/credits-core): CHANGELOG.md is missing
- packages/credits-drizzle/package.json (@croco/credits-drizzle): CHANGELOG.md is missing
- packages/engagement-core/package.json (@croco/engagement-core): CHANGELOG.md is missing
- packages/engagement-drizzle/package.json (@croco/engagement-drizzle): CHANGELOG.md is missing
- packages/etl-core/package.json (@croco/etl-core): CHANGELOG.md is missing
- packages/etl-events-tx/package.json (@croco/etl-events-tx): CHANGELOG.md is missing
- packages/experience-core/package.json (@croco/experience-core): CHANGELOG.md is missing
- packages/experience-drizzle/package.json (@croco/experience-drizzle): CHANGELOG.md is missing
- packages/lifecycle-drizzle/package.json (@croco/lifecycle-drizzle): CHANGELOG.md is missing
- packages/notifications-fcm/package.json (@croco/notifications-fcm): version is "0.0.0"; CHANGELOG.md is missing
- packages/notifications-react-email/package.json (@croco/notifications-react-email): CHANGELOG.md is missing
- packages/promotions-core/package.json (@croco/promotions-core): CHANGELOG.md is missing
- packages/promotions-drizzle/package.json (@croco/promotions-drizzle): CHANGELOG.md is missing
- packages/protocol-codegen/package.json (@croco/protocol-codegen): CHANGELOG.md is missing
- packages/testing-resources/package.json (@croco/testing-resources): CHANGELOG.md is missing
- packages/ui-astryx/package.json (@croco/ui-astryx): CHANGELOG.md is missing
- packages/warehouse-core/package.json (@croco/warehouse-core): version is "0.0.0"; CHANGELOG.md is missing

OK: Release metadata placeholders are covered by pending changesets. Final publish candidates must pass without --allow-pending-changesets.

```

### Read-only verification policy

- ID: `verification-policy`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Guard or classify the reported verification path -- node --experimental-strip-types scripts/verification-policy.mts`
- Started at: 2026-10-03T20:12:12.585Z
- Completed at: 2026-10-03T20:12:13.354Z
- Duration: 0.77s
- Timeout: 300s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
verification-policy: every discovered verification path is classified and read-only.

```

### Authoritative test inventory

- ID: `test-inventory`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery node --experimental-strip-types scripts/test-inventory.mts --write -- node --experimental-strip-types scripts/test-inventory.mts --check --profile publish --output ci-reports/package-quality/test-inventory.json`
- Started at: 2026-10-03T20:12:12.734Z
- Completed at: 2026-10-03T20:12:13.486Z
- Duration: 0.76s
- Timeout: 300s
- Failure reason: none

Artifacts:
- Resolved test inventory (required): `ci-reports/package-quality/test-inventory.json` present; modified at 2026-10-03T20:12:13.266Z; copied to `ci-reports/release/artifacts/test-inventory/test-inventory.json`

stdout excerpt:

```text
test inventory valid (924 tests, 40ceaac765f2924ad0e70a25754d5a9068f2aa00bb2394351ea1ea14ef750d7b)

```

### Turbo cache reuse and invalidation contract

- ID: `turbo-cache-contract`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/turbo-cache-contract.mts`
- Started at: 2026-10-03T20:12:13.355Z
- Completed at: 2026-10-03T20:12:21.945Z
- Duration: 8.59s
- Timeout: 300s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
[turbo-cache-contract] initial-run: tasks=4 hits=0 misses=4 statuses=[@fixture/app#build=MISS(9cdf623337f1932f), @fixture/app#test=MISS(7b082611c9242af3), @fixture/dependency#build=MISS(2e2bc92a527c1885), @fixture/dependency#test=MISS(4d5e516c8d0f9662)]
[turbo-cache-contract] identical-second-run: tasks=4 hits=4 misses=0 statuses=[@fixture/app#build=HIT(9cdf623337f1932f), @fixture/app#test=HIT(7b082611c9242af3), @fixture/dependency#build=HIT(2e2bc92a527c1885), @fixture/dependency#test=HIT(4d5e516c8d0f9662)]
[turbo-cache-contract] package-source-mutation: tasks=4 hits=2 misses=2 statuses=[@fixture/app#build=MISS(1951ab2fa9dc2e66), @fixture/app#test=MISS(a56ca2b505d9b8a4), @fixture/dependency#build=HIT(2e2bc92a527c1885), @fixture/dependency#test=HIT(4d5e516c8d0f9662)]
[turbo-cache-contract] package-test-mutation: tasks=4 hits=3 misses=1 statuses=[@fixture/app#build=HIT(9cdf623337f1932f), @fixture/app#test=MISS(7f1b6fdb6a00ffe8), @fixture/dependency#build=HIT(2e2bc92a527c1885), @fixture/dependency#test=HIT(4d5e516c8d0f9662)]
[turbo-cache-contract] package-config-mutation: tasks=4 hits=3 misses=1 statuses=[@fixture/app#build=HIT(9cdf623337f1932f), @fixture/app#test=MISS(4fd3d88423464c8c), @fixture/dependency#build=HIT(2e2bc92a527c1885), @fixture/dependency#test=HIT(4d5e516c8d0f9662)]
[turbo-cache-contract] declared-env-mutation: tasks=4 hits=0 misses=4 statuses=[@fixture/app#build=MISS(cc1b9c20a6e42092), @fixture/app#test=MISS(e10446a6d4f3db87), @fixture/dependency#build=MISS(14d7ef8d57e7d0d8), @fixture/dependency#test=MISS(62816b75886479f0)]
[turbo-cache-contract] lockfile-mutation: tasks=4 hits=0 misses=4 statuses=[@fixture/app#build=MISS(ad30a00e21be7bad), @fixture/app#test=MISS(fb681b60c47060db), @fixture/dependency#build=MISS(621b5552f9d0fde6), @fixture/dependency#test=MISS(d954f58201efb6b9)]
[turbo-cache-contract] node-version-mutation: tasks=4 hits=0 misses=4 statuses=[@fixture/app#build=MISS(a6622cf32ed4231e), @fixture/app#test=MISS(7f41768965334996), @fixture/dependency#build=MISS(431cc8e0690fa55e), @fixture/dependency#test=MISS(44b6e392b8f2e026)]
[turbo-cache-contract] direct-dependency-mutation: tasks=4 hits=0 misses=4 statuses=[@fixture/app#build=MISS(a8a00e299bbf0aec), @fixture/app#test=MISS(68873a2cb79c08bc), @fixture/dependency#build=MISS(72b9262d5983622c), @fixture/dependency#test=MISS(0da0e14fc95db530)]
[turbo-cache-contract] unrelated-package-mutation: tasks=4 hits=4 misses=0 statuses=[@fixture/app#build=HIT(9cdf623337f1932f), @fixture/app#test=HIT(7b082611c9242af3), @fixture/dependency#build=HIT(2e2bc92a527c1885), @fixture/dependency#test=HIT(4d5e516c8d0f9662)]
[turbo-cache-contract] canonical-prune-baseline: tasks=4 hits=4 misses=0 statuses=[@fixture/app#build=HIT(9cdf623337f1932f), @fixture/app#test=HIT(7b082611c9242af3), @fixture/dependency#build=HIT(2e2bc92a527c1885), @fixture/dependency#test=HIT(4d5e516c8d0f9662)]
[turbo-cache-contract] canonical-prune-reuse: tasks=4 hits=4 misses=0 statuses=[@fixture/app#build=HIT(9cdf623337f1932f), @fixture/app#test=HIT(7b082611c9242af3), @fixture/dependency#build=HIT(2e2bc92a527c1885), @fixture/dependency#test=HIT(4d5e516c8d0f9662)]
[turbo-cache-contract] canonical-prune: removed=64 kept=4

```

### Verification profile contracts

- ID: `verification-contract-tests`
- Status: not_applicable
- Selection reason: Always selected by this verification profile.
- Command: `pnpm exec vitest run scripts/tests/verification-command.spec.ts scripts/tests/verification-change-classifier.spec.ts scripts/tests/verification-manifest.spec.ts scripts/tests/release-spine-evidence.spec.ts scripts/tests/ci-workflow.spec.ts scripts/tests/ci-performance-budget.spec.ts scripts/tests/release-workflow.spec.ts scripts/tests/turbo-task-contract.spec.ts scripts/tests/branch-protection-policy.spec.ts scripts/tests/repository-policy-audit-workflow.spec.ts scripts/tests/verification-policy.spec.ts scripts/tests/test-inventory.spec.ts scripts/tests/test-lane-runner.spec.ts scripts/tests/turbo-cache-contract.spec.ts`
- Started at: not started
- Completed at: 2026-10-03T20:12:13.492Z
- Duration: not collected
- Timeout: not started
- Failure reason: Not applicable to the changed files in this verification context.

Artifacts:
- none

### Changeset requirement

- ID: `changeset-required`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm changeset or revert the publishable change -- node --experimental-strip-types scripts/changeset-required-check.mts --base a661a90abc2a0b690717abf096d56750e847fa4e --head HEAD`
- Started at: 2026-10-03T20:12:13.493Z
- Completed at: 2026-10-03T20:12:14.070Z
- Duration: 0.58s
- Timeout: 300s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
changeset-required: changed changesets cover all affected publishable packages (passing)

```

### Package manifests

- ID: `package-manifests`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm package-manifests:write -- node scripts/normalize-packages.mjs --check`
- Started at: 2026-10-03T20:12:14.071Z
- Completed at: 2026-10-03T20:12:18.532Z
- Duration: 4.46s
- Timeout: 300s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text

=== Package manifest summary ===
Checked: 130
Skipped private: 18
Modified: 0

✓ Package manifest contracts are normalized.

```

### Release version-derived metadata

- ID: `release-version-sync`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm release-version-sync:write && pnpm docs:catalog:write -- node --experimental-strip-types scripts/release-version-sync.mts --check`
- Started at: 2026-10-03T20:12:18.534Z
- Completed at: 2026-10-03T20:12:19.483Z
- Duration: 0.95s
- Timeout: 300s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
release-version-sync: verified 2 version-derived metadata files.

```

### Package documentation catalog

- ID: `docs-catalog`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm docs:catalog:write -- node --experimental-strip-types scripts/package-docs-check.mts --check`
- Started at: 2026-10-03T20:12:19.485Z
- Completed at: 2026-10-03T20:12:21.214Z
- Duration: 1.73s
- Timeout: 300s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
package-docs-check: package catalog and documentation report are in sync.

```

### API documentation triggers

- ID: `docs-api-triggers`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm docs:api-triggers:write -- node --experimental-strip-types scripts/api-docs-trigger-check.mts --check`
- Started at: 2026-10-03T20:12:21.215Z
- Completed at: 2026-10-03T20:12:21.790Z
- Duration: 0.57s
- Timeout: 300s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
api-docs-trigger-check: CI API docs triggers match generated API docs surface.

```

### Problem registry

- ID: `problem-registry`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm problem-registry:write -- node --experimental-strip-types scripts/problem-registry.mts --check --base a661a90abc2a0b690717abf096d56750e847fa4e`
- Started at: 2026-10-03T20:12:21.791Z
- Completed at: 2026-10-03T20:12:31.043Z
- Duration: 9.25s
- Timeout: 300s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
Problem registry check passed: 914 codes from 882 discoveries.

```

### Documentation examples

- ID: `docs-examples`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm docs:examples:write -- node --experimental-strip-types scripts/doc-examples-check.mts --check`
- Started at: 2026-10-03T20:12:21.949Z
- Completed at: 2026-10-03T20:12:31.360Z
- Duration: 9.41s
- Timeout: 300s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
doc-examples-check: checked 40 TypeScript documentation examples.

```

### Release documentation

- ID: `release-docs`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported release documentation contract -- node --experimental-strip-types scripts/release-docs-check.mts`
- Started at: 2026-10-03T20:12:31.045Z
- Completed at: 2026-10-03T20:12:31.630Z
- Duration: 0.58s
- Timeout: 300s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
release-docs: Changesets config and release guide agree on independent versioning.

```

### CI executable supply chain

- ID: `ci-executables`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Pin the reported CI executable to an immutable source -- node --experimental-strip-types scripts/ci-executable-policy.mts`
- Started at: 2026-10-03T20:12:31.364Z
- Completed at: 2026-10-03T20:12:33.279Z
- Duration: 1.92s
- Timeout: 300s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
ci-executable-policy: passed (10 checked surfaces)

```

### Pull-request CI performance budget

- ID: `ci-performance-budget`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/ci-performance-budget.mts`
- Started at: 2026-10-03T20:12:31.632Z
- Completed at: 2026-10-03T20:12:31.916Z
- Duration: 0.28s
- Timeout: 300s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
{
  "schemaVersion": "croco.ci-performance-budget-report/v1",
  "asOf": "1970-01-01T00:00:00.000Z",
  "retentionDays": 90,
  "promotionWindowDays": 45,
  "minPromotionSamples": 30,
  "maxPromotionSamples": 60,
  "mode": "report",
  "partitions": [],
  "diagnostics": [
    {
      "code": "BUDGET_NOT_ENFORCEABLE",
      "key": "",
      "message": "no CI performance samples or reviewed baselines are available"
    }
  ],
  "failed": false
}

```

### Verification runtime prerequisites

- ID: `architecture-policy-runtime`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the verification runtime build prerequisites -- pnpm --filter @croco/architecture-policy... --filter @croco/tenant-core... build`
- Started at: 2026-10-03T20:12:31.918Z
- Completed at: 2026-10-03T20:12:51.758Z
- Duration: 19.84s
- Timeout: 600s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
[truncated 5755 chars]
clean --dts
packages/framework-context build: [34mCLI[39m Building entry: src/index.ts
packages/framework-context build: [34mCLI[39m Using tsconfig: tsconfig.json
packages/framework-context build: [34mCLI[39m tsup v8.5.1
packages/framework-context build: [34mCLI[39m Target: es2017
packages/framework-context build: [34mCLI[39m Cleaning output folder
packages/framework-context build: [34mESM[39m Build start
packages/framework-context build: [34mCJS[39m Build start
packages/framework-context build: [32mESM[39m [1mdist/index.mjs [22m[32m92.89 KB[39m
packages/framework-context build: [32mESM[39m ⚡️ Build success in 168ms
packages/framework-context build: [32mCJS[39m [1mdist/index.js [22m[32m96.29 KB[39m
packages/framework-context build: [32mCJS[39m ⚡️ Build success in 175ms
packages/framework-context build: [34mDTS[39m Build start
packages/framework-context build: [32mDTS[39m ⚡️ Build success in 2814ms
packages/framework-context build: [32mDTS[39m [1mdist/index.d.mts [22m[32m64.07 KB[39m
packages/framework-context build: [32mDTS[39m [1mdist/index.d.ts  [22m[32m64.07 KB[39m
packages/framework-context build: Done
packages/access-core build$ tsup src/index.ts --format esm,cjs --minify --clean --dts
packages/access-core build: [34mCLI[39m Building entry: src/index.ts
packages/access-core build: [34mCLI[39m Using tsconfig: tsconfig.json
packages/access-core build: [34mCLI[39m tsup v8.5.1
packages/access-core build: [34mCLI[39m Target: es2017
packages/access-core build: [34mCLI[39m Cleaning output folder
packages/access-core build: [34mESM[39m Build start
packages/access-core build: [34mCJS[39m Build start
packages/access-core build: [32mESM[39m [1mdist/index.mjs [22m[32m11.30 KB[39m
packages/access-core build: [32mESM[39m ⚡️ Build success in 77ms
packages/access-core build: [32mCJS[39m [1mdist/index.js [22m[32m12.21 KB[39m
packages/access-core build: [32mCJS[39m ⚡️ Build success in 78ms
packages/access-core build: [34mDTS[39m Build start
packages/access-core build: [32mDTS[39m ⚡️ Build success in 1928ms
packages/access-core build: [32mDTS[39m [1mdist/index.d.mts [22m[32m7.25 KB[39m
packages/access-core build: [32mDTS[39m [1mdist/index.d.ts  [22m[32m7.25 KB[39m
packages/access-core build: Done
packages/tenant-core build$ tsup src/index.ts src/tenant-model.ts --format esm,cjs --minify --clean --dts
packages/tenant-core build: [34mCLI[39m Building entry: src/index.ts, src/tenant-model.ts
packages/tenant-core build: [34mCLI[39m Using tsconfig: tsconfig.json
packages/tenant-core build: [34mCLI[39m tsup v8.5.1
packages/tenant-core build: [34mCLI[39m Target: es2017
packages/tenant-core build: [34mCLI[39m Cleaning output folder
packages/tenant-core build: [34mESM[39m Build start
packages/tenant-core build: [34mCJS[39m Build start
packages/tenant-core build: [32mESM[39m [1mdist/index.mjs          [22m[32m14.80 KB[39m
packages/tenant-core build: [32mESM[39m [1mdist/tenant-model.mjs   [22m[32m659.00 B[39m
packages/tenant-core build: [32mESM[39m [1mdist/chunk-MQ7AVEXI.mjs [22m[32m12.73 KB[39m
packages/tenant-core build: [32mESM[39m ⚡️ Build success in 101ms
packages/tenant-core build: [32mCJS[39m [1mdist/index.js        [22m[32m28.79 KB[39m
packages/tenant-core build: [32mCJS[39m [1mdist/tenant-model.js [22m[32m13.71 KB[39m
packages/tenant-core build: [32mCJS[39m ⚡️ Build success in 112ms
packages/tenant-core build: [34mDTS[39m Build start
packages/tenant-core build: [32mDTS[39m ⚡️ Build success in 2213ms
packages/tenant-core build: [32mDTS[39m [1mdist/index.d.mts        [22m[32m22.03 KB[39m
packages/tenant-core build: [32mDTS[39m [1mdist/tenant-model.d.mts [22m[32m13.60 KB[39m
packages/tenant-core build: [32mDTS[39m [1mdist/index.d.ts         [22m[32m22.03 KB[39m
packages/tenant-core build: [32mDTS[39m [1mdist/tenant-model.d.ts  [22m[32m13.60 KB[39m
packages/tenant-core build: Done

```

### Architecture policy

- ID: `architecture-policy`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported architecture violation -- node --experimental-strip-types scripts/architecture-policy-check.mts --manifest croco.arch.json`
- Started at: 2026-10-03T20:12:51.761Z
- Completed at: 2026-10-03T20:12:55.273Z
- Duration: 3.51s
- Timeout: 600s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
architecture-policy: passed for 6768 import(s) across 132 package(s)
architecture-policy: package catalog group consistency passed for 130 public package(s)

```

### Architecture circular allowlist

- ID: `architecture-circular-allowlist`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Update code or intentionally update the circular dependency allowlist -- node --experimental-strip-types scripts/verify-circular-allowlist.mts`
- Started at: 2026-10-03T20:12:33.287Z
- Completed at: 2026-10-03T20:12:48.548Z
- Duration: 15.26s
- Timeout: 600s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
circular-allowlist: passed (0 detected cycles match allowlist).

```

### Dependency boundaries

- ID: `dependency-boundaries`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported package boundary -- node --experimental-strip-types scripts/package-quality-report.mts --boundary-check-only`
- Started at: 2026-10-03T20:12:48.551Z
- Completed at: 2026-10-03T20:12:49.134Z
- Duration: 0.58s
- Timeout: 600s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
dependency-boundaries: repository-core-drizzle-free pass
dependency-boundaries: all rules passed

```

### Security allowlists

- ID: `security-allowlists`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported security allowlist metadata -- node --experimental-strip-types scripts/security-allowlist-metadata-check.mts`
- Started at: 2026-10-03T20:12:49.136Z
- Completed at: 2026-10-03T20:12:56.001Z
- Duration: 6.87s
- Timeout: 300s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
security-allowlist-metadata: passed (0 audit ignores, 1 gitleaks allowlist entries, 1 gitleaks ignore fingerprints, 0 generated template allowlists).

```

### Generated secret placeholders

- ID: `generated-secret-placeholders`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported template placeholder -- node --experimental-strip-types scripts/generated-secret-placeholder-policy.mts`
- Started at: 2026-10-03T20:12:55.275Z
- Completed at: 2026-10-03T20:12:55.804Z
- Duration: 0.53s
- Timeout: 300s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
generated-secret-placeholder-policy: passed (2 scan paths, 0 generated template allowlists).

```

### TypeScript compiler baseline

- ID: `compiler-baseline`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Restore the documented TypeScript compiler and tsconfig contract -- node --experimental-strip-types scripts/compiler-baseline-check.mts`
- Started at: 2026-10-03T20:12:55.808Z
- Completed at: 2026-10-03T20:12:56.467Z
- Duration: 0.66s
- Timeout: 300s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
compiler-baseline-check: TypeScript 6.0.3, legacy decorators, tsconfig migration, and generated consumers verified

```

### Legacy decorator signature spike

- ID: `decorator-signature-spike`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Restore the reviewed TypeScript 6 decorator signature fixtures and policy -- node --experimental-strip-types scripts/decorator-signature-spike.mts`
- Started at: 2026-10-03T20:12:56.003Z
- Completed at: 2026-10-03T20:13:02.518Z
- Duration: 6.52s
- Timeout: 600s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
decorator-signature-spike: TypeScript 6 legacy decorator feasibility verified
decorator-signature-spike: 30 negative assertions fail with broad signatures; inheritance limitation compiled as documented
decorator-signature-spike: overload declaration snapshot and strict/loose packed ESM/CJS consumer passed
decorator-signature-spike: broad 579 instantiations / 0.08s check, strict 26106 instantiations / 0.39s check
decorator-signature-spike: strict instantiation delta 25527 within 250000 budget

```

### Strict contract typecheck

- ID: `strict-contract-typecheck`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported strict contract diagnostic -- node --experimental-strip-types scripts/strict-contract-typecheck.mts`
- Started at: 2026-10-03T20:12:56.469Z
- Completed at: 2026-10-03T20:13:55.913Z
- Duration: 59.44s
- Timeout: 600s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
strict-contract-typecheck: mode staged
strict-contract-typecheck: spine packages 18
strict-contract-typecheck: enrolled packages 18
strict-contract-typecheck: exempted packages 0
strict-contract-typecheck: packages @croco/framework-context, @croco/problems-core, @croco/protocols-core, @croco/protocols-rest, @croco/openapi-spec, @croco/rpc-codegen, @croco/transports-http, @croco/telemetry-api, @croco/telemetry-sdk-node, @croco/tx-core, @croco/tx-drizzle, @croco/events-core, @croco/events-tx, @croco/retry-core, @croco/idempotency-core, @croco/testing, create-croco-app, @croco/cli
strict-contract-typecheck: options exactOptionalPropertyTypes, noUncheckedIndexedAccess, noPropertyAccessFromIndexSignature
strict-contract-typecheck: accepted baseline diagnostics 410
strict-contract-typecheck: diagnostics added 0, removed 0, unchanged 410
strict-contract-typecheck: staged rollout deferrals 12 (@croco/framework-context, @croco/problems-core, @croco/protocols-rest, @croco/openapi-spec, @croco/transports-http, @croco/events-core, @croco/events-tx, @croco/retry-core, @croco/idempotency-core, @croco/testing, create-croco-app, @croco/cli)
strict-contract-typecheck: accepted release debt deferrals 0 (<empty>)
strict-contract-typecheck: baseline matched

```

### Static misuse

- ID: `static-misuse`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported source misuse -- node --experimental-strip-types scripts/static-misuse-check.mts`
- Started at: 2026-10-03T20:13:02.522Z
- Completed at: 2026-10-03T20:13:14.784Z
- Duration: 12.26s
- Timeout: 600s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
static-misuse: CROCO_STATIC_REPOSITORY_CORE_IMPLEMENTATION_BOUNDARY pass
static-misuse: CROCO_STATIC_REST_GENERATED_CONTRACT_SCHEMA_BOUNDARY pass
static-misuse: REST_DECORATOR_CONTRACT_MISMATCH pass
static-misuse: CROCO_STATIC_REST_OVERLOADED_PARAMETER_DECORATOR_BOUNDARY pass
static-misuse: CROCO_STATIC_REST_OVERLOADED_CONTRACT_ROUTE_DECORATOR_BOUNDARY pass
static-misuse: CROCO_STATIC_RAW_ERROR_RUNTIME_BOUNDARY pass
static-misuse: CROCO_STATIC_EMPTY_CATCH_RUNTIME_BOUNDARY pass
static-misuse: all rules passed

```

### Lint

- ID: `lint`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `pnpm exec oxlint .`
- Started at: 2026-10-03T20:13:14.790Z
- Completed at: 2026-10-03T20:13:16.592Z
- Duration: 1.80s
- Timeout: 900s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
::warning file=packages/admin-react/src/libs/ActivationGuideConsole.ts,line=95,endLine=95,col=14,endColumn=19,title=react-hooks(exhaustive-deps)::React Hook useEffect has a missing dependency: 'props.definition'
::warning file=packages/frontend-cloudflare/src/tests/CloudflareSsrHandler.spec.ts,line=126,endLine=126,col=11,endColumn=15,title=unicorn(no-invalid-fetch-options)::"body" is not allowed when method is "GET"
::warning file=packages/analytics-core/src/tests/GrowthAnalysisService.spec.ts,line=305,endLine=305,col=53,endColumn=65,title=unicorn(no-new-array)::Do not use `new Array(singleArgument)`.
::warning file=packages/analytics-core/src/tests/GrowthAnalysisService.spec.ts,line=947,endLine=947,col=30,endColumn=42,title=unicorn(no-new-array)::Do not use `new Array(singleArgument)`.
::warning file=packages/telemetry-api/src/tests/Trace.spec.ts,line=138,endLine=138,col=74,endColumn=78,title=unicorn(no-thenable)::Do not add `then` to an object.
::warning file=packages/telemetry-api/src/tests/Trace.spec.ts,line=238,endLine=238,col=41,endColumn=45,title=unicorn(no-thenable)::Do not add `then` to an object.
::warning file=packages/telemetry-api/src/tests/Trace.spec.ts,line=239,endLine=239,col=17,endColumn=21,title=unicorn(no-thenable)::Do not add `then` to an object.
::warning file=packages/telemetry-api/src/tests/Trace.spec.ts,line=609,endLine=609,col=7,endColumn=11,title=unicorn(no-thenable)::Do not add `then` to a class.
::warning file=scripts/security-allowlist-metadata-check.mts,line=1042,endLine=1042,col=14,endColumn=16,title=eslint(no-control-regex)::Unexpected control character

Found 9 warnings and 0 errors.
Finished in 1.7s on 2915 files with 116 rules using 4 threads.

```

### Format

- ID: `format`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `pnpm exec oxfmt --check . --ignore-path=.gitignore --ignore-path=.prettierignore --ignore-path=.oxfmtignore`
- Started at: 2026-10-03T20:13:16.594Z
- Completed at: 2026-10-03T20:13:25.161Z
- Duration: 8.57s
- Timeout: 900s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
Checking formatting...

All matched files use the correct format.
Finished in 8394ms on 4495 files using 4 threads.

```

### Architecture circular dependencies

- ID: `architecture-circular`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported circular dependency -- pnpm exec madge --circular --extensions ts packages`
- Started at: 2026-10-03T20:13:25.162Z
- Completed at: 2026-10-03T20:13:39.106Z
- Duration: 13.94s
- Timeout: 600s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
Processed 2590 files (13.2s) (128 warnings)



```

stderr excerpt:

```text
- Finding files
✔ No circular dependency found!

```

### Benchmark thresholds

- ID: `benchmark-thresholds`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm bench:update -- node --experimental-strip-types scripts/bench-threshold-check.mts`
- Started at: 2026-10-03T20:13:39.108Z
- Completed at: 2026-10-03T20:13:57.358Z
- Duration: 18.25s
- Timeout: 600s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
[truncated 10427 chars]
benchmarks[2m > [22m[2mEventPublisher.publishNow single event[22m

  should resolve 10 handlers[2m - packages/events-core/src/tests/EventBus.bench.ts[2m > [22m[2mEventBus benchmarks[2m > [22m[2mDefaultHandlerResolver.resolve × 10[22m

  Container.get singleton (cold)[2m - packages/framework-context/src/tests/Container.bench.ts[2m > [22m[2mContainer.get singleton (cold)[22m

  register 50 singletons[2m - packages/framework-context/src/tests/Container.bench.ts[2m > [22m[2mContainer.register × 50 components[22m

  Container.validate (50 components)[2m - packages/framework-context/src/tests/Container.bench.ts[2m > [22m[2mContainer.validate (50 components)[22m

  Container.get singleton (warm)[2m - packages/framework-context/src/tests/Container.bench.ts[2m > [22m[2mContainer.get singleton (warm)[22m

  lambdaPreset config creation[2m - packages/telemetry-sdk-node/src/tests/TelemetryRuntime.bench.ts[2m > [22m[2mTelemetryRuntime benchmarks[22m
[32m    13.62x [39m[90mfaster than [39mTelemetryRuntime.init (lambda preset)

  Hono + DI lookup[2m - packages/transports-http/src/tests/CrocoApp.bench.ts[2m > [22m[2mCrocoApp benchmarks[2m > [22m[2mCrocoApp constructor[22m

  boot() + handler creation[2m - packages/transports-http/src/tests/CrocoApp.bench.ts[2m > [22m[2mCrocoApp benchmarks[2m > [22m[2mCrocoApp lambdaHandler (10 controllers)[22m

  createApp → lambdaHandler → mock API Gateway v2 event[2m - packages/transports-http/src/tests/CrocoApp.bench.ts[2m > [22m[2mCrocoApp benchmarks[2m > [22m[2mLambda cold-start simulation[22m

  cold-start with authorization header[2m - packages/transports-http/src/tests/CrocoApp.bench.ts[2m > [22m[2mCrocoApp benchmarks[2m > [22m[2mLambda cold-start with headers[22m

  cold-start with base64 encoded body[2m - packages/transports-http/src/tests/CrocoApp.bench.ts[2m > [22m[2mCrocoApp benchmarks[2m > [22m[2mLambda cold-start with binary body[22m

  cold-start with query string[2m - packages/transports-http/src/tests/CrocoApp.bench.ts[2m > [22m[2mCrocoApp benchmarks[2m > [22m[2mLambda cold-start with query params[22m

  cold-start with JWT authorizer claims[2m - packages/transports-http/src/tests/CrocoApp.bench.ts[2m > [22m[2mCrocoApp benchmarks[2m > [22m[2mLambda cold-start with authorizer context[22m

  realistic cold-start with auth, headers, query[2m - packages/transports-http/src/tests/CrocoApp.bench.ts[2m > [22m[2mCrocoApp benchmarks[2m > [22m[2mLambda cold-start realistic scenario[22m


╔══════════════════════════════════════════════════════════╗
║ Cold-Start Benchmark Report                            ║
╠══════════════════════════════════════════════════════════╣
║ CrocoApp constructor           p75: 13.6μs     threshold: 30
║ CrocoApp lambdaHandler (10 controllers) p75: 1.8ms      thre
║ Lambda cold-start simulation   p75: 2.0ms      threshold: 80
║ Lambda cold-start with headers p75: 2.0ms      threshold: 80
║ Lambda cold-start with binary body p75: 1.9ms      threshold
║ Lambda cold-start with query params p75: 1.9ms      threshol
║ Lambda cold-start with authorizer context p75: 1.9ms      th
║ Lambda cold-start realistic scenario p75: 1.9ms      thresho
║ EventBusConfig.start (10 handlers) p75: 2.1μs      threshold
║ EventPublisher.publishNow single event p75: 2.7μs      thres
║ DefaultHandlerResolver.resolve × 10 p75: 0.1μs      threshol
║ Container.get singleton (cold) p75: 84.0μs     threshold: 5.
║ Container.register × 50 components p75: 3.9ms      threshold
║ Container.validate (50 components) p75: 4.3ms      threshold
║ Container.get singleton (warm) p75: 1.2μs      threshold: 50
║ TelemetryRuntime.init (lambda preset) p75: 15.7μs     thresh
║ lambdaPreset config creation   p75: 1.1μs      threshold: 2.
╠══════════════════════════════════════════════════════════╣
║ Result: ALL PASSED                                         ║
╚══════════════════════════════════════════════════════════╝


```

stderr excerpt:

```text
⚠️  Baseline drift for "CrocoApp constructor": p75 13.6μs exceeds baseline 8.2μs by 5.4μs (+66.5%).
⚠️  Baseline drift for "CrocoApp lambdaHandler (10 controllers)": p75 1.8ms exceeds baseline 258.4μs by 1.5ms (+589.3%).
⚠️  Baseline drift for "Lambda cold-start simulation": p75 2.0ms exceeds baseline 418.1μs by 1.5ms (+369.6%).
⚠️  Baseline drift for "Lambda cold-start with headers": p75 2.0ms exceeds baseline 369.7μs by 1.6ms (+443.0%).
⚠️  Baseline drift for "Lambda cold-start with binary body": p75 1.9ms exceeds baseline 339.1μs by 1.6ms (+470.4%).
⚠️  Baseline drift for "Lambda cold-start with query params": p75 1.9ms exceeds baseline 301.3μs by 1.6ms (+535.5%).
⚠️  Baseline drift for "Lambda cold-start with authorizer context": p75 1.9ms exceeds baseline 299.8μs by 1.6ms (+531.3%).
⚠️  Baseline drift for "Lambda cold-start realistic scenario": p75 1.9ms exceeds baseline 299.2μs by 1.6ms (+538.1%).
⚠️  Baseline drift for "EventBusConfig.start (10 handlers)": p75 2.1μs exceeds baseline 1.4μs by 0.6μs (+44.0%).
⚠️  Baseline drift for "EventPublisher.publishNow single event": p75 2.7μs exceeds baseline 1.7μs by 1.0μs (+60.2%).
⚠️  Baseline drift for "Container.register × 50 components": p75 3.9ms exceeds baseline 3.2ms by 659.5μs (+20.4%).
⚠️  Baseline drift for "Container.validate (50 components)": p75 4.3ms exceeds baseline 3.4ms by 944.8μs (+27.9%).

```

### Affected build

- ID: `build`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `pnpm turbo run build --filter=create-croco-app --filter=@croco/problems-core --filter=@croco/diagnostics-core --filter=@croco/framework-context --filter=@croco/protocols-core --filter=@croco/protocols-rest --filter=@croco/cli --filter=create-croco-app --filter=@croco/openapi-spec --filter=@croco/migration-runner --filter=@croco/rpc-codegen --summarize --continue=always`
- Started at: 2026-10-03T20:13:55.915Z
- Completed at: 2026-10-03T20:13:56.527Z
- Duration: 0.61s
- Timeout: 1800s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
[truncated 38821 chars]
[32m365.00 B[39m
[32mESM[39m [1mdist/generate-KR2CTPF2.js           [22m[32m313.00 B[39m
[32mESM[39m [1mdist/test-XARDJB75.js               [22m[32m12.80 KB[39m
[32mESM[39m [1mdist/codegen-IHFJNBVB.js            [22m[32m161.00 B[39m
[32mESM[39m [1mdist/contracts-I2ZYCQDG.js          [22m[32m225.00 B[39m
[32mESM[39m [1mdist/architecturePolicy-IFT235TQ.js [22m[32m339.00 B[39m
[32mESM[39m [1mdist/di-ICPLZMDK.js                 [22m[32m151.00 B[39m
[32mESM[39m [1mdist/runtimePolicy-GMSYI7TM.js      [22m[32m329.00 B[39m
[32mESM[39m [1mdist/ops-Q2QPXL5M.js                [22m[32m431.00 B[39m
[32mESM[39m [1mdist/jobs-K4ZANPVJ.js               [22m[32m719.00 B[39m
[32mESM[39m [1mdist/bin/croco-agent.js             [22m[32m2.64 KB[39m
[32mESM[39m [1mdist/agent.js                       [22m[32m243.00 B[39m
[32mESM[39m [1mdist/chunk-QS67BMTH.js              [22m[32m418.63 KB[39m
[32mESM[39m [1mdist/index.js                       [22m[32m4.91 KB[39m
[32mESM[39m [1mdist/chunk-MILXAY64.js              [22m[32m18.97 KB[39m
[32mESM[39m [1mdist/chunk-LHV4RJU3.js              [22m[32m42.86 KB[39m
[32mESM[39m [1mdist/chunk-BPETQQT7.js              [22m[32m3.42 KB[39m
[32mESM[39m [1mdist/chunk-5D2JMYWX.js              [22m[32m14.41 KB[39m
[32mESM[39m [1mdist/chunk-ODROWYYM.js              [22m[32m5.69 KB[39m
[32mESM[39m [1mdist/chunk-AIZNEBSN.js              [22m[32m28.59 KB[39m
[32mESM[39m [1mdist/chunk-J2HZI6DD.js              [22m[32m7.95 KB[39m
[32mESM[39m [1mdist/chunk-CMOBRBLL.js              [22m[32m3.04 KB[39m
[32mESM[39m [1mdist/chunk-DHELHA22.js              [22m[32m195.64 KB[39m
[32mESM[39m [1mdist/chunk-IC3JTPWG.js              [22m[32m46.98 KB[39m
[32mESM[39m [1mdist/chunk-27YTG7NK.js              [22m[32m2.71 KB[39m
[32mESM[39m [1mdist/chunk-YLUMPPHY.js              [22m[32m119.23 KB[39m
[32mESM[39m [1mdist/chunk-BLXT4T54.js              [22m[32m16.38 KB[39m
[32mESM[39m [1mdist/ops.js                         [22m[32m299.00 B[39m
[32mESM[39m [1mdist/chunk-ASOVMZVD.js              [22m[32m7.51 KB[39m
[32mESM[39m [1mdist/jobs.js                        [22m[32m531.00 B[39m
[32mESM[39m [1mdist/chunk-A7PVUCWV.js              [22m[32m8.52 KB[39m
[32mESM[39m [1mdist/chunk-2DNTERSJ.js              [22m[32m11.33 KB[39m
[32mESM[39m [1mdist/make-7VNHS55D.js               [22m[32m215.00 B[39m
[32mESM[39m [1mdist/create-ILRTFI4A.js             [22m[32m249.00 B[39m
[32mESM[39m [1mdist/chunk-IXC6CWWP.js              [22m[32m431.00 B[39m
[32mESM[39m [1mdist/chunk-EHYWZHPR.js              [22m[32m27.39 KB[39m
[32mESM[39m [1mdist/chunk-RKAGPFV4.js              [22m[32m90.00 B[39m
[32mESM[39m [1mdist/chunk-ZMHMFQ6G.js              [22m[32m291.00 B[39m
[32mESM[39m [1mdist/chunk-MD3EKV6L.js              [22m[32m3.65 KB[39m
[32mESM[39m [1mdist/chunk-DA4W3WVH.js              [22m[32m1.56 KB[39m
[32mESM[39m [1mdist/chunk-WLLBQNZQ.js              [22m[32m24.83 KB[39m
[32mESM[39m [1mdist/chunk-L3RCGKNV.js              [22m[32m800.14 KB[39m
[32mESM[39m ⚡️ Build success in 828ms
[34mDTS[39m Build start
[32mDTS[39m ⚡️ Build success in 27330ms
[32mDTS[39m [1mdist/bin/croco.d.ts       [22m[32m20.00 B[39m
[32mDTS[39m [1mdist/agent.d.ts           [22m[32m1008.00 B[39m
[32mDTS[39m [1mdist/index.d.ts           [22m[32m31.62 KB[39m
[32mDTS[39m [1mdist/ops.d.ts             [22m[32m1.75 KB[39m
[32mDTS[39m [1mdist/bin/croco-agent.d.ts [22m[32m20.00 B[39m
[32mDTS[39m [1mdist/jobs.d.ts            [22m[32m448.00 B[39m
[32mDTS[39m [1mdist/jobs-BsRu-P_y.d.ts   [22m[32m3.88 KB[39m
::endgroup::

  Tasks:    38 successful, 38 total
 Cached:    38 cached, 38 total
   Time:    526ms >>> FULL TURBO
Summary:    /home/runner/work/framework/framework/.turbo/runs/3KCPAvSFi5CGinvkcRZ7YCrGoto.json


```

stderr excerpt:

```text

Attention:
Turborepo now collects completely anonymous telemetry regarding usage.
This information is used to shape the Turborepo roadmap and prioritize features.
You can learn more, including how to opt-out if you'd not like to participate in this anonymous program, by visiting the following URL:
https://turborepo.dev/docs/telemetry


```

### Quick-start Lambda smoke

- ID: `quick-start-lambda-smoke`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/quick-start-lambda-smoke.mts`
- Started at: 2026-10-03T20:13:56.529Z
- Completed at: 2026-10-03T20:15:58.580Z
- Duration: 122.05s
- Timeout: 600s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
[truncated 52116 chars]
m [1mdist/index.d.ts  [22m[32m16.49 KB[39m
packages/auth-clerk build: Done
packages/telemetry-sdk-node build: [32mDTS[39m ⚡️ Build success in 5044ms
packages/telemetry-sdk-node build: [32mDTS[39m [1mdist/index.d.mts [22m[32m15.25 KB[39m
packages/telemetry-sdk-node build: [32mDTS[39m [1mdist/index.d.ts  [22m[32m15.25 KB[39m
packages/telemetry-sdk-node build: Done
packages/testing-resources build$ tsup src/index.ts --format esm,cjs --minify --clean --dts
packages/testing-resources build: [34mCLI[39m Building entry: src/index.ts
packages/testing-resources build: [34mCLI[39m Using tsconfig: tsconfig.json
packages/testing-resources build: [34mCLI[39m tsup v8.5.1
packages/testing-resources build: [34mCLI[39m Target: es2017
packages/testing-resources build: [34mCLI[39m Cleaning output folder
packages/testing-resources build: [34mESM[39m Build start
packages/testing-resources build: [34mCJS[39m Build start
packages/testing-resources build: [32mCJS[39m [1mdist/index.js [22m[32m11.45 KB[39m
packages/testing-resources build: [32mCJS[39m ⚡️ Build success in 74ms
packages/testing-resources build: [32mESM[39m [1mdist/index.mjs [22m[32m10.60 KB[39m
packages/testing-resources build: [32mESM[39m ⚡️ Build success in 111ms
packages/testing-resources build: [34mDTS[39m Build start
packages/testing-resources build: [32mDTS[39m ⚡️ Build success in 7415ms
packages/testing-resources build: [32mDTS[39m [1mdist/index.d.mts [22m[32m4.12 KB[39m
packages/testing-resources build: [32mDTS[39m [1mdist/index.d.ts  [22m[32m4.12 KB[39m
packages/testing-resources build: Done
packages/metering-core build$ tsup src/index.ts --format esm,cjs --minify --clean --dts
packages/metering-core build: [34mCLI[39m Building entry: src/index.ts
packages/metering-core build: [34mCLI[39m Using tsconfig: tsconfig.json
packages/metering-core build: [34mCLI[39m tsup v8.5.1
packages/metering-core build: [34mCLI[39m Target: es2017
packages/metering-core build: [34mCLI[39m Cleaning output folder
packages/metering-core build: [34mESM[39m Build start
packages/metering-core build: [34mCJS[39m Build start
packages/metering-core build: [32mCJS[39m [1mdist/index.js [22m[32m65.25 KB[39m
packages/metering-core build: [32mCJS[39m ⚡️ Build success in 162ms
packages/metering-core build: [32mESM[39m [1mdist/index.mjs [22m[32m64.14 KB[39m
packages/metering-core build: [32mESM[39m ⚡️ Build success in 167ms
packages/metering-core build: [34mDTS[39m Build start
packages/metering-core build: [32mDTS[39m ⚡️ Build success in 2639ms
packages/metering-core build: [32mDTS[39m [1mdist/index.d.mts [22m[32m37.75 KB[39m
packages/metering-core build: [32mDTS[39m [1mdist/index.d.ts  [22m[32m37.75 KB[39m
packages/metering-core build: Done
examples/quick-start-lambda build$ tsx scripts/build.ts && tsc --noEmit
examples/quick-start-lambda build: Done
quick-start-lambda-smoke: build passed
quick-start-lambda-smoke: generated graph passed
quick-start-lambda-smoke: metering replay started
quick-start-lambda-smoke: metering replay passed
quick-start-lambda-smoke: application lifecycle started
quick-start-lambda-smoke: application lifecycle passed
SaaS demo API running at http://localhost:38047/api
quick-start-lambda-smoke: startup passed
quick-start-lambda-smoke: health passed
quick-start-lambda-smoke: unauthorized users passed
quick-start-lambda-smoke: unauthorized user creation passed
quick-start-lambda-smoke: authorized users passed
usage recorded {
  id: '01M41PHAPN6TM1PFARFYPDEMJ6',
  tenantId: 'default',
  meterId: 'api_user_create',
  value: 1,
  timestamp: 2026-10-03T20:15:53.557Z,
  idempotencyKey: '01M41PHAPMEYZE95T9ZMJVBT2S',
  eventId: undefined,
  dimensions: undefined,
  metadata: undefined
}
quick-start-lambda-smoke: create user passed
quick-start-lambda-smoke: created user remains available passed
quick-start-lambda-smoke: create user metering passed
quick-start-lambda-smoke: all checks passed

```

### First-success contract

- ID: `first-success`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Follow the reported scaffold or documentation recovery command -- node --experimental-strip-types scripts/first-success-verify.mts`
- Started at: 2026-10-03T20:13:57.372Z
- Completed at: 2026-10-03T20:13:58.513Z
- Duration: 1.14s
- Timeout: 600s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
[truncated 456 chars]
idation
  ✅ A1h — quick-start-lambda configures all required security middleware capabilities
  ✅ A1i — quick-start-lambda declares its rate-limit dependency
  ✅ A1k — quick-start-lambda rate limiter is credential-free and wired to HTTP middleware
  ✅ A1j — quick-start-lambda README documents the secure bootstrap posture
  ✅ A2a — HealthController has @Controller('/api')
  ✅ A2b — HealthController has @Get('/health')
  ✅ A2c — health() returns { status: 'ok' }
  ✅ A3a — UserController has @Controller('/api/users')
  ✅ A3b — UserController has @Get()
  ✅ A3c — list() has @UseGuards(ApiKeyGuard)
  ✅ A4a — UserController has @Post()
  ✅ A4b — create() has @UseGuards(ApiKeyGuard)
  ✅ A4c — create() has @Metered({ meterId: 'api_user_create' })

📋 B. Auth contract

  ✅ B0 — ApiKeyGuard delegates to AuthGuard with its injected TestAuthProvider
  ✅ B1 — TestAuthProvider.ts checks for `test-key`
  ✅ B2 — TestAuthProvider.ts returns null for non-matching keys
  ✅ B3 — README documents x-api-key: test-key usage
  ✅ B4 — README documents 401 for missing/invalid key

📋 C. Metering contract

  ✅ C1 — UserController has class-level @Meter({ meterId: 'api_user_create' })
  ✅ C2 — create() has @Metered({ meterId: 'api_user_create' })
  ✅ C3 — README documents api_user_create meter

📋 D. SaaS billing golden-path contract

  ✅ S1a — SaaS README documents local run command
  ✅ S1b — SaaS README documents local test command
  ✅ S1c — SaaS README documents root smoke command
  ✅ S2a — SaaS scripts.dev matches expected pattern (tsx src/index.ts)
  ✅ S2b — SaaS scripts.test runs the checked-in golden path tests
  ✅ S2c — SaaS scripts.typecheck matches expected typecheck command
  ✅ S2d — SaaS scripts.build matches expected typecheck command
  ✅ S3 — root package.json exposes `saas-billing-golden-path:smoke`
  ✅ S4a — BillingController includes @Controller("/api")
  ✅ S4b — BillingController includes @Post("/checkouts")
  ✅ S4c — BillingController includes @Get("/orders/:id")
  ✅ S4d — BillingController includes @Get("/backoffice/audit")
  ✅ S5a — CheckoutService includes RetryTemplate
  ✅ S5b — CheckoutService includes publishAfterCommit
  ✅ S5c — CheckoutService includes withSpan
  ✅ S5d — CheckoutService includes CheckoutValidationProblem
  ✅ S5e — CheckoutService includes OrderNotFoundProblem
  ✅ S6a — golden-path.spec.ts covers retries transient payment failure
  ✅ S6b — golden-path.spec.ts covers golden-path/checkout-validation
  ✅ S6c — golden-path.spec.ts covers golden-path/payment-declined
  ✅ S6d — golden-path.spec.ts covers golden-path/order-not-found
  ✅ S7a — Getting started docs reference saas-billing-golden-path
  ✅ S7b — Getting started docs document SaaS billing golden-path smoke command
  ✅ S8a — SaaS billing example uses default security validation
  ✅ S8b — SaaS billing example configures all required security middleware capabilities
  ✅ S8c — SaaS billing example declares its rate-limit dependency
  ✅ S8e — SaaS billing rate limiter is credential-free and wired to HTTP middleware
  ✅ S8d — SaaS billing README documents the secure bootstrap posture

📋 E. Docs contract

  ✅ D1 — Getting started docs reference quick-start-lambda
  ✅ D1b — Getting started docs document quick-start-lambda smoke command
  ✅ D2 — Getting started docs document create-croco-app command
  ✅ D3 — Public create-croco-app commands validate and each source retains the canonical saas-api journey
  ✅ D4 — Getting started docs do not describe prompts for the quick-start command
  ✅ D5 — Public package-count claims match generated catalog count (130)
  ✅ D6 — README, getting-started docs, and release spine docs share first-success commands
  ✅ D7 — README tooling commands match required root package scripts
  ✅ D8 — Public 1.0 spine status matches docs/package-catalog.json

📋 F. Scaffold contract

  ✅ E1 — prompts.ts ddd-api hint matches contract
  ✅ E2 — prompts.ts has ddd-api preset

✅ first-success contract verification PASSED — all contracts match source.

```

### Package entrypoint smoke

- ID: `package-entrypoints-smoke`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/package-entrypoint-smoke.mts --build-missing`
- Started at: 2026-10-03T20:50:14.843Z
- Completed at: 2026-10-03T20:52:58.601Z
- Duration: 163.76s
- Timeout: 900s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
[truncated 15993 chars]
 cjs 1, types 1
✓ @croco/framework-logger: esm 1, cjs 1, types 1
✓ @croco/framework-module: esm 1, cjs 1, types 1
✓ @croco/framework-preset: esm 1, cjs 1, types 1
✓ @croco/framework-routes: esm 1, cjs 1, types 1
✓ @croco/frontend-cloudflare: esm 1, cjs 1, types 1
✓ @croco/frontend-problems: esm 1, cjs 1, types 1
✓ @croco/frontend-react: esm 2, cjs 2, types 2
✓ @croco/frontend-vite: esm 1, cjs 1, types 1
✓ @croco/gid-core: esm 1, cjs 1, types 1
✓ @croco/governance-core: esm 1, cjs 1, types 1
✓ @croco/health-core: esm 1, cjs 1, types 1
✓ @croco/idempotency-core: esm 1, cjs 1, types 1
✓ @croco/impersonation-core: esm 1, cjs 1, types 1
✓ @croco/integrations-posthog: esm 1, cjs 1, types 1
✓ @croco/invitation-core: esm 1, cjs 1, types 1
✓ @croco/invitation-drizzle: esm 1, cjs 1, types 1
✓ @croco/lifecycle-core: esm 1, cjs 1, types 1
✓ @croco/lifecycle-drizzle: esm 1, cjs 1, types 1
✓ @croco/membership-core: esm 1, cjs 1, types 1
✓ @croco/membership-drizzle: esm 1, cjs 1, types 1
✓ @croco/meta-vite: esm 2, cjs 2, types 2
✓ @croco/metering-core: esm 1, cjs 1, types 1
✓ @croco/metering-drizzle: esm 1, cjs 1, types 1
✓ @croco/metering-upstash: esm 1, cjs 1, types 1
✓ @croco/metrics-billing: esm 1, cjs 1, types 1
✓ @croco/metrics-core: esm 2, cjs 2, types 2
✓ @croco/migration-runner: esm 2, cjs 2, types 2
✓ @croco/notifications-core: esm 1, cjs 1, types 1
✓ @croco/notifications-fcm: esm 1, cjs 1, types 1
✓ @croco/notifications-react-email: esm 1, cjs 1, types 1
✓ @croco/notifications-resend: esm 1, cjs 1, types 1
✓ @croco/onboarding-core: esm 2, cjs 2, types 2
✓ @croco/onboarding-drizzle: esm 1, cjs 1, types 1
✓ @croco/openapi-spec: esm 1, cjs 1, types 1
✓ @croco/outbox-core: esm 1, cjs 1, types 1
✓ @croco/pagination-core: esm 1, cjs 1, types 1
✓ @croco/presentation-preset: esm 2, cjs 2, types 1
✓ @croco/preset-cloudflare: esm 2, cjs 0, types 2
✓ @croco/preset-lambda: esm 3, cjs 3, types 3
✓ @croco/preset-node: esm 2, cjs 2, types 2
✓ @croco/problems-core: esm 1, cjs 1, types 1
✓ @croco/promotions-core: esm 2, cjs 2, types 2
✓ @croco/promotions-drizzle: esm 1, cjs 1, types 1
✓ @croco/protocol-codegen: esm 1, cjs 1, types 1
✓ @croco/protocols-core: esm 1, cjs 1, types 1
✓ @croco/protocols-graphql: esm 1, cjs 1, types 1
✓ @croco/protocols-rest: esm 1, cjs 1, types 1
✓ @croco/protocols-trpc: esm 1, cjs 1, types 1
✓ @croco/ratelimit-core: esm 1, cjs 1, types 1
✓ @croco/ratelimit-upstash: esm 1, cjs 1, types 1
✓ @croco/repository-core: esm 1, cjs 1, types 1
✓ @croco/retry-core: esm 1, cjs 1, types 1
✓ @croco/rpc-codegen: esm 1, cjs 1, types 1
✓ @croco/search-core: esm 2, cjs 0, types 2
✓ @croco/search-drizzle: esm 1, cjs 0, types 1
✓ @croco/search-meilisearch: esm 1, cjs 0, types 1
✓ @croco/storage-cloudflare: esm 1, cjs 1, types 1
✓ @croco/storage-cloudinary: esm 1, cjs 1, types 1
✓ @croco/storage-core: esm 2, cjs 2, types 2
✓ @croco/storage-r2: esm 1, cjs 1, types 1
✓ @croco/tasks-core: esm 1, cjs 1, types 1
✓ @croco/tasks-qstash: esm 1, cjs 1, types 1
✓ @croco/telemetry-api: esm 1, cjs 1, types 1
✓ @croco/telemetry-sdk-node: esm 1, cjs 1, types 1
✓ @croco/tenant-core: esm 2, cjs 2, types 2
✓ @croco/testing-resources: esm 1, cjs 1, types 1
✓ @croco/testing: esm 8, cjs 8, types 6
✓ @croco/transports-cloudflare-workers: esm 1, cjs 1, types 1
✓ @croco/transports-graphql: esm 1, cjs 1, types 1
✓ @croco/transports-http: esm 1, cjs 1, types 1
✓ @croco/triggers-core: esm 1, cjs 1, types 1
✓ @croco/triggers-qstash: esm 1, cjs 1, types 1
✓ @croco/tx-core: esm 1, cjs 1, types 1
✓ @croco/tx-drizzle: esm 1, cjs 1, types 1
✓ @croco/ui-astryx: esm 1, cjs 1, types 1
✓ @croco/warehouse-core: esm 2, cjs 2, types 2
✓ @croco/warehouse-postgres: esm 3, cjs 3, types 3
✓ @croco/webhooks-core: esm 1, cjs 1, types 1
✓ @croco/workflow-core: esm 1, cjs 1, types 1

package-entrypoint-smoke: exemptions
- none

package-entrypoint-smoke: summary checked=130 exempt=0 skippedPrivate=2

package-entrypoint-smoke: cjs, esm, and typescript consumers resolved for 130 packages

```

### Package binary smoke

- ID: `package-bins-smoke`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/package-bin-smoke.mts`
- Started at: 2026-10-03T20:13:58.515Z
- Completed at: 2026-10-03T20:14:17.889Z
- Duration: 19.37s
- Timeout: 1200s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
package-bin-smoke: @croco/cli croco doctor --json
package-bin-smoke: @croco/cli croco migrate up --help
package-bin-smoke: @croco/cli croco --cwd bin-smoke/migration-workspace --dryRun migrate up -d -migrations --target -1 --connection postgres://db --dry-run
package-bin-smoke: @croco/cli croco migrate status
package-bin-smoke: @croco/cli croco --overwrite migrate up
package-bin-smoke: @croco/cli croco --cwd migrate --bogus up
package-bin-smoke: @croco/cli croco desktop generate --config bin smoke/croco desktop.config.ts --out-dir bin smoke/generated desktop --strict --json
package-bin-smoke: @croco/cli croco-agent call listCapabilities {}
package-bin-smoke: @croco/cli croco-agent stdio
package-bin-smoke: create-croco-app create-croco-app bin-smoke-app --preset blank --scope @croco-smoke --no-install --no-git --json
package-bin-smoke: @croco/migration-runner migrate status
package-bin-smoke: @croco/migration-runner migrate down --count abc
package-bin-smoke: @croco/openapi-spec croco-openapi-spec --controllers bin-smoke/SmokeController.ts --tsconfig bin-smoke/tsconfig.json --check --compatibility-problems --compatibility-schemas
package-bin-smoke: @croco/rpc-codegen croco-rpc-codegen --controllers bin-smoke/SmokeController.ts --tsconfig bin-smoke/tsconfig.json --check --compatibility-problems --compatibility-schemas

package-bin-smoke: checked packages
- @croco/cli: bins 2
- create-croco-app: bins 1
- @croco/migration-runner: bins 1
- @croco/openapi-spec: bins 1
- @croco/rpc-codegen: bins 1

package-bin-smoke: summary checkedPackages=5 checkedBins=6

```

### create-croco-app spine smoke

- ID: `generated-app-smoke`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/create-croco-app-generated-smoke.mts goal-saas-api goal-spa-backend-split goal-worker goal-internal-tool graphql-lambda-api trpc-lambda-api graphql-vite-spa-docker meta-vite-fullstack-workers production-app-starter saas-golden-path saas-single-tenant rest-spa-contracts admin-console-starter ai-saas-golden-path`
- Started at: 2026-10-03T20:14:17.892Z
- Completed at: 2026-10-03T20:48:33.483Z
- Duration: 2055.59s
- Timeout: 4500s
- Failure reason: none

Artifacts:
- Spine-blocking generated app smoke matrix markdown (required): `ci-reports/generated-apps/spine-blocking-matrix.md` present; modified at 2026-10-03T20:48:29.078Z; copied to `ci-reports/release/artifacts/generated-app-smoke/spine-blocking-matrix.md`
- Spine-blocking generated app smoke matrix JSON (required): `ci-reports/generated-apps/spine-blocking-matrix.json` present; modified at 2026-10-03T20:48:29.077Z; copied to `ci-reports/release/artifacts/generated-app-smoke/spine-blocking-matrix.json`
- Ecosystem-advisory generated app smoke matrix JSON (optional): `ci-reports/generated-apps/ecosystem-advisory-matrix.json` present; modified at 2026-10-03T20:48:29.078Z; copied to `ci-reports/release/artifacts/generated-app-smoke/ecosystem-advisory-matrix.json`
- Aggregate generated app smoke matrix JSON (optional): `ci-reports/generated-apps/matrix.json` present; modified at 2026-10-03T20:48:29.078Z; copied to `ci-reports/release/artifacts/generated-app-smoke/matrix.json`
- Generated app smoke journey bundle (optional): `ci-reports/generated-apps/spine-blocking-journeys` missing
- Generated test materialization evidence (required): `ci-reports/generated-apps/materialization-evidence.json` present; modified at 2026-10-03T20:48:29.077Z; copied to `ci-reports/release/artifacts/generated-app-smoke/materialization-evidence.json`
- Generated test materializations (required): `ci-reports/generated-apps/materialized-tests` present; modified at 2026-10-03T20:23:04.330Z; copied to `ci-reports/release/artifacts/generated-app-smoke/materialized-tests`

stdout excerpt:

```text
[truncated 13609 chars]
ed-smoke: saas-golden-path lint passed
create-croco-app-generated-smoke: saas-golden-path provider profile manifest passed
create-croco-app-generated-smoke: saas-golden-path real-provider missing env diagnostic passed
create-croco-app-generated-smoke: saas-golden-path real-provider constructor bootstrap passed
create-croco-app-generated-smoke: saas-golden-path usage dashboard generator passed
create-croco-app-generated-smoke: saas-golden-path typecheck passed
create-croco-app-generated-smoke: saas-golden-path build passed
create-croco-app-generated-smoke: saas-golden-path Contract snapshot passed
create-croco-app-generated-smoke: saas-golden-path Contract codegen passed
create-croco-app-generated-smoke: saas-golden-path test passed
create-croco-app-generated-smoke: saas-golden-path Contract verify passed
create-croco-app-generated-smoke: saas-golden-path DI graph generation passed
create-croco-app-generated-smoke: saas-golden-path DI graph verify passed
create-croco-app-generated-smoke: saas-golden-path demo seed passed
create-croco-app-generated-smoke: saas-golden-path demo flow passed
create-croco-app-generated-smoke: saas-golden-path failure drill smoke passed
create-croco-app-generated-smoke: saas-golden-path scenario output passed
create-croco-app-generated-smoke: saas-single-tenant README.md exists
create-croco-app-generated-smoke: saas-single-tenant Node runtime contract matches >=24
create-croco-app-generated-smoke: saas-single-tenant generated a commented .env.example only
create-croco-app-generated-smoke: saas-single-tenant keeps HTTP security validation enabled
create-croco-app-generated-smoke: saas-single-tenant generated secret placeholders are safe
create-croco-app-generated-smoke: saas-single-tenant lint passed
create-croco-app-generated-smoke: saas-single-tenant install-immediate contract verify passed
create-croco-app-generated-smoke: saas-single-tenant provider profile manifest passed
create-croco-app-generated-smoke: saas-single-tenant runtime capability manifest passed
create-croco-app-generated-smoke: saas-single-tenant build passed
create-croco-app-generated-smoke: saas-single-tenant typecheck passed
create-croco-app-generated-smoke: saas-single-tenant test passed
create-croco-app-generated-smoke: saas-single-tenant contract:snapshot passed
create-croco-app-generated-smoke: saas-single-tenant codegen passed
create-croco-app-generated-smoke: saas-single-tenant contract:verify passed
create-croco-app-generated-smoke: saas-single-tenant demo:smoke passed
create-croco-app-generated-smoke: ai-saas-golden-path README.md exists
create-croco-app-generated-smoke: ai-saas-golden-path Node runtime contract matches >=24
create-croco-app-generated-smoke: ai-saas-golden-path generated a commented .env.example only
create-croco-app-generated-smoke: ai-saas-golden-path keeps HTTP security validation enabled
create-croco-app-generated-smoke: ai-saas-golden-path generated secret placeholders are safe
create-croco-app-generated-smoke: ai-saas-golden-path lint passed
create-croco-app-generated-smoke: ai-saas-golden-path build passed
create-croco-app-generated-smoke: ai-saas-golden-path typecheck passed
create-croco-app-generated-smoke: ai-saas-golden-path Contract snapshot passed
create-croco-app-generated-smoke: ai-saas-golden-path Contract codegen passed
create-croco-app-generated-smoke: ai-saas-golden-path test passed
create-croco-app-generated-smoke: ai-saas-golden-path Contract verify passed
create-croco-app-generated-smoke: ai-saas-golden-path DI graph generation passed
create-croco-app-generated-smoke: ai-saas-golden-path DI graph verify passed
create-croco-app-generated-smoke: ai-saas-golden-path AI demo flow passed
create-croco-app-generated-smoke: ai-saas-golden-path full demo flow passed
create-croco-app-generated-smoke: ai-saas-golden-path failure drill smoke passed
create-croco-app-generated-smoke: rest-spa-contracts contract commands passed
create-croco-app-generated-smoke: all generated app smoke cases passed

```

### Packed decorator consumers

- ID: `packed-decorator-consumers`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/packed-decorator-consumers.mts`
- Started at: 2026-10-03T20:15:58.585Z
- Completed at: 2026-10-03T20:16:09.710Z
- Duration: 11.13s
- Timeout: 900s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
packed-decorator-consumers: declarations: strict decorator overloads preserved
packed-decorator-consumers: install: 5 packed internal packages, no local dependency references
packed-decorator-consumers: ESM: positive build/runtime and 7 negative markers passed
packed-decorator-consumers: CJS: positive build/runtime and 7 negative markers passed

```

### Packed generated app release smoke

- ID: `alpha-release-smoke`
- Status: not_applicable
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/alpha-release-smoke.mts`
- Started at: not started
- Completed at: 2026-10-03T20:48:33.489Z
- Duration: not collected
- Timeout: not started
- Failure reason: Not applicable to the changed files in this verification context.

Artifacts:
- Packed generated app smoke report (required): `ci-reports/release/alpha-release-smoke.md` missing

### Summarized TypeScript check

- ID: `typecheck`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported TypeScript diagnostics -- pnpm turbo run typecheck --summarize --continue=always`
- Started at: 2026-10-03T20:48:33.491Z
- Completed at: 2026-10-03T20:50:14.840Z
- Duration: 101.35s
- Timeout: 1800s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
[truncated 139279 chars]
m Build start
[32mCJS[39m [1mdist/index.js [22m[32m57.99 KB[39m
[32mCJS[39m ⚡️ Build success in 387ms
[32mESM[39m [1mdist/index.mjs [22m[32m53.19 KB[39m
[32mESM[39m ⚡️ Build success in 394ms
[34mDTS[39m Build start
[32mDTS[39m ⚡️ Build success in 28167ms
[32mDTS[39m [1mdist/index.d.mts [22m[32m169.04 KB[39m
[32mDTS[39m [1mdist/index.d.ts  [22m[32m169.04 KB[39m
::endgroup::
::group::@croco/engagement-core:typecheck
cache miss, executing c014272476a2bd3c
$ tsc --noEmit
::endgroup::
::group::@croco-example/onboarding-goals:build
cache miss, executing 944acfd2de1ca657
$ tsc --noEmit
::endgroup::
::group::@croco-example/experience-placement:build
cache miss, executing 10a59896632b3054
$ tsc --noEmit
::endgroup::
::group::@croco-example/growth-analysis:build
cache miss, executing d72c91a16c986f82
$ tsc --noEmit
::endgroup::
::group::@croco/cohort-core:typecheck
cache miss, executing 1650925f57631d24
$ tsc --noEmit
::endgroup::
::group::@croco-example/warehouse-explorer:build
cache miss, executing 3b2f3107019025a5
$ tsc --noEmit
::endgroup::
::group::@croco/notifications-react-email:typecheck
cache miss, executing 6353f60c412d2b3a
$ tsc --noEmit
::endgroup::
::group::@croco-example/promotion-offers:build
cache miss, executing ffebd98b99b4b303
$ tsc --noEmit
::endgroup::
::group::@croco-example/lifecycle-journey:build
cache miss, executing 0c37073924c3281d
$ tsc --noEmit
::endgroup::
::group::@croco/experience-core:typecheck
cache miss, executing 2ad14292c968bdb3
$ tsc --noEmit
::endgroup::
::group::@croco/cohort-drizzle:typecheck
cache miss, executing e5fbfb3e97e485df
$ tsc --noEmit
::endgroup::
::group::@croco-example/contact-policy:build
cache miss, executing 14024ac445d6cab6
$ tsc --noEmit
::endgroup::
::group::@croco-example/cohort-builder:build
cache miss, executing 1d0054ca012d2610
$ tsc --noEmit
::endgroup::
::group::@croco/engagement-drizzle:typecheck
cache miss, executing 7f4a118aa3662924
$ tsc --noEmit
::endgroup::
::group::@croco/experience-drizzle:typecheck
cache miss, executing c96ec6e673c659c2
$ tsc --noEmit
::endgroup::
::group::@croco/frontend-react:typecheck
cache miss, executing 1aec5d69642ea4c3
$ tsc --noEmit
::endgroup::
::group::@croco/admin-core:typecheck
cache miss, executing 024f973ea48bd824
$ tsc --noEmit
::endgroup::
::group::@croco/frontend-cloudflare:typecheck
cache miss, executing b5acb6b1f7cd7c15
$ tsc --noEmit
::endgroup::
::group::@croco/ui-astryx:typecheck
cache miss, executing 8b768142f9dca0f3
$ tsc --noEmit
::endgroup::
::group::@croco/admin-react:typecheck
cache miss, executing 179ad39f315622c5
$ tsc --noEmit
::endgroup::
::group::@croco-example/experiment-runtime:typecheck
cache miss, executing f4d7259ddbd5274f
$ tsc --noEmit
::endgroup::
::group::@croco-example/experience-placement:typecheck
cache miss, executing 4e2c4be99bd23a37
$ tsc --noEmit
::endgroup::
::group::@croco-example/fact-history:typecheck
cache miss, executing 800f7ee2649f99c0
$ tsc --noEmit
::endgroup::
::group::@croco-example/growth-analysis:typecheck
cache miss, executing 57169573c8dca66b
$ tsc --noEmit
::endgroup::
::group::@croco-example/contact-policy:typecheck
cache miss, executing 69bbee16383468bf
$ tsc --noEmit
::endgroup::
::group::@croco-example/promotion-offers:typecheck
cache miss, executing bbc3db66e3dc1521
$ tsc --noEmit
::endgroup::
::group::@croco-example/onboarding-goals:typecheck
cache miss, executing 4a3a11712fbb7262
$ tsc --noEmit
::endgroup::
::group::@croco-example/cohort-builder:typecheck
cache miss, executing 3dc31efb42653bf8
$ tsc --noEmit
::endgroup::
::group::@croco-example/lifecycle-journey:typecheck
cache miss, executing e285dcbd50f85eeb
$ tsc --noEmit
::endgroup::
::group::@croco-example/warehouse-explorer:typecheck
cache miss, executing 749d505de131b943
$ tsc --noEmit
::endgroup::

  Tasks:    292 successful, 292 total
 Cached:    252 cached, 292 total
   Time:    1m40.87s 
Summary:    /home/runner/work/framework/framework/.turbo/runs/3KCTadWjzKdDtjNSigV2peKLjoG.json


```

stderr excerpt:

```text
 WARNING  no output files found for task @croco-example/cohort-builder#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/contact-policy#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/experience-placement#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/experiment-runtime#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/fact-history#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/growth-analysis#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/lifecycle-journey#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/onboarding-goals#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/promotion-offers#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/warehouse-explorer#build. Please check your `outputs` key in `turbo.json`

```

### Summarized tests

- ID: `test`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/test-lane-runner.mts --lane fast --output ci-reports/package-quality/fast-test-lane.json`
- Started at: 2026-10-03T20:52:58.603Z
- Completed at: 2026-10-03T20:57:14.285Z
- Duration: 255.68s
- Timeout: 2700s
- Failure reason: none

Artifacts:
- Fast test lane evidence (required): `ci-reports/package-quality/fast-test-lane.json` present; modified at 2026-10-03T20:57:14.278Z; copied to `ci-reports/release/artifacts/test/fast-test-lane.json`

stdout excerpt:

```text
[truncated 198250 chars]
m[32m37.81 KB[39m
[32mDTS[39m [1mdist/index.d.ts  [22m[32m37.81 KB[39m
::endgroup::
::group::@croco/membership-drizzle:test:evidence
cache hit, replaying logs 5638ab0692b8a6bf
$ pnpm run test --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
$ vitest run --exclude src/tests/DrizzleMembershipStore.postgres.spec.ts --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
JSON report written to /home/runner/work/framework/framework/packages/membership-drizzle/.turbo/croco-test-evidence.json
::endgroup::
::group::@croco/frontend-react:test:evidence
cache miss, executing 322242fd87f88758
$ pnpm run test --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
$ vitest run --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
JSON report written to /home/runner/work/framework/framework/packages/frontend-react/.turbo/croco-test-evidence.json
::endgroup::
::group::@croco-example/experiment-runtime:test:evidence
cache miss, executing 9bc3e08607222738
$ pnpm run test --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
$ vitest run --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
JSON report written to /home/runner/work/framework/framework/examples/experiment-runtime/.turbo/croco-test-evidence.json
::endgroup::
::group::@croco/admin-core:test:evidence
cache miss, executing 9f382437f8194bf4
$ pnpm run test --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
$ vitest run --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
JSON report written to /home/runner/work/framework/framework/packages/admin-core/.turbo/croco-test-evidence.json
::endgroup::
::group::@croco-example/lifecycle-journey:test:evidence
cache miss, executing 60eb540cd615621d
$ pnpm run test --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
$ vitest run src/tests/TaskRecovery.spec.ts --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
JSON report written to /home/runner/work/framework/framework/examples/lifecycle-journey/.turbo/croco-test-evidence.json
::endgroup::
::group::@croco/invitation-drizzle:test:evidence
cache hit, replaying logs f755411c3d05ca24
$ pnpm run test --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
$ vitest run --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
JSON report written to /home/runner/work/framework/framework/packages/invitation-drizzle/.turbo/croco-test-evidence.json
::endgroup::
::group::@croco-example/promotion-offers:test:evidence
cache miss, executing 122dae89e88c1e52
$ pnpm run test --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
$ vitest run src/tests --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
JSON report written to /home/runner/work/framework/framework/examples/promotion-offers/.turbo/croco-test-evidence.json
::endgroup::
::group::@croco-example/growth-analysis:test:evidence
cache miss, executing cb6eb5f0017e7d4b
$ pnpm run test --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
$ vitest run --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
JSON report written to /home/runner/work/framework/framework/examples/growth-analysis/.turbo/croco-test-evidence.json
::endgroup::
::group::@croco/admin-react:test:evidence
cache miss, executing 04759d052eef3ede
$ pnpm run test --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
$ vitest run --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
JSON report written to /home/runner/work/framework/framework/packages/admin-react/.turbo/croco-test-evidence.json
::endgroup::

  Tasks:    271 successful, 271 total
 Cached:    253 cached, 271 total
   Time:    19.419s 
Summary:    /home/runner/work/framework/framework/.turbo/runs/3KCTxkc6iKy7GkqF6H2pffQf8O6.json


```

stderr excerpt:

```text
[truncated 6817 chars]
EAD is now at 96b3621 base
Warning: you are leaving 1 commit behind, not connected to
any of your branches:

  62ffed5 Merge commit '3b3d9ae3522776d45d3bf57cffe5c6a864f780a7' into HEAD

If you want to keep it by creating a new branch, this may be a good time
to do so with:

 git branch <new-branch-name> 62ffed5

Switched to a new branch 'side'
HEAD is now at 20fde9f side
Switched to a new branch 'pull-request'
HEAD is now at 96b3621 base
Warning: you are leaving 1 commit behind, not connected to
any of your branches:

  c1f497e Merge commit '3b3d9ae3522776d45d3bf57cffe5c6a864f780a7' into HEAD

If you want to keep it by creating a new branch, this may be a good time
to do so with:

 git branch <new-branch-name> c1f497e

Switched to a new branch 'side'
HEAD is now at fb80b9e side
Switched to a new branch 'pull-request'
Switched to branch 'trunk'
Switched to a new branch 'pull-request'
HEAD is now at 5346412 base
Warning: you are leaving 1 commit behind, not connected to
any of your branches:

  436f995 Merge commit 'be0ad1310a9c6fdc23bf0b5c3e08575a2a2553b4' into HEAD

If you want to keep it by creating a new branch, this may be a good time
to do so with:

 git branch <new-branch-name> 436f995

Switched to branch 'pull-request'
Switched to a new branch 'pull-request'
HEAD is now at 5346412 base
Warning: you are leaving 1 commit behind, not connected to
any of your branches:

  436f995 Merge commit 'be0ad1310a9c6fdc23bf0b5c3e08575a2a2553b4' into HEAD

If you want to keep it by creating a new branch, this may be a good time
to do so with:

 git branch <new-branch-name> 436f995

Switched to branch 'trunk'
Cloning into '.'...
From file:///tmp/croco-ci-verification-identity-p5OCOL
 * branch            436f99501eaa496b1785a6f1a3fd0d8190a3d0c7 -> FETCH_HEAD
Cloning into '.'...
From file:///tmp/croco-ci-verification-identity-p5OCOL
 * branch            436f99501eaa496b1785a6f1a3fd0d8190a3d0c7 -> FETCH_HEAD
 * branch            trunk      -> FETCH_HEAD
Switched to a new branch 'pull-request'
HEAD is now at 5346412 base
hint: Using 'master' as the name for the initial branch. This default branch name
hint: will change to "main" in Git 3.0. To configure the initial branch name
hint: to use in all of your new repositories, which will suppress this warning,
hint: call:
hint:
hint: 	git config --global init.defaultBranch <name>
hint:
hint: Names commonly chosen instead of 'master' are 'main', 'trunk' and
hint: 'development'. The just-created branch can be renamed via this command:
hint:
hint: 	git branch -m <name>
hint:
hint: Disable this message with "git config set advice.defaultBranchName false"
hint: Using 'master' as the name for the initial branch. This default branch name
hint: will change to "main" in Git 3.0. To configure the initial branch name
hint: to use in all of your new repositories, which will suppress this warning,
hint: call:
hint:
hint: 	git config --global init.defaultBranch <name>
hint:
hint: Names commonly chosen instead of 'master' are 'main', 'trunk' and
hint: 'development'. The just-created branch can be renamed via this command:
hint:
hint: 	git branch -m <name>
hint:
hint: Disable this message with "git config set advice.defaultBranchName false"
Switched to a new branch 'pull-request'
HEAD is now at 8e514c7 base
hint: Using 'master' as the name for the initial branch. This default branch name
hint: will change to "main" in Git 3.0. To configure the initial branch name
hint: to use in all of your new repositories, which will suppress this warning,
hint: call:
hint:
hint: 	git config --global init.defaultBranch <name>
hint:
hint: Names commonly chosen instead of 'master' are 'main', 'trunk' and
hint: 'development'. The just-created branch can be renamed via this command:
hint:
hint: 	git branch -m <name>
hint:
hint: Disable this message with "git config set advice.defaultBranchName false"
fatal: path 'missing-shadow-assurance-fixture.json' does not exist in 'HEAD'
fatal: invalid object name 'invalid-shadow-revision'.

```

### Inventory integration test lane

- ID: `integration-test-lane`
- Status: passed
- Selection reason: Selected for the full integration inventory.
- Command: `node --experimental-strip-types scripts/test-lane-runner.mts --lane integration --output ci-reports/package-quality/integration-test-lane.json`
- Started at: 2026-10-03T20:57:14.294Z
- Completed at: 2026-10-03T21:02:34.942Z
- Duration: 320.65s
- Timeout: 1800s
- Failure reason: none

Artifacts:
- Integration test lane evidence (required): `ci-reports/package-quality/integration-test-lane.json` present; modified at 2026-10-03T21:02:34.936Z; copied to `ci-reports/release/artifacts/integration-test-lane/integration-test-lane.json`

stdout excerpt:

```text
JSON report written to /tmp/croco-test-lane-9BJHIn/vitest.json
JSON report written to /tmp/croco-test-lane-3UtWLR/vitest.json
JSON report written to /tmp/croco-test-lane-vhpcT1/vitest.json

Running 1 test using 1 worker
·
  1 passed (3.4m)
JSON report written to /tmp/croco-test-lane-j2ObcN/vitest.json
JSON report written to /tmp/croco-test-lane-kBeWE2/vitest.json
JSON report written to /tmp/croco-test-lane-75VGIN/vitest.json
JSON report written to /tmp/croco-test-lane-GGeyKa/vitest.json
JSON report written to /tmp/croco-test-lane-eYAUIm/vitest.json

```

stderr excerpt:

```text
$ vitest run src/tests/Integration.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-9BJHIn/vitest.json
$ vitest run src/tests/integration/CliCommandIntegration.spec.ts src/tests/integration/e2e.spec.ts src/tests/integration/jobs-e2e.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-3UtWLR/vitest.json
$ vitest run src/tests/E2E.spec.ts src/tests/e2e-advanced.spec.ts src/tests/e2e-vite-spa.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-vhpcT1/vitest.json
$ playwright test e2e/verify-starlight.spec.ts --reporter=json
$ CROCO_TEST_REAL_RESOURCES=1 vitest run src/tests/OutboxFactSource.integration.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-j2ObcN/vitest.json
$ vitest run src/__tests__/e2e.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-kBeWE2/vitest.json
$ vitest run src/tests/e2e.spec.ts src/tests/real-app.e2e.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-75VGIN/vitest.json
$ vitest run src/tests/TaskRunner.integration.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-GGeyKa/vitest.json
$ CROCO_TEST_REAL_RESOURCES=1 vitest run src/tests/PostgresWarehouseFacts.integration.spec.ts src/tests/PostgresWarehouseReader.integration.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-eYAUIm/vitest.json

```

### Inventory published-consumer test lane

- ID: `published-test-lane`
- Status: passed
- Selection reason: Selected for the full published-consumer inventory.
- Command: `node --experimental-strip-types scripts/test-lane-runner.mts --lane published --output ci-reports/package-quality/published-test-lane.json`
- Started at: 2026-10-03T21:02:34.945Z
- Completed at: 2026-10-03T21:03:21.602Z
- Duration: 46.66s
- Timeout: 2700s
- Failure reason: none

Artifacts:
- Published-consumer test lane evidence (required): `ci-reports/package-quality/published-test-lane.json` present; modified at 2026-10-03T21:03:21.596Z; copied to `ci-reports/release/artifacts/published-test-lane/published-test-lane.json`

stdout excerpt:

```text
JSON report written to /tmp/croco-test-lane-laMmw9/vitest.json
JSON report written to /tmp/croco-test-lane-K4U8Ms/vitest.json
JSON report written to /tmp/croco-test-lane-mLAImq/vitest.json
JSON report written to /tmp/croco-test-lane-AULChZ/vitest.json
JSON report written to /tmp/croco-test-lane-spl0FR/vitest.json
JSON report written to /tmp/croco-test-lane-UZNPAW/vitest.json
JSON report written to /tmp/croco-test-lane-mUe0KJ/vitest.json
JSON report written to /tmp/croco-test-lane-LmACs7/vitest.json
JSON report written to /tmp/croco-test-lane-x3jn2q/vitest.json
JSON report written to /tmp/croco-test-lane-OTgCQD/vitest.json
JSON report written to /tmp/croco-test-lane-oxjWcH/vitest.json
JSON report written to /tmp/croco-test-lane-7M27VG/vitest.json
JSON report written to /tmp/croco-test-lane-J7djjf/vitest.json
JSON report written to /tmp/croco-test-lane-RAkdZr/vitest.json

```

stderr excerpt:

```text
$ vitest run src/tests/PublishedCli.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-laMmw9/vitest.json
$ vitest run src/tests/PublishedMessageContracts.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-K4U8Ms/vitest.json
$ vitest run src/tests/PublishedGraphConsumer.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-mLAImq/vitest.json
$ vitest run src/tests/PublishedTypes.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-AULChZ/vitest.json
$ vitest run src/tests/published-contract.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-spl0FR/vitest.json
$ vitest run src/tests/PublishedCli.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-UZNPAW/vitest.json
$ vitest run src/tests/PublishedReactEmail.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-mUe0KJ/vitest.json
$ vitest run src/tests/PublishedPolicyTypes.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-LmACs7/vitest.json
$ vitest run src/tests/PublishedCli.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-x3jn2q/vitest.json
$ vitest run src/tests/PublishedSearchable.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-OTgCQD/vitest.json
$ vitest run src/tests/PublishedTypes.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-oxjWcH/vitest.json
$ vitest run src/tests/PublishedTypes.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-7M27VG/vitest.json
$ vitest run src/tests/PublishedWorkerTypes.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-J7djjf/vitest.json
$ vitest run src/tests/PublishedListen.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-RAkdZr/vitest.json

```

### Enforced test execution evidence

- ID: `test-evidence-reconcile`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/test-evidence-reconcile.mts --profile publish --lane-report ci-reports/package-quality/fast-test-lane.json --lane-report ci-reports/package-quality/integration-test-lane.json --lane-report ci-reports/package-quality/published-test-lane.json --materialization-evidence ci-reports/generated-apps/materialization-evidence.json --generated-root ci-reports/generated-apps/materialized-tests --required-generated-path packages/create-croco-app/templates/addons/graphql-standalone/apps/graphql-api/src/formatGraphQLError.spec.ts --required-generated-path packages/create-croco-app/templates/admin-console/apps/api-server/src/tests/AdminConsole.spec.ts --required-generated-path packages/create-croco-app/templates/admin-console/apps/api-server/src/tests/CreditOperations.spec.ts --required-generated-path packages/create-croco-app/templates/admin-console/tests/journeys/plan-release.spec.ts --required-generated-path packages/create-croco-app/templates/ai-saas/apps/api-server/src/tests/AiGenerate.spec.ts --required-generated-path packages/create-croco-app/templates/ai-saas/apps/api-server/src/tests/AiReceipts.spec.ts --required-generated-path packages/create-croco-app/templates/ai-saas/apps/api-server/src/tests/AiSaas.spec.ts --required-generated-path packages/create-croco-app/templates/base-ddd/libs/shared/utils-env/src/tests/createEnv.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/ContractFuzz.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/ExecutableAssurance.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/FileBillableUsageJournal.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/FileUsageBillingGateway.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/GeneratedTelemetryEndpoint.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/ProviderProfileEnv.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/SaasDemo.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/node-lifecycle.spec.ts --required-generated-path packages/create-croco-app/templates/spa-be-split/apps/api-server/src/tests/app.spec.ts --required-generated-path packages/create-croco-app/templates/spa-be-split/apps/api-server/src/tests/env.spec.ts --required-generated-path packages/create-croco-app/templates/spa-be-split/apps/api-server/src/tests/node-lifecycle.spec.ts --required-generated-path packages/create-croco-app/templates/spa-be-split/apps/console-web/src/tests/ProblemNotice.spec.tsx --required-generated-path packages/create-croco-app/templates/spa-be-split/tests/journeys/create-user.spec.ts --required-generated-path packages/create-croco-app/templates/spa-be-split/tests/journeys/problem-rendering.spec.ts --output ci-reports/package-quality/test-evidence.json`
- Started at: 2026-10-03T21:03:21.605Z
- Completed at: 2026-10-03T21:03:21.764Z
- Duration: 0.16s
- Timeout: 300s
- Failure reason: none

Artifacts:
- Enforced test evidence (required): `ci-reports/package-quality/test-evidence.json` present; modified at 2026-10-03T21:03:21.757Z; copied to `ci-reports/release/artifacts/test-evidence-reconcile/test-evidence.json`

### Packed installed CLI integration evidence

- ID: `cli-packed-e2e`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/test-lane-evidence-check.mts --report ci-reports/package-quality/integration-test-lane.json --lane integration --path packages/cli/src/tests/integration/CliCommandIntegration.spec.ts`
- Started at: 2026-10-03T21:03:21.609Z
- Completed at: 2026-10-03T21:03:21.752Z
- Duration: 0.14s
- Timeout: 120s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
[test-lane-evidence] integration report covers 1 required paths

```

### Provider certification

- ID: `provider-certification`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported provider certification metadata -- node --experimental-strip-types scripts/provider-certification-check.mts`
- Started at: 2026-10-03T20:16:09.713Z
- Completed at: 2026-10-03T20:16:10.352Z
- Duration: 0.64s
- Timeout: 600s
- Failure reason: none

Artifacts:
- Provider certification markdown (required): `ci-reports/package-quality/provider-certification.md` present; modified at 2026-10-03T20:16:10.133Z; copied to `ci-reports/release/artifacts/provider-certification/provider-certification.md`
- Provider certification JSON (required): `ci-reports/package-quality/provider-certification.json` present; modified at 2026-10-03T20:16:10.134Z; copied to `ci-reports/release/artifacts/provider-certification/provider-certification.json`

stdout excerpt:

```text
provider-certification-check: wrote /home/runner/work/framework/framework/ci-reports/package-quality/provider-certification.md
provider-certification-check: wrote /home/runner/work/framework/framework/ci-reports/package-quality/provider-certification.json
provider-certification-check: production extension packages=3
provider-certification-check: blocking failures=0

```

### Production-ready package evidence

- ID: `production-ready`
- Status: passed
- Selection reason: Selected because package accountability inputs changed: packages/batch-core/src/index.ts, packages/batch-core/src/tests/DocExamples.spec.ts.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported production-ready package violations -- node --experimental-strip-types scripts/production-ready-check.mts`
- Started at: 2026-10-03T21:03:21.766Z
- Completed at: 2026-10-03T21:03:22.993Z
- Duration: 1.23s
- Timeout: 600s
- Failure reason: none

Artifacts:
- Production-ready package markdown (required): `ci-reports/package-quality/production-ready.md` present; modified at 2026-10-03T21:03:22.692Z; copied to `ci-reports/release/artifacts/production-ready/production-ready.md`

stdout excerpt:

```text
production-ready-check: wrote /home/runner/work/framework/framework/ci-reports/package-quality/production-ready.md
production-ready-check: production packages=23
production-ready-check: blocking failures=0

```

### Beta spine promotion accountability

- ID: `spine-promotion`
- Status: passed
- Selection reason: Selected because package accountability inputs changed: packages/batch-core/src/index.ts, packages/batch-core/src/tests/DocExamples.spec.ts.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported beta spine promotion violations -- node --experimental-strip-types scripts/spine-promotion-check.mts --package batch-core`
- Started at: 2026-10-03T21:03:23.000Z
- Completed at: 2026-10-03T21:03:24.119Z
- Duration: 1.12s
- Timeout: 600s
- Failure reason: none

Artifacts:
- Beta spine promotion markdown (required): `ci-reports/package-quality/spine-promotion.md` present; modified at 2026-10-03T21:03:23.882Z; copied to `ci-reports/release/artifacts/spine-promotion/spine-promotion.md`

stdout excerpt:

```text
spine-promotion-check: wrote /home/runner/work/framework/framework/ci-reports/package-quality/spine-promotion.md
spine-promotion-check: beta spine packages=0
spine-promotion-check: blocking failures=0

```

### Core coverage gate

- ID: `core-coverage`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/core-coverage-runner.mts`
- Started at: 2026-10-03T21:03:21.756Z
- Completed at: 2026-10-03T21:06:47.192Z
- Duration: 205.44s
- Timeout: 2700s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
[truncated 151587 chars]
|   85.41 | ...98-300,327,336 
  create.ts        |     100 |      100 |     100 |     100 |                   
  createDomain.ts  |   61.53 |       52 |      70 |   64.86 | ...40-147,245-262 
  createPage.ts    |   77.77 |    68.08 |    62.5 |   82.35 | ...25-140,171-174 
  ...topRemoved.ts |   77.77 |      100 |   33.33 |   77.77 | 21,36             
  di.ts            |     100 |      100 |     100 |     100 |                   
  diCheck.ts       |    82.6 |    75.65 |   82.75 |    82.3 | ...52,356-357,365 
  diGraph.ts       |   84.05 |    79.32 |   88.23 |   84.21 | ...23,628,634,641 
  doctor.ts        |   88.67 |    79.11 |   96.23 |   88.57 | ...5393,5415-5445 
  generate.ts      |     100 |      100 |     100 |     100 |                   
  ...teScaffold.ts |      60 |    45.45 |      50 |    64.7 | 35,79-92,97       
  ...eDashboard.ts |   76.92 |    61.66 |   86.36 |   77.77 | ...1267,1290-1308 
  jobs.ts          |   80.15 |    56.06 |   81.57 |    80.8 | ...80,685,692,706 
  make.ts          |     100 |      100 |     100 |     100 |                   
  ...Controller.ts |     100 |    85.71 |     100 |     100 | 115-118           
  makeEntity.ts    |   73.33 |    64.28 |      50 |   73.33 | 36-37,78-84       
  makeEvent.ts     |   76.47 |    64.28 |      50 |   76.47 | 38-39,90-96       
  makeListener.ts  |      75 |    64.28 |      50 |      75 | 37-38,92-98       
  ...Repository.ts |      75 |    64.28 |      50 |      75 | 37-38,102-108     
  migrate.ts       |   91.73 |    86.17 |      96 |   91.22 | ...72-376,382,391 
  ops.ts           |   33.33 |        0 |       0 |   33.33 | 60-69,108-118     
  options.ts       |     100 |      100 |     100 |     100 |                   
  projectMap.ts    |   72.86 |    58.25 |   71.96 |   72.68 | ...1795,1810,1829 
  resolveCliBin.ts |     100 |      100 |     100 |     100 |                   
  root.ts          |   78.06 |    81.35 |   66.66 |   79.31 | ...00-404,409,427 
  runtimePolicy.ts |   68.42 |     67.6 |   83.33 |   68.08 | ...19,323-324,332 
  testPlan.ts      |   85.24 |    77.55 |   80.64 |   84.95 | ...82,351-352,361 
  upgrade.ts       |   88.51 |    77.65 |    92.3 |   88.27 | ...24,341,346,458 
  upgradeRules.ts  |   98.57 |    84.37 |     100 |   98.41 | 231               
 src/libs          |   86.85 |    84.14 |   91.79 |   89.91 |                   
  CliError.ts      |     100 |      100 |     100 |     100 |                   
  ...tReadTools.ts |   87.36 |    86.27 |   83.33 |   93.02 | ...01,155,175,184 
  ...ntEvidence.ts |     100 |      100 |     100 |     100 |                   
  cliRuntime.ts    |   68.96 |     82.6 |   61.11 |   67.85 | ...48-49,70,81-88 
  constants.ts     |     100 |      100 |     100 |     100 |                   
  ...ageFilters.ts |     100 |    85.71 |     100 |     100 | 14                
  ...tedCommand.ts |   95.45 |       92 |     100 |     100 | 49-59             
  ...osticCodes.ts |    90.9 |       75 |      80 |    90.9 | 197               
  fileWriter.ts    |   87.86 |    87.59 |     100 |   87.85 | ...14,517-518,531 
  ...rtContract.ts |     100 |     91.3 |     100 |     100 | 115,125           
  naming.ts        |    75.6 |    73.23 |     100 |   86.36 | ...65,169,173,214 
  ops.ts           |   92.78 |    87.67 |   95.83 |   93.54 | ...31,237,312,317 
  prompts.ts       |     100 |      100 |     100 |     100 |                   
  workspace.ts     |     100 |      100 |     100 |     100 |                   
 src/libs/codemods |   89.01 |    85.09 |     100 |   91.02 |                   
  ...Controller.ts |   89.01 |    85.09 |     100 |   91.02 | ...66,393,397,429 
 src/templates     |     100 |      100 |     100 |     100 |                   
  pageRoute.ts     |     100 |      100 |     100 |     100 |                   
  pageTsx.ts       |     100 |      100 |     100 |     100 |                   
-------------------|---------|----------|---------|---------|-------------------

```

stderr excerpt:

```text
[90mstderr[2m | src/tests/ShutdownManager.spec.ts[2m > [22m[2mShutdownManager[2m > [22m[2mshutdown[2m > [22m[2mshould abort active hooks when timeout is exceeded
[22m[39m[ShutdownManager] Shutdown timeout exceeded.

[90mstderr[2m | src/tests/ShutdownManager.spec.ts[2m > [22m[2mShutdownManager[2m > [22m[2mshutdown[2m > [22m[2mshould preserve strict hook failures when a later hook times out
[22m[39m[ShutdownManager] Shutdown timeout exceeded.

[90mstderr[2m | src/libs/TxManager.test.ts[2m > [22m[2mTxManager.onAfterCommit[2m > [22m[2mshould track detached savepoint fallbacks as joined operations
[22m[39m[TxManager] Savepoint nesting requested but adapter does not support savepoint. Falling back to join.

[90mstderr[2m | src/tests/TxManager.concurrency.spec.ts[2m > [22m[2mTxManager Transaction Timeout[2m > [22m[2mtimeout with run options[2m > [22m[2mshould report slow afterCommit failures as committed post-processing failures
[22m[39m[TxManager] AfterCommit hook failed: {
  error: TestTransactionFailureProblem: post-commit delivery failed
      at [90m/home/runner/work/framework/framework/packages/tx-core/[39msrc/tests/TxManager.concurrency.spec.ts:592:19
      at TxManager.executeAfterCommitHooks [90m(/home/runner/work/framework/framework/packages/tx-core/[39msrc/libs/TxManager.ts:437:9[90m)[39m
      at TxManager.executeRootWithOutcome [90m(/home/runner/work/framework/framework/packages/tx-core/[39msrc/libs/TxManager.ts:220:11[90m)[39m
      at [90m/home/runner/work/framework/framework/packages/tx-core/[39msrc/tests/TxManager.concurrency.spec.ts:588:23
      at file:///home/runner/work/framework/framework/node_modules/[4m.pnpm[24m/@vitest+runner@4.1.8/node_modules/[4m@vitest/runner[24m/dist/chunk-artifact.js:1903:20 {
    code: [32m'tx-core/test-transaction-failure'[39m,
    category: [32m'InternalServerError'[39m,
    detail: [32m'post-commit delivery failed'[39m,
    type: [32m'about:blank'[39m,
    instance: [90mundefined[39m,
    extensions: [90mundefined[39m,
    cause: [90mundefined[39m
  }
}

[90mstderr[2m | src/tests/RbacEngine.spec.ts[2m > [22m[2mRbacEngine[2m > [22m[2mhasPermission[2m > [22m[2mshould return true if user has permission via role
[22m[39mMalformed permission string: profile:update

[90mstderr[2m | src/tests/RbacEngine.spec.ts[2m > [22m[2mRbacEngine[2m > [22m[2mhasPermission[2m > [22m[2mshould return false if user does not have permission
[22m[39mMalformed permission string: profile:update


```

### Core coverage warning report

- ID: `core-coverage-warning`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/core-coverage-warning-check.mts`
- Started at: 2026-10-03T21:06:47.195Z
- Completed at: 2026-10-03T21:06:47.306Z
- Duration: 0.11s
- Timeout: 600s
- Failure reason: none

Artifacts:
- Core coverage warning markdown (required): `ci-reports/coverage/core-warning/report.md` present; modified at 2026-10-03T21:06:47.299Z; copied to `ci-reports/release/artifacts/core-coverage-warning/report.md`

stdout excerpt:

```text

⚠️  Core coverage warning report written to /home/runner/work/framework/framework/ci-reports/coverage/core-warning/report.md
⚠️  Total core coverage selection warnings: 39
⚠️  Total core coverage warnings: 58
✅ Total core coverage hard errors: 0

```

### Public API snapshot

- ID: `public-api`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm public-api:write -- node --experimental-strip-types scripts/public-api-surface.mts --check`
- Started at: 2026-10-03T20:16:10.356Z
- Completed at: 2026-10-03T20:16:12.883Z
- Duration: 2.53s
- Timeout: 600s
- Failure reason: none

Artifacts:
- Public API diff markdown (required): `ci-reports/package-quality/public-api-diff.md` present; modified at 2026-10-03T20:16:12.652Z; copied to `ci-reports/release/artifacts/public-api/public-api-diff.md`
- Public API summary JSON (required): `ci-reports/package-quality/public-api-summary.json` present; modified at 2026-10-03T20:16:12.652Z; copied to `ci-reports/release/artifacts/public-api/public-api-summary.json`

stdout excerpt:

```text
public-api-surface: 130 package public API snapshot(s) match.

```

### Release-gate maintenance test evidence

- ID: `release-gate-tests`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/test-lane-evidence-check.mts --report ci-reports/package-quality/fast-test-lane.json --lane fast --path scripts/tests/alpha-release-smoke.spec.ts --path scripts/tests/api-docs-trigger-check.spec.ts --path scripts/tests/architecture-policy-check.spec.ts --path scripts/tests/bench-threshold-check.spec.ts --path scripts/tests/benchmark-workflow.spec.ts --path scripts/tests/branch-protection-policy.spec.ts --path scripts/tests/changeset-required-check.spec.ts --path scripts/tests/ci-executable-policy.spec.ts --path scripts/tests/ci-performance-budget.spec.ts --path scripts/tests/ci-verification-identity.spec.ts --path scripts/tests/ci-workflow.spec.ts --path scripts/tests/compiler-baseline-check.spec.ts --path scripts/tests/core-coverage-warning-check.spec.ts --path scripts/tests/create-croco-app-generated-smoke.spec.ts --path scripts/tests/dependency-audit-policy.spec.ts --path scripts/tests/doc-examples-check.spec.ts --path scripts/tests/first-success-verify.spec.ts --path scripts/tests/generated-secret-placeholder-policy.spec.ts --path scripts/tests/live-tests-workflow.spec.ts --path scripts/tests/normalize-packages.spec.ts --path scripts/tests/package-bin-smoke.spec.ts --path scripts/tests/package-docs-check.spec.ts --path scripts/tests/package-entrypoint-smoke.spec.ts --path scripts/tests/package-manifest-contracts.spec.ts --path scripts/tests/package-quality-report.spec.ts --path scripts/tests/package-roles.spec.ts --path scripts/tests/problem-registry.spec.ts --path scripts/tests/production-ready-check.spec.ts --path scripts/tests/provenance-config-check.spec.ts --path scripts/tests/provider-certification-check.spec.ts --path scripts/tests/public-api-surface.spec.ts --path scripts/tests/release-docs-check.spec.ts --path scripts/tests/release-metadata-check.spec.ts --path scripts/tests/release-spine-evidence.spec.ts --path scripts/tests/release-version-sync.spec.ts --path scripts/tests/release-workflow.spec.ts --path scripts/tests/repository-policy-audit-workflow.spec.ts --path scripts/tests/security-allowlist-metadata-check.spec.ts --path scripts/tests/spine-promotion-check.spec.ts --path scripts/tests/static-misuse-check.spec.ts --path scripts/tests/strict-contract-typecheck.spec.ts --path scripts/tests/test-evidence-reconcile.spec.ts --path scripts/tests/test-inventory.spec.ts --path scripts/tests/test-lane-evidence-check.spec.ts --path scripts/tests/test-lane-runner.spec.ts --path scripts/tests/tracked-file-mutation-guard.spec.ts --path scripts/tests/turbo-cache-contract.spec.ts --path scripts/tests/turbo-canonical-cache.spec.ts --path scripts/tests/turbo-task-contract.spec.ts --path scripts/tests/verification-change-classifier.spec.ts --path scripts/tests/verification-command.spec.ts --path scripts/tests/verification-manifest.spec.ts --path scripts/tests/verification-policy.spec.ts --path scripts/tests/verify-circular-allowlist.spec.ts`
- Started at: 2026-10-03T20:57:14.297Z
- Completed at: 2026-10-03T20:57:14.456Z
- Duration: 0.16s
- Timeout: 120s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
[test-lane-evidence] fast report covers 54 required paths

```

### Spine bundle-size warning report

- ID: `spine-bundle-size`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/package-quality-report.mts`
- Started at: 2026-10-03T21:03:24.123Z
- Completed at: 2026-10-03T21:03:24.387Z
- Duration: 0.27s
- Timeout: 600s
- Failure reason: none

Artifacts:
- Package quality dashboard markdown (required): `ci-reports/package-quality/report.md` present; modified at 2026-10-03T21:03:24.363Z; copied to `ci-reports/release/artifacts/spine-bundle-size/report.md`
- Package quality dashboard JSON (required): `ci-reports/package-quality/summary.json` present; modified at 2026-10-03T21:03:24.366Z; copied to `ci-reports/release/artifacts/spine-bundle-size/summary.json`
- Bundle-size enforcement markdown (required): `ci-reports/package-quality/bundle-size.md` present; modified at 2026-10-03T21:03:24.370Z; copied to `ci-reports/release/artifacts/spine-bundle-size/bundle-size.md`

stdout excerpt:

```text
package-quality-report: wrote /home/runner/work/framework/framework/ci-reports/package-quality/report.md
package-quality-report: package task failures=0
package-quality-report: dependency boundary failures=0
package-quality-report: compatibility train internal range drift=0
package-quality-report: compatibility train generated app range drift=0
package-quality-report: spine bundle-size blocking issues=0

```

### Production dependency audit policy

- ID: `dependency-audit-policy`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/dependency-audit-policy.mts`
- Started at: 2026-10-03T20:16:12.887Z
- Completed at: 2026-10-03T20:16:18.601Z
- Duration: 5.71s
- Timeout: 600s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
dependency-audit-policy: pnpm audit --json started timeoutMs=120000
dependency-audit-policy: pnpm audit --json completed elapsedMs=549 status=1 signal=null
dependency-audit-policy: pnpm audit --prod --json started timeoutMs=120000
dependency-audit-policy: pnpm audit --prod --json completed elapsedMs=517 status=1 signal=null
dependency-audit-policy: generated template pnpm audit --json started timeoutMs=120000
dependency-audit-policy: generated template pnpm audit --json completed elapsedMs=316 status=0 signal=null
dependency-audit-policy: wrote ci-reports/security/dependency-audit-policy.md
dependency-audit-policy: passed

```

### npm provenance configuration

- ID: `provenance-config`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/provenance-config-check.mts`
- Started at: 2026-10-03T20:16:18.605Z
- Completed at: 2026-10-03T20:16:18.808Z
- Duration: 0.20s
- Timeout: 300s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
NPM_CONFIG_PROVENANCE: true
npm provenance: true

```

stderr excerpt:

```text
npm warn Unknown project config "node-linker". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.

```

### Publish dry run

- ID: `publish-dry-run`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `pnpm -r publish --dry-run --no-git-checks`
- Started at: 2026-10-03T21:06:47.203Z
- Completed at: 2026-10-03T21:08:01.004Z
- Duration: 73.80s
- Timeout: 1800s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
[truncated 57058 chars]
TH_TOKEN_EXCHANGE: Failed token exchange request with body message: Unknown error (status code 404)
📦 @croco/frontend-react@0.1.0 → https://registry.npmjs.org/
[WARN] Skip publishing @croco/frontend-react@0.1.0 (dry run)
GET https://run-actions-2-azure-eastus.actions.githubusercontent.com/110//idtoken/bdcdecc7-9329-819d-9886-0d98a0d86593/6972a9fd-b66e-5f3a-b281-7fcbae3f6ef8?api-version=2.0&audience=npm%3Aregistry.npmjs.org 200 61ms
[WARN] Skipped OIDC: ERR_PNPM_AUTH_TOKEN_EXCHANGE: Failed token exchange request with body message: Unknown error (status code 404)
📦 @croco/entitlements-drizzle@0.0.4 → https://registry.npmjs.org/
[WARN] Skip publishing @croco/entitlements-drizzle@0.0.4 (dry run)
GET https://run-actions-2-azure-eastus.actions.githubusercontent.com/110//idtoken/bdcdecc7-9329-819d-9886-0d98a0d86593/6972a9fd-b66e-5f3a-b281-7fcbae3f6ef8?api-version=2.0&audience=npm%3Aregistry.npmjs.org 200 56ms
[WARN] Skipped OIDC: ERR_PNPM_AUTH_TOKEN_EXCHANGE: Failed token exchange request with body message: Unknown error (status code 404)
📦 @croco/membership-core@0.0.4 → https://registry.npmjs.org/
[WARN] Skip publishing @croco/membership-core@0.0.4 (dry run)
GET https://run-actions-2-azure-eastus.actions.githubusercontent.com/110//idtoken/bdcdecc7-9329-819d-9886-0d98a0d86593/6972a9fd-b66e-5f3a-b281-7fcbae3f6ef8?api-version=2.0&audience=npm%3Aregistry.npmjs.org 200 64ms
[WARN] Skipped OIDC: ERR_PNPM_AUTH_TOKEN_EXCHANGE: Failed token exchange request with body message: Unknown error (status code 404)
📦 @croco/admin-react@0.1.0 → https://registry.npmjs.org/
[WARN] Skip publishing @croco/admin-react@0.1.0 (dry run)
GET https://run-actions-2-azure-eastus.actions.githubusercontent.com/110//idtoken/bdcdecc7-9329-819d-9886-0d98a0d86593/6972a9fd-b66e-5f3a-b281-7fcbae3f6ef8?api-version=2.0&audience=npm%3Aregistry.npmjs.org 200 61ms
[WARN] Skipped OIDC: ERR_PNPM_AUTH_TOKEN_EXCHANGE: Failed token exchange request with body message: Unknown error (status code 404)
📦 @croco/frontend-cloudflare@0.1.0 → https://registry.npmjs.org/
[WARN] Skip publishing @croco/frontend-cloudflare@0.1.0 (dry run)
GET https://run-actions-2-azure-eastus.actions.githubusercontent.com/110//idtoken/bdcdecc7-9329-819d-9886-0d98a0d86593/6972a9fd-b66e-5f3a-b281-7fcbae3f6ef8?api-version=2.0&audience=npm%3Aregistry.npmjs.org 200 57ms
[WARN] Skipped OIDC: ERR_PNPM_AUTH_TOKEN_EXCHANGE: Failed token exchange request with body message: Unknown error (status code 404)
📦 @croco/ui-astryx@0.1.0 → https://registry.npmjs.org/
[WARN] Skip publishing @croco/ui-astryx@0.1.0 (dry run)
GET https://run-actions-2-azure-eastus.actions.githubusercontent.com/110//idtoken/bdcdecc7-9329-819d-9886-0d98a0d86593/6972a9fd-b66e-5f3a-b281-7fcbae3f6ef8?api-version=2.0&audience=npm%3Aregistry.npmjs.org 200 54ms
[WARN] Skipped OIDC: ERR_PNPM_AUTH_TOKEN_EXCHANGE: Failed token exchange request with body message: Unknown error (status code 404)
📦 @croco/invitation-core@0.0.4 → https://registry.npmjs.org/
[WARN] Skip publishing @croco/invitation-core@0.0.4 (dry run)
GET https://run-actions-2-azure-eastus.actions.githubusercontent.com/110//idtoken/bdcdecc7-9329-819d-9886-0d98a0d86593/6972a9fd-b66e-5f3a-b281-7fcbae3f6ef8?api-version=2.0&audience=npm%3Aregistry.npmjs.org 200 74ms
[WARN] Skipped OIDC: ERR_PNPM_AUTH_TOKEN_EXCHANGE: Failed token exchange request with body message: Unknown error (status code 404)
📦 @croco/membership-drizzle@0.0.4 → https://registry.npmjs.org/
[WARN] Skip publishing @croco/membership-drizzle@0.0.4 (dry run)
GET https://run-actions-2-azure-eastus.actions.githubusercontent.com/110//idtoken/bdcdecc7-9329-819d-9886-0d98a0d86593/6972a9fd-b66e-5f3a-b281-7fcbae3f6ef8?api-version=2.0&audience=npm%3Aregistry.npmjs.org 200 58ms
[WARN] Skipped OIDC: ERR_PNPM_AUTH_TOKEN_EXCHANGE: Failed token exchange request with body message: Unknown error (status code 404)
📦 @croco/invitation-drizzle@0.0.4 → https://registry.npmjs.org/
[WARN] Skip publishing @croco/invitation-drizzle@0.0.4 (dry run)

```

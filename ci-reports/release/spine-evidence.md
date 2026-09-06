# Release Spine Evidence

- Status: passed
- Generated at: 2026-09-06T18:35:23.733Z
- Completed at: 2026-09-06T19:44:04.598Z
- Root: `/home/runner/work/framework/framework`
- Output directory: `/home/runner/work/framework/framework/ci-reports/release`
- Profile: `publish`
- Commit: `10f360164c126e849adfec9b818506085b354e7e`
- Run: `34050242023` attempt `1`
- Total timeout: 9000s
- Checks: 48/54 passed, 6 not applicable, 0 failed, 0 timed out, 0 interrupted, 0 skipped after timeout, 0 skipped by prerequisite

## Check summary

| Check | Category | Command | Status | Exit | Duration | Timeout | Evidence artifacts |
| --- | --- | --- | --- | --- | ---: | ---: | --- |
| Read-only verification policy | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Guard or classify the reported verification path -- node --experimental-strip-types scripts/verification-policy.mts` | passed | 0 | 0.94s | 300s | - |
| Authoritative test inventory | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery node --experimental-strip-types scripts/test-inventory.mts --write -- node --experimental-strip-types scripts/test-inventory.mts --check --profile publish --output ci-reports/package-quality/test-inventory.json` | passed | 0 | 1.18s | 300s | Resolved test inventory (present, modified: 2026-09-06T18:35:24.414Z, copied: `ci-reports/release/artifacts/test-inventory/test-inventory.json`) |
| Turbo cache reuse and invalidation contract | quality | `node --experimental-strip-types scripts/turbo-cache-contract.mts` | passed | 0 | 18.68s | 300s | - |
| Verification profile contracts | quality | `pnpm exec vitest run scripts/tests/verification-command.spec.ts scripts/tests/verification-change-classifier.spec.ts scripts/tests/verification-manifest.spec.ts scripts/tests/release-spine-evidence.spec.ts scripts/tests/ci-workflow.spec.ts scripts/tests/ci-performance-budget.spec.ts scripts/tests/release-workflow.spec.ts scripts/tests/turbo-task-contract.spec.ts scripts/tests/branch-protection-policy.spec.ts scripts/tests/repository-policy-audit-workflow.spec.ts scripts/tests/verification-policy.spec.ts scripts/tests/test-inventory.spec.ts scripts/tests/test-lane-runner.spec.ts scripts/tests/turbo-cache-contract.spec.ts` | not_applicable | - | not collected | not started | - |
| Changeset requirement | metadata | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm changeset or revert the publishable change -- node --experimental-strip-types scripts/changeset-required-check.mts --base df8d0185955ec77aa8b38d475685d74f371dd0d1 --head HEAD` | passed | 0 | 0.88s | 300s | - |
| Package manifests | metadata | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm package-manifests:write -- node scripts/normalize-packages.mjs --check` | passed | 0 | 4.64s | 300s | - |
| Release version-derived metadata | metadata | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm release-version-sync:write && pnpm docs:catalog:write -- node --experimental-strip-types scripts/release-version-sync.mts --check` | passed | 0 | 0.66s | 300s | - |
| Package documentation catalog | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm docs:catalog:write -- node --experimental-strip-types scripts/package-docs-check.mts --check` | passed | 0 | 1.90s | 300s | - |
| API documentation triggers | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm docs:api-triggers:write -- node --experimental-strip-types scripts/api-docs-trigger-check.mts --check` | passed | 0 | 0.84s | 300s | - |
| Problem registry | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm problem-registry:write -- node --experimental-strip-types scripts/problem-registry.mts --check --base df8d0185955ec77aa8b38d475685d74f371dd0d1` | passed | 0 | 9.16s | 300s | - |
| Documentation examples | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm docs:examples:write -- node --experimental-strip-types scripts/doc-examples-check.mts --check` | passed | 0 | 8.17s | 300s | - |
| Release documentation | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported release documentation contract -- node --experimental-strip-types scripts/release-docs-check.mts` | passed | 0 | 0.73s | 300s | - |
| CI executable supply chain | security | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Pin the reported CI executable to an immutable source -- node --experimental-strip-types scripts/ci-executable-policy.mts` | passed | 0 | 2.18s | 300s | - |
| Pull-request CI performance budget | quality | `node --experimental-strip-types scripts/ci-performance-budget.mts` | passed | 0 | 0.37s | 300s | - |
| Verification runtime prerequisites | build | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the verification runtime build prerequisites -- pnpm --filter @croco/architecture-policy... --filter @croco/tenant-core... build` | passed | 0 | 23.86s | 600s | - |
| Architecture policy | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported architecture violation -- node --experimental-strip-types scripts/architecture-policy-check.mts --manifest croco.arch.json` | passed | 0 | 3.71s | 600s | - |
| Architecture circular allowlist | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Update code or intentionally update the circular dependency allowlist -- node --experimental-strip-types scripts/verify-circular-allowlist.mts` | passed | 0 | 17.72s | 600s | - |
| Dependency boundaries | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported package boundary -- node --experimental-strip-types scripts/package-quality-report.mts --boundary-check-only` | passed | 0 | 0.81s | 600s | - |
| Security allowlists | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported security allowlist metadata -- node --experimental-strip-types scripts/security-allowlist-metadata-check.mts` | passed | 0 | 5.64s | 300s | - |
| Generated secret placeholders | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported template placeholder -- node --experimental-strip-types scripts/generated-secret-placeholder-policy.mts` | passed | 0 | 0.65s | 300s | - |
| TypeScript compiler baseline | typecheck | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Restore the documented TypeScript compiler and tsconfig contract -- node --experimental-strip-types scripts/compiler-baseline-check.mts` | passed | 0 | 0.77s | 300s | - |
| Legacy decorator signature spike | typecheck | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Restore the reviewed TypeScript 6 decorator signature fixtures and policy -- node --experimental-strip-types scripts/decorator-signature-spike.mts` | passed | 0 | 9.32s | 600s | - |
| Strict contract typecheck | typecheck | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported strict contract diagnostic -- node --experimental-strip-types scripts/strict-contract-typecheck.mts` | passed | 0 | 78.45s | 600s | - |
| Static misuse | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported source misuse -- node --experimental-strip-types scripts/static-misuse-check.mts` | passed | 0 | 14.54s | 600s | - |
| Lint | quality | `pnpm exec oxlint .` | passed | 0 | 2.70s | 900s | - |
| Format | quality | `pnpm exec oxfmt --check . --ignore-path=.gitignore --ignore-path=.prettierignore --ignore-path=.oxfmtignore` | passed | 0 | 10.46s | 900s | - |
| Architecture circular dependencies | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported circular dependency -- pnpm exec madge --circular --extensions ts packages` | passed | 0 | 17.10s | 600s | - |
| Benchmark thresholds | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm bench:update -- node --experimental-strip-types scripts/bench-threshold-check.mts` | passed | 0 | 18.59s | 600s | - |
| Affected build | build | `pnpm turbo run build --filter=@croco/problems-core --filter=@croco/diagnostics-core --filter=@croco/framework-context --filter=@croco/protocols-core --filter=@croco/protocols-rest --summarize --continue=always` | passed | 0 | 22.32s | 1800s | - |
| Quick-start Lambda smoke | runtime-smoke | `node --experimental-strip-types scripts/quick-start-lambda-smoke.mts` | not_applicable | - | not collected | not started | - |
| First-success contract | generated-app | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Follow the reported scaffold or documentation recovery command -- node --experimental-strip-types scripts/first-success-verify.mts` | not_applicable | - | not collected | not started | - |
| Package entrypoint smoke | package-smoke | `node --experimental-strip-types scripts/package-entrypoint-smoke.mts --build-missing` | passed | 0 | 298.19s | 900s | - |
| Package binary smoke | package-smoke | `node --experimental-strip-types scripts/package-bin-smoke.mts` | not_applicable | - | not collected | not started | - |
| create-croco-app spine smoke | generated-app | `node --experimental-strip-types scripts/create-croco-app-generated-smoke.mts goal-saas-api goal-spa-backend-split goal-worker goal-internal-tool graphql-lambda-api graphql-vite-spa-docker meta-vite-fullstack-workers production-app-starter saas-golden-path rest-spa-contracts admin-console-starter ai-saas-golden-path` | passed | 0 | 1750.39s | 2700s | Spine-blocking generated app smoke matrix markdown (present, modified: 2026-09-06T19:06:54.042Z, copied: `ci-reports/release/artifacts/generated-app-smoke/spine-blocking-matrix.md`)<br>Spine-blocking generated app smoke matrix JSON (present, modified: 2026-09-06T19:06:54.042Z, copied: `ci-reports/release/artifacts/generated-app-smoke/spine-blocking-matrix.json`)<br>Generated app smoke journey bundle (missing)<br>Generated test materialization evidence (present, modified: 2026-09-06T19:06:54.041Z, copied: `ci-reports/release/artifacts/generated-app-smoke/materialization-evidence.json`)<br>Generated test materializations (present, modified: 2026-09-06T18:53:46.714Z, copied: `ci-reports/release/artifacts/generated-app-smoke/materialized-tests`) |
| Packed decorator consumers | package-smoke | `node --experimental-strip-types scripts/packed-decorator-consumers.mts` | passed | 0 | 48.38s | 900s | - |
| Packed generated app release smoke | generated-app | `node --experimental-strip-types scripts/alpha-release-smoke.mts` | not_applicable | - | not collected | not started | Packed generated app smoke report (missing) |
| Summarized TypeScript check | typecheck | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported TypeScript diagnostics -- pnpm turbo run typecheck --summarize --continue=always` | passed | 0 | 356.65s | 1800s | - |
| Summarized tests | quality | `node --experimental-strip-types scripts/test-lane-runner.mts --lane fast --output ci-reports/package-quality/fast-test-lane.json` | passed | 0 | 789.38s | 2700s | Fast test lane evidence (present, modified: 2026-09-06T19:31:05.174Z, copied: `ci-reports/release/artifacts/test/fast-test-lane.json`) |
| Inventory integration test lane | quality | `node --experimental-strip-types scripts/test-lane-runner.mts --lane integration --output ci-reports/package-quality/integration-test-lane.json` | passed | 0 | 382.66s | 1800s | Integration test lane evidence (present, modified: 2026-09-06T19:37:27.836Z, copied: `ci-reports/release/artifacts/integration-test-lane/integration-test-lane.json`) |
| Inventory published-consumer test lane | package-smoke | `node --experimental-strip-types scripts/test-lane-runner.mts --lane published --output ci-reports/package-quality/published-test-lane.json` | passed | 0 | 77.48s | 2700s | Published-consumer test lane evidence (present, modified: 2026-09-06T19:38:45.323Z, copied: `ci-reports/release/artifacts/published-test-lane/published-test-lane.json`) |
| Enforced test execution evidence | quality | `node --experimental-strip-types scripts/test-evidence-reconcile.mts --profile publish --lane-report ci-reports/package-quality/fast-test-lane.json --lane-report ci-reports/package-quality/integration-test-lane.json --lane-report ci-reports/package-quality/published-test-lane.json --materialization-evidence ci-reports/generated-apps/materialization-evidence.json --generated-root ci-reports/generated-apps/materialized-tests --required-generated-path packages/create-croco-app/templates/admin-console/apps/api-server/src/tests/AdminConsole.spec.ts --required-generated-path packages/create-croco-app/templates/admin-console/apps/api-server/src/tests/CreditOperations.spec.ts --required-generated-path packages/create-croco-app/templates/admin-console/tests/journeys/plan-release.spec.ts --required-generated-path packages/create-croco-app/templates/ai-saas/apps/api-server/src/tests/AiSaas.spec.ts --required-generated-path packages/create-croco-app/templates/base-ddd/libs/shared/utils-env/src/tests/createEnv.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/ContractFuzz.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/ExecutableAssurance.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/FileBillableUsageJournal.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/FileUsageBillingGateway.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/ProviderProfileEnv.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/SaasDemo.spec.ts --required-generated-path packages/create-croco-app/templates/spa-be-split/apps/api-server/src/tests/app.spec.ts --required-generated-path packages/create-croco-app/templates/spa-be-split/apps/console-web/src/tests/ProblemNotice.spec.tsx --required-generated-path packages/create-croco-app/templates/spa-be-split/tests/journeys/create-user.spec.ts --required-generated-path packages/create-croco-app/templates/spa-be-split/tests/journeys/problem-rendering.spec.ts --output ci-reports/package-quality/test-evidence.json` | passed | 0 | 0.14s | 300s | Enforced test evidence (present, modified: 2026-09-06T19:38:45.451Z, copied: `ci-reports/release/artifacts/test-evidence-reconcile/test-evidence.json`) |
| Packed installed CLI integration evidence | quality | `node --experimental-strip-types scripts/test-lane-evidence-check.mts --report ci-reports/package-quality/integration-test-lane.json --lane integration --path packages/cli/src/tests/integration/CliCommandIntegration.spec.ts` | not_applicable | - | not collected | not started | - |
| Provider certification | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported provider certification metadata -- node --experimental-strip-types scripts/provider-certification-check.mts` | passed | 0 | 0.96s | 600s | Provider certification markdown (present, modified: 2026-09-06T18:37:34.732Z, copied: `ci-reports/release/artifacts/provider-certification/provider-certification.md`)<br>Provider certification JSON (present, modified: 2026-09-06T18:37:34.733Z, copied: `ci-reports/release/artifacts/provider-certification/provider-certification.json`) |
| Production-ready package evidence | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported production-ready package violations -- node --experimental-strip-types scripts/production-ready-check.mts` | passed | 0 | 2.31s | 600s | Production-ready package markdown (present, modified: 2026-09-06T19:38:47.466Z, copied: `ci-reports/release/artifacts/production-ready/production-ready.md`) |
| Beta spine promotion accountability | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported beta spine promotion violations -- node --experimental-strip-types scripts/spine-promotion-check.mts --package docs --package idempotency-core --package problems-core` | passed | 0 | 3.12s | 600s | Beta spine promotion markdown (present, modified: 2026-09-06T19:38:50.332Z, copied: `ci-reports/release/artifacts/spine-promotion/spine-promotion.md`) |
| Core coverage gate | coverage | `pnpm --filter @croco/framework-context --filter @croco/problems-core --filter @croco/protocols-core --filter @croco/protocols-rest --filter @croco/openapi-spec --filter @croco/rpc-codegen --filter @croco/transports-http --filter @croco/telemetry-api --filter @croco/telemetry-sdk-node --filter @croco/tx-core --filter @croco/tx-drizzle --filter @croco/events-core --filter @croco/events-tx --filter @croco/retry-core --filter @croco/idempotency-core --filter @croco/testing --filter create-croco-app --filter @croco/cli --filter @croco/auth-core exec vitest run --coverage --config ../../vitest.config.ts` | passed | 0 | 234.65s | 2700s | - |
| Core coverage warning report | coverage | `node --experimental-strip-types scripts/core-coverage-warning-check.mts` | passed | 0 | 0.16s | 600s | Core coverage warning markdown (present, modified: 2026-09-06T19:42:40.125Z, copied: `ci-reports/release/artifacts/core-coverage-warning/report.md`) |
| Public API snapshot | public-api | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm public-api:write -- node --experimental-strip-types scripts/public-api-surface.mts --check` | passed | 0 | 4.17s | 600s | Public API diff markdown (present, modified: 2026-09-06T18:37:38.791Z, copied: `ci-reports/release/artifacts/public-api/public-api-diff.md`)<br>Public API summary JSON (present, modified: 2026-09-06T18:37:38.791Z, copied: `ci-reports/release/artifacts/public-api/public-api-summary.json`) |
| Release-gate maintenance test evidence | quality | `node --experimental-strip-types scripts/test-lane-evidence-check.mts --report ci-reports/package-quality/fast-test-lane.json --lane fast --path scripts/tests/alpha-release-smoke.spec.ts --path scripts/tests/api-docs-trigger-check.spec.ts --path scripts/tests/architecture-policy-check.spec.ts --path scripts/tests/bench-threshold-check.spec.ts --path scripts/tests/benchmark-workflow.spec.ts --path scripts/tests/branch-protection-policy.spec.ts --path scripts/tests/changeset-required-check.spec.ts --path scripts/tests/ci-executable-policy.spec.ts --path scripts/tests/ci-performance-budget.spec.ts --path scripts/tests/ci-verification-identity.spec.ts --path scripts/tests/ci-workflow.spec.ts --path scripts/tests/compiler-baseline-check.spec.ts --path scripts/tests/core-coverage-warning-check.spec.ts --path scripts/tests/create-croco-app-generated-smoke.spec.ts --path scripts/tests/dependency-audit-policy.spec.ts --path scripts/tests/doc-examples-check.spec.ts --path scripts/tests/first-success-verify.spec.ts --path scripts/tests/generated-secret-placeholder-policy.spec.ts --path scripts/tests/live-tests-workflow.spec.ts --path scripts/tests/normalize-packages.spec.ts --path scripts/tests/package-bin-smoke.spec.ts --path scripts/tests/package-docs-check.spec.ts --path scripts/tests/package-entrypoint-smoke.spec.ts --path scripts/tests/package-manifest-contracts.spec.ts --path scripts/tests/package-quality-report.spec.ts --path scripts/tests/problem-registry.spec.ts --path scripts/tests/production-ready-check.spec.ts --path scripts/tests/provenance-config-check.spec.ts --path scripts/tests/provider-certification-check.spec.ts --path scripts/tests/public-api-surface.spec.ts --path scripts/tests/release-docs-check.spec.ts --path scripts/tests/release-metadata-check.spec.ts --path scripts/tests/release-spine-evidence.spec.ts --path scripts/tests/release-version-sync.spec.ts --path scripts/tests/release-workflow.spec.ts --path scripts/tests/repository-policy-audit-workflow.spec.ts --path scripts/tests/security-allowlist-metadata-check.spec.ts --path scripts/tests/spine-promotion-check.spec.ts --path scripts/tests/static-misuse-check.spec.ts --path scripts/tests/strict-contract-typecheck.spec.ts --path scripts/tests/test-evidence-reconcile.spec.ts --path scripts/tests/test-inventory.spec.ts --path scripts/tests/test-lane-evidence-check.spec.ts --path scripts/tests/test-lane-runner.spec.ts --path scripts/tests/tracked-file-mutation-guard.spec.ts --path scripts/tests/turbo-cache-contract.spec.ts --path scripts/tests/turbo-task-contract.spec.ts --path scripts/tests/verification-change-classifier.spec.ts --path scripts/tests/verification-command.spec.ts --path scripts/tests/verification-manifest.spec.ts --path scripts/tests/verification-policy.spec.ts --path scripts/tests/verify-circular-allowlist.spec.ts` | passed | 0 | 0.17s | 120s | - |
| Release metadata | metadata | `node --experimental-strip-types scripts/release-metadata-check.mts --allow-pending-changesets` | passed | 0 | 0.23s | 600s | - |
| Spine bundle-size warning report | quality | `node --experimental-strip-types scripts/package-quality-report.mts` | passed | 0 | 1.50s | 600s | Package quality dashboard markdown (present, modified: 2026-09-06T19:38:52.371Z, copied: `ci-reports/release/artifacts/spine-bundle-size/report.md`)<br>Package quality dashboard JSON (present, modified: 2026-09-06T19:38:52.376Z, copied: `ci-reports/release/artifacts/spine-bundle-size/summary.json`)<br>Bundle-size enforcement markdown (present, modified: 2026-09-06T19:38:52.382Z, copied: `ci-reports/release/artifacts/spine-bundle-size/bundle-size.md`) |
| Production dependency audit policy | quality | `node --experimental-strip-types scripts/dependency-audit-policy.mts` | passed | 0 | 9.12s | 600s | - |
| npm provenance configuration | metadata | `node --experimental-strip-types scripts/provenance-config-check.mts` | passed | 0 | 0.30s | 300s | - |
| Publish dry run | metadata | `pnpm -r publish --dry-run --no-git-checks` | passed | 0 | 84.60s | 1800s | - |

## Check details

### Read-only verification policy

- ID: `verification-policy`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Guard or classify the reported verification path -- node --experimental-strip-types scripts/verification-policy.mts`
- Started at: 2026-09-06T18:35:23.735Z
- Completed at: 2026-09-06T18:35:24.670Z
- Duration: 0.94s
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
- Started at: 2026-09-06T18:35:23.739Z
- Completed at: 2026-09-06T18:35:24.798Z
- Duration: 1.18s
- Timeout: 300s
- Failure reason: none

Artifacts:
- Resolved test inventory (required): `ci-reports/package-quality/test-inventory.json` present; modified at 2026-09-06T18:35:24.414Z; copied to `ci-reports/release/artifacts/test-inventory/test-inventory.json`

stdout excerpt:

```text
test inventory valid (797 tests, baf5bd70e137630064c968e440160b1b65df5e1b633ca208c2e75ef8c0ead974)

```

### Turbo cache reuse and invalidation contract

- ID: `turbo-cache-contract`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/turbo-cache-contract.mts`
- Started at: 2026-09-06T18:35:24.683Z
- Completed at: 2026-09-06T18:35:43.366Z
- Duration: 18.68s
- Timeout: 300s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
[turbo-cache-contract] initial-run: tasks=4 hits=0 misses=4 statuses=[@fixture/app#build=MISS(d353f38244daaf65), @fixture/app#test=MISS(f32b143879b711bc), @fixture/dependency#build=MISS(5c7c9732da066212), @fixture/dependency#test=MISS(1aad9a98d7bc6054)]
[turbo-cache-contract] identical-second-run: tasks=4 hits=4 misses=0 statuses=[@fixture/app#build=HIT(d353f38244daaf65), @fixture/app#test=HIT(f32b143879b711bc), @fixture/dependency#build=HIT(5c7c9732da066212), @fixture/dependency#test=HIT(1aad9a98d7bc6054)]
[turbo-cache-contract] package-source-mutation: tasks=4 hits=2 misses=2 statuses=[@fixture/app#build=MISS(0a5568a156879a76), @fixture/app#test=MISS(27ed8a57b7a55a57), @fixture/dependency#build=HIT(5c7c9732da066212), @fixture/dependency#test=HIT(1aad9a98d7bc6054)]
[turbo-cache-contract] package-test-mutation: tasks=4 hits=3 misses=1 statuses=[@fixture/app#build=HIT(d353f38244daaf65), @fixture/app#test=MISS(9d8c5c94c3514c83), @fixture/dependency#build=HIT(5c7c9732da066212), @fixture/dependency#test=HIT(1aad9a98d7bc6054)]
[turbo-cache-contract] package-config-mutation: tasks=4 hits=3 misses=1 statuses=[@fixture/app#build=HIT(d353f38244daaf65), @fixture/app#test=MISS(e443a1e9f229bbfa), @fixture/dependency#build=HIT(5c7c9732da066212), @fixture/dependency#test=HIT(1aad9a98d7bc6054)]
[turbo-cache-contract] declared-env-mutation: tasks=4 hits=0 misses=4 statuses=[@fixture/app#build=MISS(bb2c16af16bfd796), @fixture/app#test=MISS(50712a8492c478fd), @fixture/dependency#build=MISS(c4baa12b457d9bd7), @fixture/dependency#test=MISS(4cdbebf94035b476)]
[turbo-cache-contract] lockfile-mutation: tasks=4 hits=0 misses=4 statuses=[@fixture/app#build=MISS(fc10c2b9ed6287ee), @fixture/app#test=MISS(7c54f986a42f9c22), @fixture/dependency#build=MISS(deb94f3963716426), @fixture/dependency#test=MISS(841028f561e80a1d)]
[turbo-cache-contract] node-version-mutation: tasks=4 hits=0 misses=4 statuses=[@fixture/app#build=MISS(7bf8af051a54c67e), @fixture/app#test=MISS(e57d1fda527352de), @fixture/dependency#build=MISS(2de40eaea228b694), @fixture/dependency#test=MISS(123bf6067f2cff97)]
[turbo-cache-contract] direct-dependency-mutation: tasks=4 hits=0 misses=4 statuses=[@fixture/app#build=MISS(866319d4e9955c99), @fixture/app#test=MISS(e22d443f4bd97ab9), @fixture/dependency#build=MISS(4fd1eab4e2ec45e2), @fixture/dependency#test=MISS(89039e29687fc2fd)]
[turbo-cache-contract] unrelated-package-mutation: tasks=4 hits=4 misses=0 statuses=[@fixture/app#build=HIT(d353f38244daaf65), @fixture/app#test=HIT(f32b143879b711bc), @fixture/dependency#build=HIT(5c7c9732da066212), @fixture/dependency#test=HIT(1aad9a98d7bc6054)]

```

### Verification profile contracts

- ID: `verification-contract-tests`
- Status: not_applicable
- Selection reason: Always selected by this verification profile.
- Command: `pnpm exec vitest run scripts/tests/verification-command.spec.ts scripts/tests/verification-change-classifier.spec.ts scripts/tests/verification-manifest.spec.ts scripts/tests/release-spine-evidence.spec.ts scripts/tests/ci-workflow.spec.ts scripts/tests/ci-performance-budget.spec.ts scripts/tests/release-workflow.spec.ts scripts/tests/turbo-task-contract.spec.ts scripts/tests/branch-protection-policy.spec.ts scripts/tests/repository-policy-audit-workflow.spec.ts scripts/tests/verification-policy.spec.ts scripts/tests/test-inventory.spec.ts scripts/tests/test-lane-runner.spec.ts scripts/tests/turbo-cache-contract.spec.ts`
- Started at: not started
- Completed at: 2026-09-06T18:35:24.924Z
- Duration: not collected
- Timeout: not started
- Failure reason: Not applicable to the changed files in this verification context.

Artifacts:
- none

### Changeset requirement

- ID: `changeset-required`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm changeset or revert the publishable change -- node --experimental-strip-types scripts/changeset-required-check.mts --base df8d0185955ec77aa8b38d475685d74f371dd0d1 --head HEAD`
- Started at: 2026-09-06T18:35:25.035Z
- Completed at: 2026-09-06T18:35:25.912Z
- Duration: 0.88s
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
- Started at: 2026-09-06T18:35:25.914Z
- Completed at: 2026-09-06T18:35:30.558Z
- Duration: 4.64s
- Timeout: 300s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text

=== Package manifest summary ===
Checked: 120
Skipped private: 4
Modified: 0

✓ Package manifest contracts are normalized.

```

### Release version-derived metadata

- ID: `release-version-sync`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm release-version-sync:write && pnpm docs:catalog:write -- node --experimental-strip-types scripts/release-version-sync.mts --check`
- Started at: 2026-09-06T18:35:30.560Z
- Completed at: 2026-09-06T18:35:31.216Z
- Duration: 0.66s
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
- Started at: 2026-09-06T18:35:31.217Z
- Completed at: 2026-09-06T18:35:33.114Z
- Duration: 1.90s
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
- Started at: 2026-09-06T18:35:33.116Z
- Completed at: 2026-09-06T18:35:33.960Z
- Duration: 0.84s
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
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm problem-registry:write -- node --experimental-strip-types scripts/problem-registry.mts --check --base df8d0185955ec77aa8b38d475685d74f371dd0d1`
- Started at: 2026-09-06T18:35:33.962Z
- Completed at: 2026-09-06T18:35:43.125Z
- Duration: 9.16s
- Timeout: 300s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
Problem registry check passed: 763 codes from 763 discoveries.

```

### Documentation examples

- ID: `docs-examples`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm docs:examples:write -- node --experimental-strip-types scripts/doc-examples-check.mts --check`
- Started at: 2026-09-06T18:35:43.127Z
- Completed at: 2026-09-06T18:35:51.301Z
- Duration: 8.17s
- Timeout: 300s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
doc-examples-check: checked 22 TypeScript documentation examples.

```

### Release documentation

- ID: `release-docs`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported release documentation contract -- node --experimental-strip-types scripts/release-docs-check.mts`
- Started at: 2026-09-06T18:35:43.368Z
- Completed at: 2026-09-06T18:35:44.100Z
- Duration: 0.73s
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
- Started at: 2026-09-06T18:35:44.102Z
- Completed at: 2026-09-06T18:35:46.284Z
- Duration: 2.18s
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
- Started at: 2026-09-06T18:35:46.286Z
- Completed at: 2026-09-06T18:35:46.659Z
- Duration: 0.37s
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
- Started at: 2026-09-06T18:35:46.661Z
- Completed at: 2026-09-06T18:36:10.525Z
- Duration: 23.86s
- Timeout: 600s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
[truncated 5789 chars]
--clean --dts
packages/framework-context build: [34mCLI[39m Building entry: src/index.ts
packages/framework-context build: [34mCLI[39m Using tsconfig: tsconfig.json
packages/framework-context build: [34mCLI[39m tsup v8.5.1
packages/framework-context build: [34mCLI[39m Target: es2017
packages/framework-context build: [34mCLI[39m Cleaning output folder
packages/framework-context build: [34mESM[39m Build start
packages/framework-context build: [34mCJS[39m Build start
packages/framework-context build: [32mESM[39m [1mdist/index.mjs [22m[32m79.26 KB[39m
packages/framework-context build: [32mESM[39m ⚡️ Build success in 136ms
packages/framework-context build: [32mCJS[39m [1mdist/index.js [22m[32m82.55 KB[39m
packages/framework-context build: [32mCJS[39m ⚡️ Build success in 144ms
packages/framework-context build: [34mDTS[39m Build start
packages/framework-context build: [32mDTS[39m ⚡️ Build success in 3300ms
packages/framework-context build: [32mDTS[39m [1mdist/index.d.mts [22m[32m55.55 KB[39m
packages/framework-context build: [32mDTS[39m [1mdist/index.d.ts  [22m[32m55.55 KB[39m
packages/framework-context build: Done
packages/access-core build$ tsup src/index.ts --format esm,cjs --minify --clean --dts
packages/access-core build: [34mCLI[39m Building entry: src/index.ts
packages/access-core build: [34mCLI[39m Using tsconfig: tsconfig.json
packages/access-core build: [34mCLI[39m tsup v8.5.1
packages/access-core build: [34mCLI[39m Target: es2017
packages/access-core build: [34mCLI[39m Cleaning output folder
packages/access-core build: [34mESM[39m Build start
packages/access-core build: [34mCJS[39m Build start
packages/access-core build: [32mESM[39m [1mdist/index.mjs [22m[32m10.23 KB[39m
packages/access-core build: [32mESM[39m ⚡️ Build success in 70ms
packages/access-core build: [32mCJS[39m [1mdist/index.js [22m[32m11.07 KB[39m
packages/access-core build: [32mCJS[39m ⚡️ Build success in 71ms
packages/access-core build: [34mDTS[39m Build start
packages/access-core build: [32mDTS[39m ⚡️ Build success in 2258ms
packages/access-core build: [32mDTS[39m [1mdist/index.d.mts [22m[32m7.12 KB[39m
packages/access-core build: [32mDTS[39m [1mdist/index.d.ts  [22m[32m7.12 KB[39m
packages/access-core build: Done
packages/tenant-core build$ tsup src/index.ts src/tenant-model.ts --format esm,cjs --minify --clean --dts
packages/tenant-core build: [34mCLI[39m Building entry: src/index.ts, src/tenant-model.ts
packages/tenant-core build: [34mCLI[39m Using tsconfig: tsconfig.json
packages/tenant-core build: [34mCLI[39m tsup v8.5.1
packages/tenant-core build: [34mCLI[39m Target: es2017
packages/tenant-core build: [34mCLI[39m Cleaning output folder
packages/tenant-core build: [34mESM[39m Build start
packages/tenant-core build: [34mCJS[39m Build start
packages/tenant-core build: [32mCJS[39m [1mdist/index.js        [22m[32m28.72 KB[39m
packages/tenant-core build: [32mCJS[39m [1mdist/tenant-model.js [22m[32m13.71 KB[39m
packages/tenant-core build: [32mCJS[39m ⚡️ Build success in 82ms
packages/tenant-core build: [32mESM[39m [1mdist/index.mjs          [22m[32m14.73 KB[39m
packages/tenant-core build: [32mESM[39m [1mdist/tenant-model.mjs   [22m[32m659.00 B[39m
packages/tenant-core build: [32mESM[39m [1mdist/chunk-MQ7AVEXI.mjs [22m[32m12.73 KB[39m
packages/tenant-core build: [32mESM[39m ⚡️ Build success in 85ms
packages/tenant-core build: [34mDTS[39m Build start
packages/tenant-core build: [32mDTS[39m ⚡️ Build success in 2812ms
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
- Started at: 2026-09-06T18:36:10.527Z
- Completed at: 2026-09-06T18:36:14.242Z
- Duration: 3.71s
- Timeout: 600s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
architecture-policy: passed for 6154 import(s) across 122 package(s)
architecture-policy: package catalog group consistency passed for 120 public package(s)

```

### Architecture circular allowlist

- ID: `architecture-circular-allowlist`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Update code or intentionally update the circular dependency allowlist -- node --experimental-strip-types scripts/verify-circular-allowlist.mts`
- Started at: 2026-09-06T18:35:51.303Z
- Completed at: 2026-09-06T18:36:09.023Z
- Duration: 17.72s
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
- Started at: 2026-09-06T18:36:09.025Z
- Completed at: 2026-09-06T18:36:09.840Z
- Duration: 0.81s
- Timeout: 600s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
dependency-boundaries: repository-core-drizzle-free pass
dependency-boundaries: protocols-desktop-runtime-free pass
dependency-boundaries: all rules passed

```

### Security allowlists

- ID: `security-allowlists`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported security allowlist metadata -- node --experimental-strip-types scripts/security-allowlist-metadata-check.mts`
- Started at: 2026-09-06T18:36:09.841Z
- Completed at: 2026-09-06T18:36:15.485Z
- Duration: 5.64s
- Timeout: 300s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
security-allowlist-metadata: passed (1 audit ignores, 1 gitleaks allowlist entries, 1 gitleaks ignore fingerprints, 0 generated template allowlists).

```

### Generated secret placeholders

- ID: `generated-secret-placeholders`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported template placeholder -- node --experimental-strip-types scripts/generated-secret-placeholder-policy.mts`
- Started at: 2026-09-06T18:36:14.244Z
- Completed at: 2026-09-06T18:36:14.892Z
- Duration: 0.65s
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
- Started at: 2026-09-06T18:36:14.895Z
- Completed at: 2026-09-06T18:36:15.669Z
- Duration: 0.77s
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
- Started at: 2026-09-06T18:36:15.487Z
- Completed at: 2026-09-06T18:36:24.811Z
- Duration: 9.32s
- Timeout: 600s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
decorator-signature-spike: TypeScript 6 legacy decorator feasibility verified
decorator-signature-spike: 30 negative assertions fail with broad signatures; inheritance limitation compiled as documented
decorator-signature-spike: overload declaration snapshot and strict/loose packed ESM/CJS consumer passed
decorator-signature-spike: broad 579 instantiations / 0.09s check, strict 26106 instantiations / 0.39s check
decorator-signature-spike: strict instantiation delta 25527 within 250000 budget

```

### Strict contract typecheck

- ID: `strict-contract-typecheck`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported strict contract diagnostic -- node --experimental-strip-types scripts/strict-contract-typecheck.mts`
- Started at: 2026-09-06T18:36:15.671Z
- Completed at: 2026-09-06T18:37:34.122Z
- Duration: 78.45s
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
strict-contract-typecheck: accepted baseline diagnostics 450
strict-contract-typecheck: diagnostics added 0, removed 0, unchanged 450
strict-contract-typecheck: staged rollout deferrals 13 (@croco/framework-context, @croco/problems-core, @croco/protocols-rest, @croco/openapi-spec, @croco/transports-http, @croco/tx-core, @croco/events-core, @croco/events-tx, @croco/retry-core, @croco/idempotency-core, @croco/testing, create-croco-app, @croco/cli)
strict-contract-typecheck: accepted release debt deferrals 0 (<empty>)
strict-contract-typecheck: baseline matched

```

### Static misuse

- ID: `static-misuse`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported source misuse -- node --experimental-strip-types scripts/static-misuse-check.mts`
- Started at: 2026-09-06T18:36:24.812Z
- Completed at: 2026-09-06T18:36:39.356Z
- Duration: 14.54s
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
- Started at: 2026-09-06T18:36:39.358Z
- Completed at: 2026-09-06T18:36:42.054Z
- Duration: 2.70s
- Timeout: 900s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
::warning file=scripts/security-allowlist-metadata-check.mts,line=1042,endLine=1042,col=14,endColumn=16,title=eslint(no-control-regex)::Unexpected control character

Found 1 warning and 0 errors.
Finished in 2.0s on 2556 files with 116 rules using 4 threads.

```

### Format

- ID: `format`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `pnpm exec oxfmt --check . --ignore-path=.gitignore --ignore-path=.prettierignore --ignore-path=.oxfmtignore`
- Started at: 2026-09-06T18:36:42.057Z
- Completed at: 2026-09-06T18:36:52.520Z
- Duration: 10.46s
- Timeout: 900s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
Checking formatting...

All matched files use the correct format.
Finished in 9724ms on 3766 files using 4 threads.

```

### Architecture circular dependencies

- ID: `architecture-circular`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported circular dependency -- pnpm exec madge --circular --extensions ts packages`
- Started at: 2026-09-06T18:36:52.522Z
- Completed at: 2026-09-06T18:37:09.621Z
- Duration: 17.10s
- Timeout: 600s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
Processed 2313 files (15.8s) (115 warnings)



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
- Started at: 2026-09-06T18:37:09.624Z
- Completed at: 2026-09-06T18:37:28.210Z
- Duration: 18.59s
- Timeout: 600s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
[truncated 10418 chars]
 benchmarks[2m > [22m[2mEventPublisher.publishNow single event[22m

  should resolve 10 handlers[2m - packages/events-core/src/tests/EventBus.bench.ts[2m > [22m[2mEventBus benchmarks[2m > [22m[2mDefaultHandlerResolver.resolve × 10[22m

  Container.get singleton (cold)[2m - packages/framework-context/src/tests/Container.bench.ts[2m > [22m[2mContainer.get singleton (cold)[22m

  register 50 singletons[2m - packages/framework-context/src/tests/Container.bench.ts[2m > [22m[2mContainer.register × 50 components[22m

  Container.validate (50 components)[2m - packages/framework-context/src/tests/Container.bench.ts[2m > [22m[2mContainer.validate (50 components)[22m

  Container.get singleton (warm)[2m - packages/framework-context/src/tests/Container.bench.ts[2m > [22m[2mContainer.get singleton (warm)[22m

  lambdaPreset config creation[2m - packages/telemetry-sdk-node/src/tests/TelemetryRuntime.bench.ts[2m > [22m[2mTelemetryRuntime benchmarks[22m
[32m    9.55x [39m[90mfaster than [39mTelemetryRuntime.init (lambda preset)

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
║ CrocoApp constructor           p75: 68.0μs     threshold: 30
║ CrocoApp lambdaHandler (10 controllers) p75: 2.2ms      thre
║ Lambda cold-start simulation   p75: 3.7ms      threshold: 80
║ Lambda cold-start with headers p75: 2.1ms      threshold: 80
║ Lambda cold-start with binary body p75: 2.0ms      threshold
║ Lambda cold-start with query params p75: 1.9ms      threshol
║ Lambda cold-start with authorizer context p75: 2.0ms      th
║ Lambda cold-start realistic scenario p75: 2.0ms      thresho
║ EventBusConfig.start (10 handlers) p75: 2.6μs      threshold
║ EventPublisher.publishNow single event p75: 2.7μs      thres
║ DefaultHandlerResolver.resolve × 10 p75: 0.1μs      threshol
║ Container.get singleton (cold) p75: 104.2μs    threshold: 5.
║ Container.register × 50 components p75: 4.0ms      threshold
║ Container.validate (50 components) p75: 4.6ms      threshold
║ Container.get singleton (warm) p75: 1.9μs      threshold: 50
║ TelemetryRuntime.init (lambda preset) p75: 17.8μs     thresh
║ lambdaPreset config creation   p75: 2.2μs      threshold: 2.
╠══════════════════════════════════════════════════════════╣
║ Result: ALL PASSED                                         ║
╚══════════════════════════════════════════════════════════╝


```

stderr excerpt:

```text
⚠️  Baseline drift for "CrocoApp constructor": p75 68.0μs exceeds baseline 8.2μs by 59.8μs (+731.5%).
⚠️  Baseline drift for "CrocoApp lambdaHandler (10 controllers)": p75 2.2ms exceeds baseline 258.4μs by 2.0ms (+760.3%).
⚠️  Baseline drift for "Lambda cold-start simulation": p75 3.7ms exceeds baseline 418.1μs by 3.2ms (+774.5%).
⚠️  Baseline drift for "Lambda cold-start with headers": p75 2.1ms exceeds baseline 369.7μs by 1.8ms (+478.6%).
⚠️  Baseline drift for "Lambda cold-start with binary body": p75 2.0ms exceeds baseline 339.1μs by 1.6ms (+476.5%).
⚠️  Baseline drift for "Lambda cold-start with query params": p75 1.9ms exceeds baseline 301.3μs by 1.6ms (+546.2%).
⚠️  Baseline drift for "Lambda cold-start with authorizer context": p75 2.0ms exceeds baseline 299.8μs by 1.7ms (+555.4%).
⚠️  Baseline drift for "Lambda cold-start realistic scenario": p75 2.0ms exceeds baseline 299.2μs by 1.7ms (+558.3%).
⚠️  Baseline drift for "EventBusConfig.start (10 handlers)": p75 2.6μs exceeds baseline 1.4μs by 1.2μs (+83.1%).
⚠️  Baseline drift for "EventPublisher.publishNow single event": p75 2.7μs exceeds baseline 1.7μs by 1.0μs (+61.3%).
⚠️  Baseline drift for "DefaultHandlerResolver.resolve × 10": p75 0.1μs exceeds baseline 0.1μs by 0.0μs (+25.0%).
⚠️  Baseline drift for "Container.get singleton (cold)": p75 104.2μs exceeds baseline 70.3μs by 34.0μs (+48.4%).
⚠️  Baseline drift for "Container.register × 50 components": p75 4.0ms exceeds baseline 3.2ms by 815.9μs (+25.3%).
⚠️  Baseline drift for "Container.validate (50 components)": p75 4.6ms exceeds baseline 3.4ms by 1.3ms (+36.9%).
⚠️  Baseline drift for "lambdaPreset config creation": p75 2.2μs exceeds baseline 1.4μs by 0.8μs (+57.7%).

```

### Affected build

- ID: `build`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `pnpm turbo run build --filter=@croco/problems-core --filter=@croco/diagnostics-core --filter=@croco/framework-context --filter=@croco/protocols-core --filter=@croco/protocols-rest --summarize --continue=always`
- Started at: 2026-09-06T18:37:28.213Z
- Completed at: 2026-09-06T18:37:50.535Z
- Duration: 22.32s
- Timeout: 1800s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
[truncated 929 chars]
22m[32m1.01 MB[39m
::endgroup::
::group::@croco/health-core:build
cache miss, executing 04111d4a01fc112b
$ tsup src/index.ts --format esm,cjs --minify --clean --dts
[34mCLI[39m Building entry: src/index.ts
[34mCLI[39m Using tsconfig: tsconfig.json
[34mCLI[39m tsup v8.5.1
[34mCLI[39m Target: es2017
[34mCLI[39m Cleaning output folder
[34mESM[39m Build start
[34mCJS[39m Build start
[32mESM[39m [1mdist/index.mjs [22m[32m4.77 KB[39m
[32mESM[39m ⚡️ Build success in 89ms
[32mCJS[39m [1mdist/index.js [22m[32m5.34 KB[39m
[32mCJS[39m ⚡️ Build success in 102ms
[34mDTS[39m Build start
[32mDTS[39m ⚡️ Build success in 2407ms
[32mDTS[39m [1mdist/index.d.mts [22m[32m5.23 KB[39m
[32mDTS[39m [1mdist/index.d.ts  [22m[32m5.23 KB[39m
::endgroup::
::group::@croco/protocols-core:build
cache miss, executing 1ae7f53cd9a9d793
$ tsup src/index.ts --format esm,cjs --minify --clean --dts
[34mCLI[39m Building entry: src/index.ts
[34mCLI[39m Using tsconfig: tsconfig.json
[34mCLI[39m tsup v8.5.1
[34mCLI[39m Target: es2017
[34mCLI[39m Cleaning output folder
[34mESM[39m Build start
[34mCJS[39m Build start
[32mESM[39m [1mdist/index.mjs [22m[32m93.69 KB[39m
[32mESM[39m ⚡️ Build success in 186ms
[32mCJS[39m [1mdist/index.js [22m[32m95.70 KB[39m
[32mCJS[39m ⚡️ Build success in 203ms
[34mDTS[39m Build start
[32mDTS[39m ⚡️ Build success in 3851ms
[32mDTS[39m [1mdist/index.d.mts [22m[32m39.59 KB[39m
[32mDTS[39m [1mdist/index.d.ts  [22m[32m39.59 KB[39m
::endgroup::
::group::@croco/diagnostics-core:build
cache miss, executing a2b06509061daa32
$ tsup src/index.ts --format esm,cjs --minify --clean --dts
[34mCLI[39m Building entry: src/index.ts
[34mCLI[39m Using tsconfig: tsconfig.json
[34mCLI[39m tsup v8.5.1
[34mCLI[39m Target: es2017
[34mCLI[39m Cleaning output folder
[34mESM[39m Build start
[34mCJS[39m Build start
[32mCJS[39m [1mdist/index.js [22m[32m50.08 KB[39m
[32mCJS[39m ⚡️ Build success in 99ms
[32mESM[39m [1mdist/index.mjs [22m[32m49.25 KB[39m
[32mESM[39m ⚡️ Build success in 100ms
[34mDTS[39m Build start
[32mDTS[39m ⚡️ Build success in 2434ms
[32mDTS[39m [1mdist/index.d.mts [22m[32m22.90 KB[39m
[32mDTS[39m [1mdist/index.d.ts  [22m[32m22.90 KB[39m
::endgroup::
::group::@croco/framework-context:build
cache miss, executing 52e8a487b256b306
$ tsup src/index.ts --format esm,cjs --minify --clean --dts
[34mCLI[39m Building entry: src/index.ts
[34mCLI[39m Using tsconfig: tsconfig.json
[34mCLI[39m tsup v8.5.1
[34mCLI[39m Target: es2017
[34mCLI[39m Cleaning output folder
[34mESM[39m Build start
[34mCJS[39m Build start
[32mESM[39m [1mdist/index.mjs [22m[32m79.26 KB[39m
[32mESM[39m ⚡️ Build success in 158ms
[32mCJS[39m [1mdist/index.js [22m[32m82.55 KB[39m
[32mCJS[39m ⚡️ Build success in 159ms
[34mDTS[39m Build start
[32mDTS[39m ⚡️ Build success in 3140ms
[32mDTS[39m [1mdist/index.d.mts [22m[32m55.55 KB[39m
[32mDTS[39m [1mdist/index.d.ts  [22m[32m55.55 KB[39m
::endgroup::
::group::@croco/protocols-rest:build
cache miss, executing 4ca071c3f7ad6873
$ tsup src/index.ts --format esm,cjs --minify --clean --dts
[34mCLI[39m Building entry: src/index.ts
[34mCLI[39m Using tsconfig: tsconfig.json
[34mCLI[39m tsup v8.5.1
[34mCLI[39m Target: es2017
[34mCLI[39m Cleaning output folder
[34mESM[39m Build start
[34mCJS[39m Build start
[32mESM[39m [1mdist/index.mjs [22m[32m19.78 KB[39m
[32mESM[39m ⚡️ Build success in 96ms
[32mCJS[39m [1mdist/index.js [22m[32m21.48 KB[39m
[32mCJS[39m ⚡️ Build success in 96ms
[34mDTS[39m Build start
[32mDTS[39m ⚡️ Build success in 2868ms
[32mDTS[39m [1mdist/index.d.mts [22m[32m32.18 KB[39m
[32mDTS[39m [1mdist/index.d.ts  [22m[32m32.18 KB[39m
::endgroup::

  Tasks:    6 successful, 6 total
 Cached:    0 cached, 6 total
   Time:    21.714s 
Summary:    /home/runner/work/framework/framework/.turbo/runs/3Ixx9huXgg0qzYHznEntpeYM8KC.json


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
- Status: not_applicable
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/quick-start-lambda-smoke.mts`
- Started at: not started
- Completed at: 2026-09-06T18:37:50.536Z
- Duration: not collected
- Timeout: not started
- Failure reason: Not applicable to the changed files in this verification context.

Artifacts:
- none

### First-success contract

- ID: `first-success`
- Status: not_applicable
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Follow the reported scaffold or documentation recovery command -- node --experimental-strip-types scripts/first-success-verify.mts`
- Started at: not started
- Completed at: 2026-09-06T18:37:50.538Z
- Duration: not collected
- Timeout: not started
- Failure reason: Not applicable to the changed files in this verification context.

Artifacts:
- none

### Package entrypoint smoke

- ID: `package-entrypoints-smoke`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/package-entrypoint-smoke.mts --build-missing`
- Started at: 2026-09-06T19:12:57.608Z
- Completed at: 2026-09-06T19:17:55.801Z
- Duration: 298.19s
- Timeout: 900s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
[truncated 14597 chars]
res-posthog: esm 1, cjs 1, types 1
✓ @croco/framework-config: esm 1, cjs 1, types 1
✓ @croco/framework-context: esm 1, cjs 1, types 1
✓ @croco/framework-logger: esm 1, cjs 1, types 1
✓ @croco/framework-module: esm 1, cjs 1, types 1
✓ @croco/framework-preset: esm 1, cjs 1, types 1
✓ @croco/framework-routes: esm 1, cjs 1, types 1
✓ @croco/frontend-cloudflare: esm 1, cjs 1, types 1
✓ @croco/frontend-problems: esm 1, cjs 1, types 1
✓ @croco/frontend-react: esm 1, cjs 1, types 1
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
✓ @croco/llm-core: esm 1, cjs 1, types 1
✓ @croco/llm-metering: esm 1, cjs 1, types 1
✓ @croco/llm-openai: esm 1, cjs 1, types 1
✓ @croco/membership-core: esm 1, cjs 1, types 1
✓ @croco/membership-drizzle: esm 1, cjs 1, types 1
✓ @croco/meta-vite: esm 2, cjs 2, types 2
✓ @croco/metering-core: esm 1, cjs 1, types 1
✓ @croco/metering-drizzle: esm 1, cjs 1, types 1
✓ @croco/metering-upstash: esm 1, cjs 1, types 1
✓ @croco/metrics-billing: esm 1, cjs 1, types 1
✓ @croco/metrics-core: esm 1, cjs 1, types 1
✓ @croco/migration-runner: esm 2, cjs 2, types 2
✓ @croco/notifications-core: esm 1, cjs 1, types 1
✓ @croco/notifications-react-email: esm 1, cjs 1, types 1
✓ @croco/notifications-resend: esm 1, cjs 1, types 1
✓ @croco/onboarding-core: esm 1, cjs 1, types 1
✓ @croco/onboarding-drizzle: esm 1, cjs 1, types 1
✓ @croco/openapi-spec: esm 1, cjs 1, types 1
✓ @croco/outbox-core: esm 1, cjs 1, types 1
✓ @croco/pagination-core: esm 1, cjs 1, types 1
✓ @croco/presentation-preset: esm 2, cjs 2, types 1
✓ @croco/preset-cloudflare: esm 2, cjs 0, types 2
✓ @croco/preset-lambda: esm 3, cjs 3, types 3
✓ @croco/preset-node: esm 2, cjs 2, types 2
✓ @croco/problems-core: esm 1, cjs 1, types 1
✓ @croco/protocol-codegen: esm 1, cjs 1, types 1
✓ @croco/protocols-core: esm 1, cjs 1, types 1
✓ @croco/protocols-desktop: esm 1, cjs 1, types 1
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
✓ @croco/webhooks-core: esm 1, cjs 1, types 1
✓ @croco/workflow-core: esm 1, cjs 1, types 1

package-entrypoint-smoke: exemptions
- none

package-entrypoint-smoke: summary checked=120 exempt=0 skippedPrivate=2

package-entrypoint-smoke: cjs, esm, and typescript consumers resolved for 120 packages

```

### Package binary smoke

- ID: `package-bins-smoke`
- Status: not_applicable
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/package-bin-smoke.mts`
- Started at: not started
- Completed at: 2026-09-06T18:37:50.538Z
- Duration: not collected
- Timeout: not started
- Failure reason: Not applicable to the changed files in this verification context.

Artifacts:
- none

### create-croco-app spine smoke

- ID: `generated-app-smoke`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/create-croco-app-generated-smoke.mts goal-saas-api goal-spa-backend-split goal-worker goal-internal-tool graphql-lambda-api graphql-vite-spa-docker meta-vite-fullstack-workers production-app-starter saas-golden-path rest-spa-contracts admin-console-starter ai-saas-golden-path`
- Started at: 2026-09-06T18:37:50.556Z
- Completed at: 2026-09-06T19:07:00.947Z
- Duration: 1750.39s
- Timeout: 2700s
- Failure reason: none

Artifacts:
- Spine-blocking generated app smoke matrix markdown (required): `ci-reports/generated-apps/spine-blocking-matrix.md` present; modified at 2026-09-06T19:06:54.042Z; copied to `ci-reports/release/artifacts/generated-app-smoke/spine-blocking-matrix.md`
- Spine-blocking generated app smoke matrix JSON (required): `ci-reports/generated-apps/spine-blocking-matrix.json` present; modified at 2026-09-06T19:06:54.042Z; copied to `ci-reports/release/artifacts/generated-app-smoke/spine-blocking-matrix.json`
- Generated app smoke journey bundle (optional): `ci-reports/generated-apps/spine-blocking-journeys` missing
- Generated test materialization evidence (required): `ci-reports/generated-apps/materialization-evidence.json` present; modified at 2026-09-06T19:06:54.041Z; copied to `ci-reports/release/artifacts/generated-app-smoke/materialization-evidence.json`
- Generated test materializations (required): `ci-reports/generated-apps/materialized-tests` present; modified at 2026-09-06T18:53:46.714Z; copied to `ci-reports/release/artifacts/generated-app-smoke/materialized-tests`

stdout excerpt:

```text
[truncated 11015 chars]
sole-starter Chromium install passed
create-croco-app-generated-smoke: admin-console-starter test passed
create-croco-app-generated-smoke: admin-console-starter typecheck passed
create-croco-app-generated-smoke: admin-console-starter build passed
create-croco-app-generated-smoke: admin-console-starter browser journeys passed
create-croco-app-generated-smoke: admin-console-starter Contract snapshot passed
create-croco-app-generated-smoke: admin-console-starter Contract codegen passed
create-croco-app-generated-smoke: admin-console-starter Contract verify passed
create-croco-app-generated-smoke: admin-console-starter Admin RPC client passed
create-croco-app-generated-smoke: admin-console-starter DI graph generation passed
create-croco-app-generated-smoke: admin-console-starter DI graph verify passed
create-croco-app-generated-smoke: saas-golden-path README.md exists
create-croco-app-generated-smoke: saas-golden-path Node runtime contract matches >=22.5
create-croco-app-generated-smoke: saas-golden-path generated a commented .env.example only
create-croco-app-generated-smoke: saas-golden-path keeps HTTP security validation enabled
create-croco-app-generated-smoke: saas-golden-path generated secret placeholders are safe
create-croco-app-generated-smoke: saas-golden-path lint passed
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
create-croco-app-generated-smoke: ai-saas-golden-path README.md exists
create-croco-app-generated-smoke: ai-saas-golden-path Node runtime contract matches >=22.5
create-croco-app-generated-smoke: ai-saas-golden-path generated a commented .env.example only
create-croco-app-generated-smoke: ai-saas-golden-path keeps HTTP security validation enabled
create-croco-app-generated-smoke: ai-saas-golden-path generated secret placeholders are safe
create-croco-app-generated-smoke: ai-saas-golden-path lint passed
create-croco-app-generated-smoke: ai-saas-golden-path typecheck passed
create-croco-app-generated-smoke: ai-saas-golden-path build passed
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
- Started at: 2026-09-06T18:37:50.550Z
- Completed at: 2026-09-06T18:38:38.934Z
- Duration: 48.38s
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
- Completed at: 2026-09-06T19:07:00.952Z
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
- Started at: 2026-09-06T19:07:00.954Z
- Completed at: 2026-09-06T19:12:57.606Z
- Duration: 356.65s
- Timeout: 1800s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
[truncated 118600 chars]
orage-r2:typecheck
cache miss, executing c29070ba247fb356
$ tsc --noEmit
::endgroup::
::group::@croco/access-drizzle:typecheck
cache miss, executing 69842ebe350b5a36
$ tsc --noEmit
::endgroup::
::group::@croco/ratelimit-upstash:typecheck
cache miss, executing 3ac6a21b767208f3
$ tsc --noEmit
::endgroup::
::group::@croco/customer-health-drizzle:typecheck
cache miss, executing 825b0460b8aea661
$ tsc --noEmit
::endgroup::
::group::@croco/auth-drizzle:typecheck
cache miss, executing a9afd0325e5939b5
$ tsc --noEmit
::endgroup::
::group::@croco/tasks-qstash:typecheck
cache miss, executing 40e03b8c9b7e0131
$ tsc --noEmit
::endgroup::
::group::@croco/batch-qstash:typecheck
cache miss, executing 806737415d0d1459
$ tsc --noEmit
::endgroup::
::group::@croco/triggers-qstash:typecheck
cache miss, executing 9f942e8924729d1c
$ tsc --noEmit
::endgroup::
::group::@croco/auth-clerk:typecheck
cache miss, executing a087aab6e07375ec
$ tsc --noEmit
::endgroup::
::group::@croco/auth-better-auth:typecheck
cache miss, executing 377035cd998c0be5
$ tsc --noEmit
::endgroup::
::group::@croco/ui-astryx:typecheck
cache miss, executing 93451770da4603bd
$ tsc --noEmit
::endgroup::
::group::@croco/frontend-cloudflare:typecheck
cache miss, executing bb57a3ee755447db
$ tsc --noEmit
::endgroup::
::group::@croco/telemetry-sdk-node:typecheck
cache miss, executing 69468a7956b693d4
$ tsc --noEmit
::endgroup::
::group::@croco/notifications-resend:typecheck
cache miss, executing 4af9e27c58980520
$ tsc --noEmit
::endgroup::
::group::@croco/engagement-core:typecheck
cache miss, executing a0e38329f4927c50
$ tsc --noEmit
::endgroup::
::group::@croco/cli:typecheck
cache miss, executing 34dd03efcf844d94
$ tsc --noEmit
::endgroup::
::group::create-croco-app:typecheck
cache miss, executing 06a10c1f96d54031
$ tsc --noEmit
::endgroup::
::group::@croco/notifications-react-email:typecheck
cache miss, executing f3835c9fea4674a8
$ tsc --noEmit
::endgroup::
::group::@croco/engagement-drizzle:typecheck
cache miss, executing 63a822c4d1cb03d5
$ tsc --noEmit
::endgroup::
::group::@croco/testing-resources:typecheck
cache miss, executing 994a3869a13c130f
$ tsc --noEmit
::endgroup::
::group::@croco/metrics-core:typecheck
cache miss, executing 60f37e20a1472018
$ tsc --noEmit
::endgroup::
::group::@croco/metering-core:typecheck
cache miss, executing 2043cb9d507a658f
$ tsc --noEmit
::endgroup::
::group::@croco/metrics-billing:typecheck
cache miss, executing 57ef6472243fe4be
$ tsc --noEmit
::endgroup::
::group::@croco/entitlements-core:typecheck
cache miss, executing 2b9d0dde0b21739d
$ tsc --noEmit
::endgroup::
::group::@croco/metering-upstash:typecheck
cache miss, executing 725e6424ee371172
$ tsc --noEmit
::endgroup::
::group::@croco/metering-drizzle:typecheck
cache miss, executing 3dab45385543470e
$ tsc --noEmit
::endgroup::
::group::@croco/llm-metering:typecheck
cache miss, executing 8230b03f7e973590
$ tsc --noEmit
::endgroup::
::group::@croco/membership-core:typecheck
cache miss, executing b7fe94ef24727932
$ tsc --noEmit
::endgroup::
::group::@croco/billing-polar:typecheck
cache miss, executing 2ecdec5580f0c68a
$ tsc --noEmit
::endgroup::
::group::@croco/entitlements-drizzle:typecheck
cache miss, executing 153f0747b0745453
$ tsc --noEmit
::endgroup::
::group::@croco/invitation-core:typecheck
cache miss, executing 8dff0bf8b11ef7da
$ tsc --noEmit
::endgroup::
::group::@croco/admin-react:typecheck
cache miss, executing 68d4d2e0cdb3710a
$ tsc --noEmit
::endgroup::
::group::@croco/membership-drizzle:typecheck
cache miss, executing f1c98b4df38f3a53
$ tsc --noEmit
::endgroup::
::group::@croco-example/saas-billing-golden-path:typecheck
cache miss, executing 1bb98557b2db40bb
$ tsc --noEmit
::endgroup::
::group::@croco/invitation-drizzle:typecheck
cache miss, executing 805f7ba02f72dc0a
$ tsc --noEmit
::endgroup::

  Tasks:    243 successful, 243 total
 Cached:    91 cached, 243 total
   Time:    5m55.738s 
Summary:    /home/runner/work/framework/framework/.turbo/runs/3Iy1QO6v69Civ7qFGoZ5sGxQwuM.json


```

stderr excerpt:

```text
 WARNING  no output files found for task @croco-example/quick-start-lambda#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/saas-billing-golden-path#build. Please check your `outputs` key in `turbo.json`

```

### Summarized tests

- ID: `test`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/test-lane-runner.mts --lane fast --output ci-reports/package-quality/fast-test-lane.json`
- Started at: 2026-09-06T19:17:55.803Z
- Completed at: 2026-09-06T19:31:05.182Z
- Duration: 789.38s
- Timeout: 2700s
- Failure reason: none

Artifacts:
- Fast test lane evidence (required): `ci-reports/package-quality/fast-test-lane.json` present; modified at 2026-09-06T19:31:05.174Z; copied to `ci-reports/release/artifacts/test/fast-test-lane.json`

stdout excerpt:

```text
[truncated 153456 chars]
ents-core:build
cache hit, replaying logs 66d1768204b98dc8
$ tsup src/index.ts --format esm,cjs --minify --clean --dts
[34mCLI[39m Building entry: src/index.ts
[34mCLI[39m Using tsconfig: tsconfig.json
[34mCLI[39m tsup v8.5.1
[34mCLI[39m Target: es2017
[34mCLI[39m Cleaning output folder
[34mESM[39m Build start
[34mCJS[39m Build start
[32mCJS[39m [1mdist/index.js [22m[32m17.87 KB[39m
[32mCJS[39m ⚡️ Build success in 58ms
[32mESM[39m [1mdist/index.mjs [22m[32m16.27 KB[39m
[32mESM[39m ⚡️ Build success in 74ms
[34mDTS[39m Build start
[32mDTS[39m ⚡️ Build success in 2320ms
[32mDTS[39m [1mdist/index.d.mts [22m[32m19.24 KB[39m
[32mDTS[39m [1mdist/index.d.ts  [22m[32m19.24 KB[39m
::endgroup::
::group::@croco/events-core:test
cache hit, replaying logs 49aed8778fa144c1
$ vitest run --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
JSON report written to /home/runner/work/framework/framework/packages/events-core/.turbo/croco-test-evidence.json
::endgroup::

  Tasks:    6 successful, 6 total
 Cached:    6 cached, 6 total
   Time:    455ms >>> FULL TURBO
Summary:    /home/runner/work/framework/framework/.turbo/runs/3Iy3HVNZlH5YwdfzhY77XiqYf1Z.json

test inventory valid (1 tests, 86d74d33a9eaa903c0f9f4e8f22ce60f52bcb5ac9c0bf8659a329179ce228ec5)
test inventory valid (1 tests, 86d74d33a9eaa903c0f9f4e8f22ce60f52bcb5ac9c0bf8659a329179ce228ec5)
JSON report written to /home/runner/work/framework/framework/.turbo/croco-test-evidence.json
10aa058339
$ vitest run --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
JSON report written to /home/runner/work/framework/framework/packages/invitation-core/.turbo/croco-test-evidence.json
::endgroup::
::group::@croco/membership-drizzle:test
cache miss, executing a560c83783907512
$ vitest run --exclude src/tests/DrizzleMembershipStore.postgres.spec.ts --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
JSON report written to /home/runner/work/framework/framework/packages/membership-drizzle/.turbo/croco-test-evidence.json
::endgroup::
::group::@croco/invitation-drizzle:build
cache miss, executing e019e7dd1150a3db
$ tsup src/index.ts --format esm,cjs --minify --clean --dts
[34mCLI[39m Building entry: src/index.ts
[34mCLI[39m Using tsconfig: tsconfig.json
[34mCLI[39m tsup v8.5.1
[34mCLI[39m Target: es2017
[34mCLI[39m Cleaning output folder
[34mESM[39m Build start
[34mCJS[39m Build start
[32mCJS[39m [1mdist/index.js [22m[32m25.66 KB[39m
[32mCJS[39m ⚡️ Build success in 117ms
[32mESM[39m [1mdist/index.mjs [22m[32m23.62 KB[39m
[32mESM[39m ⚡️ Build success in 127ms
[34mDTS[39m Build start
[32mDTS[39m ⚡️ Build success in 7722ms
[32mDTS[39m [1mdist/index.d.mts [22m[32m37.49 KB[39m
[32mDTS[39m [1mdist/index.d.ts  [22m[32m37.49 KB[39m
::endgroup::
::group::@croco-example/saas-billing-golden-path:test
cache miss, executing a5d3dda8850bf419
$ vitest run src/tests --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
JSON report written to /home/runner/work/framework/framework/examples/saas-billing-golden-path/.turbo/croco-test-evidence.json
::endgroup::
::group::@croco/invitation-drizzle:test
cache miss, executing 0fc67d7eedd3900c
$ vitest run --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
JSON report written to /home/runner/work/framework/framework/packages/invitation-drizzle/.turbo/croco-test-evidence.json
::endgroup::
::group::@croco/cli:test
cache miss, executing 5016e0d500626353
$ vitest run --exclude "src/tests/integration/**" --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
JSON report written to /home/runner/work/framework/framework/packages/cli/.turbo/croco-test-evidence.json
::endgroup::

  Tasks:    241 successful, 241 total
 Cached:    9 cached, 241 total
   Time:    8m15.097s 
Summary:    /home/runner/work/framework/framework/.turbo/runs/3Iy329qYis50OHu59uCSiD9eE6M.json


```

stderr excerpt:

```text
[truncated 1432 chars]
ch <name>
hint:
hint: Names commonly chosen instead of 'master' are 'main', 'trunk' and
hint: 'development'. The just-created branch can be renamed via this command:
hint:
hint: 	git branch -m <name>
hint:
hint: Disable this message with "git config set advice.defaultBranchName false"
Switched to a new branch 'pull-request'
HEAD is now at 9546bdd base
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
Switched to a new branch 'pull-request'
HEAD is now at 3249737 base
Warning: you are leaving 1 commit behind, not connected to
any of your branches:

  b85895e Merge commit 'c0b44a53205eabc198494efb54c3483509b445f0' into HEAD

If you want to keep it by creating a new branch, this may be a good time
to do so with:

 git branch <new-branch-name> b85895e

Switched to branch 'trunk'
HEAD is now at b85895e Merge commit 'c0b44a53205eabc198494efb54c3483509b445f0' into HEAD
Switched to a new branch 'pull-request'
Switched to branch 'trunk'
Switched to a new branch 'pull-request'
HEAD is now at 3249737 base
Warning: you are leaving 1 commit behind, not connected to
any of your branches:

  2a842f5 Merge commit '29c4dacce49d9bea0e36d2d2fbcfa347e382ad04' into HEAD

If you want to keep it by creating a new branch, this may be a good time
to do so with:

 git branch <new-branch-name> 2a842f5

HEAD is now at 3249737 base
Warning: you are leaving 1 commit behind, not connected to
any of your branches:

  1e4b4ec divergent

If you want to keep it by creating a new branch, this may be a good time
to do so with:

 git branch <new-branch-name> 1e4b4ec

HEAD is now at 2a842f5 Merge commit '29c4dacce49d9bea0e36d2d2fbcfa347e382ad04' into HEAD
Switched to a new branch 'pull-request'
HEAD is now at ab8733e base
Warning: you are leaving 1 commit behind, not connected to
any of your branches:

  e859603 Merge commit '32f1bb4689604a4086ddfa17fb51aadee4f79106' into HEAD

If you want to keep it by creating a new branch, this may be a good time
to do so with:

 git branch <new-branch-name> e859603

Switched to branch 'trunk'
HEAD is now at e859603 Merge commit '32f1bb4689604a4086ddfa17fb51aadee4f79106' into HEAD
Switched to a new branch 'pull-request'
HEAD is now at ab8733e base
Warning: you are leaving 1 commit behind, not connected to
any of your branches:

  e859603 Merge commit '32f1bb4689604a4086ddfa17fb51aadee4f79106' into HEAD

If you want to keep it by creating a new branch, this may be a good time
to do so with:

 git branch <new-branch-name> e859603

HEAD is now at 32f1bb4 head
Switched to a new branch 'pull-request'
HEAD is now at ab8733e base
Warning: you are leaving 1 commit behind, not connected to
any of your branches:

  e859603 Merge commit '32f1bb4689604a4086ddfa17fb51aadee4f79106' into HEAD

If you want to keep it by creating a new branch, this may be a good time
to do so with:

 git branch <new-branch-name> e859603

HEAD is now at 32f1bb4 head
Switched to a new branch 'pull-request'
HEAD is now at ab8733e base
Switched to a new branch 'pull-request'
HEAD is now at ab8733e base
Warning: you are leaving 1 commit behind, not connected to
any of your branches:

  e859603 Merge commit '32f1bb4689604a4086ddfa17fb51aadee4f79106' into HEAD

If you want to keep it by creating a new branch, this may be a good time
to do so with:

 git branch <new-branch-name> e859603

HEAD is now at 32f1bb4 head

```

### Inventory integration test lane

- ID: `integration-test-lane`
- Status: passed
- Selection reason: Selected for the full integration inventory.
- Command: `node --experimental-strip-types scripts/test-lane-runner.mts --lane integration --output ci-reports/package-quality/integration-test-lane.json`
- Started at: 2026-09-06T19:31:05.185Z
- Completed at: 2026-09-06T19:37:27.843Z
- Duration: 382.66s
- Timeout: 1800s
- Failure reason: none

Artifacts:
- Integration test lane evidence (required): `ci-reports/package-quality/integration-test-lane.json` present; modified at 2026-09-06T19:37:27.836Z; copied to `ci-reports/release/artifacts/integration-test-lane/integration-test-lane.json`

stdout excerpt:

```text
JSON report written to /tmp/croco-test-lane-d1BIjm/vitest.json
JSON report written to /tmp/croco-test-lane-XLSFGf/vitest.json
JSON report written to /tmp/croco-test-lane-BChq38/vitest.json

Running 1 test using 1 worker
·
  1 passed (4.0m)
JSON report written to /tmp/croco-test-lane-NOV1iJ/vitest.json
JSON report written to /tmp/croco-test-lane-rddpuC/vitest.json
JSON report written to /tmp/croco-test-lane-ZZuJC1/vitest.json

```

stderr excerpt:

```text
$ vitest run src/tests/Integration.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-d1BIjm/vitest.json
$ vitest run src/tests/integration/CliCommandIntegration.spec.ts src/tests/integration/e2e.spec.ts src/tests/integration/jobs-e2e.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-XLSFGf/vitest.json
$ vitest run src/tests/e2e-advanced.spec.ts src/tests/e2e-generation.spec.ts src/tests/e2e-vite-spa.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-BChq38/vitest.json
$ playwright test e2e/verify-starlight.spec.ts --reporter=json
$ vitest run src/__tests__/e2e.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-NOV1iJ/vitest.json
$ vitest run src/tests/e2e.spec.ts src/tests/real-app.e2e.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-rddpuC/vitest.json
$ vitest run src/tests/TaskRunner.integration.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-ZZuJC1/vitest.json

```

### Inventory published-consumer test lane

- ID: `published-test-lane`
- Status: passed
- Selection reason: Selected for the full published-consumer inventory.
- Command: `node --experimental-strip-types scripts/test-lane-runner.mts --lane published --output ci-reports/package-quality/published-test-lane.json`
- Started at: 2026-09-06T19:37:27.846Z
- Completed at: 2026-09-06T19:38:45.330Z
- Duration: 77.48s
- Timeout: 2700s
- Failure reason: none

Artifacts:
- Published-consumer test lane evidence (required): `ci-reports/package-quality/published-test-lane.json` present; modified at 2026-09-06T19:38:45.323Z; copied to `ci-reports/release/artifacts/published-test-lane/published-test-lane.json`

stdout excerpt:

```text
JSON report written to /tmp/croco-test-lane-1FiZwR/vitest.json
JSON report written to /tmp/croco-test-lane-Sx18QM/vitest.json
JSON report written to /tmp/croco-test-lane-NSd2aR/vitest.json
JSON report written to /tmp/croco-test-lane-eihhDv/vitest.json
JSON report written to /tmp/croco-test-lane-frR4YF/vitest.json
JSON report written to /tmp/croco-test-lane-NA4KaR/vitest.json
JSON report written to /tmp/croco-test-lane-Ghh9dr/vitest.json
JSON report written to /tmp/croco-test-lane-Kru6PK/vitest.json
JSON report written to /tmp/croco-test-lane-nI28up/vitest.json
JSON report written to /tmp/croco-test-lane-PxlZRh/vitest.json
JSON report written to /tmp/croco-test-lane-FRvjdK/vitest.json
JSON report written to /tmp/croco-test-lane-qyJa8J/vitest.json
JSON report written to /tmp/croco-test-lane-ys6bEi/vitest.json

```

stderr excerpt:

```text
$ vitest run src/tests/PublishedCli.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-1FiZwR/vitest.json
$ vitest run src/tests/PublishedMessageContracts.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-Sx18QM/vitest.json
$ vitest run src/tests/PublishedTypes.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-NSd2aR/vitest.json
$ vitest run src/tests/published-contract.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-eihhDv/vitest.json
$ vitest run src/tests/PublishedCli.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-frR4YF/vitest.json
$ vitest run src/tests/PublishedReactEmail.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-NA4KaR/vitest.json
$ vitest run src/tests/PublishedPolicyTypes.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-Ghh9dr/vitest.json
$ vitest run src/tests/PublishedCli.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-Kru6PK/vitest.json
$ vitest run src/tests/PublishedSearchable.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-nI28up/vitest.json
$ vitest run src/tests/PublishedTypes.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-PxlZRh/vitest.json
$ vitest run src/tests/PublishedTypes.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-FRvjdK/vitest.json
$ vitest run src/tests/PublishedWorkerTypes.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-qyJa8J/vitest.json
$ vitest run src/tests/PublishedListen.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-ys6bEi/vitest.json

```

### Enforced test execution evidence

- ID: `test-evidence-reconcile`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/test-evidence-reconcile.mts --profile publish --lane-report ci-reports/package-quality/fast-test-lane.json --lane-report ci-reports/package-quality/integration-test-lane.json --lane-report ci-reports/package-quality/published-test-lane.json --materialization-evidence ci-reports/generated-apps/materialization-evidence.json --generated-root ci-reports/generated-apps/materialized-tests --required-generated-path packages/create-croco-app/templates/admin-console/apps/api-server/src/tests/AdminConsole.spec.ts --required-generated-path packages/create-croco-app/templates/admin-console/apps/api-server/src/tests/CreditOperations.spec.ts --required-generated-path packages/create-croco-app/templates/admin-console/tests/journeys/plan-release.spec.ts --required-generated-path packages/create-croco-app/templates/ai-saas/apps/api-server/src/tests/AiSaas.spec.ts --required-generated-path packages/create-croco-app/templates/base-ddd/libs/shared/utils-env/src/tests/createEnv.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/ContractFuzz.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/ExecutableAssurance.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/FileBillableUsageJournal.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/FileUsageBillingGateway.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/ProviderProfileEnv.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/SaasDemo.spec.ts --required-generated-path packages/create-croco-app/templates/spa-be-split/apps/api-server/src/tests/app.spec.ts --required-generated-path packages/create-croco-app/templates/spa-be-split/apps/console-web/src/tests/ProblemNotice.spec.tsx --required-generated-path packages/create-croco-app/templates/spa-be-split/tests/journeys/create-user.spec.ts --required-generated-path packages/create-croco-app/templates/spa-be-split/tests/journeys/problem-rendering.spec.ts --output ci-reports/package-quality/test-evidence.json`
- Started at: 2026-09-06T19:38:45.332Z
- Completed at: 2026-09-06T19:38:45.475Z
- Duration: 0.14s
- Timeout: 300s
- Failure reason: none

Artifacts:
- Enforced test evidence (required): `ci-reports/package-quality/test-evidence.json` present; modified at 2026-09-06T19:38:45.451Z; copied to `ci-reports/release/artifacts/test-evidence-reconcile/test-evidence.json`

### Packed installed CLI integration evidence

- ID: `cli-packed-e2e`
- Status: not_applicable
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/test-lane-evidence-check.mts --report ci-reports/package-quality/integration-test-lane.json --lane integration --path packages/cli/src/tests/integration/CliCommandIntegration.spec.ts`
- Started at: not started
- Completed at: 2026-09-06T19:38:45.336Z
- Duration: not collected
- Timeout: not started
- Failure reason: Not applicable to the changed files in this verification context.

Artifacts:
- none

### Provider certification

- ID: `provider-certification`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported provider certification metadata -- node --experimental-strip-types scripts/provider-certification-check.mts`
- Started at: 2026-09-06T18:37:34.125Z
- Completed at: 2026-09-06T18:37:35.080Z
- Duration: 0.96s
- Timeout: 600s
- Failure reason: none

Artifacts:
- Provider certification markdown (required): `ci-reports/package-quality/provider-certification.md` present; modified at 2026-09-06T18:37:34.732Z; copied to `ci-reports/release/artifacts/provider-certification/provider-certification.md`
- Provider certification JSON (required): `ci-reports/package-quality/provider-certification.json` present; modified at 2026-09-06T18:37:34.733Z; copied to `ci-reports/release/artifacts/provider-certification/provider-certification.json`

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
- Selection reason: Selected because package accountability inputs changed: packages/docs/src/content/docs/api/idempotency-core/src/classes/IdempotencyExecutionIndeterminateProblem.md, packages/docs/src/content/docs/api/idempotency-core/src/variables/IDEMPOTENCY_DIAGNOSTIC_CODES.md, packages/docs/src/content/docs/api/problems-core/src/variables/CROCO_PROBLEM_CODE_REGISTRY.md, packages/docs/src/content/docs/en/reference/problem-recovery-cookbook.md, packages/idempotency-core/README.md, packages/idempotency-core/src/index.ts, packages/idempotency-core/src/libs/IdempotencyCoordinator.ts, packages/idempotency-core/src/libs/problems/IdempotencyProblems.ts, packages/idempotency-core/src/tests/IdempotencyCoordinator.spec.ts, packages/problems-core/src/generated/problem-code-registry.ts.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported production-ready package violations -- node --experimental-strip-types scripts/production-ready-check.mts`
- Started at: 2026-09-06T19:38:45.479Z
- Completed at: 2026-09-06T19:38:47.786Z
- Duration: 2.31s
- Timeout: 600s
- Failure reason: none

Artifacts:
- Production-ready package markdown (required): `ci-reports/package-quality/production-ready.md` present; modified at 2026-09-06T19:38:47.466Z; copied to `ci-reports/release/artifacts/production-ready/production-ready.md`

stdout excerpt:

```text
production-ready-check: wrote /home/runner/work/framework/framework/ci-reports/package-quality/production-ready.md
production-ready-check: production packages=24
production-ready-check: blocking failures=0

```

### Beta spine promotion accountability

- ID: `spine-promotion`
- Status: passed
- Selection reason: Selected because package accountability inputs changed: packages/docs/src/content/docs/api/idempotency-core/src/classes/IdempotencyExecutionIndeterminateProblem.md, packages/docs/src/content/docs/api/idempotency-core/src/variables/IDEMPOTENCY_DIAGNOSTIC_CODES.md, packages/docs/src/content/docs/api/problems-core/src/variables/CROCO_PROBLEM_CODE_REGISTRY.md, packages/docs/src/content/docs/en/reference/problem-recovery-cookbook.md, packages/idempotency-core/README.md, packages/idempotency-core/src/index.ts, packages/idempotency-core/src/libs/IdempotencyCoordinator.ts, packages/idempotency-core/src/libs/problems/IdempotencyProblems.ts, packages/idempotency-core/src/tests/IdempotencyCoordinator.spec.ts, packages/problems-core/src/generated/problem-code-registry.ts.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported beta spine promotion violations -- node --experimental-strip-types scripts/spine-promotion-check.mts --package docs --package idempotency-core --package problems-core`
- Started at: 2026-09-06T19:38:47.789Z
- Completed at: 2026-09-06T19:38:50.906Z
- Duration: 3.12s
- Timeout: 600s
- Failure reason: none

Artifacts:
- Beta spine promotion markdown (required): `ci-reports/package-quality/spine-promotion.md` present; modified at 2026-09-06T19:38:50.332Z; copied to `ci-reports/release/artifacts/spine-promotion/spine-promotion.md`

stdout excerpt:

```text
spine-promotion-check: wrote /home/runner/work/framework/framework/ci-reports/package-quality/spine-promotion.md
spine-promotion-check: beta spine packages=1
spine-promotion-check: blocking failures=0

```

### Core coverage gate

- ID: `core-coverage`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `pnpm --filter @croco/framework-context --filter @croco/problems-core --filter @croco/protocols-core --filter @croco/protocols-rest --filter @croco/openapi-spec --filter @croco/rpc-codegen --filter @croco/transports-http --filter @croco/telemetry-api --filter @croco/telemetry-sdk-node --filter @croco/tx-core --filter @croco/tx-drizzle --filter @croco/events-core --filter @croco/events-tx --filter @croco/retry-core --filter @croco/idempotency-core --filter @croco/testing --filter create-croco-app --filter @croco/cli --filter @croco/auth-core exec vitest run --coverage --config ../../vitest.config.ts`
- Started at: 2026-09-06T19:38:45.338Z
- Completed at: 2026-09-06T19:42:39.990Z
- Duration: 234.65s
- Timeout: 2700s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
[truncated 94954 chars]
|     100 |                   
  ...t-template.ts |     100 |      100 |     100 |     100 |                   
  ...e-evidence.ts |   88.88 |    83.33 |     100 |   88.88 | 23                
  ...ion-result.ts |     100 |      100 |     100 |     100 |                   
  generator.ts     |    98.2 |    93.12 |     100 |    98.2 | 142,646,654       
  goals.ts         |   74.32 |    66.21 |   81.81 |   93.75 | 87,93,167         
  index.ts         |       0 |        0 |       0 |       0 |                   
  node-runtime.ts  |     100 |    85.71 |     100 |     100 | 50                
  options.ts       |   83.17 |       80 |   96.29 |   85.97 | ...96-706,713-716 
  ...ge-version.ts |   83.33 |    71.42 |     100 |   83.33 | 15,29             
  programmatic.ts  |       0 |        0 |       0 |       0 |                   
  prompts.ts       |   22.22 |    22.22 |   16.66 |   22.53 | ...96-398,409-478 
  ...r-profiles.ts |   96.47 |    92.68 |     100 |   96.34 | 669,748,1088      
  ...der-policy.ts |   70.32 |    61.26 |   78.37 |   71.81 | ...55,569,575,580 
  staging.ts       |     100 |      100 |     100 |     100 |                   
  ...ed-options.ts |     100 |      100 |     100 |     100 |                   
  template-path.ts |     100 |      100 |     100 |     100 |                   
 src/helpers       |   91.61 |    88.79 |   93.75 |   92.35 |                   
  catalog-spine.ts |     100 |      100 |     100 |     100 |                   
  croco-ranges.ts  |     100 |      100 |     100 |     100 |                   
  fs.ts            |   92.53 |       85 |    87.5 |   92.42 | 30,60,62,75,92    
  ...normalizer.ts |   96.96 |       95 |     100 |   96.77 | 70                
  pkg-json.ts      |     100 |       90 |     100 |     100 | 8                 
  validate.ts      |    82.6 |    88.09 |   83.33 |   84.61 | 14,49,69-72       
 src/installers    |   97.53 |    86.84 |   94.73 |    97.5 |                   
  agent-rules.ts   |     100 |      100 |     100 |     100 |                   
  docker.ts        |   93.33 |     87.5 |     100 |   93.33 | 56                
  ...end-deploy.ts |     100 |    83.33 |     100 |     100 | 35,45-52          
  ...hql-nextjs.ts |     100 |      100 |     100 |     100 |                   
  ...standalone.ts |     100 |      100 |     100 |     100 |                   
  index.ts         |       0 |        0 |       0 |       0 |                   
  lambda.ts        |     100 |      100 |     100 |     100 |                   
  mongodb.ts       |     100 |      100 |     100 |     100 |                   
  redis.ts         |     100 |      100 |     100 |     100 |                   
  shared-ui.ts     |     100 |      100 |     100 |     100 |                   
  trpc-nextjs.ts   |     100 |      100 |     100 |     100 |                   
  ...standalone.ts |     100 |      100 |     100 |     100 |                   
  ui-profile.ts    |   95.45 |     87.5 |      75 |   95.23 | 87                
  web-graphql.ts   |     100 |      100 |     100 |     100 |                   
  web-trpc.ts      |     100 |      100 |     100 |     100 |                   
 src/libs/problems |     100 |       50 |     100 |     100 |                   
  ...ptyProblem.ts |     100 |      100 |     100 |     100 |                   
  ...ionProblem.ts |     100 |       50 |     100 |     100 | 10                
  ...ionProblem.ts |     100 |      100 |     100 |     100 |                   
  ...ionProblem.ts |     100 |      100 |     100 |     100 |                   
  ...andProblem.ts |     100 |       50 |     100 |     100 | 38                
  ...ionProblem.ts |     100 |      100 |     100 |     100 |                   
 ...raphql-api/src |   95.83 |      100 |     100 |   95.83 |                   
  ...metryFlush.ts |   95.83 |      100 |     100 |   95.83 | 45                
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
      at [90m/home/runner/work/framework/framework/packages/tx-core/[39msrc/tests/TxManager.concurrency.spec.ts:595:19
      at TxManager.executeAfterCommitHooks [90m(/home/runner/work/framework/framework/packages/tx-core/[39msrc/libs/TxManager.ts:405:9[90m)[39m
      at TxManager.executeRootWithOutcome [90m(/home/runner/work/framework/framework/packages/tx-core/[39msrc/libs/TxManager.ts:213:11[90m)[39m
      at [90m/home/runner/work/framework/framework/packages/tx-core/[39msrc/tests/TxManager.concurrency.spec.ts:591:23
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
- Started at: 2026-09-06T19:42:39.993Z
- Completed at: 2026-09-06T19:42:40.149Z
- Duration: 0.16s
- Timeout: 600s
- Failure reason: none

Artifacts:
- Core coverage warning markdown (required): `ci-reports/coverage/core-warning/report.md` present; modified at 2026-09-06T19:42:40.125Z; copied to `ci-reports/release/artifacts/core-coverage-warning/report.md`

stdout excerpt:

```text

⚠️  Core coverage warning report written to /home/runner/work/framework/framework/ci-reports/coverage/core-warning/report.md
⚠️  Total core coverage selection warnings: 41
⚠️  Total core coverage warnings: 63
✅ Total core coverage hard errors: 0

```

### Public API snapshot

- ID: `public-api`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm public-api:write -- node --experimental-strip-types scripts/public-api-surface.mts --check`
- Started at: 2026-09-06T18:37:35.083Z
- Completed at: 2026-09-06T18:37:39.248Z
- Duration: 4.17s
- Timeout: 600s
- Failure reason: none

Artifacts:
- Public API diff markdown (required): `ci-reports/package-quality/public-api-diff.md` present; modified at 2026-09-06T18:37:38.791Z; copied to `ci-reports/release/artifacts/public-api/public-api-diff.md`
- Public API summary JSON (required): `ci-reports/package-quality/public-api-summary.json` present; modified at 2026-09-06T18:37:38.791Z; copied to `ci-reports/release/artifacts/public-api/public-api-summary.json`

stdout excerpt:

```text
public-api-surface: 120 package public API snapshot(s) match.

```

### Release-gate maintenance test evidence

- ID: `release-gate-tests`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/test-lane-evidence-check.mts --report ci-reports/package-quality/fast-test-lane.json --lane fast --path scripts/tests/alpha-release-smoke.spec.ts --path scripts/tests/api-docs-trigger-check.spec.ts --path scripts/tests/architecture-policy-check.spec.ts --path scripts/tests/bench-threshold-check.spec.ts --path scripts/tests/benchmark-workflow.spec.ts --path scripts/tests/branch-protection-policy.spec.ts --path scripts/tests/changeset-required-check.spec.ts --path scripts/tests/ci-executable-policy.spec.ts --path scripts/tests/ci-performance-budget.spec.ts --path scripts/tests/ci-verification-identity.spec.ts --path scripts/tests/ci-workflow.spec.ts --path scripts/tests/compiler-baseline-check.spec.ts --path scripts/tests/core-coverage-warning-check.spec.ts --path scripts/tests/create-croco-app-generated-smoke.spec.ts --path scripts/tests/dependency-audit-policy.spec.ts --path scripts/tests/doc-examples-check.spec.ts --path scripts/tests/first-success-verify.spec.ts --path scripts/tests/generated-secret-placeholder-policy.spec.ts --path scripts/tests/live-tests-workflow.spec.ts --path scripts/tests/normalize-packages.spec.ts --path scripts/tests/package-bin-smoke.spec.ts --path scripts/tests/package-docs-check.spec.ts --path scripts/tests/package-entrypoint-smoke.spec.ts --path scripts/tests/package-manifest-contracts.spec.ts --path scripts/tests/package-quality-report.spec.ts --path scripts/tests/problem-registry.spec.ts --path scripts/tests/production-ready-check.spec.ts --path scripts/tests/provenance-config-check.spec.ts --path scripts/tests/provider-certification-check.spec.ts --path scripts/tests/public-api-surface.spec.ts --path scripts/tests/release-docs-check.spec.ts --path scripts/tests/release-metadata-check.spec.ts --path scripts/tests/release-spine-evidence.spec.ts --path scripts/tests/release-version-sync.spec.ts --path scripts/tests/release-workflow.spec.ts --path scripts/tests/repository-policy-audit-workflow.spec.ts --path scripts/tests/security-allowlist-metadata-check.spec.ts --path scripts/tests/spine-promotion-check.spec.ts --path scripts/tests/static-misuse-check.spec.ts --path scripts/tests/strict-contract-typecheck.spec.ts --path scripts/tests/test-evidence-reconcile.spec.ts --path scripts/tests/test-inventory.spec.ts --path scripts/tests/test-lane-evidence-check.spec.ts --path scripts/tests/test-lane-runner.spec.ts --path scripts/tests/tracked-file-mutation-guard.spec.ts --path scripts/tests/turbo-cache-contract.spec.ts --path scripts/tests/turbo-task-contract.spec.ts --path scripts/tests/verification-change-classifier.spec.ts --path scripts/tests/verification-command.spec.ts --path scripts/tests/verification-manifest.spec.ts --path scripts/tests/verification-policy.spec.ts --path scripts/tests/verify-circular-allowlist.spec.ts`
- Started at: 2026-09-06T19:31:05.189Z
- Completed at: 2026-09-06T19:31:05.357Z
- Duration: 0.17s
- Timeout: 120s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
[test-lane-evidence] fast report covers 52 required paths

```

### Release metadata

- ID: `release-metadata`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/release-metadata-check.mts --allow-pending-changesets`
- Started at: 2026-09-06T18:37:39.252Z
- Completed at: 2026-09-06T18:37:39.480Z
- Duration: 0.23s
- Timeout: 600s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
=== Release metadata summary ===
Checked publishable: 120
Skipped private/non-published tooling: 2
Pending changeset recoveries: 10

Pending changeset metadata recoveries:
- packages/credits-core/package.json (@croco/credits-core): CHANGELOG.md is missing
- packages/credits-drizzle/package.json (@croco/credits-drizzle): CHANGELOG.md is missing
- packages/desktop-codegen/package.json (@croco/desktop-codegen): CHANGELOG.md is missing
- packages/engagement-core/package.json (@croco/engagement-core): CHANGELOG.md is missing
- packages/engagement-drizzle/package.json (@croco/engagement-drizzle): CHANGELOG.md is missing
- packages/notifications-react-email/package.json (@croco/notifications-react-email): CHANGELOG.md is missing
- packages/protocol-codegen/package.json (@croco/protocol-codegen): CHANGELOG.md is missing
- packages/protocols-desktop/package.json (@croco/protocols-desktop): CHANGELOG.md is missing
- packages/testing-resources/package.json (@croco/testing-resources): CHANGELOG.md is missing
- packages/ui-astryx/package.json (@croco/ui-astryx): CHANGELOG.md is missing

OK: Release metadata placeholders are covered by pending changesets. Final publish candidates must pass without --allow-pending-changesets.

```

### Spine bundle-size warning report

- ID: `spine-bundle-size`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/package-quality-report.mts`
- Started at: 2026-09-06T19:38:50.912Z
- Completed at: 2026-09-06T19:38:52.412Z
- Duration: 1.50s
- Timeout: 600s
- Failure reason: none

Artifacts:
- Package quality dashboard markdown (required): `ci-reports/package-quality/report.md` present; modified at 2026-09-06T19:38:52.371Z; copied to `ci-reports/release/artifacts/spine-bundle-size/report.md`
- Package quality dashboard JSON (required): `ci-reports/package-quality/summary.json` present; modified at 2026-09-06T19:38:52.376Z; copied to `ci-reports/release/artifacts/spine-bundle-size/summary.json`
- Bundle-size enforcement markdown (required): `ci-reports/package-quality/bundle-size.md` present; modified at 2026-09-06T19:38:52.382Z; copied to `ci-reports/release/artifacts/spine-bundle-size/bundle-size.md`

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
- Started at: 2026-09-06T18:37:39.483Z
- Completed at: 2026-09-06T18:37:48.604Z
- Duration: 9.12s
- Timeout: 600s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
dependency-audit-policy: pnpm audit --json started timeoutMs=120000
dependency-audit-policy: pnpm audit --json completed elapsedMs=1002 status=1 signal=null
dependency-audit-transport {"event":"start","elapsedMs":0,"cpuUserMs":19,"cpuSystemMs":9,"stage":"before-request","nodeVersion":"v22.23.2"}
dependency-audit-transport {"event":"request","elapsedMs":804,"cpuUserMs":935,"cpuSystemMs":104,"stage":"waiting-send","requestId":1}
dependency-audit-transport {"event":"body-sent","elapsedMs":839,"cpuUserMs":955,"cpuSystemMs":109,"stage":"waiting-headers","requestId":1}
dependency-audit-transport {"event":"headers","elapsedMs":895,"cpuUserMs":959,"cpuSystemMs":109,"stage":"reading-body","requestId":1,"statusCode":200}
dependency-audit-transport {"event":"body-complete","elapsedMs":899,"cpuUserMs":964,"cpuSystemMs":109,"stage":"processing-response","requestId":1}
dependency-audit-transport {"event":"exit","elapsedMs":945,"cpuUserMs":1042,"cpuSystemMs":111,"stage":"processing-response","code":1}
dependency-audit-policy: pnpm audit --prod --json started timeoutMs=120000
dependency-audit-policy: pnpm audit --prod --json completed elapsedMs=937 status=0 signal=null
dependency-audit-transport {"event":"start","elapsedMs":0,"cpuUserMs":14,"cpuSystemMs":7,"stage":"before-request","nodeVersion":"v22.23.2"}
dependency-audit-transport {"event":"request","elapsedMs":756,"cpuUserMs":812,"cpuSystemMs":96,"stage":"waiting-send","requestId":1}
dependency-audit-transport {"event":"body-sent","elapsedMs":796,"cpuUserMs":842,"cpuSystemMs":98,"stage":"waiting-headers","requestId":1}
dependency-audit-transport {"event":"headers","elapsedMs":855,"cpuUserMs":845,"cpuSystemMs":98,"stage":"reading-body","requestId":1,"statusCode":200}
dependency-audit-transport {"event":"body-complete","elapsedMs":860,"cpuUserMs":850,"cpuSystemMs":98,"stage":"processing-response","requestId":1}
dependency-audit-transport {"event":"exit","elapsedMs":889,"cpuUserMs":893,"cpuSystemMs":99,"stage":"processing-response","code":0}
dependency-audit-policy: generated template pnpm audit --json started timeoutMs=120000
dependency-audit-policy: generated template pnpm audit --json completed elapsedMs=664 status=0 signal=null
dependency-audit-transport {"event":"start","elapsedMs":0,"cpuUserMs":16,"cpuSystemMs":8,"stage":"before-request","nodeVersion":"v22.23.2"}
dependency-audit-transport {"event":"request","elapsedMs":534,"cpuUserMs":559,"cpuSystemMs":59,"stage":"waiting-send","requestId":1}
dependency-audit-transport {"event":"body-sent","elapsedMs":563,"cpuUserMs":576,"cpuSystemMs":60,"stage":"waiting-headers","requestId":1}
dependency-audit-transport {"event":"headers","elapsedMs":613,"cpuUserMs":579,"cpuSystemMs":60,"stage":"reading-body","requestId":1,"statusCode":200}
dependency-audit-transport {"event":"body-complete","elapsedMs":615,"cpuUserMs":582,"cpuSystemMs":60,"stage":"processing-response","requestId":1}
dependency-audit-transport {"event":"exit","elapsedMs":621,"cpuUserMs":590,"cpuSystemMs":60,"stage":"processing-response","code":0}
dependency-audit-policy: wrote ci-reports/security/dependency-audit-policy.md
dependency-audit-policy: passed

```

### npm provenance configuration

- ID: `provenance-config`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/provenance-config-check.mts`
- Started at: 2026-09-06T18:37:48.609Z
- Completed at: 2026-09-06T18:37:48.910Z
- Duration: 0.30s
- Timeout: 300s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
NPM_CONFIG_PROVENANCE: true
npm provenance: true

```

### Publish dry run

- ID: `publish-dry-run`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `pnpm -r publish --dry-run --no-git-checks`
- Started at: 2026-09-06T19:42:39.997Z
- Completed at: 2026-09-06T19:44:04.596Z
- Duration: 84.60s
- Timeout: 1800s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
[truncated 52383 chars]
CHANGE: Failed token exchange request with body message: Unknown error (status code 404)
📦 @croco/metering-drizzle@0.0.4 → https://registry.npmjs.org/
[WARN] Skip publishing @croco/metering-drizzle@0.0.4 (dry run)
GET https://run-actions-1-azure-eastus.actions.githubusercontent.com/248//idtoken/f5223ab2-b502-4334-ae89-8938576bb434/a600d4f7-613f-547c-bfd1-20cf08008e7c?api-version=2.0&audience=npm%3Aregistry.npmjs.org 200 94ms
[WARN] Skipped OIDC: ERR_PNPM_AUTH_TOKEN_EXCHANGE: Failed token exchange request with body message: Unknown error (status code 404)
📦 @croco/metering-upstash@0.0.4 → https://registry.npmjs.org/
[WARN] Skip publishing @croco/metering-upstash@0.0.4 (dry run)
GET https://run-actions-1-azure-eastus.actions.githubusercontent.com/248//idtoken/f5223ab2-b502-4334-ae89-8938576bb434/a600d4f7-613f-547c-bfd1-20cf08008e7c?api-version=2.0&audience=npm%3Aregistry.npmjs.org 200 95ms
[WARN] Skipped OIDC: ERR_PNPM_AUTH_TOKEN_EXCHANGE: Failed token exchange request with body message: Unknown error (status code 404)
📦 @croco/metrics-billing@0.1.0 → https://registry.npmjs.org/
[WARN] Skip publishing @croco/metrics-billing@0.1.0 (dry run)
GET https://run-actions-1-azure-eastus.actions.githubusercontent.com/248//idtoken/f5223ab2-b502-4334-ae89-8938576bb434/a600d4f7-613f-547c-bfd1-20cf08008e7c?api-version=2.0&audience=npm%3Aregistry.npmjs.org 200 93ms
[WARN] Skipped OIDC: ERR_PNPM_AUTH_TOKEN_EXCHANGE: Failed token exchange request with body message: Unknown error (status code 404)
📦 @croco/admin-react@0.1.0 → https://registry.npmjs.org/
[WARN] Skip publishing @croco/admin-react@0.1.0 (dry run)
GET https://run-actions-1-azure-eastus.actions.githubusercontent.com/248//idtoken/f5223ab2-b502-4334-ae89-8938576bb434/a600d4f7-613f-547c-bfd1-20cf08008e7c?api-version=2.0&audience=npm%3Aregistry.npmjs.org 200 95ms
[WARN] Skipped OIDC: ERR_PNPM_AUTH_TOKEN_EXCHANGE: Failed token exchange request with body message: Unknown error (status code 404)
📦 @croco/entitlements-drizzle@0.0.4 → https://registry.npmjs.org/
[WARN] Skip publishing @croco/entitlements-drizzle@0.0.4 (dry run)
GET https://run-actions-1-azure-eastus.actions.githubusercontent.com/248//idtoken/f5223ab2-b502-4334-ae89-8938576bb434/a600d4f7-613f-547c-bfd1-20cf08008e7c?api-version=2.0&audience=npm%3Aregistry.npmjs.org 200 104ms
[WARN] Skipped OIDC: ERR_PNPM_AUTH_TOKEN_EXCHANGE: Failed token exchange request with body message: Unknown error (status code 404)
📦 @croco/membership-core@0.0.4 → https://registry.npmjs.org/
[WARN] Skip publishing @croco/membership-core@0.0.4 (dry run)
GET https://run-actions-1-azure-eastus.actions.githubusercontent.com/248//idtoken/f5223ab2-b502-4334-ae89-8938576bb434/a600d4f7-613f-547c-bfd1-20cf08008e7c?api-version=2.0&audience=npm%3Aregistry.npmjs.org 200 95ms
[WARN] Skipped OIDC: ERR_PNPM_AUTH_TOKEN_EXCHANGE: Failed token exchange request with body message: Unknown error (status code 404)
📦 @croco/invitation-core@0.0.4 → https://registry.npmjs.org/
[WARN] Skip publishing @croco/invitation-core@0.0.4 (dry run)
GET https://run-actions-1-azure-eastus.actions.githubusercontent.com/248//idtoken/f5223ab2-b502-4334-ae89-8938576bb434/a600d4f7-613f-547c-bfd1-20cf08008e7c?api-version=2.0&audience=npm%3Aregistry.npmjs.org 200 93ms
[WARN] Skipped OIDC: ERR_PNPM_AUTH_TOKEN_EXCHANGE: Failed token exchange request with body message: Unknown error (status code 404)
📦 @croco/membership-drizzle@0.0.4 → https://registry.npmjs.org/
[WARN] Skip publishing @croco/membership-drizzle@0.0.4 (dry run)
GET https://run-actions-1-azure-eastus.actions.githubusercontent.com/248//idtoken/f5223ab2-b502-4334-ae89-8938576bb434/a600d4f7-613f-547c-bfd1-20cf08008e7c?api-version=2.0&audience=npm%3Aregistry.npmjs.org 200 95ms
[WARN] Skipped OIDC: ERR_PNPM_AUTH_TOKEN_EXCHANGE: Failed token exchange request with body message: Unknown error (status code 404)
📦 @croco/invitation-drizzle@0.0.4 → https://registry.npmjs.org/
[WARN] Skip publishing @croco/invitation-drizzle@0.0.4 (dry run)

```

# Release Spine Evidence

- Status: passed
- Generated at: 2026-09-15T15:05:46.230Z
- Completed at: 2026-09-15T15:54:47.303Z
- Root: `/home/runner/work/framework/framework`
- Output directory: `/home/runner/work/framework/framework/ci-reports/release`
- Profile: `publish`
- Commit: `5dac3cc7cf481c11d8348395aa622f9a4da7a9d5`
- Run: `34985927115` attempt `1`
- Total timeout: 9000s
- Checks: 47/54 passed, 7 not applicable, 0 failed, 0 timed out, 0 interrupted, 0 skipped after timeout, 0 skipped by prerequisite

## Check summary

| Check | Category | Command | Status | Exit | Duration | Timeout | Evidence artifacts |
| --- | --- | --- | --- | --- | ---: | ---: | --- |
| Release metadata | metadata | `node --experimental-strip-types scripts/release-metadata-check.mts --allow-pending-changesets` | passed | 0 | 0.12s | 600s | - |
| Read-only verification policy | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Guard or classify the reported verification path -- node --experimental-strip-types scripts/verification-policy.mts` | passed | 0 | 0.76s | 300s | - |
| Authoritative test inventory | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery node --experimental-strip-types scripts/test-inventory.mts --write -- node --experimental-strip-types scripts/test-inventory.mts --check --profile publish --output ci-reports/package-quality/test-inventory.json` | passed | 0 | 0.70s | 300s | Resolved test inventory (present, modified: 2026-09-15T15:05:46.851Z, copied: `ci-reports/release/artifacts/test-inventory/test-inventory.json`) |
| Turbo cache reuse and invalidation contract | quality | `node --experimental-strip-types scripts/turbo-cache-contract.mts` | passed | 0 | 15.27s | 300s | - |
| Verification profile contracts | quality | `pnpm exec vitest run scripts/tests/verification-command.spec.ts scripts/tests/verification-change-classifier.spec.ts scripts/tests/verification-manifest.spec.ts scripts/tests/release-spine-evidence.spec.ts scripts/tests/ci-workflow.spec.ts scripts/tests/ci-performance-budget.spec.ts scripts/tests/release-workflow.spec.ts scripts/tests/turbo-task-contract.spec.ts scripts/tests/branch-protection-policy.spec.ts scripts/tests/repository-policy-audit-workflow.spec.ts scripts/tests/verification-policy.spec.ts scripts/tests/test-inventory.spec.ts scripts/tests/test-lane-runner.spec.ts scripts/tests/turbo-cache-contract.spec.ts` | not_applicable | - | not collected | not started | - |
| Changeset requirement | metadata | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm changeset or revert the publishable change -- node --experimental-strip-types scripts/changeset-required-check.mts --base 1d935c284d8146dff1e576508d498a0a5d2467c1 --head HEAD` | passed | 0 | 0.67s | 300s | - |
| Package manifests | metadata | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm package-manifests:write -- node scripts/normalize-packages.mjs --check` | passed | 0 | 3.48s | 300s | - |
| Release version-derived metadata | metadata | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm release-version-sync:write && pnpm docs:catalog:write -- node --experimental-strip-types scripts/release-version-sync.mts --check` | passed | 0 | 0.58s | 300s | - |
| Package documentation catalog | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm docs:catalog:write -- node --experimental-strip-types scripts/package-docs-check.mts --check` | passed | 0 | 1.72s | 300s | - |
| API documentation triggers | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm docs:api-triggers:write -- node --experimental-strip-types scripts/api-docs-trigger-check.mts --check` | passed | 0 | 0.56s | 300s | - |
| Problem registry | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm problem-registry:write -- node --experimental-strip-types scripts/problem-registry.mts --check --base 1d935c284d8146dff1e576508d498a0a5d2467c1` | passed | 0 | 6.70s | 300s | - |
| Documentation examples | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm docs:examples:write -- node --experimental-strip-types scripts/doc-examples-check.mts --check` | passed | 0 | 5.93s | 300s | - |
| Release documentation | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported release documentation contract -- node --experimental-strip-types scripts/release-docs-check.mts` | passed | 0 | 0.65s | 300s | - |
| CI executable supply chain | security | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Pin the reported CI executable to an immutable source -- node --experimental-strip-types scripts/ci-executable-policy.mts` | passed | 0 | 2.05s | 300s | - |
| Pull-request CI performance budget | quality | `node --experimental-strip-types scripts/ci-performance-budget.mts` | passed | 0 | 0.26s | 300s | - |
| Verification runtime prerequisites | build | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the verification runtime build prerequisites -- pnpm --filter @croco/architecture-policy... --filter @croco/tenant-core... build` | passed | 0 | 18.25s | 600s | - |
| Architecture policy | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported architecture violation -- node --experimental-strip-types scripts/architecture-policy-check.mts --manifest croco.arch.json` | passed | 0 | 3.15s | 600s | - |
| Architecture circular allowlist | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Update code or intentionally update the circular dependency allowlist -- node --experimental-strip-types scripts/verify-circular-allowlist.mts` | passed | 0 | 14.75s | 600s | - |
| Dependency boundaries | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported package boundary -- node --experimental-strip-types scripts/package-quality-report.mts --boundary-check-only` | passed | 0 | 0.67s | 600s | - |
| Security allowlists | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported security allowlist metadata -- node --experimental-strip-types scripts/security-allowlist-metadata-check.mts` | passed | 0 | 4.44s | 300s | - |
| Generated secret placeholders | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported template placeholder -- node --experimental-strip-types scripts/generated-secret-placeholder-policy.mts` | passed | 0 | 0.57s | 300s | - |
| TypeScript compiler baseline | typecheck | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Restore the documented TypeScript compiler and tsconfig contract -- node --experimental-strip-types scripts/compiler-baseline-check.mts` | passed | 0 | 0.60s | 300s | - |
| Legacy decorator signature spike | typecheck | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Restore the reviewed TypeScript 6 decorator signature fixtures and policy -- node --experimental-strip-types scripts/decorator-signature-spike.mts` | passed | 0 | 7.11s | 600s | - |
| Strict contract typecheck | typecheck | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported strict contract diagnostic -- node --experimental-strip-types scripts/strict-contract-typecheck.mts` | passed | 0 | 61.48s | 600s | - |
| Static misuse | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported source misuse -- node --experimental-strip-types scripts/static-misuse-check.mts` | passed | 0 | 11.37s | 600s | - |
| Lint | quality | `pnpm exec oxlint .` | passed | 0 | 2.17s | 900s | - |
| Format | quality | `pnpm exec oxfmt --check . --ignore-path=.gitignore --ignore-path=.prettierignore --ignore-path=.oxfmtignore` | passed | 0 | 8.32s | 900s | - |
| Architecture circular dependencies | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported circular dependency -- pnpm exec madge --circular --extensions ts packages` | passed | 0 | 13.76s | 600s | - |
| Benchmark thresholds | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm bench:update -- node --experimental-strip-types scripts/bench-threshold-check.mts` | passed | 0 | 17.70s | 600s | - |
| Affected build | build | `pnpm turbo run build --filter=@croco/problems-core --filter=@croco/diagnostics-core --filter=@croco/framework-context --filter=@croco/protocols-core --filter=@croco/protocols-rest --summarize --continue=always` | passed | 0 | 16.82s | 1800s | - |
| Quick-start Lambda smoke | runtime-smoke | `node --experimental-strip-types scripts/quick-start-lambda-smoke.mts` | not_applicable | - | not collected | not started | - |
| First-success contract | generated-app | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Follow the reported scaffold or documentation recovery command -- node --experimental-strip-types scripts/first-success-verify.mts` | not_applicable | - | not collected | not started | - |
| Package entrypoint smoke | package-smoke | `node --experimental-strip-types scripts/package-entrypoint-smoke.mts --build-missing` | not_applicable | - | not collected | not started | - |
| Package binary smoke | package-smoke | `node --experimental-strip-types scripts/package-bin-smoke.mts` | not_applicable | - | not collected | not started | - |
| create-croco-app spine smoke | generated-app | `node --experimental-strip-types scripts/create-croco-app-generated-smoke.mts goal-saas-api goal-spa-backend-split goal-worker goal-internal-tool graphql-lambda-api graphql-vite-spa-docker meta-vite-fullstack-workers production-app-starter saas-golden-path rest-spa-contracts admin-console-starter ai-saas-golden-path` | passed | 0 | 1409.00s | 2700s | Spine-blocking generated app smoke matrix markdown (present, modified: 2026-09-15T15:31:06.053Z, copied: `ci-reports/release/artifacts/generated-app-smoke/spine-blocking-matrix.md`)<br>Spine-blocking generated app smoke matrix JSON (present, modified: 2026-09-15T15:31:06.053Z, copied: `ci-reports/release/artifacts/generated-app-smoke/spine-blocking-matrix.json`)<br>Generated app smoke journey bundle (missing)<br>Generated test materialization evidence (present, modified: 2026-09-15T15:31:06.053Z, copied: `ci-reports/release/artifacts/generated-app-smoke/materialization-evidence.json`)<br>Generated test materializations (present, modified: 2026-09-15T15:14:13.583Z, copied: `ci-reports/release/artifacts/generated-app-smoke/materialized-tests`) |
| Packed decorator consumers | package-smoke | `node --experimental-strip-types scripts/packed-decorator-consumers.mts` | passed | 0 | 41.38s | 900s | - |
| Packed generated app release smoke | generated-app | `node --experimental-strip-types scripts/alpha-release-smoke.mts` | not_applicable | - | not collected | not started | Packed generated app smoke report (missing) |
| Summarized TypeScript check | typecheck | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported TypeScript diagnostics -- pnpm turbo run typecheck --summarize --continue=always` | passed | 0 | 312.10s | 1800s | - |
| Summarized tests | quality | `node --experimental-strip-types scripts/test-lane-runner.mts --lane fast --output ci-reports/package-quality/fast-test-lane.json` | passed | 0 | 462.21s | 2700s | Fast test lane evidence (present, modified: 2026-09-15T15:44:07.789Z, copied: `ci-reports/release/artifacts/test/fast-test-lane.json`) |
| Inventory integration test lane | quality | `node --experimental-strip-types scripts/test-lane-runner.mts --lane integration --output ci-reports/package-quality/integration-test-lane.json` | passed | 0 | 311.50s | 1800s | Integration test lane evidence (present, modified: 2026-09-15T15:49:19.294Z, copied: `ci-reports/release/artifacts/integration-test-lane/integration-test-lane.json`) |
| Inventory published-consumer test lane | package-smoke | `node --experimental-strip-types scripts/test-lane-runner.mts --lane published --output ci-reports/package-quality/published-test-lane.json` | passed | 0 | 61.04s | 2700s | Published-consumer test lane evidence (present, modified: 2026-09-15T15:50:20.338Z, copied: `ci-reports/release/artifacts/published-test-lane/published-test-lane.json`) |
| Enforced test execution evidence | quality | `node --experimental-strip-types scripts/test-evidence-reconcile.mts --profile publish --lane-report ci-reports/package-quality/fast-test-lane.json --lane-report ci-reports/package-quality/integration-test-lane.json --lane-report ci-reports/package-quality/published-test-lane.json --materialization-evidence ci-reports/generated-apps/materialization-evidence.json --generated-root ci-reports/generated-apps/materialized-tests --required-generated-path packages/create-croco-app/templates/admin-console/apps/api-server/src/tests/AdminConsole.spec.ts --required-generated-path packages/create-croco-app/templates/admin-console/apps/api-server/src/tests/CreditOperations.spec.ts --required-generated-path packages/create-croco-app/templates/admin-console/tests/journeys/plan-release.spec.ts --required-generated-path packages/create-croco-app/templates/ai-saas/apps/api-server/src/tests/AiSaas.spec.ts --required-generated-path packages/create-croco-app/templates/base-ddd/libs/shared/utils-env/src/tests/createEnv.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/ContractFuzz.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/ExecutableAssurance.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/FileBillableUsageJournal.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/FileUsageBillingGateway.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/ProviderProfileEnv.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/SaasDemo.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/node-lifecycle.spec.ts --required-generated-path packages/create-croco-app/templates/spa-be-split/apps/api-server/src/tests/app.spec.ts --required-generated-path packages/create-croco-app/templates/spa-be-split/apps/api-server/src/tests/node-lifecycle.spec.ts --required-generated-path packages/create-croco-app/templates/spa-be-split/apps/console-web/src/tests/ProblemNotice.spec.tsx --required-generated-path packages/create-croco-app/templates/spa-be-split/tests/journeys/create-user.spec.ts --required-generated-path packages/create-croco-app/templates/spa-be-split/tests/journeys/problem-rendering.spec.ts --output ci-reports/package-quality/test-evidence.json` | passed | 0 | 0.11s | 300s | Enforced test evidence (present, modified: 2026-09-15T15:50:20.446Z, copied: `ci-reports/release/artifacts/test-evidence-reconcile/test-evidence.json`) |
| Packed installed CLI integration evidence | quality | `node --experimental-strip-types scripts/test-lane-evidence-check.mts --report ci-reports/package-quality/integration-test-lane.json --lane integration --path packages/cli/src/tests/integration/CliCommandIntegration.spec.ts` | not_applicable | - | not collected | not started | - |
| Provider certification | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported provider certification metadata -- node --experimental-strip-types scripts/provider-certification-check.mts` | passed | 0 | 0.99s | 600s | Provider certification markdown (present, modified: 2026-09-15T15:07:29.573Z, copied: `ci-reports/release/artifacts/provider-certification/provider-certification.md`)<br>Provider certification JSON (present, modified: 2026-09-15T15:07:29.574Z, copied: `ci-reports/release/artifacts/provider-certification/provider-certification.json`) |
| Production-ready package evidence | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported production-ready package violations -- node --experimental-strip-types scripts/production-ready-check.mts` | passed | 0 | 2.05s | 600s | Production-ready package markdown (present, modified: 2026-09-15T15:50:22.017Z, copied: `ci-reports/release/artifacts/production-ready/production-ready.md`) |
| Beta spine promotion accountability | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported beta spine promotion violations -- node --experimental-strip-types scripts/spine-promotion-check.mts --package docs --package impersonation-core --package problems-core` | passed | 0 | 0.88s | 600s | Beta spine promotion markdown (present, modified: 2026-09-15T15:50:23.148Z, copied: `ci-reports/release/artifacts/spine-promotion/spine-promotion.md`) |
| Core coverage gate | coverage | `node --experimental-strip-types scripts/core-coverage-runner.mts` | passed | 0 | 180.38s | 2700s | - |
| Core coverage warning report | coverage | `node --experimental-strip-types scripts/core-coverage-warning-check.mts` | passed | 0 | 0.08s | 600s | Core coverage warning markdown (present, modified: 2026-09-15T15:53:20.799Z, copied: `ci-reports/release/artifacts/core-coverage-warning/report.md`) |
| Public API snapshot | public-api | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm public-api:write -- node --experimental-strip-types scripts/public-api-surface.mts --check` | passed | 0 | 2.53s | 600s | Public API diff markdown (present, modified: 2026-09-15T15:07:32.097Z, copied: `ci-reports/release/artifacts/public-api/public-api-diff.md`)<br>Public API summary JSON (present, modified: 2026-09-15T15:07:32.097Z, copied: `ci-reports/release/artifacts/public-api/public-api-summary.json`) |
| Release-gate maintenance test evidence | quality | `node --experimental-strip-types scripts/test-lane-evidence-check.mts --report ci-reports/package-quality/fast-test-lane.json --lane fast --path scripts/tests/alpha-release-smoke.spec.ts --path scripts/tests/api-docs-trigger-check.spec.ts --path scripts/tests/architecture-policy-check.spec.ts --path scripts/tests/bench-threshold-check.spec.ts --path scripts/tests/benchmark-workflow.spec.ts --path scripts/tests/branch-protection-policy.spec.ts --path scripts/tests/changeset-required-check.spec.ts --path scripts/tests/ci-executable-policy.spec.ts --path scripts/tests/ci-performance-budget.spec.ts --path scripts/tests/ci-verification-identity.spec.ts --path scripts/tests/ci-workflow.spec.ts --path scripts/tests/compiler-baseline-check.spec.ts --path scripts/tests/core-coverage-warning-check.spec.ts --path scripts/tests/create-croco-app-generated-smoke.spec.ts --path scripts/tests/dependency-audit-policy.spec.ts --path scripts/tests/doc-examples-check.spec.ts --path scripts/tests/first-success-verify.spec.ts --path scripts/tests/generated-secret-placeholder-policy.spec.ts --path scripts/tests/live-tests-workflow.spec.ts --path scripts/tests/normalize-packages.spec.ts --path scripts/tests/package-bin-smoke.spec.ts --path scripts/tests/package-docs-check.spec.ts --path scripts/tests/package-entrypoint-smoke.spec.ts --path scripts/tests/package-manifest-contracts.spec.ts --path scripts/tests/package-quality-report.spec.ts --path scripts/tests/package-roles.spec.ts --path scripts/tests/problem-registry.spec.ts --path scripts/tests/production-ready-check.spec.ts --path scripts/tests/provenance-config-check.spec.ts --path scripts/tests/provider-certification-check.spec.ts --path scripts/tests/public-api-surface.spec.ts --path scripts/tests/release-docs-check.spec.ts --path scripts/tests/release-metadata-check.spec.ts --path scripts/tests/release-spine-evidence.spec.ts --path scripts/tests/release-version-sync.spec.ts --path scripts/tests/release-workflow.spec.ts --path scripts/tests/repository-policy-audit-workflow.spec.ts --path scripts/tests/security-allowlist-metadata-check.spec.ts --path scripts/tests/spine-promotion-check.spec.ts --path scripts/tests/static-misuse-check.spec.ts --path scripts/tests/strict-contract-typecheck.spec.ts --path scripts/tests/test-evidence-reconcile.spec.ts --path scripts/tests/test-inventory.spec.ts --path scripts/tests/test-lane-evidence-check.spec.ts --path scripts/tests/test-lane-runner.spec.ts --path scripts/tests/tracked-file-mutation-guard.spec.ts --path scripts/tests/turbo-cache-contract.spec.ts --path scripts/tests/turbo-task-contract.spec.ts --path scripts/tests/verification-change-classifier.spec.ts --path scripts/tests/verification-command.spec.ts --path scripts/tests/verification-manifest.spec.ts --path scripts/tests/verification-policy.spec.ts --path scripts/tests/verify-circular-allowlist.spec.ts` | passed | 0 | 0.13s | 120s | - |
| Spine bundle-size warning report | quality | `node --experimental-strip-types scripts/package-quality-report.mts` | passed | 0 | 1.86s | 600s | Package quality dashboard markdown (present, modified: 2026-09-15T15:50:25.207Z, copied: `ci-reports/release/artifacts/spine-bundle-size/report.md`)<br>Package quality dashboard JSON (present, modified: 2026-09-15T15:50:25.212Z, copied: `ci-reports/release/artifacts/spine-bundle-size/summary.json`)<br>Bundle-size enforcement markdown (present, modified: 2026-09-15T15:50:25.217Z, copied: `ci-reports/release/artifacts/spine-bundle-size/bundle-size.md`) |
| Production dependency audit policy | quality | `node --experimental-strip-types scripts/dependency-audit-policy.mts` | passed | 0 | 9.82s | 600s | - |
| npm provenance configuration | metadata | `node --experimental-strip-types scripts/provenance-config-check.mts` | passed | 0 | 0.20s | 300s | - |
| Publish dry run | metadata | `pnpm -r publish --dry-run --no-git-checks` | passed | 0 | 86.56s | 1800s | - |

## Check details

### Release metadata

- ID: `release-metadata`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/release-metadata-check.mts --allow-pending-changesets`
- Started at: 2026-09-15T15:05:46.232Z
- Completed at: 2026-09-15T15:05:46.354Z
- Duration: 0.12s
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

### Read-only verification policy

- ID: `verification-policy`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Guard or classify the reported verification path -- node --experimental-strip-types scripts/verification-policy.mts`
- Started at: 2026-09-15T15:05:46.236Z
- Completed at: 2026-09-15T15:05:46.991Z
- Duration: 0.76s
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
- Started at: 2026-09-15T15:05:46.356Z
- Completed at: 2026-09-15T15:05:47.057Z
- Duration: 0.70s
- Timeout: 300s
- Failure reason: none

Artifacts:
- Resolved test inventory (required): `ci-reports/package-quality/test-inventory.json` present; modified at 2026-09-15T15:05:46.851Z; copied to `ci-reports/release/artifacts/test-inventory/test-inventory.json`

stdout excerpt:

```text
test inventory valid (810 tests, 1484813ae8aa6cce4dbf0c91e226874e012b4481e25afeaeed296a1f4c9b1027)

```

### Turbo cache reuse and invalidation contract

- ID: `turbo-cache-contract`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/turbo-cache-contract.mts`
- Started at: 2026-09-15T15:05:46.992Z
- Completed at: 2026-09-15T15:06:02.263Z
- Duration: 15.27s
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
- Completed at: 2026-09-15T15:05:47.059Z
- Duration: not collected
- Timeout: not started
- Failure reason: Not applicable to the changed files in this verification context.

Artifacts:
- none

### Changeset requirement

- ID: `changeset-required`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm changeset or revert the publishable change -- node --experimental-strip-types scripts/changeset-required-check.mts --base 1d935c284d8146dff1e576508d498a0a5d2467c1 --head HEAD`
- Started at: 2026-09-15T15:05:47.268Z
- Completed at: 2026-09-15T15:05:47.942Z
- Duration: 0.67s
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
- Started at: 2026-09-15T15:05:47.943Z
- Completed at: 2026-09-15T15:05:51.426Z
- Duration: 3.48s
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
- Started at: 2026-09-15T15:05:51.428Z
- Completed at: 2026-09-15T15:05:52.007Z
- Duration: 0.58s
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
- Started at: 2026-09-15T15:05:52.009Z
- Completed at: 2026-09-15T15:05:53.725Z
- Duration: 1.72s
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
- Started at: 2026-09-15T15:05:53.726Z
- Completed at: 2026-09-15T15:05:54.281Z
- Duration: 0.56s
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
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm problem-registry:write -- node --experimental-strip-types scripts/problem-registry.mts --check --base 1d935c284d8146dff1e576508d498a0a5d2467c1`
- Started at: 2026-09-15T15:05:54.283Z
- Completed at: 2026-09-15T15:06:00.982Z
- Duration: 6.70s
- Timeout: 300s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
Problem registry check passed: 775 codes from 775 discoveries.

```

### Documentation examples

- ID: `docs-examples`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm docs:examples:write -- node --experimental-strip-types scripts/doc-examples-check.mts --check`
- Started at: 2026-09-15T15:06:00.984Z
- Completed at: 2026-09-15T15:06:06.910Z
- Duration: 5.93s
- Timeout: 300s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
doc-examples-check: checked 23 TypeScript documentation examples.

```

### Release documentation

- ID: `release-docs`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported release documentation contract -- node --experimental-strip-types scripts/release-docs-check.mts`
- Started at: 2026-09-15T15:06:02.265Z
- Completed at: 2026-09-15T15:06:02.911Z
- Duration: 0.65s
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
- Started at: 2026-09-15T15:06:02.913Z
- Completed at: 2026-09-15T15:06:04.964Z
- Duration: 2.05s
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
- Started at: 2026-09-15T15:06:04.965Z
- Completed at: 2026-09-15T15:06:05.224Z
- Duration: 0.26s
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
- Started at: 2026-09-15T15:06:05.225Z
- Completed at: 2026-09-15T15:06:23.474Z
- Duration: 18.25s
- Timeout: 600s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
[truncated 5786 chars]
--clean --dts
packages/framework-context build: [34mCLI[39m Building entry: src/index.ts
packages/framework-context build: [34mCLI[39m Using tsconfig: tsconfig.json
packages/framework-context build: [34mCLI[39m tsup v8.5.1
packages/framework-context build: [34mCLI[39m Target: es2017
packages/framework-context build: [34mCLI[39m Cleaning output folder
packages/framework-context build: [34mESM[39m Build start
packages/framework-context build: [34mCJS[39m Build start
packages/framework-context build: [32mESM[39m [1mdist/index.mjs [22m[32m79.96 KB[39m
packages/framework-context build: [32mESM[39m ⚡️ Build success in 137ms
packages/framework-context build: [32mCJS[39m [1mdist/index.js [22m[32m83.25 KB[39m
packages/framework-context build: [32mCJS[39m ⚡️ Build success in 139ms
packages/framework-context build: [34mDTS[39m Build start
packages/framework-context build: [32mDTS[39m ⚡️ Build success in 2484ms
packages/framework-context build: [32mDTS[39m [1mdist/index.d.mts [22m[32m57.07 KB[39m
packages/framework-context build: [32mDTS[39m [1mdist/index.d.ts  [22m[32m57.07 KB[39m
packages/framework-context build: Done
packages/access-core build$ tsup src/index.ts --format esm,cjs --minify --clean --dts
packages/access-core build: [34mCLI[39m Building entry: src/index.ts
packages/access-core build: [34mCLI[39m Using tsconfig: tsconfig.json
packages/access-core build: [34mCLI[39m tsup v8.5.1
packages/access-core build: [34mCLI[39m Target: es2017
packages/access-core build: [34mCLI[39m Cleaning output folder
packages/access-core build: [34mESM[39m Build start
packages/access-core build: [34mCJS[39m Build start
packages/access-core build: [32mESM[39m [1mdist/index.mjs [22m[32m10.40 KB[39m
packages/access-core build: [32mESM[39m ⚡️ Build success in 58ms
packages/access-core build: [32mCJS[39m [1mdist/index.js [22m[32m11.27 KB[39m
packages/access-core build: [32mCJS[39m ⚡️ Build success in 59ms
packages/access-core build: [34mDTS[39m Build start
packages/access-core build: [32mDTS[39m ⚡️ Build success in 1560ms
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
packages/tenant-core build: [32mCJS[39m [1mdist/index.js        [22m[32m28.75 KB[39m
packages/tenant-core build: [32mCJS[39m [1mdist/tenant-model.js [22m[32m13.71 KB[39m
packages/tenant-core build: [32mCJS[39m ⚡️ Build success in 66ms
packages/tenant-core build: [32mESM[39m [1mdist/index.mjs          [22m[32m14.77 KB[39m
packages/tenant-core build: [32mESM[39m [1mdist/tenant-model.mjs   [22m[32m659.00 B[39m
packages/tenant-core build: [32mESM[39m [1mdist/chunk-MQ7AVEXI.mjs [22m[32m12.73 KB[39m
packages/tenant-core build: [32mESM[39m ⚡️ Build success in 68ms
packages/tenant-core build: [34mDTS[39m Build start
packages/tenant-core build: [32mDTS[39m ⚡️ Build success in 2185ms
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
- Started at: 2026-09-15T15:06:23.475Z
- Completed at: 2026-09-15T15:06:26.627Z
- Duration: 3.15s
- Timeout: 600s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
architecture-policy: passed for 6190 import(s) across 122 package(s)
architecture-policy: package catalog group consistency passed for 120 public package(s)

```

### Architecture circular allowlist

- ID: `architecture-circular-allowlist`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Update code or intentionally update the circular dependency allowlist -- node --experimental-strip-types scripts/verify-circular-allowlist.mts`
- Started at: 2026-09-15T15:06:06.912Z
- Completed at: 2026-09-15T15:06:21.662Z
- Duration: 14.75s
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
- Started at: 2026-09-15T15:06:21.663Z
- Completed at: 2026-09-15T15:06:22.333Z
- Duration: 0.67s
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
- Started at: 2026-09-15T15:06:22.334Z
- Completed at: 2026-09-15T15:06:26.772Z
- Duration: 4.44s
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
- Started at: 2026-09-15T15:06:26.628Z
- Completed at: 2026-09-15T15:06:27.199Z
- Duration: 0.57s
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
- Started at: 2026-09-15T15:06:26.774Z
- Completed at: 2026-09-15T15:06:27.376Z
- Duration: 0.60s
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
- Started at: 2026-09-15T15:06:27.200Z
- Completed at: 2026-09-15T15:06:34.314Z
- Duration: 7.11s
- Timeout: 600s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
decorator-signature-spike: TypeScript 6 legacy decorator feasibility verified
decorator-signature-spike: 30 negative assertions fail with broad signatures; inheritance limitation compiled as documented
decorator-signature-spike: overload declaration snapshot and strict/loose packed ESM/CJS consumer passed
decorator-signature-spike: broad 579 instantiations / 0.06s check, strict 26106 instantiations / 0.34s check
decorator-signature-spike: strict instantiation delta 25527 within 250000 budget

```

### Strict contract typecheck

- ID: `strict-contract-typecheck`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported strict contract diagnostic -- node --experimental-strip-types scripts/strict-contract-typecheck.mts`
- Started at: 2026-09-15T15:06:27.377Z
- Completed at: 2026-09-15T15:07:28.858Z
- Duration: 61.48s
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
strict-contract-typecheck: accepted baseline diagnostics 447
strict-contract-typecheck: diagnostics added 0, removed 0, unchanged 447
strict-contract-typecheck: staged rollout deferrals 13 (@croco/framework-context, @croco/problems-core, @croco/protocols-rest, @croco/openapi-spec, @croco/transports-http, @croco/tx-core, @croco/events-core, @croco/events-tx, @croco/retry-core, @croco/idempotency-core, @croco/testing, create-croco-app, @croco/cli)
strict-contract-typecheck: accepted release debt deferrals 0 (<empty>)
strict-contract-typecheck: baseline matched

```

### Static misuse

- ID: `static-misuse`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported source misuse -- node --experimental-strip-types scripts/static-misuse-check.mts`
- Started at: 2026-09-15T15:06:34.316Z
- Completed at: 2026-09-15T15:06:45.686Z
- Duration: 11.37s
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
- Started at: 2026-09-15T15:06:45.687Z
- Completed at: 2026-09-15T15:06:47.852Z
- Duration: 2.17s
- Timeout: 900s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
::warning file=packages/frontend-cloudflare/src/tests/CloudflareSsrHandler.spec.ts,line=125,endLine=125,col=11,endColumn=15,title=unicorn(no-invalid-fetch-options)::"body" is not allowed when method is "GET"
::warning file=packages/telemetry-api/src/tests/Trace.spec.ts,line=137,endLine=137,col=74,endColumn=78,title=unicorn(no-thenable)::Do not add `then` to an object.
::warning file=packages/telemetry-api/src/tests/Trace.spec.ts,line=237,endLine=237,col=41,endColumn=45,title=unicorn(no-thenable)::Do not add `then` to an object.
::warning file=packages/telemetry-api/src/tests/Trace.spec.ts,line=238,endLine=238,col=17,endColumn=21,title=unicorn(no-thenable)::Do not add `then` to an object.
::warning file=scripts/security-allowlist-metadata-check.mts,line=1042,endLine=1042,col=14,endColumn=16,title=eslint(no-control-regex)::Unexpected control character

Found 5 warnings and 0 errors.
Finished in 1.7s on 2577 files with 116 rules using 4 threads.

```

### Format

- ID: `format`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `pnpm exec oxfmt --check . --ignore-path=.gitignore --ignore-path=.prettierignore --ignore-path=.oxfmtignore`
- Started at: 2026-09-15T15:06:47.854Z
- Completed at: 2026-09-15T15:06:56.171Z
- Duration: 8.32s
- Timeout: 900s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
Checking formatting...

All matched files use the correct format.
Finished in 7626ms on 3885 files using 4 threads.

```

### Architecture circular dependencies

- ID: `architecture-circular`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported circular dependency -- pnpm exec madge --circular --extensions ts packages`
- Started at: 2026-09-15T15:06:56.173Z
- Completed at: 2026-09-15T15:07:09.930Z
- Duration: 13.76s
- Timeout: 600s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
Processed 2332 files (12.7s) (117 warnings)



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
- Started at: 2026-09-15T15:07:09.932Z
- Completed at: 2026-09-15T15:07:27.631Z
- Duration: 17.70s
- Timeout: 600s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
[truncated 10414 chars]
 benchmarks[2m > [22m[2mEventPublisher.publishNow single event[22m

  should resolve 10 handlers[2m - packages/events-core/src/tests/EventBus.bench.ts[2m > [22m[2mEventBus benchmarks[2m > [22m[2mDefaultHandlerResolver.resolve × 10[22m

  Container.get singleton (cold)[2m - packages/framework-context/src/tests/Container.bench.ts[2m > [22m[2mContainer.get singleton (cold)[22m

  register 50 singletons[2m - packages/framework-context/src/tests/Container.bench.ts[2m > [22m[2mContainer.register × 50 components[22m

  Container.validate (50 components)[2m - packages/framework-context/src/tests/Container.bench.ts[2m > [22m[2mContainer.validate (50 components)[22m

  Container.get singleton (warm)[2m - packages/framework-context/src/tests/Container.bench.ts[2m > [22m[2mContainer.get singleton (warm)[22m

  lambdaPreset config creation[2m - packages/telemetry-sdk-node/src/tests/TelemetryRuntime.bench.ts[2m > [22m[2mTelemetryRuntime benchmarks[22m
[32m    9.34x [39m[90mfaster than [39mTelemetryRuntime.init (lambda preset)

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
║ CrocoApp constructor           p75: 43.0μs     threshold: 30
║ CrocoApp lambdaHandler (10 controllers) p75: 1.5ms      thre
║ Lambda cold-start simulation   p75: 1.6ms      threshold: 80
║ Lambda cold-start with headers p75: 1.5ms      threshold: 80
║ Lambda cold-start with binary body p75: 1.5ms      threshold
║ Lambda cold-start with query params p75: 1.4ms      threshol
║ Lambda cold-start with authorizer context p75: 1.5ms      th
║ Lambda cold-start realistic scenario p75: 1.4ms      thresho
║ EventBusConfig.start (10 handlers) p75: 2.0μs      threshold
║ EventPublisher.publishNow single event p75: 2.0μs      thres
║ DefaultHandlerResolver.resolve × 10 p75: 0.1μs      threshol
║ Container.get singleton (cold) p75: 64.3μs     threshold: 5.
║ Container.register × 50 components p75: 2.8ms      threshold
║ Container.validate (50 components) p75: 3.3ms      threshold
║ Container.get singleton (warm) p75: 1.4μs      threshold: 50
║ TelemetryRuntime.init (lambda preset) p75: 12.2μs     thresh
║ lambdaPreset config creation   p75: 1.5μs      threshold: 2.
╠══════════════════════════════════════════════════════════╣
║ Result: ALL PASSED                                         ║
╚══════════════════════════════════════════════════════════╝


```

stderr excerpt:

```text
⚠️  Baseline drift for "CrocoApp constructor": p75 43.0μs exceeds baseline 8.2μs by 34.9μs (+426.3%).
⚠️  Baseline drift for "CrocoApp lambdaHandler (10 controllers)": p75 1.5ms exceeds baseline 258.4μs by 1.2ms (+470.1%).
⚠️  Baseline drift for "Lambda cold-start simulation": p75 1.6ms exceeds baseline 418.1μs by 1.2ms (+275.8%).
⚠️  Baseline drift for "Lambda cold-start with headers": p75 1.5ms exceeds baseline 369.7μs by 1.1ms (+294.8%).
⚠️  Baseline drift for "Lambda cold-start with binary body": p75 1.5ms exceeds baseline 339.1μs by 1.1ms (+338.0%).
⚠️  Baseline drift for "Lambda cold-start with query params": p75 1.4ms exceeds baseline 301.3μs by 1.1ms (+366.0%).
⚠️  Baseline drift for "Lambda cold-start with authorizer context": p75 1.5ms exceeds baseline 299.8μs by 1.2ms (+384.3%).
⚠️  Baseline drift for "Lambda cold-start realistic scenario": p75 1.4ms exceeds baseline 299.2μs by 1.1ms (+383.3%).
⚠️  Baseline drift for "EventBusConfig.start (10 handlers)": p75 2.0μs exceeds baseline 1.4μs by 0.6μs (+39.8%).

```

### Affected build

- ID: `build`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `pnpm turbo run build --filter=@croco/problems-core --filter=@croco/diagnostics-core --filter=@croco/framework-context --filter=@croco/protocols-core --filter=@croco/protocols-rest --summarize --continue=always`
- Started at: 2026-09-15T15:07:27.633Z
- Completed at: 2026-09-15T15:07:44.454Z
- Duration: 16.82s
- Timeout: 1800s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
[truncated 926 chars]
 [22m[32m1.02 MB[39m
::endgroup::
::group::@croco/health-core:build
cache miss, executing cbcc991566806dc3
$ tsup src/index.ts --format esm,cjs --minify --clean --dts
[34mCLI[39m Building entry: src/index.ts
[34mCLI[39m Using tsconfig: tsconfig.json
[34mCLI[39m tsup v8.5.1
[34mCLI[39m Target: es2017
[34mCLI[39m Cleaning output folder
[34mESM[39m Build start
[34mCJS[39m Build start
[32mCJS[39m [1mdist/index.js [22m[32m5.34 KB[39m
[32mCJS[39m ⚡️ Build success in 56ms
[32mESM[39m [1mdist/index.mjs [22m[32m4.77 KB[39m
[32mESM[39m ⚡️ Build success in 56ms
[34mDTS[39m Build start
[32mDTS[39m ⚡️ Build success in 1630ms
[32mDTS[39m [1mdist/index.d.mts [22m[32m5.23 KB[39m
[32mDTS[39m [1mdist/index.d.ts  [22m[32m5.23 KB[39m
::endgroup::
::group::@croco/protocols-core:build
cache miss, executing 4dc5c54e1f2ef8fd
$ tsup src/index.ts --format esm,cjs --minify --clean --dts
[34mCLI[39m Building entry: src/index.ts
[34mCLI[39m Using tsconfig: tsconfig.json
[34mCLI[39m tsup v8.5.1
[34mCLI[39m Target: es2017
[34mCLI[39m Cleaning output folder
[34mESM[39m Build start
[34mCJS[39m Build start
[32mESM[39m [1mdist/index.mjs [22m[32m95.40 KB[39m
[32mESM[39m ⚡️ Build success in 212ms
[32mCJS[39m [1mdist/index.js [22m[32m97.46 KB[39m
[32mCJS[39m ⚡️ Build success in 214ms
[34mDTS[39m Build start
[32mDTS[39m ⚡️ Build success in 2845ms
[32mDTS[39m [1mdist/index.d.mts [22m[32m39.86 KB[39m
[32mDTS[39m [1mdist/index.d.ts  [22m[32m39.86 KB[39m
::endgroup::
::group::@croco/diagnostics-core:build
cache miss, executing a2e83bba734f2208
$ tsup src/index.ts --format esm,cjs --minify --clean --dts
[34mCLI[39m Building entry: src/index.ts
[34mCLI[39m Using tsconfig: tsconfig.json
[34mCLI[39m tsup v8.5.1
[34mCLI[39m Target: es2017
[34mCLI[39m Cleaning output folder
[34mESM[39m Build start
[34mCJS[39m Build start
[32mESM[39m [1mdist/index.mjs [22m[32m49.25 KB[39m
[32mESM[39m ⚡️ Build success in 89ms
[32mCJS[39m [1mdist/index.js [22m[32m50.08 KB[39m
[32mCJS[39m ⚡️ Build success in 90ms
[34mDTS[39m Build start
[32mDTS[39m ⚡️ Build success in 2012ms
[32mDTS[39m [1mdist/index.d.mts [22m[32m22.90 KB[39m
[32mDTS[39m [1mdist/index.d.ts  [22m[32m22.90 KB[39m
::endgroup::
::group::@croco/framework-context:build
cache miss, executing c5b472648b4c87a5
$ tsup src/index.ts --format esm,cjs --minify --clean --dts
[34mCLI[39m Building entry: src/index.ts
[34mCLI[39m Using tsconfig: tsconfig.json
[34mCLI[39m tsup v8.5.1
[34mCLI[39m Target: es2017
[34mCLI[39m Cleaning output folder
[34mESM[39m Build start
[34mCJS[39m Build start
[32mCJS[39m [1mdist/index.js [22m[32m83.25 KB[39m
[32mCJS[39m ⚡️ Build success in 118ms
[32mESM[39m [1mdist/index.mjs [22m[32m79.96 KB[39m
[32mESM[39m ⚡️ Build success in 125ms
[34mDTS[39m Build start
[32mDTS[39m ⚡️ Build success in 2532ms
[32mDTS[39m [1mdist/index.d.mts [22m[32m57.07 KB[39m
[32mDTS[39m [1mdist/index.d.ts  [22m[32m57.07 KB[39m
::endgroup::
::group::@croco/protocols-rest:build
cache miss, executing abeddc3e3f1af0bf
$ tsup src/index.ts --format esm,cjs --minify --clean --dts
[34mCLI[39m Building entry: src/index.ts
[34mCLI[39m Using tsconfig: tsconfig.json
[34mCLI[39m tsup v8.5.1
[34mCLI[39m Target: es2017
[34mCLI[39m Cleaning output folder
[34mESM[39m Build start
[34mCJS[39m Build start
[32mCJS[39m [1mdist/index.js [22m[32m21.96 KB[39m
[32mCJS[39m ⚡️ Build success in 76ms
[32mESM[39m [1mdist/index.mjs [22m[32m20.24 KB[39m
[32mESM[39m ⚡️ Build success in 77ms
[34mDTS[39m Build start
[32mDTS[39m ⚡️ Build success in 2127ms
[32mDTS[39m [1mdist/index.d.mts [22m[32m32.94 KB[39m
[32mDTS[39m [1mdist/index.d.ts  [22m[32m32.94 KB[39m
::endgroup::

  Tasks:    6 successful, 6 total
 Cached:    0 cached, 6 total
   Time:    16.41s 
Summary:    /home/runner/work/framework/framework/.turbo/runs/3JMxiKpGskyziyQProRxqIz0u7a.json


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
- Completed at: 2026-09-15T15:07:44.455Z
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
- Completed at: 2026-09-15T15:07:44.457Z
- Duration: not collected
- Timeout: not started
- Failure reason: Not applicable to the changed files in this verification context.

Artifacts:
- none

### Package entrypoint smoke

- ID: `package-entrypoints-smoke`
- Status: not_applicable
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/package-entrypoint-smoke.mts --build-missing`
- Started at: not started
- Completed at: 2026-09-15T15:36:25.583Z
- Duration: not collected
- Timeout: not started
- Failure reason: Not applicable to the changed files in this verification context.

Artifacts:
- none

### Package binary smoke

- ID: `package-bins-smoke`
- Status: not_applicable
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/package-bin-smoke.mts`
- Started at: not started
- Completed at: 2026-09-15T15:07:44.457Z
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
- Started at: 2026-09-15T15:07:44.462Z
- Completed at: 2026-09-15T15:31:13.460Z
- Duration: 1409.00s
- Timeout: 2700s
- Failure reason: none

Artifacts:
- Spine-blocking generated app smoke matrix markdown (required): `ci-reports/generated-apps/spine-blocking-matrix.md` present; modified at 2026-09-15T15:31:06.053Z; copied to `ci-reports/release/artifacts/generated-app-smoke/spine-blocking-matrix.md`
- Spine-blocking generated app smoke matrix JSON (required): `ci-reports/generated-apps/spine-blocking-matrix.json` present; modified at 2026-09-15T15:31:06.053Z; copied to `ci-reports/release/artifacts/generated-app-smoke/spine-blocking-matrix.json`
- Generated app smoke journey bundle (optional): `ci-reports/generated-apps/spine-blocking-journeys` missing
- Generated test materialization evidence (required): `ci-reports/generated-apps/materialization-evidence.json` present; modified at 2026-09-15T15:31:06.053Z; copied to `ci-reports/release/artifacts/generated-app-smoke/materialization-evidence.json`
- Generated test materializations (required): `ci-reports/generated-apps/materialized-tests` present; modified at 2026-09-15T15:14:13.583Z; copied to `ci-reports/release/artifacts/generated-app-smoke/materialized-tests`

stdout excerpt:

```text
[truncated 11274 chars]
starter test passed
create-croco-app-generated-smoke: admin-console-starter typecheck passed
create-croco-app-generated-smoke: admin-console-starter build passed
create-croco-app-generated-smoke: admin-console-starter built Node host smoke passed
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
- Started at: 2026-09-15T15:07:44.458Z
- Completed at: 2026-09-15T15:08:25.834Z
- Duration: 41.38s
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
- Completed at: 2026-09-15T15:31:13.465Z
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
- Started at: 2026-09-15T15:31:13.481Z
- Completed at: 2026-09-15T15:36:25.582Z
- Duration: 312.10s
- Timeout: 1800s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
[truncated 118585 chars]
nboarding-drizzle:typecheck
cache miss, executing 514cb76c03fabb2c
$ tsc --noEmit
::endgroup::
::group::@croco/storage-cloudflare:typecheck
cache miss, executing 4232f7390050ff48
$ tsc --noEmit
::endgroup::
::group::@croco/storage-r2:typecheck
cache miss, executing 430f33af30f4f2c8
$ tsc --noEmit
::endgroup::
::group::@croco/audit-drizzle:typecheck
cache miss, executing 3c8c6c75b3c3117d
$ tsc --noEmit
::endgroup::
::group::@croco/auth-better-auth:typecheck
cache miss, executing b244d57a91e5b186
$ tsc --noEmit
::endgroup::
::group::@croco/ratelimit-upstash:typecheck
cache miss, executing d1d83a89b5d43f25
$ tsc --noEmit
::endgroup::
::group::@croco/auth-drizzle:typecheck
cache miss, executing 2c30c3fb9ffde407
$ tsc --noEmit
::endgroup::
::group::@croco/auth-clerk:typecheck
cache miss, executing d3ab49080b822d85
$ tsc --noEmit
::endgroup::
::group::@croco/frontend-cloudflare:typecheck
cache miss, executing d2a31065194201c3
$ tsc --noEmit
::endgroup::
::group::@croco/access-drizzle:typecheck
cache miss, executing ebd9044ea5900b75
$ tsc --noEmit
::endgroup::
::group::@croco/ui-astryx:typecheck
cache miss, executing db7ab6d5c927bd6e
$ tsc --noEmit
::endgroup::
::group::@croco/tasks-qstash:typecheck
cache miss, executing ddbdb23e86d75b42
$ tsc --noEmit
::endgroup::
::group::@croco/telemetry-sdk-node:typecheck
cache miss, executing 12a36819290a20f0
$ tsc --noEmit
::endgroup::
::group::@croco/notifications-resend:typecheck
cache miss, executing 28d9d8ce276f2d0a
$ tsc --noEmit
::endgroup::
::group::@croco/engagement-core:typecheck
cache miss, executing d1fbc96136ea332f
$ tsc --noEmit
::endgroup::
::group::@croco/cli:typecheck
cache miss, executing 1420cbf0c4a468bb
$ tsc --noEmit
::endgroup::
::group::create-croco-app:typecheck
cache miss, executing 8ecc067d69f22ad8
$ tsc --noEmit
::endgroup::
::group::@croco/notifications-react-email:typecheck
cache miss, executing a2cf0678e4f5d394
$ tsc --noEmit
::endgroup::
::group::@croco/engagement-drizzle:typecheck
cache miss, executing bde4412a92a3a639
$ tsc --noEmit
::endgroup::
::group::@croco/testing-resources:typecheck
cache miss, executing dd9834b469b9137e
$ tsc --noEmit
::endgroup::
::group::@croco/metrics-core:typecheck
cache miss, executing 3730871fe55c677f
$ tsc --noEmit
::endgroup::
::group::@croco/metering-core:typecheck
cache miss, executing 49648342477660d7
$ tsc --noEmit
::endgroup::
::group::@croco/metrics-billing:typecheck
cache miss, executing b3559928ab139ef3
$ tsc --noEmit
::endgroup::
::group::@croco/metering-upstash:typecheck
cache miss, executing 1c91eb6285daab03
$ tsc --noEmit
::endgroup::
::group::@croco/entitlements-core:typecheck
cache miss, executing f2cbfd1b127cc77b
$ tsc --noEmit
::endgroup::
::group::@croco/llm-metering:typecheck
cache miss, executing ce50bfa824b7d6a8
$ tsc --noEmit
::endgroup::
::group::@croco/metering-drizzle:typecheck
cache miss, executing e42c11941ab64204
$ tsc --noEmit
::endgroup::
::group::@croco/membership-core:typecheck
cache miss, executing bde230f5427ed69d
$ tsc --noEmit
::endgroup::
::group::@croco/billing-polar:typecheck
cache miss, executing 901ddb8874282c9c
$ tsc --noEmit
::endgroup::
::group::@croco/entitlements-drizzle:typecheck
cache miss, executing 19f3717208a7a826
$ tsc --noEmit
::endgroup::
::group::@croco/invitation-core:typecheck
cache miss, executing 7b4c4a44d267056e
$ tsc --noEmit
::endgroup::
::group::@croco/admin-react:typecheck
cache miss, executing 973837a7edd7ec19
$ tsc --noEmit
::endgroup::
::group::@croco/membership-drizzle:typecheck
cache miss, executing 4b5ad1ffac4dff1f
$ tsc --noEmit
::endgroup::
::group::@croco-example/saas-billing-golden-path:typecheck
cache miss, executing 0065f96b5b050e96
$ tsc --noEmit
::endgroup::
::group::@croco/invitation-drizzle:typecheck
cache miss, executing a0929cebfbaadea5
$ tsc --noEmit
::endgroup::

  Tasks:    243 successful, 243 total
 Cached:    89 cached, 243 total
   Time:    5m11.363s 
Summary:    /home/runner/work/framework/framework/.turbo/runs/3JN1CbhbwJOFU5PHD7x5ATJutgm.json


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
- Started at: 2026-09-15T15:36:25.585Z
- Completed at: 2026-09-15T15:44:07.797Z
- Duration: 462.21s
- Timeout: 2700s
- Failure reason: none

Artifacts:
- Fast test lane evidence (required): `ci-reports/package-quality/fast-test-lane.json` present; modified at 2026-09-15T15:44:07.789Z; copied to `ci-reports/release/artifacts/test/fast-test-lane.json`

stdout excerpt:

```text
[truncated 169289 chars]
ramework/packages/membership-core/.turbo/croco-test-evidence.json
::endgroup::
::group::@croco/admin-react:test:evidence
cache miss, executing f5de6dd650cc1c3a
$ pnpm run test --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
$ vitest run --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
JSON report written to /home/runner/work/framework/framework/packages/admin-react/.turbo/croco-test-evidence.json
::endgroup::
::group::@croco/invitation-drizzle:build
cache hit, replaying logs b7d43c1ab38ff129
$ tsup src/index.ts --format esm,cjs --minify --clean --dts
[34mCLI[39m Building entry: src/index.ts
[34mCLI[39m Using tsconfig: tsconfig.json
[34mCLI[39m tsup v8.5.1
[34mCLI[39m Target: es2017
[34mCLI[39m Cleaning output folder
[34mESM[39m Build start
[34mCJS[39m Build start
[32mCJS[39m [1mdist/index.js [22m[32m26.51 KB[39m
[32mCJS[39m ⚡️ Build success in 353ms
[32mESM[39m [1mdist/index.mjs [22m[32m24.35 KB[39m
[32mESM[39m ⚡️ Build success in 356ms
[34mDTS[39m Build start
[32mDTS[39m ⚡️ Build success in 24459ms
[32mDTS[39m [1mdist/index.d.mts [22m[32m37.81 KB[39m
[32mDTS[39m [1mdist/index.d.ts  [22m[32m37.81 KB[39m
::endgroup::
::group::@croco/entitlements-drizzle:test:evidence
cache miss, executing 7cf90a130ff37854
$ pnpm run test --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
$ vitest run --exclude src/tests/LegacyEntitlementRules.postgres.spec.ts --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
JSON report written to /home/runner/work/framework/framework/packages/entitlements-drizzle/.turbo/croco-test-evidence.json
::endgroup::
::group::@croco/invitation-core:test:evidence
cache miss, executing 7bbd9feb30780ff2
$ pnpm run test --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
$ vitest run --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
JSON report written to /home/runner/work/framework/framework/packages/invitation-core/.turbo/croco-test-evidence.json
::endgroup::
::group::@croco-example/saas-billing-golden-path:test:evidence
cache miss, executing 8f4c014aecd5463f
$ pnpm run test --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
$ vitest run src/tests --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
JSON report written to /home/runner/work/framework/framework/examples/saas-billing-golden-path/.turbo/croco-test-evidence.json
::endgroup::
::group::@croco/membership-drizzle:test:evidence
cache miss, executing 4f44074a7b143ebe
$ pnpm run test --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
$ vitest run --exclude src/tests/DrizzleMembershipStore.postgres.spec.ts --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
JSON report written to /home/runner/work/framework/framework/packages/membership-drizzle/.turbo/croco-test-evidence.json
::endgroup::
::group::@croco/invitation-drizzle:test:evidence
cache miss, executing 2ce68aef1983cc03
$ pnpm run test --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
$ vitest run --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
JSON report written to /home/runner/work/framework/framework/packages/invitation-drizzle/.turbo/croco-test-evidence.json
::endgroup::
::group::@croco/cli:test:evidence
cache miss, executing 3ae4eff2b5f3dace
$ pnpm run test --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
$ vitest run --exclude "src/tests/integration/**" --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
JSON report written to /home/runner/work/framework/framework/packages/cli/.turbo/croco-test-evidence.json
::endgroup::

  Tasks:    241 successful, 241 total
 Cached:    124 cached, 241 total
   Time:    3m28.442s 
Summary:    /home/runner/work/framework/framework/.turbo/runs/3JN1cxmhkprSJA9NAyqj70v3FX5.json


```

stderr excerpt:

```text
[truncated 1296 chars]
ch <name>
hint:
hint: Names commonly chosen instead of 'master' are 'main', 'trunk' and
hint: 'development'. The just-created branch can be renamed via this command:
hint:
hint: 	git branch -m <name>
hint:
hint: Disable this message with "git config set advice.defaultBranchName false"
Switched to a new branch 'pull-request'
HEAD is now at 77f4d54 base
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
HEAD is now at 0d7ae51 base
Warning: you are leaving 1 commit behind, not connected to
any of your branches:

  82c448b Merge commit 'b952e5bbaaae8acfe5dd5f13f47c752be49383a5' into HEAD

If you want to keep it by creating a new branch, this may be a good time
to do so with:

 git branch <new-branch-name> 82c448b

Switched to branch 'trunk'
HEAD is now at 82c448b Merge commit 'b952e5bbaaae8acfe5dd5f13f47c752be49383a5' into HEAD
Switched to a new branch 'pull-request'
Switched to branch 'trunk'
Switched to a new branch 'pull-request'
HEAD is now at 0d7ae51 base
Warning: you are leaving 1 commit behind, not connected to
any of your branches:

  82c448b Merge commit 'b952e5bbaaae8acfe5dd5f13f47c752be49383a5' into HEAD

If you want to keep it by creating a new branch, this may be a good time
to do so with:

 git branch <new-branch-name> 82c448b

HEAD is now at 0d7ae51 base
Warning: you are leaving 1 commit behind, not connected to
any of your branches:

  787137e divergent

If you want to keep it by creating a new branch, this may be a good time
to do so with:

 git branch <new-branch-name> 787137e

HEAD is now at 82c448b Merge commit 'b952e5bbaaae8acfe5dd5f13f47c752be49383a5' into HEAD
Switched to a new branch 'pull-request'
HEAD is now at 0d7ae51 base
Warning: you are leaving 1 commit behind, not connected to
any of your branches:

  82c448b Merge commit 'b952e5bbaaae8acfe5dd5f13f47c752be49383a5' into HEAD

If you want to keep it by creating a new branch, this may be a good time
to do so with:

 git branch <new-branch-name> 82c448b

Switched to branch 'trunk'
HEAD is now at 82c448b Merge commit 'b952e5bbaaae8acfe5dd5f13f47c752be49383a5' into HEAD
Switched to a new branch 'pull-request'
HEAD is now at 0d7ae51 base
Warning: you are leaving 1 commit behind, not connected to
any of your branches:

  9ecceab Merge commit '1abfe80bea486fd8009e4e81cf0d7ea7561ec27a' into HEAD

If you want to keep it by creating a new branch, this may be a good time
to do so with:

 git branch <new-branch-name> 9ecceab

HEAD is now at 1abfe80 head
Switched to a new branch 'pull-request'
HEAD is now at 94c60c0 base
Warning: you are leaving 1 commit behind, not connected to
any of your branches:

  88db0d7 Merge commit '7a65a6d941e6b48e54caadf9583356449a10ea20' into HEAD

If you want to keep it by creating a new branch, this may be a good time
to do so with:

 git branch <new-branch-name> 88db0d7

HEAD is now at 7a65a6d head
Switched to a new branch 'pull-request'
HEAD is now at 94c60c0 base
Switched to a new branch 'pull-request'
HEAD is now at 94c60c0 base
Warning: you are leaving 1 commit behind, not connected to
any of your branches:

  88db0d7 Merge commit '7a65a6d941e6b48e54caadf9583356449a10ea20' into HEAD

If you want to keep it by creating a new branch, this may be a good time
to do so with:

 git branch <new-branch-name> 88db0d7

HEAD is now at 7a65a6d head

```

### Inventory integration test lane

- ID: `integration-test-lane`
- Status: passed
- Selection reason: Selected for the full integration inventory.
- Command: `node --experimental-strip-types scripts/test-lane-runner.mts --lane integration --output ci-reports/package-quality/integration-test-lane.json`
- Started at: 2026-09-15T15:44:07.799Z
- Completed at: 2026-09-15T15:49:19.301Z
- Duration: 311.50s
- Timeout: 1800s
- Failure reason: none

Artifacts:
- Integration test lane evidence (required): `ci-reports/package-quality/integration-test-lane.json` present; modified at 2026-09-15T15:49:19.294Z; copied to `ci-reports/release/artifacts/integration-test-lane/integration-test-lane.json`

stdout excerpt:

```text
JSON report written to /tmp/croco-test-lane-zQIKoh/vitest.json
JSON report written to /tmp/croco-test-lane-boYaMx/vitest.json
JSON report written to /tmp/croco-test-lane-MYZVoz/vitest.json

Running 1 test using 1 worker
·
  1 passed (3.1m)
JSON report written to /tmp/croco-test-lane-8TvPph/vitest.json
JSON report written to /tmp/croco-test-lane-Hqb1oz/vitest.json
JSON report written to /tmp/croco-test-lane-0K0GRS/vitest.json

```

stderr excerpt:

```text
$ vitest run src/tests/Integration.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-zQIKoh/vitest.json
$ vitest run src/tests/integration/CliCommandIntegration.spec.ts src/tests/integration/e2e.spec.ts src/tests/integration/jobs-e2e.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-boYaMx/vitest.json
$ vitest run src/tests/E2E.spec.ts src/tests/e2e-advanced.spec.ts src/tests/e2e-vite-spa.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-MYZVoz/vitest.json
$ playwright test e2e/verify-starlight.spec.ts --reporter=json
$ vitest run src/__tests__/e2e.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-8TvPph/vitest.json
$ vitest run src/tests/e2e.spec.ts src/tests/real-app.e2e.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-Hqb1oz/vitest.json
$ vitest run src/tests/TaskRunner.integration.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-0K0GRS/vitest.json

```

### Inventory published-consumer test lane

- ID: `published-test-lane`
- Status: passed
- Selection reason: Selected for the full published-consumer inventory.
- Command: `node --experimental-strip-types scripts/test-lane-runner.mts --lane published --output ci-reports/package-quality/published-test-lane.json`
- Started at: 2026-09-15T15:49:19.302Z
- Completed at: 2026-09-15T15:50:20.345Z
- Duration: 61.04s
- Timeout: 2700s
- Failure reason: none

Artifacts:
- Published-consumer test lane evidence (required): `ci-reports/package-quality/published-test-lane.json` present; modified at 2026-09-15T15:50:20.338Z; copied to `ci-reports/release/artifacts/published-test-lane/published-test-lane.json`

stdout excerpt:

```text
JSON report written to /tmp/croco-test-lane-5o2G06/vitest.json
JSON report written to /tmp/croco-test-lane-2vMZUP/vitest.json
JSON report written to /tmp/croco-test-lane-dZa3B4/vitest.json
JSON report written to /tmp/croco-test-lane-1vPYvN/vitest.json
JSON report written to /tmp/croco-test-lane-ep3EEx/vitest.json
JSON report written to /tmp/croco-test-lane-ASfli2/vitest.json
JSON report written to /tmp/croco-test-lane-8fgMCU/vitest.json
JSON report written to /tmp/croco-test-lane-LT85tx/vitest.json
JSON report written to /tmp/croco-test-lane-aX3nPG/vitest.json
JSON report written to /tmp/croco-test-lane-gqB8jj/vitest.json
JSON report written to /tmp/croco-test-lane-Ck2x6T/vitest.json
JSON report written to /tmp/croco-test-lane-FDR7jV/vitest.json
JSON report written to /tmp/croco-test-lane-Taceh9/vitest.json

```

stderr excerpt:

```text
$ vitest run src/tests/PublishedCli.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-5o2G06/vitest.json
$ vitest run src/tests/PublishedMessageContracts.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-2vMZUP/vitest.json
$ vitest run src/tests/PublishedTypes.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-dZa3B4/vitest.json
$ vitest run src/tests/published-contract.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-1vPYvN/vitest.json
$ vitest run src/tests/PublishedCli.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-ep3EEx/vitest.json
$ vitest run src/tests/PublishedReactEmail.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-ASfli2/vitest.json
$ vitest run src/tests/PublishedPolicyTypes.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-8fgMCU/vitest.json
$ vitest run src/tests/PublishedCli.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-LT85tx/vitest.json
$ vitest run src/tests/PublishedSearchable.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-aX3nPG/vitest.json
$ vitest run src/tests/PublishedTypes.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-gqB8jj/vitest.json
$ vitest run src/tests/PublishedTypes.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-Ck2x6T/vitest.json
$ vitest run src/tests/PublishedWorkerTypes.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-FDR7jV/vitest.json
$ vitest run src/tests/PublishedListen.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-Taceh9/vitest.json

```

### Enforced test execution evidence

- ID: `test-evidence-reconcile`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/test-evidence-reconcile.mts --profile publish --lane-report ci-reports/package-quality/fast-test-lane.json --lane-report ci-reports/package-quality/integration-test-lane.json --lane-report ci-reports/package-quality/published-test-lane.json --materialization-evidence ci-reports/generated-apps/materialization-evidence.json --generated-root ci-reports/generated-apps/materialized-tests --required-generated-path packages/create-croco-app/templates/admin-console/apps/api-server/src/tests/AdminConsole.spec.ts --required-generated-path packages/create-croco-app/templates/admin-console/apps/api-server/src/tests/CreditOperations.spec.ts --required-generated-path packages/create-croco-app/templates/admin-console/tests/journeys/plan-release.spec.ts --required-generated-path packages/create-croco-app/templates/ai-saas/apps/api-server/src/tests/AiSaas.spec.ts --required-generated-path packages/create-croco-app/templates/base-ddd/libs/shared/utils-env/src/tests/createEnv.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/ContractFuzz.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/ExecutableAssurance.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/FileBillableUsageJournal.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/FileUsageBillingGateway.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/ProviderProfileEnv.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/SaasDemo.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/node-lifecycle.spec.ts --required-generated-path packages/create-croco-app/templates/spa-be-split/apps/api-server/src/tests/app.spec.ts --required-generated-path packages/create-croco-app/templates/spa-be-split/apps/api-server/src/tests/node-lifecycle.spec.ts --required-generated-path packages/create-croco-app/templates/spa-be-split/apps/console-web/src/tests/ProblemNotice.spec.tsx --required-generated-path packages/create-croco-app/templates/spa-be-split/tests/journeys/create-user.spec.ts --required-generated-path packages/create-croco-app/templates/spa-be-split/tests/journeys/problem-rendering.spec.ts --output ci-reports/package-quality/test-evidence.json`
- Started at: 2026-09-15T15:50:20.347Z
- Completed at: 2026-09-15T15:50:20.458Z
- Duration: 0.11s
- Timeout: 300s
- Failure reason: none

Artifacts:
- Enforced test evidence (required): `ci-reports/package-quality/test-evidence.json` present; modified at 2026-09-15T15:50:20.446Z; copied to `ci-reports/release/artifacts/test-evidence-reconcile/test-evidence.json`

### Packed installed CLI integration evidence

- ID: `cli-packed-e2e`
- Status: not_applicable
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/test-lane-evidence-check.mts --report ci-reports/package-quality/integration-test-lane.json --lane integration --path packages/cli/src/tests/integration/CliCommandIntegration.spec.ts`
- Started at: not started
- Completed at: 2026-09-15T15:50:20.350Z
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
- Started at: 2026-09-15T15:07:28.860Z
- Completed at: 2026-09-15T15:07:29.851Z
- Duration: 0.99s
- Timeout: 600s
- Failure reason: none

Artifacts:
- Provider certification markdown (required): `ci-reports/package-quality/provider-certification.md` present; modified at 2026-09-15T15:07:29.573Z; copied to `ci-reports/release/artifacts/provider-certification/provider-certification.md`
- Provider certification JSON (required): `ci-reports/package-quality/provider-certification.json` present; modified at 2026-09-15T15:07:29.574Z; copied to `ci-reports/release/artifacts/provider-certification/provider-certification.json`

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
- Selection reason: Selected because package accountability inputs changed: packages/docs/src/content/docs/api/impersonation-core/src/classes/ImpersonationStore.md, packages/docs/src/content/docs/api/impersonation-core/src/classes/InMemoryImpersonationStore.md, packages/docs/src/content/docs/api/problems-core/src/variables/CROCO_PROBLEM_CODE_REGISTRY.md, packages/docs/src/content/docs/en/reference/problem-recovery-cookbook.md, packages/impersonation-core/README.md, packages/impersonation-core/src/libs/ImpersonationService.ts, packages/impersonation-core/src/libs/InMemoryImpersonationStore.ts, packages/impersonation-core/src/libs/interfaces.ts, packages/impersonation-core/src/tests/ImpersonationService.spec.ts, packages/impersonation-core/src/tests/InMemoryImpersonationStore.spec.ts, packages/problems-core/src/generated/problem-code-registry.ts.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported production-ready package violations -- node --experimental-strip-types scripts/production-ready-check.mts`
- Started at: 2026-09-15T15:50:20.461Z
- Completed at: 2026-09-15T15:50:22.509Z
- Duration: 2.05s
- Timeout: 600s
- Failure reason: none

Artifacts:
- Production-ready package markdown (required): `ci-reports/package-quality/production-ready.md` present; modified at 2026-09-15T15:50:22.017Z; copied to `ci-reports/release/artifacts/production-ready/production-ready.md`

stdout excerpt:

```text
production-ready-check: wrote /home/runner/work/framework/framework/ci-reports/package-quality/production-ready.md
production-ready-check: production packages=24
production-ready-check: blocking failures=0

```

### Beta spine promotion accountability

- ID: `spine-promotion`
- Status: passed
- Selection reason: Selected because package accountability inputs changed: packages/docs/src/content/docs/api/impersonation-core/src/classes/ImpersonationStore.md, packages/docs/src/content/docs/api/impersonation-core/src/classes/InMemoryImpersonationStore.md, packages/docs/src/content/docs/api/problems-core/src/variables/CROCO_PROBLEM_CODE_REGISTRY.md, packages/docs/src/content/docs/en/reference/problem-recovery-cookbook.md, packages/impersonation-core/README.md, packages/impersonation-core/src/libs/ImpersonationService.ts, packages/impersonation-core/src/libs/InMemoryImpersonationStore.ts, packages/impersonation-core/src/libs/interfaces.ts, packages/impersonation-core/src/tests/ImpersonationService.spec.ts, packages/impersonation-core/src/tests/InMemoryImpersonationStore.spec.ts, packages/problems-core/src/generated/problem-code-registry.ts.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported beta spine promotion violations -- node --experimental-strip-types scripts/spine-promotion-check.mts --package docs --package impersonation-core --package problems-core`
- Started at: 2026-09-15T15:50:22.511Z
- Completed at: 2026-09-15T15:50:23.394Z
- Duration: 0.88s
- Timeout: 600s
- Failure reason: none

Artifacts:
- Beta spine promotion markdown (required): `ci-reports/package-quality/spine-promotion.md` present; modified at 2026-09-15T15:50:23.148Z; copied to `ci-reports/release/artifacts/spine-promotion/spine-promotion.md`

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
- Started at: 2026-09-15T15:50:20.351Z
- Completed at: 2026-09-15T15:53:20.731Z
- Duration: 180.38s
- Timeout: 2700s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
[truncated 143191 chars]
|   88.88 | 23                
  ...ion-result.ts |     100 |      100 |     100 |     100 |                   
  generator.ts     |    98.7 |     95.6 |     100 |    98.7 | 147,837,845       
  goals.ts         |   74.32 |    66.21 |   81.81 |   93.75 | 87,93,167         
  index.ts         |       0 |        0 |       0 |       0 |                   
  node-runtime.ts  |     100 |    85.71 |     100 |     100 | 50                
  options.ts       |   83.17 |       80 |   96.29 |   85.97 | ...96-706,713-716 
  ...ge-version.ts |   83.33 |    71.42 |     100 |   83.33 | 15,29             
  programmatic.ts  |       0 |        0 |       0 |       0 |                   
  prompts.ts       |   22.22 |    22.22 |   16.66 |   22.53 | ...96-398,409-478 
  ...r-profiles.ts |   96.47 |    92.68 |     100 |   96.34 | 671,750,1090      
  ...der-policy.ts |   70.32 |    61.26 |   78.37 |   71.81 | ...55,569,575,580 
  staging.ts       |     100 |      100 |     100 |     100 |                   
  ...ed-options.ts |     100 |      100 |     100 |     100 |                   
  template-path.ts |     100 |      100 |     100 |     100 |                   
 src/data          |       0 |        0 |       0 |       0 |                   
  ...ge-roles.json |       0 |        0 |       0 |       0 |                   
 src/helpers       |   91.61 |    88.79 |   93.75 |   92.35 |                   
  catalog-spine.ts |     100 |      100 |     100 |     100 |                   
  croco-ranges.ts  |     100 |      100 |     100 |     100 |                   
  fs.ts            |   92.53 |       85 |    87.5 |   92.42 | 30,60,62,75,92    
  ...normalizer.ts |   96.96 |       95 |     100 |   96.77 | 70                
  pkg-json.ts      |     100 |       90 |     100 |     100 | 8                 
  validate.ts      |    82.6 |    88.09 |   83.33 |   84.61 | 14,49,69-72       
 src/installers    |   97.56 |    86.84 |   94.73 |   97.53 |                   
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
- Started at: 2026-09-15T15:53:20.733Z
- Completed at: 2026-09-15T15:53:20.812Z
- Duration: 0.08s
- Timeout: 600s
- Failure reason: none

Artifacts:
- Core coverage warning markdown (required): `ci-reports/coverage/core-warning/report.md` present; modified at 2026-09-15T15:53:20.799Z; copied to `ci-reports/release/artifacts/core-coverage-warning/report.md`

stdout excerpt:

```text

⚠️  Core coverage warning report written to /home/runner/work/framework/framework/ci-reports/coverage/core-warning/report.md
⚠️  Total core coverage selection warnings: 41
⚠️  Total core coverage warnings: 62
✅ Total core coverage hard errors: 0

```

### Public API snapshot

- ID: `public-api`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm public-api:write -- node --experimental-strip-types scripts/public-api-surface.mts --check`
- Started at: 2026-09-15T15:07:29.854Z
- Completed at: 2026-09-15T15:07:32.383Z
- Duration: 2.53s
- Timeout: 600s
- Failure reason: none

Artifacts:
- Public API diff markdown (required): `ci-reports/package-quality/public-api-diff.md` present; modified at 2026-09-15T15:07:32.097Z; copied to `ci-reports/release/artifacts/public-api/public-api-diff.md`
- Public API summary JSON (required): `ci-reports/package-quality/public-api-summary.json` present; modified at 2026-09-15T15:07:32.097Z; copied to `ci-reports/release/artifacts/public-api/public-api-summary.json`

stdout excerpt:

```text
public-api-surface: 120 package public API snapshot(s) match.

```

### Release-gate maintenance test evidence

- ID: `release-gate-tests`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/test-lane-evidence-check.mts --report ci-reports/package-quality/fast-test-lane.json --lane fast --path scripts/tests/alpha-release-smoke.spec.ts --path scripts/tests/api-docs-trigger-check.spec.ts --path scripts/tests/architecture-policy-check.spec.ts --path scripts/tests/bench-threshold-check.spec.ts --path scripts/tests/benchmark-workflow.spec.ts --path scripts/tests/branch-protection-policy.spec.ts --path scripts/tests/changeset-required-check.spec.ts --path scripts/tests/ci-executable-policy.spec.ts --path scripts/tests/ci-performance-budget.spec.ts --path scripts/tests/ci-verification-identity.spec.ts --path scripts/tests/ci-workflow.spec.ts --path scripts/tests/compiler-baseline-check.spec.ts --path scripts/tests/core-coverage-warning-check.spec.ts --path scripts/tests/create-croco-app-generated-smoke.spec.ts --path scripts/tests/dependency-audit-policy.spec.ts --path scripts/tests/doc-examples-check.spec.ts --path scripts/tests/first-success-verify.spec.ts --path scripts/tests/generated-secret-placeholder-policy.spec.ts --path scripts/tests/live-tests-workflow.spec.ts --path scripts/tests/normalize-packages.spec.ts --path scripts/tests/package-bin-smoke.spec.ts --path scripts/tests/package-docs-check.spec.ts --path scripts/tests/package-entrypoint-smoke.spec.ts --path scripts/tests/package-manifest-contracts.spec.ts --path scripts/tests/package-quality-report.spec.ts --path scripts/tests/package-roles.spec.ts --path scripts/tests/problem-registry.spec.ts --path scripts/tests/production-ready-check.spec.ts --path scripts/tests/provenance-config-check.spec.ts --path scripts/tests/provider-certification-check.spec.ts --path scripts/tests/public-api-surface.spec.ts --path scripts/tests/release-docs-check.spec.ts --path scripts/tests/release-metadata-check.spec.ts --path scripts/tests/release-spine-evidence.spec.ts --path scripts/tests/release-version-sync.spec.ts --path scripts/tests/release-workflow.spec.ts --path scripts/tests/repository-policy-audit-workflow.spec.ts --path scripts/tests/security-allowlist-metadata-check.spec.ts --path scripts/tests/spine-promotion-check.spec.ts --path scripts/tests/static-misuse-check.spec.ts --path scripts/tests/strict-contract-typecheck.spec.ts --path scripts/tests/test-evidence-reconcile.spec.ts --path scripts/tests/test-inventory.spec.ts --path scripts/tests/test-lane-evidence-check.spec.ts --path scripts/tests/test-lane-runner.spec.ts --path scripts/tests/tracked-file-mutation-guard.spec.ts --path scripts/tests/turbo-cache-contract.spec.ts --path scripts/tests/turbo-task-contract.spec.ts --path scripts/tests/verification-change-classifier.spec.ts --path scripts/tests/verification-command.spec.ts --path scripts/tests/verification-manifest.spec.ts --path scripts/tests/verification-policy.spec.ts --path scripts/tests/verify-circular-allowlist.spec.ts`
- Started at: 2026-09-15T15:44:07.803Z
- Completed at: 2026-09-15T15:44:07.929Z
- Duration: 0.13s
- Timeout: 120s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
[test-lane-evidence] fast report covers 53 required paths

```

### Spine bundle-size warning report

- ID: `spine-bundle-size`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/package-quality-report.mts`
- Started at: 2026-09-15T15:50:23.397Z
- Completed at: 2026-09-15T15:50:25.252Z
- Duration: 1.86s
- Timeout: 600s
- Failure reason: none

Artifacts:
- Package quality dashboard markdown (required): `ci-reports/package-quality/report.md` present; modified at 2026-09-15T15:50:25.207Z; copied to `ci-reports/release/artifacts/spine-bundle-size/report.md`
- Package quality dashboard JSON (required): `ci-reports/package-quality/summary.json` present; modified at 2026-09-15T15:50:25.212Z; copied to `ci-reports/release/artifacts/spine-bundle-size/summary.json`
- Bundle-size enforcement markdown (required): `ci-reports/package-quality/bundle-size.md` present; modified at 2026-09-15T15:50:25.217Z; copied to `ci-reports/release/artifacts/spine-bundle-size/bundle-size.md`

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
- Started at: 2026-09-15T15:07:32.386Z
- Completed at: 2026-09-15T15:07:42.206Z
- Duration: 9.82s
- Timeout: 600s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
dependency-audit-policy: pnpm audit --json started timeoutMs=120000
dependency-audit-policy: pnpm audit --json completed elapsedMs=1073 status=1 signal=null
dependency-audit-transport {"event":"start","elapsedMs":0,"cpuUserMs":11,"cpuSystemMs":11,"stage":"before-request","nodeVersion":"v22.23.2"}
dependency-audit-transport {"event":"request","elapsedMs":762,"cpuUserMs":757,"cpuSystemMs":96,"stage":"waiting-send","requestId":1}
dependency-audit-transport {"event":"body-sent","elapsedMs":843,"cpuUserMs":775,"cpuSystemMs":97,"stage":"waiting-headers","requestId":1}
dependency-audit-transport {"event":"headers","elapsedMs":945,"cpuUserMs":777,"cpuSystemMs":97,"stage":"reading-body","requestId":1,"statusCode":200}
dependency-audit-transport {"event":"body-complete","elapsedMs":953,"cpuUserMs":781,"cpuSystemMs":98,"stage":"processing-response","requestId":1}
dependency-audit-transport {"event":"exit","elapsedMs":1013,"cpuUserMs":853,"cpuSystemMs":98,"stage":"processing-response","code":1}
dependency-audit-policy: pnpm audit --prod --json started timeoutMs=120000
dependency-audit-policy: pnpm audit --prod --json completed elapsedMs=966 status=1 signal=null
dependency-audit-transport {"event":"start","elapsedMs":0,"cpuUserMs":13,"cpuSystemMs":9,"stage":"before-request","nodeVersion":"v22.23.2"}
dependency-audit-transport {"event":"request","elapsedMs":728,"cpuUserMs":695,"cpuSystemMs":79,"stage":"waiting-send","requestId":1}
dependency-audit-transport {"event":"body-sent","elapsedMs":799,"cpuUserMs":720,"cpuSystemMs":80,"stage":"waiting-headers","requestId":1}
dependency-audit-transport {"event":"headers","elapsedMs":869,"cpuUserMs":722,"cpuSystemMs":80,"stage":"reading-body","requestId":1,"statusCode":200}
dependency-audit-transport {"event":"body-complete","elapsedMs":875,"cpuUserMs":726,"cpuSystemMs":80,"stage":"processing-response","requestId":1}
dependency-audit-transport {"event":"exit","elapsedMs":908,"cpuUserMs":765,"cpuSystemMs":80,"stage":"processing-response","code":1}
dependency-audit-policy: generated template pnpm audit --json started timeoutMs=120000
dependency-audit-policy: generated template pnpm audit --json completed elapsedMs=558 status=0 signal=null
dependency-audit-transport {"event":"start","elapsedMs":0,"cpuUserMs":13,"cpuSystemMs":6,"stage":"before-request","nodeVersion":"v22.23.2"}
dependency-audit-transport {"event":"request","elapsedMs":347,"cpuUserMs":392,"cpuSystemMs":53,"stage":"waiting-send","requestId":1}
dependency-audit-transport {"event":"body-sent","elapsedMs":411,"cpuUserMs":409,"cpuSystemMs":54,"stage":"waiting-headers","requestId":1}
dependency-audit-transport {"event":"headers","elapsedMs":511,"cpuUserMs":411,"cpuSystemMs":54,"stage":"reading-body","requestId":1,"statusCode":200}
dependency-audit-transport {"event":"body-complete","elapsedMs":513,"cpuUserMs":413,"cpuSystemMs":54,"stage":"processing-response","requestId":1}
dependency-audit-transport {"event":"exit","elapsedMs":521,"cpuUserMs":421,"cpuSystemMs":54,"stage":"processing-response","code":0}
dependency-audit-policy: wrote ci-reports/security/dependency-audit-policy.md
dependency-audit-policy: passed

```

### npm provenance configuration

- ID: `provenance-config`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/provenance-config-check.mts`
- Started at: 2026-09-15T15:07:42.208Z
- Completed at: 2026-09-15T15:07:42.409Z
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

### Publish dry run

- ID: `publish-dry-run`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `pnpm -r publish --dry-run --no-git-checks`
- Started at: 2026-09-15T15:53:20.736Z
- Completed at: 2026-09-15T15:54:47.301Z
- Duration: 86.56s
- Timeout: 1800s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
[truncated 52375 chars]
ANGE: Failed token exchange request with body message: Unknown error (status code 404)
📦 @croco/metering-drizzle@0.0.4 → https://registry.npmjs.org/
[WARN] Skip publishing @croco/metering-drizzle@0.0.4 (dry run)
GET https://run-actions-2-azure-eastus.actions.githubusercontent.com/244//idtoken/9093270f-f1d2-43c8-82b8-5ff84c613375/e07a2137-ad4c-5ee3-9c60-f9f1115f349f?api-version=2.0&audience=npm%3Aregistry.npmjs.org 200 90ms
[WARN] Skipped OIDC: ERR_PNPM_AUTH_TOKEN_EXCHANGE: Failed token exchange request with body message: Unknown error (status code 404)
📦 @croco/metering-upstash@0.0.4 → https://registry.npmjs.org/
[WARN] Skip publishing @croco/metering-upstash@0.0.4 (dry run)
GET https://run-actions-2-azure-eastus.actions.githubusercontent.com/244//idtoken/9093270f-f1d2-43c8-82b8-5ff84c613375/e07a2137-ad4c-5ee3-9c60-f9f1115f349f?api-version=2.0&audience=npm%3Aregistry.npmjs.org 200 100ms
[WARN] Skipped OIDC: ERR_PNPM_AUTH_TOKEN_EXCHANGE: Failed token exchange request with body message: Unknown error (status code 404)
📦 @croco/metrics-billing@0.1.0 → https://registry.npmjs.org/
[WARN] Skip publishing @croco/metrics-billing@0.1.0 (dry run)
GET https://run-actions-2-azure-eastus.actions.githubusercontent.com/244//idtoken/9093270f-f1d2-43c8-82b8-5ff84c613375/e07a2137-ad4c-5ee3-9c60-f9f1115f349f?api-version=2.0&audience=npm%3Aregistry.npmjs.org 200 111ms
[WARN] Skipped OIDC: ERR_PNPM_AUTH_TOKEN_EXCHANGE: Failed token exchange request with body message: Unknown error (status code 404)
📦 @croco/admin-react@0.1.0 → https://registry.npmjs.org/
[WARN] Skip publishing @croco/admin-react@0.1.0 (dry run)
GET https://run-actions-2-azure-eastus.actions.githubusercontent.com/244//idtoken/9093270f-f1d2-43c8-82b8-5ff84c613375/e07a2137-ad4c-5ee3-9c60-f9f1115f349f?api-version=2.0&audience=npm%3Aregistry.npmjs.org 200 93ms
[WARN] Skipped OIDC: ERR_PNPM_AUTH_TOKEN_EXCHANGE: Failed token exchange request with body message: Unknown error (status code 404)
📦 @croco/entitlements-drizzle@0.0.4 → https://registry.npmjs.org/
[WARN] Skip publishing @croco/entitlements-drizzle@0.0.4 (dry run)
GET https://run-actions-2-azure-eastus.actions.githubusercontent.com/244//idtoken/9093270f-f1d2-43c8-82b8-5ff84c613375/e07a2137-ad4c-5ee3-9c60-f9f1115f349f?api-version=2.0&audience=npm%3Aregistry.npmjs.org 200 89ms
[WARN] Skipped OIDC: ERR_PNPM_AUTH_TOKEN_EXCHANGE: Failed token exchange request with body message: Unknown error (status code 404)
📦 @croco/membership-core@0.0.4 → https://registry.npmjs.org/
[WARN] Skip publishing @croco/membership-core@0.0.4 (dry run)
GET https://run-actions-2-azure-eastus.actions.githubusercontent.com/244//idtoken/9093270f-f1d2-43c8-82b8-5ff84c613375/e07a2137-ad4c-5ee3-9c60-f9f1115f349f?api-version=2.0&audience=npm%3Aregistry.npmjs.org 200 102ms
[WARN] Skipped OIDC: ERR_PNPM_AUTH_TOKEN_EXCHANGE: Failed token exchange request with body message: Unknown error (status code 404)
📦 @croco/invitation-core@0.0.4 → https://registry.npmjs.org/
[WARN] Skip publishing @croco/invitation-core@0.0.4 (dry run)
GET https://run-actions-2-azure-eastus.actions.githubusercontent.com/244//idtoken/9093270f-f1d2-43c8-82b8-5ff84c613375/e07a2137-ad4c-5ee3-9c60-f9f1115f349f?api-version=2.0&audience=npm%3Aregistry.npmjs.org 200 84ms
[WARN] Skipped OIDC: ERR_PNPM_AUTH_TOKEN_EXCHANGE: Failed token exchange request with body message: Unknown error (status code 404)
📦 @croco/membership-drizzle@0.0.4 → https://registry.npmjs.org/
[WARN] Skip publishing @croco/membership-drizzle@0.0.4 (dry run)
GET https://run-actions-2-azure-eastus.actions.githubusercontent.com/244//idtoken/9093270f-f1d2-43c8-82b8-5ff84c613375/e07a2137-ad4c-5ee3-9c60-f9f1115f349f?api-version=2.0&audience=npm%3Aregistry.npmjs.org 200 88ms
[WARN] Skipped OIDC: ERR_PNPM_AUTH_TOKEN_EXCHANGE: Failed token exchange request with body message: Unknown error (status code 404)
📦 @croco/invitation-drizzle@0.0.4 → https://registry.npmjs.org/
[WARN] Skip publishing @croco/invitation-drizzle@0.0.4 (dry run)

```

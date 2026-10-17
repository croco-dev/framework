# Release Spine Evidence

- Status: passed
- Generated at: 2026-10-17T19:44:24.791Z
- Completed at: 2026-10-17T21:18:37.412Z
- Root: `/home/runner/work/framework/framework`
- Output directory: `/home/runner/work/framework/framework/ci-reports/release`
- Profile: `publish`
- Commit: `f445c2d222af26b7dcdd633b29022ff1d60cba77`
- Run: `39059044162` attempt `1`
- Total timeout: 9000s
- Checks: 49/55 passed, 6 not applicable, 0 failed, 0 timed out, 0 interrupted, 0 skipped after timeout, 0 skipped by prerequisite

## Check summary

| Check | Category | Command | Status | Exit | Duration | Timeout | Evidence artifacts |
| --- | --- | --- | --- | --- | ---: | ---: | --- |
| Release metadata | metadata | `node --experimental-strip-types scripts/release-metadata-check.mts --allow-pending-changesets` | passed | 0 | 0.23s | 600s | - |
| Read-only verification policy | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Guard or classify the reported verification path -- node --experimental-strip-types scripts/verification-policy.mts` | passed | 0 | 1.23s | 300s | - |
| Authoritative test inventory | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery node --experimental-strip-types scripts/test-inventory.mts --write -- node --experimental-strip-types scripts/test-inventory.mts --check --profile publish --output ci-reports/package-quality/test-inventory.json` | passed | 0 | 1.26s | 300s | Resolved test inventory (present, modified: 2026-10-17T19:44:25.884Z, copied: `ci-reports/release/artifacts/test-inventory/test-inventory.json`) |
| Turbo cache reuse and invalidation contract | quality | `node --experimental-strip-types scripts/turbo-cache-contract.mts` | passed | 0 | 8.67s | 300s | - |
| Verification profile contracts | quality | `pnpm exec vitest run scripts/tests/verification-command.spec.ts scripts/tests/verification-change-classifier.spec.ts scripts/tests/verification-manifest.spec.ts scripts/tests/release-spine-evidence.spec.ts scripts/tests/ci-workflow.spec.ts scripts/tests/ci-performance-budget.spec.ts scripts/tests/release-workflow.spec.ts scripts/tests/turbo-task-contract.spec.ts scripts/tests/branch-protection-policy.spec.ts scripts/tests/repository-policy-audit-workflow.spec.ts scripts/tests/verification-policy.spec.ts scripts/tests/test-inventory.spec.ts scripts/tests/test-lane-runner.spec.ts scripts/tests/turbo-cache-contract.spec.ts scripts/tests/package-test-typecheck-check.spec.ts` | not_applicable | - | not collected | not started | - |
| Changeset requirement | metadata | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm changeset or revert the publishable change -- node --experimental-strip-types scripts/changeset-required-check.mts --base 4bf6bd10abfd258b7254213aec6a73e69630c541 --head HEAD` | passed | 0 | 0.90s | 300s | - |
| Package manifests | metadata | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm package-manifests:write -- node scripts/normalize-packages.mjs --check` | passed | 0 | 7.33s | 300s | - |
| Release version-derived metadata | metadata | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm release-version-sync:write && pnpm docs:catalog:write -- node --experimental-strip-types scripts/release-version-sync.mts --check` | passed | 0 | 1.44s | 300s | - |
| Package documentation catalog | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm docs:catalog:write -- node --experimental-strip-types scripts/package-docs-check.mts --check` | passed | 0 | 2.52s | 300s | - |
| API documentation triggers | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm docs:api-triggers:write -- node --experimental-strip-types scripts/api-docs-trigger-check.mts --check` | passed | 0 | 0.97s | 300s | - |
| Problem registry | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm problem-registry:write -- node --experimental-strip-types scripts/problem-registry.mts --check --base 4bf6bd10abfd258b7254213aec6a73e69630c541` | passed | 0 | 47.30s | 300s | - |
| Documentation examples | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm docs:examples:write -- node --experimental-strip-types scripts/doc-examples-check.mts --check` | passed | 0 | 17.85s | 300s | - |
| Release documentation | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported release documentation contract -- node --experimental-strip-types scripts/release-docs-check.mts` | passed | 0 | 1.04s | 300s | - |
| CI executable supply chain | security | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Pin the reported CI executable to an immutable source -- node --experimental-strip-types scripts/ci-executable-policy.mts` | passed | 0 | 2.31s | 300s | - |
| Pull-request CI performance budget | quality | `node --experimental-strip-types scripts/ci-performance-budget.mts` | passed | 0 | 0.33s | 300s | - |
| Verification runtime prerequisites | build | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the verification runtime build prerequisites -- pnpm turbo run build --filter=@croco/architecture-policy... --filter=@croco/tenant-core... --filter=@croco/docs^...` | passed | 0 | 436.68s | 600s | - |
| Architecture policy | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported architecture violation -- node --experimental-strip-types scripts/architecture-policy-check.mts --manifest croco.arch.json` | passed | 0 | 8.54s | 600s | - |
| Architecture circular allowlist | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Update code or intentionally update the circular dependency allowlist -- node --experimental-strip-types scripts/verify-circular-allowlist.mts` | passed | 0 | 98.25s | 600s | - |
| Dependency boundaries | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported package boundary -- node --experimental-strip-types scripts/package-quality-report.mts --boundary-check-only` | passed | 0 | 5.37s | 600s | - |
| Security allowlists | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported security allowlist metadata -- node --experimental-strip-types scripts/security-allowlist-metadata-check.mts` | passed | 0 | 40.33s | 300s | - |
| Generated secret placeholders | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported template placeholder -- node --experimental-strip-types scripts/generated-secret-placeholder-policy.mts` | passed | 0 | 2.06s | 300s | - |
| Package test typecheck coverage | quality | `node --experimental-strip-types scripts/package-test-typecheck-check.mts` | passed | 0 | 2.12s | 300s | - |
| TypeScript compiler baseline | typecheck | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Restore the documented TypeScript compiler and tsconfig contract -- node --experimental-strip-types scripts/compiler-baseline-check.mts` | passed | 0 | 2.76s | 300s | - |
| Legacy decorator signature spike | typecheck | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Restore the reviewed TypeScript 6 decorator signature fixtures and policy -- node --experimental-strip-types scripts/decorator-signature-spike.mts` | passed | 0 | 15.29s | 600s | - |
| Strict contract typecheck | typecheck | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported strict contract diagnostic -- node --experimental-strip-types scripts/strict-contract-typecheck.mts` | passed | 0 | 237.95s | 600s | - |
| Static misuse | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported source misuse -- node --experimental-strip-types scripts/static-misuse-check.mts` | passed | 0 | 26.16s | 600s | - |
| Lint | quality | `pnpm exec oxlint .` | passed | 0 | 2.45s | 900s | - |
| Format | quality | `pnpm exec oxfmt --check . --ignore-path=.gitignore --ignore-path=.prettierignore --ignore-path=.oxfmtignore` | passed | 0 | 13.34s | 900s | - |
| Architecture circular dependencies | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported circular dependency -- pnpm exec madge --circular --extensions ts packages` | passed | 0 | 20.47s | 600s | - |
| Benchmark thresholds | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm bench:update -- node --experimental-strip-types scripts/bench-threshold-check.mts` | passed | 0 | 16.82s | 600s | - |
| Affected build | build | `pnpm turbo run build --filter=@croco/problems-core --filter=@croco/diagnostics-core --filter=@croco/framework-context --filter=@croco/protocols-core --filter=@croco/protocols-rest --filter=@croco/cli --filter=create-croco-app --filter=@croco/openapi-spec --filter=@croco/migration-runner --filter=@croco/rpc-codegen --summarize --continue=always` | passed | 0 | 1.03s | 1800s | - |
| Quick-start Lambda smoke | runtime-smoke | `node --experimental-strip-types scripts/quick-start-lambda-smoke.mts` | not_applicable | - | not collected | not started | - |
| First-success contract | generated-app | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Follow the reported scaffold or documentation recovery command -- node --experimental-strip-types scripts/first-success-verify.mts` | not_applicable | - | not collected | not started | - |
| Package entrypoint smoke | package-smoke | `node --experimental-strip-types scripts/package-entrypoint-smoke.mts --build-missing` | not_applicable | - | not collected | not started | - |
| Package binary smoke | package-smoke | `node --experimental-strip-types scripts/package-bin-smoke.mts` | passed | 0 | 18.03s | 1200s | - |
| create-croco-app spine smoke | generated-app | `node --experimental-strip-types scripts/create-croco-app-generated-smoke.mts goal-saas-api goal-spa-backend-split goal-worker goal-internal-tool graphql-lambda-api trpc-lambda-api graphql-vite-spa-docker meta-vite-fullstack-workers production-app-starter saas-golden-path saas-single-tenant rest-spa-contracts admin-console-starter ai-saas-golden-path trpc-nextjs-vercel-fullstack` | passed | 0 | 2631.30s | 4500s | Spine-blocking generated app smoke matrix markdown (present, modified: 2026-10-17T20:36:57.318Z, copied: `ci-reports/release/artifacts/generated-app-smoke/spine-blocking-matrix.md`)<br>Spine-blocking generated app smoke matrix JSON (present, modified: 2026-10-17T20:36:57.317Z, copied: `ci-reports/release/artifacts/generated-app-smoke/spine-blocking-matrix.json`)<br>Ecosystem-advisory generated app smoke matrix JSON (present, modified: 2026-10-17T20:36:57.318Z, copied: `ci-reports/release/artifacts/generated-app-smoke/ecosystem-advisory-matrix.json`)<br>Aggregate generated app smoke matrix JSON (present, modified: 2026-10-17T20:36:57.318Z, copied: `ci-reports/release/artifacts/generated-app-smoke/matrix.json`)<br>Generated app smoke journey bundle (missing)<br>Generated test materialization evidence (present, modified: 2026-10-17T20:36:57.317Z, copied: `ci-reports/release/artifacts/generated-app-smoke/materialization-evidence.json`)<br>Generated test materializations (present, modified: 2026-10-17T20:03:22.524Z, copied: `ci-reports/release/artifacts/generated-app-smoke/materialized-tests`) |
| Packed decorator consumers | package-smoke | `node --experimental-strip-types scripts/packed-decorator-consumers.mts` | passed | 0 | 13.76s | 900s | - |
| Packed generated app release smoke | generated-app | `node --experimental-strip-types scripts/alpha-release-smoke.mts` | not_applicable | - | not collected | not started | Packed generated app smoke report (missing) |
| Summarized TypeScript check | typecheck | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported TypeScript diagnostics -- pnpm turbo run typecheck --summarize --continue=always` | passed | 0 | 622.60s | 1800s | - |
| Summarized tests | quality | `node --experimental-strip-types scripts/test-lane-runner.mts --lane fast --output ci-reports/package-quality/fast-test-lane.json` | passed | 0 | 826.46s | 2700s | Fast test lane evidence (present, modified: 2026-10-17T21:01:12.729Z, copied: `ci-reports/release/artifacts/test/fast-test-lane.json`) |
| Inventory integration test lane | quality | `node --experimental-strip-types scripts/test-lane-runner.mts --lane integration --output ci-reports/package-quality/integration-test-lane.json` | passed | 0 | 529.69s | 1800s | Integration test lane evidence (present, modified: 2026-10-17T21:10:02.424Z, copied: `ci-reports/release/artifacts/integration-test-lane/integration-test-lane.json`) |
| Inventory published-consumer test lane | package-smoke | `node --experimental-strip-types scripts/test-lane-runner.mts --lane published --output ci-reports/package-quality/published-test-lane.json` | passed | 0 | 66.24s | 2700s | Published-consumer test lane evidence (present, modified: 2026-10-17T21:11:08.665Z, copied: `ci-reports/release/artifacts/published-test-lane/published-test-lane.json`) |
| Enforced test execution evidence | quality | `node --experimental-strip-types scripts/test-evidence-reconcile.mts --profile publish --lane-report ci-reports/package-quality/fast-test-lane.json --lane-report ci-reports/package-quality/integration-test-lane.json --lane-report ci-reports/package-quality/published-test-lane.json --materialization-evidence ci-reports/generated-apps/materialization-evidence.json --generated-root ci-reports/generated-apps/materialized-tests --required-generated-path packages/create-croco-app/templates/addons/graphql-standalone/apps/graphql-api/src/formatGraphQLError.spec.ts --required-generated-path packages/create-croco-app/templates/addons/trpc-nextjs/apps/web/src/server/tests/LocalSessionProvider.spec.ts --required-generated-path packages/create-croco-app/templates/addons/trpc-nextjs/apps/web/src/server/tests/ProductTrials.spec.ts --required-generated-path packages/create-croco-app/templates/admin-console/apps/api-server/src/tests/AdminConsole.spec.ts --required-generated-path packages/create-croco-app/templates/admin-console/apps/api-server/src/tests/CreditOperations.spec.ts --required-generated-path packages/create-croco-app/templates/admin-console/tests/journeys/plan-release.spec.ts --required-generated-path packages/create-croco-app/templates/ai-saas/apps/api-server/src/tests/AiGenerate.spec.ts --required-generated-path packages/create-croco-app/templates/ai-saas/apps/api-server/src/tests/AiReceipts.spec.ts --required-generated-path packages/create-croco-app/templates/ai-saas/apps/api-server/src/tests/AiSaas.spec.ts --required-generated-path packages/create-croco-app/templates/base-ddd/libs/shared/utils-env/src/tests/createEnv.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/ContractFuzz.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/ExecutableAssurance.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/FileBillableUsageJournal.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/FileUsageBillingGateway.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/GeneratedTelemetryEndpoint.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/ProviderProfileEnv.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/SaasDemo.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/node-lifecycle.spec.ts --required-generated-path packages/create-croco-app/templates/spa-be-split/apps/api-server/src/tests/app.spec.ts --required-generated-path packages/create-croco-app/templates/spa-be-split/apps/api-server/src/tests/env.spec.ts --required-generated-path packages/create-croco-app/templates/spa-be-split/apps/api-server/src/tests/node-lifecycle.spec.ts --required-generated-path packages/create-croco-app/templates/spa-be-split/apps/console-web/src/tests/ProblemNotice.spec.tsx --required-generated-path packages/create-croco-app/templates/spa-be-split/tests/journeys/create-user.spec.ts --required-generated-path packages/create-croco-app/templates/spa-be-split/tests/journeys/problem-rendering.spec.ts --output ci-reports/package-quality/test-evidence.json` | passed | 0 | 0.17s | 300s | Enforced test evidence (present, modified: 2026-10-17T21:11:08.831Z, copied: `ci-reports/release/artifacts/test-evidence-reconcile/test-evidence.json`) |
| Packed installed CLI integration evidence | quality | `node --experimental-strip-types scripts/test-lane-evidence-check.mts --report ci-reports/package-quality/integration-test-lane.json --lane integration --path packages/cli/src/tests/integration/CliCommandIntegration.spec.ts` | not_applicable | - | not collected | not started | - |
| Provider certification | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported provider certification metadata -- node --experimental-strip-types scripts/provider-certification-check.mts` | passed | 0 | 1.19s | 600s | Provider certification markdown (present, modified: 2026-10-17T19:53:12.916Z, copied: `ci-reports/release/artifacts/provider-certification/provider-certification.md`)<br>Provider certification JSON (present, modified: 2026-10-17T19:53:12.917Z, copied: `ci-reports/release/artifacts/provider-certification/provider-certification.json`) |
| Production-ready package evidence | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported production-ready package violations -- node --experimental-strip-types scripts/production-ready-check.mts` | passed | 0 | 2.46s | 600s | Production-ready package markdown (present, modified: 2026-10-17T21:11:10.394Z, copied: `ci-reports/release/artifacts/production-ready/production-ready.md`) |
| Beta spine promotion accountability | quality | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported beta spine promotion violations -- node --experimental-strip-types scripts/spine-promotion-check.mts --package cli --package docs --package problems-core --package testing` | passed | 0 | 2.38s | 600s | Beta spine promotion markdown (present, modified: 2026-10-17T21:11:13.208Z, copied: `ci-reports/release/artifacts/spine-promotion/spine-promotion.md`) |
| Core coverage gate | coverage | `node --experimental-strip-types scripts/core-coverage-runner.mts` | passed | 0 | 370.58s | 2700s | - |
| Core coverage warning report | coverage | `node --experimental-strip-types scripts/core-coverage-warning-check.mts` | passed | 0 | 0.12s | 600s | Core coverage warning markdown (present, modified: 2026-10-17T21:17:19.384Z, copied: `ci-reports/release/artifacts/core-coverage-warning/report.md`) |
| Public API snapshot | public-api | `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm public-api:write -- node --experimental-strip-types scripts/public-api-surface.mts --check` | passed | 0 | 3.80s | 600s | Public API diff markdown (present, modified: 2026-10-17T19:53:16.768Z, copied: `ci-reports/release/artifacts/public-api/public-api-diff.md`)<br>Public API summary JSON (present, modified: 2026-10-17T19:53:16.768Z, copied: `ci-reports/release/artifacts/public-api/public-api-summary.json`) |
| Release-gate maintenance test evidence | quality | `node --experimental-strip-types scripts/test-lane-evidence-check.mts --report ci-reports/package-quality/fast-test-lane.json --lane fast --path scripts/tests/alpha-release-smoke.spec.ts --path scripts/tests/api-docs-trigger-check.spec.ts --path scripts/tests/architecture-policy-check.spec.ts --path scripts/tests/bench-threshold-check.spec.ts --path scripts/tests/benchmark-workflow.spec.ts --path scripts/tests/branch-protection-policy.spec.ts --path scripts/tests/changeset-required-check.spec.ts --path scripts/tests/ci-executable-policy.spec.ts --path scripts/tests/ci-performance-budget.spec.ts --path scripts/tests/ci-verification-identity.spec.ts --path scripts/tests/ci-workflow.spec.ts --path scripts/tests/compiler-baseline-check.spec.ts --path scripts/tests/core-coverage-warning-check.spec.ts --path scripts/tests/create-croco-app-generated-smoke.spec.ts --path scripts/tests/dependency-audit-policy.spec.ts --path scripts/tests/doc-examples-check.spec.ts --path scripts/tests/first-success-verify.spec.ts --path scripts/tests/generated-secret-placeholder-policy.spec.ts --path scripts/tests/live-tests-workflow.spec.ts --path scripts/tests/normalize-packages.spec.ts --path scripts/tests/package-bin-smoke.spec.ts --path scripts/tests/package-docs-check.spec.ts --path scripts/tests/package-entrypoint-smoke.spec.ts --path scripts/tests/package-manifest-contracts.spec.ts --path scripts/tests/package-quality-report.spec.ts --path scripts/tests/package-roles.spec.ts --path scripts/tests/package-test-typecheck-check.spec.ts --path scripts/tests/problem-registry.spec.ts --path scripts/tests/production-ready-check.spec.ts --path scripts/tests/provenance-config-check.spec.ts --path scripts/tests/provider-certification-check.spec.ts --path scripts/tests/public-api-surface.spec.ts --path scripts/tests/release-docs-check.spec.ts --path scripts/tests/release-metadata-check.spec.ts --path scripts/tests/release-spine-evidence.spec.ts --path scripts/tests/release-version-sync.spec.ts --path scripts/tests/release-workflow.spec.ts --path scripts/tests/repository-policy-audit-workflow.spec.ts --path scripts/tests/security-allowlist-metadata-check.spec.ts --path scripts/tests/spine-promotion-check.spec.ts --path scripts/tests/static-misuse-check.spec.ts --path scripts/tests/strict-contract-typecheck.spec.ts --path scripts/tests/test-evidence-reconcile.spec.ts --path scripts/tests/test-inventory.spec.ts --path scripts/tests/test-lane-evidence-check.spec.ts --path scripts/tests/test-lane-runner.spec.ts --path scripts/tests/tracked-file-mutation-guard.spec.ts --path scripts/tests/turbo-cache-contract.spec.ts --path scripts/tests/turbo-canonical-cache.spec.ts --path scripts/tests/turbo-task-contract.spec.ts --path scripts/tests/verification-change-classifier.spec.ts --path scripts/tests/verification-command.spec.ts --path scripts/tests/verification-manifest.spec.ts --path scripts/tests/verification-policy.spec.ts --path scripts/tests/verify-circular-allowlist.spec.ts` | passed | 0 | 0.20s | 120s | - |
| Spine bundle-size warning report | quality | `node --experimental-strip-types scripts/package-quality-report.mts` | passed | 0 | 0.43s | 600s | Package quality dashboard markdown (present, modified: 2026-10-17T21:11:14.077Z, copied: `ci-reports/release/artifacts/spine-bundle-size/report.md`)<br>Package quality dashboard JSON (present, modified: 2026-10-17T21:11:14.081Z, copied: `ci-reports/release/artifacts/spine-bundle-size/summary.json`)<br>Bundle-size enforcement markdown (present, modified: 2026-10-17T21:11:14.087Z, copied: `ci-reports/release/artifacts/spine-bundle-size/bundle-size.md`) |
| Production dependency audit policy | quality | `node --experimental-strip-types scripts/dependency-audit-policy.mts` | passed | 0 | 7.46s | 600s | - |
| npm provenance configuration | metadata | `node --experimental-strip-types scripts/provenance-config-check.mts` | passed | 0 | 0.27s | 300s | - |
| Publish dry run | metadata | `pnpm -r publish --dry-run --no-git-checks` | passed | 0 | 78.13s | 1800s | - |

## Check details

### Release metadata

- ID: `release-metadata`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/release-metadata-check.mts --allow-pending-changesets`
- Started at: 2026-10-17T19:44:24.794Z
- Completed at: 2026-10-17T19:44:25.021Z
- Duration: 0.23s
- Timeout: 600s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
=== Release metadata summary ===
Checked publishable: 139
Skipped private/non-published tooling: 2
Pending changeset recoveries: 28

Pending changeset metadata recoveries:
- packages/admin-postgres/package.json (@croco/admin-postgres): CHANGELOG.md is missing
- packages/ai-usage/package.json (@croco/ai-usage): CHANGELOG.md is missing
- packages/analytics-drizzle/package.json (@croco/analytics-drizzle): version is "0.0.0"; CHANGELOG.md is missing
- packages/billing-drizzle/package.json (@croco/billing-drizzle): CHANGELOG.md is missing
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
- packages/gamification-core/package.json (@croco/gamification-core): CHANGELOG.md is missing
- packages/gamification-drizzle/package.json (@croco/gamification-drizzle): CHANGELOG.md is missing
- packages/lifecycle-drizzle/package.json (@croco/lifecycle-drizzle): CHANGELOG.md is missing
- packages/notifications-fcm/package.json (@croco/notifications-fcm): version is "0.0.0"; CHANGELOG.md is missing
- packages/notifications-react-email/package.json (@croco/notifications-react-email): CHANGELOG.md is missing
- packages/promotions-core/package.json (@croco/promotions-core): CHANGELOG.md is missing
- packages/promotions-drizzle/package.json (@croco/promotions-drizzle): CHANGELOG.md is missing
- packages/protocol-codegen/package.json (@croco/protocol-codegen): CHANGELOG.md is missing
- packages/referral-core/package.json (@croco/referral-core): CHANGELOG.md is missing
- packages/referral-drizzle/package.json (@croco/referral-drizzle): CHANGELOG.md is missing
- packages/testing-resources/package.json (@croco/testing-resources): CHANGELOG.md is missing
- packages/ui-astryx/package.json (@croco/ui-astryx): CHANGELOG.md is missing
- packages/warehouse-core/package.json (@croco/warehouse-core): version is "0.0.0"; CHANGELOG.md is missing
- packages/warehouse-tooling/package.json (@croco/warehouse-tooling): CHANGELOG.md is missing

OK: Release metadata placeholders are covered by pending changesets. Final publish candidates must pass without --allow-pending-changesets.

```

### Read-only verification policy

- ID: `verification-policy`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Guard or classify the reported verification path -- node --experimental-strip-types scripts/verification-policy.mts`
- Started at: 2026-10-17T19:44:24.799Z
- Completed at: 2026-10-17T19:44:26.024Z
- Duration: 1.23s
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
- Started at: 2026-10-17T19:44:25.024Z
- Completed at: 2026-10-17T19:44:26.285Z
- Duration: 1.26s
- Timeout: 300s
- Failure reason: none

Artifacts:
- Resolved test inventory (required): `ci-reports/package-quality/test-inventory.json` present; modified at 2026-10-17T19:44:25.884Z; copied to `ci-reports/release/artifacts/test-inventory/test-inventory.json`

stdout excerpt:

```text
test inventory valid (1076 tests, d1a5808cbfab8a32738687c2e744d29726502b7cce871d51c77d21e13d39b19c)

```

### Turbo cache reuse and invalidation contract

- ID: `turbo-cache-contract`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/turbo-cache-contract.mts`
- Started at: 2026-10-17T19:44:26.025Z
- Completed at: 2026-10-17T19:44:34.696Z
- Duration: 8.67s
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
- Command: `pnpm exec vitest run scripts/tests/verification-command.spec.ts scripts/tests/verification-change-classifier.spec.ts scripts/tests/verification-manifest.spec.ts scripts/tests/release-spine-evidence.spec.ts scripts/tests/ci-workflow.spec.ts scripts/tests/ci-performance-budget.spec.ts scripts/tests/release-workflow.spec.ts scripts/tests/turbo-task-contract.spec.ts scripts/tests/branch-protection-policy.spec.ts scripts/tests/repository-policy-audit-workflow.spec.ts scripts/tests/verification-policy.spec.ts scripts/tests/test-inventory.spec.ts scripts/tests/test-lane-runner.spec.ts scripts/tests/turbo-cache-contract.spec.ts scripts/tests/package-test-typecheck-check.spec.ts`
- Started at: not started
- Completed at: 2026-10-17T19:44:26.288Z
- Duration: not collected
- Timeout: not started
- Failure reason: Not applicable to the changed files in this verification context.

Artifacts:
- none

### Changeset requirement

- ID: `changeset-required`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm changeset or revert the publishable change -- node --experimental-strip-types scripts/changeset-required-check.mts --base 4bf6bd10abfd258b7254213aec6a73e69630c541 --head HEAD`
- Started at: 2026-10-17T19:44:26.290Z
- Completed at: 2026-10-17T19:44:27.190Z
- Duration: 0.90s
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
- Started at: 2026-10-17T19:44:27.192Z
- Completed at: 2026-10-17T19:44:34.527Z
- Duration: 7.33s
- Timeout: 300s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text

=== Package manifest summary ===
Checked: 139
Skipped private: 35
Modified: 0

✓ Package manifest contracts are normalized.

```

### Release version-derived metadata

- ID: `release-version-sync`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm release-version-sync:write && pnpm docs:catalog:write -- node --experimental-strip-types scripts/release-version-sync.mts --check`
- Started at: 2026-10-17T19:44:34.529Z
- Completed at: 2026-10-17T19:44:35.973Z
- Duration: 1.44s
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
- Started at: 2026-10-17T19:44:34.698Z
- Completed at: 2026-10-17T19:44:37.217Z
- Duration: 2.52s
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
- Started at: 2026-10-17T19:44:35.975Z
- Completed at: 2026-10-17T19:44:36.944Z
- Duration: 0.97s
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
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm problem-registry:write -- node --experimental-strip-types scripts/problem-registry.mts --check --base 4bf6bd10abfd258b7254213aec6a73e69630c541`
- Started at: 2026-10-17T19:44:36.947Z
- Completed at: 2026-10-17T19:45:24.251Z
- Duration: 47.30s
- Timeout: 300s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
Problem registry check passed: 1063 codes from 1031 discoveries.

```

### Documentation examples

- ID: `docs-examples`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery pnpm docs:examples:write -- node --experimental-strip-types scripts/doc-examples-check.mts --check`
- Started at: 2026-10-17T19:51:57.600Z
- Completed at: 2026-10-17T19:52:15.451Z
- Duration: 17.85s
- Timeout: 300s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
doc-examples-check: checked 53 TypeScript documentation examples.

```

### Release documentation

- ID: `release-docs`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported release documentation contract -- node --experimental-strip-types scripts/release-docs-check.mts`
- Started at: 2026-10-17T19:44:37.220Z
- Completed at: 2026-10-17T19:44:38.262Z
- Duration: 1.04s
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
- Started at: 2026-10-17T19:44:38.268Z
- Completed at: 2026-10-17T19:44:40.580Z
- Duration: 2.31s
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
- Started at: 2026-10-17T19:44:40.582Z
- Completed at: 2026-10-17T19:44:40.912Z
- Duration: 0.33s
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
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the verification runtime build prerequisites -- pnpm turbo run build --filter=@croco/architecture-policy... --filter=@croco/tenant-core... --filter=@croco/docs^...`
- Started at: 2026-10-17T19:44:40.914Z
- Completed at: 2026-10-17T19:51:57.594Z
- Duration: 436.68s
- Timeout: 600s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
[truncated 134130 chars]
U.js              [22m[32m431.00 B[39m
[32mESM[39m [1mdist/chunk-BHKBPETB.js              [22m[32m34.17 KB[39m
[32mESM[39m [1mdist/chunk-JMQ3QKR6.js              [22m[32m27.64 KB[39m
[32mESM[39m [1mdist/chunk-RKAGPFV4.js              [22m[32m90.00 B[39m
[32mESM[39m [1mdist/chunk-ZMHMFQ6G.js              [22m[32m291.00 B[39m
[32mESM[39m [1mdist/chunk-ELAQMBOU.js              [22m[32m333.00 B[39m
[32mESM[39m [1mdist/chunk-XFYIVH5P.js              [22m[32m3.33 KB[39m
[32mESM[39m [1mdist/chunk-DA4W3WVH.js              [22m[32m1.56 KB[39m
[32mESM[39m [1mdist/chunk-X5JEJJEC.js              [22m[32m931.69 KB[39m
[32mESM[39m ⚡️ Build success in 1738ms
[34mDTS[39m Build start
[32mDTS[39m ⚡️ Build success in 54922ms
[32mDTS[39m [1mdist/bin/croco.d.ts       [22m[32m20.00 B[39m
[32mDTS[39m [1mdist/agent.d.ts           [22m[32m1008.00 B[39m
[32mDTS[39m [1mdist/index.d.ts           [22m[32m31.70 KB[39m
[32mDTS[39m [1mdist/ops.d.ts             [22m[32m1.75 KB[39m
[32mDTS[39m [1mdist/bin/croco-agent.d.ts [22m[32m20.00 B[39m
[32mDTS[39m [1mdist/jobs.d.ts            [22m[32m448.00 B[39m
[32mDTS[39m [1mdist/jobs-BsRu-P_y.d.ts   [22m[32m3.88 KB[39m
::endgroup::
::group::@croco/admin-react:build
cache miss, executing 01a7295fff56feb1
$ tsup src/index.ts src/experience-console.ts src/experiment-console.ts src/surveys.ts --format esm,cjs --minify --clean --dts --external react --external react-dom --external @croco/admin-core --external @croco/admin-ops --external @croco/billing-core --external @croco/entitlements-core --external @croco/impersonation-core --external @croco/lifecycle-core --external @croco/metering-core --external @croco/onboarding-core --external @croco/pagination-core --external @croco/problems-core --external @croco/search-core --external @croco/tenant-core --external @croco/gamification-core
[34mCLI[39m Building entry: src/experience-console.ts, src/experiment-console.ts, src/index.ts, src/surveys.ts
[34mCLI[39m Using tsconfig: tsconfig.json
[34mCLI[39m tsup v8.5.1
[34mCLI[39m Target: node16
[34mCLI[39m Cleaning output folder
[34mESM[39m Build start
[34mCJS[39m Build start
[32mCJS[39m [1mdist/experience-console.js [22m[32m9.08 KB[39m
[32mCJS[39m [1mdist/experiment-console.js [22m[32m9.54 KB[39m
[32mCJS[39m [1mdist/surveys.js            [22m[32m6.49 KB[39m
[32mCJS[39m [1mdist/index.js              [22m[32m339.03 KB[39m
[32mCJS[39m ⚡️ Build success in 486ms
[32mESM[39m [1mdist/experiment-console.mjs [22m[32m102.00 B[39m
[32mESM[39m [1mdist/experience-console.mjs [22m[32m102.00 B[39m
[32mESM[39m [1mdist/index.mjs              [22m[32m283.40 KB[39m
[32mESM[39m [1mdist/chunk-NV2QKJ37.mjs     [22m[32m7.52 KB[39m
[32mESM[39m [1mdist/chunk-BJ55MHSH.mjs     [22m[32m8.89 KB[39m
[32mESM[39m [1mdist/surveys.mjs            [22m[32m149.00 B[39m
[32mESM[39m [1mdist/chunk-A52RSASH.mjs     [22m[32m5.03 KB[39m
[32mESM[39m [1mdist/chunk-YSXGDEY5.mjs     [22m[32m95.00 B[39m
[32mESM[39m ⚡️ Build success in 555ms
[34mDTS[39m Build start
"OfferConsolePolicyView" is imported from external module "@croco/admin-core" but never used in "src/libs/OfferConsole.ts".
[32mDTS[39m ⚡️ Build success in 22070ms
[32mDTS[39m [1mdist/index.d.mts              [22m[32m93.07 KB[39m
[32mDTS[39m [1mdist/experience-console.d.mts [22m[32m943.00 B[39m
[32mDTS[39m [1mdist/experiment-console.d.mts [22m[32m1.09 KB[39m
[32mDTS[39m [1mdist/surveys.d.mts            [22m[32m1.62 KB[39m
[32mDTS[39m [1mdist/index.d.ts               [22m[32m93.07 KB[39m
[32mDTS[39m [1mdist/experience-console.d.ts  [22m[32m943.00 B[39m
[32mDTS[39m [1mdist/experiment-console.d.ts  [22m[32m1.09 KB[39m
[32mDTS[39m [1mdist/surveys.d.ts             [22m[32m1.62 KB[39m
::endgroup::

 Tasks:    139 successful, 139 total
Cached:    3 cached, 139 total
  Time:    7m15.752s 


```

stderr excerpt:

```text

Attention:
Turborepo now collects completely anonymous telemetry regarding usage.
This information is used to shape the Turborepo roadmap and prioritize features.
You can learn more, including how to opt-out if you'd not like to participate in this anonymous program, by visiting the following URL:
https://turborepo.dev/docs/telemetry


```

### Architecture policy

- ID: `architecture-policy`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported architecture violation -- node --experimental-strip-types scripts/architecture-policy-check.mts --manifest croco.arch.json`
- Started at: 2026-10-17T19:52:08.467Z
- Completed at: 2026-10-17T19:52:17.009Z
- Duration: 8.54s
- Timeout: 600s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
architecture-policy: passed for 7600 import(s) across 141 package(s)
architecture-policy: package catalog group consistency passed for 139 public package(s)

```

### Architecture circular allowlist

- ID: `architecture-circular-allowlist`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Update code or intentionally update the circular dependency allowlist -- node --experimental-strip-types scripts/verify-circular-allowlist.mts`
- Started at: 2026-10-17T19:45:24.257Z
- Completed at: 2026-10-17T19:47:02.509Z
- Duration: 98.25s
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
- Started at: 2026-10-17T19:47:02.526Z
- Completed at: 2026-10-17T19:47:07.892Z
- Duration: 5.37s
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
- Started at: 2026-10-17T19:47:07.908Z
- Completed at: 2026-10-17T19:47:48.240Z
- Duration: 40.33s
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
- Started at: 2026-10-17T19:47:48.252Z
- Completed at: 2026-10-17T19:47:50.317Z
- Duration: 2.06s
- Timeout: 300s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
generated-secret-placeholder-policy: passed (2 scan paths, 0 generated template allowlists).

```

### Package test typecheck coverage

- ID: `package-test-typecheck`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/package-test-typecheck-check.mts`
- Started at: 2026-10-17T19:47:50.321Z
- Completed at: 2026-10-17T19:47:52.437Z
- Duration: 2.12s
- Timeout: 300s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
package-test-typecheck-check: all package src tests are included by their typecheck configs

```

### TypeScript compiler baseline

- ID: `compiler-baseline`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Restore the documented TypeScript compiler and tsconfig contract -- node --experimental-strip-types scripts/compiler-baseline-check.mts`
- Started at: 2026-10-17T19:47:52.444Z
- Completed at: 2026-10-17T19:47:55.202Z
- Duration: 2.76s
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
- Started at: 2026-10-17T19:47:55.208Z
- Completed at: 2026-10-17T19:48:10.500Z
- Duration: 15.29s
- Timeout: 600s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
decorator-signature-spike: TypeScript 6 legacy decorator feasibility verified
decorator-signature-spike: 30 negative assertions fail with broad signatures; inheritance limitation compiled as documented
decorator-signature-spike: overload declaration snapshot and strict/loose packed ESM/CJS consumer passed
decorator-signature-spike: broad 579 instantiations / 0.28s check, strict 26106 instantiations / 0.72s check
decorator-signature-spike: strict instantiation delta 25527 within 250000 budget

```

### Strict contract typecheck

- ID: `strict-contract-typecheck`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported strict contract diagnostic -- node --experimental-strip-types scripts/strict-contract-typecheck.mts`
- Started at: 2026-10-17T19:48:10.508Z
- Completed at: 2026-10-17T19:52:08.461Z
- Duration: 237.95s
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
strict-contract-typecheck: accepted baseline diagnostics 408
strict-contract-typecheck: diagnostics added 0, removed 0, unchanged 408
strict-contract-typecheck: staged rollout deferrals 11 (@croco/framework-context, @croco/problems-core, @croco/protocols-rest, @croco/openapi-spec, @croco/transports-http, @croco/events-core, @croco/events-tx, @croco/idempotency-core, @croco/testing, create-croco-app, @croco/cli)
strict-contract-typecheck: accepted release debt deferrals 0 (<empty>)
strict-contract-typecheck: baseline matched

```

### Static misuse

- ID: `static-misuse`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported source misuse -- node --experimental-strip-types scripts/static-misuse-check.mts`
- Started at: 2026-10-17T19:52:15.454Z
- Completed at: 2026-10-17T19:52:41.617Z
- Duration: 26.16s
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
static-misuse: CROCO_STATIC_DIRECT_ERROR_SUBCLASS_BOUNDARY pass
static-misuse: CROCO_STATIC_EMPTY_CATCH_RUNTIME_BOUNDARY pass
static-misuse: CROCO_STATIC_DETERMINISTIC_LOCALE_COMPARE pass
static-misuse: all rules passed

```

### Lint

- ID: `lint`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `pnpm exec oxlint .`
- Started at: 2026-10-17T19:52:17.019Z
- Completed at: 2026-10-17T19:52:19.468Z
- Duration: 2.45s
- Timeout: 900s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
::warning file=packages/frontend-react/src/libs/SurveyCard.ts,line=187,endLine=187,col=7,endColumn=12,title=react-hooks(exhaustive-deps)::React Hook useEffect has a missing dependency: 'props.returnFocusTo'
::warning file=packages/admin-react/src/libs/ActivationGuideConsole.ts,line=95,endLine=95,col=14,endColumn=19,title=react-hooks(exhaustive-deps)::React Hook useEffect has a missing dependency: 'props.definition'
::warning file=packages/frontend-cloudflare/src/tests/CloudflareSsrHandler.spec.ts,line=126,endLine=126,col=11,endColumn=15,title=unicorn(no-invalid-fetch-options)::"body" is not allowed when method is "GET"
::warning file=packages/idempotency-core/src/tests/IdempotencyConformance.spec.ts,line=45,endLine=45,col=8,endColumn=21,title=jest(valid-title)::Title must be a string
::warning file=packages/analytics-core/src/tests/GrowthAnalysisService.spec.ts,line=305,endLine=305,col=53,endColumn=65,title=unicorn(no-new-array)::Do not use `new Array(singleArgument)`.
::warning file=packages/analytics-core/src/tests/GrowthAnalysisService.spec.ts,line=947,endLine=947,col=30,endColumn=42,title=unicorn(no-new-array)::Do not use `new Array(singleArgument)`.
::warning file=packages/telemetry-api/src/tests/Trace.spec.ts,line=138,endLine=138,col=74,endColumn=78,title=unicorn(no-thenable)::Do not add `then` to an object.
::warning file=packages/telemetry-api/src/tests/Trace.spec.ts,line=243,endLine=243,col=41,endColumn=45,title=unicorn(no-thenable)::Do not add `then` to an object.
::warning file=packages/telemetry-api/src/tests/Trace.spec.ts,line=244,endLine=244,col=17,endColumn=21,title=unicorn(no-thenable)::Do not add `then` to an object.
::warning file=packages/telemetry-api/src/tests/Trace.spec.ts,line=614,endLine=614,col=7,endColumn=11,title=unicorn(no-thenable)::Do not add `then` to a class.
::warning file=examples/cooperative-challenge/src/browser.tsx,line=103,endLine=103,col=6,endColumn=13,title=react-hooks(exhaustive-deps)::React Hook useMemo has unnecessary dependency: epoch
::warning file=scripts/security-allowlist-metadata-check.mts,line=1042,endLine=1042,col=14,endColumn=16,title=eslint(no-control-regex)::Unexpected control character

Found 12 warnings and 0 errors.
Finished in 2.3s on 3392 files with 116 rules using 4 threads.

```

### Format

- ID: `format`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `pnpm exec oxfmt --check . --ignore-path=.gitignore --ignore-path=.prettierignore --ignore-path=.oxfmtignore`
- Started at: 2026-10-17T19:52:19.472Z
- Completed at: 2026-10-17T19:52:32.815Z
- Duration: 13.34s
- Timeout: 900s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
Checking formatting...

All matched files use the correct format.
Finished in 13086ms on 5273 files using 4 threads.

```

### Architecture circular dependencies

- ID: `architecture-circular`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported circular dependency -- pnpm exec madge --circular --extensions ts packages`
- Started at: 2026-10-17T19:52:32.818Z
- Completed at: 2026-10-17T19:52:53.288Z
- Duration: 20.47s
- Timeout: 600s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
Processed 3190 files (19.5s) (110 warnings)



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
- Started at: 2026-10-17T19:52:41.620Z
- Completed at: 2026-10-17T19:52:58.443Z
- Duration: 16.82s
- Timeout: 600s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
[truncated 10443 chars]
benchmarks[2m > [22m[2mEventPublisher.publishNow single event[22m

  should resolve 10 handlers[2m - packages/events-core/src/tests/EventBus.bench.ts[2m > [22m[2mEventBus benchmarks[2m > [22m[2mDefaultHandlerResolver.resolve × 10[22m

  Container.get singleton (cold)[2m - packages/framework-context/src/tests/Container.bench.ts[2m > [22m[2mContainer.get singleton (cold)[22m

  register 50 singletons[2m - packages/framework-context/src/tests/Container.bench.ts[2m > [22m[2mContainer.register × 50 components[22m

  Container.validate (50 components)[2m - packages/framework-context/src/tests/Container.bench.ts[2m > [22m[2mContainer.validate (50 components)[22m

  Container.get singleton (warm)[2m - packages/framework-context/src/tests/Container.bench.ts[2m > [22m[2mContainer.get singleton (warm)[22m

  lambdaPreset config creation[2m - packages/telemetry-sdk-node/src/tests/TelemetryRuntime.bench.ts[2m > [22m[2mTelemetryRuntime benchmarks[22m
[32m    13.86x [39m[90mfaster than [39mTelemetryRuntime.init (lambda preset)

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
║ CrocoApp constructor           p75: 16.5μs     threshold: 30
║ CrocoApp lambdaHandler (10 controllers) p75: 2.6ms      thre
║ Lambda cold-start simulation   p75: 1.9ms      threshold: 80
║ Lambda cold-start with headers p75: 2.6ms      threshold: 80
║ Lambda cold-start with binary body p75: 2.4ms      threshold
║ Lambda cold-start with query params p75: 2.4ms      threshol
║ Lambda cold-start with authorizer context p75: 1.5ms      th
║ Lambda cold-start realistic scenario p75: 1.7ms      thresho
║ EventBusConfig.start (10 handlers) p75: 5.9μs      threshold
║ EventPublisher.publishNow single event p75: 4.7μs      thres
║ DefaultHandlerResolver.resolve × 10 p75: 0.2μs      threshol
║ Container.get singleton (cold) p75: 225.3μs    threshold: 5.
║ Container.register × 50 components p75: 5.6ms      threshold
║ Container.validate (50 components) p75: 5.2ms      threshold
║ Container.get singleton (warm) p75: 1.1μs      threshold: 50
║ TelemetryRuntime.init (lambda preset) p75: 27.5μs     thresh
║ lambdaPreset config creation   p75: 1.5μs      threshold: 2.
╠══════════════════════════════════════════════════════════╣
║ Result: ALL PASSED                                         ║
╚══════════════════════════════════════════════════════════╝


```

stderr excerpt:

```text
⚠️  Baseline drift for "CrocoApp constructor": p75 16.5μs exceeds baseline 8.2μs by 8.3μs (+101.6%).
⚠️  Baseline drift for "CrocoApp lambdaHandler (10 controllers)": p75 2.6ms exceeds baseline 258.4μs by 2.4ms (+916.5%).
⚠️  Baseline drift for "Lambda cold-start simulation": p75 1.9ms exceeds baseline 418.1μs by 1.5ms (+357.9%).
⚠️  Baseline drift for "Lambda cold-start with headers": p75 2.6ms exceeds baseline 369.7μs by 2.2ms (+600.8%).
⚠️  Baseline drift for "Lambda cold-start with binary body": p75 2.4ms exceeds baseline 339.1μs by 2.1ms (+609.1%).
⚠️  Baseline drift for "Lambda cold-start with query params": p75 2.4ms exceeds baseline 301.3μs by 2.1ms (+688.1%).
⚠️  Baseline drift for "Lambda cold-start with authorizer context": p75 1.5ms exceeds baseline 299.8μs by 1.2ms (+399.3%).
⚠️  Baseline drift for "Lambda cold-start realistic scenario": p75 1.7ms exceeds baseline 299.2μs by 1.4ms (+482.8%).
⚠️  Baseline drift for "EventBusConfig.start (10 handlers)": p75 5.9μs exceeds baseline 1.4μs by 4.5μs (+313.9%).
⚠️  Baseline drift for "EventPublisher.publishNow single event": p75 4.7μs exceeds baseline 1.7μs by 3.1μs (+181.6%).
⚠️  Baseline drift for "DefaultHandlerResolver.resolve × 10": p75 0.2μs exceeds baseline 0.1μs by 0.1μs (+113.8%).
⚠️  Baseline drift for "Container.get singleton (cold)": p75 225.3μs exceeds baseline 70.3μs by 155.0μs (+220.7%).
⚠️  Baseline drift for "Container.register × 50 components": p75 5.6ms exceeds baseline 3.2ms by 2.4ms (+73.0%).
⚠️  Baseline drift for "Container.validate (50 components)": p75 5.2ms exceeds baseline 3.4ms by 1.9ms (+54.8%).

```

### Affected build

- ID: `build`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `pnpm turbo run build --filter=@croco/problems-core --filter=@croco/diagnostics-core --filter=@croco/framework-context --filter=@croco/protocols-core --filter=@croco/protocols-rest --filter=@croco/cli --filter=create-croco-app --filter=@croco/openapi-spec --filter=@croco/migration-runner --filter=@croco/rpc-codegen --summarize --continue=always`
- Started at: 2026-10-17T19:52:53.291Z
- Completed at: 2026-10-17T19:52:54.322Z
- Duration: 1.03s
- Timeout: 1800s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
[truncated 51706 chars]
32m395.00 B[39m
[32mESM[39m [1mdist/generate-RJBVDULX.js           [22m[32m343.00 B[39m
[32mESM[39m [1mdist/codegen-MJA2EOKA.js            [22m[32m191.00 B[39m
[32mESM[39m [1mdist/contracts-I33WECPM.js          [22m[32m255.00 B[39m
[32mESM[39m [1mdist/data-ECB5SQJR.js               [22m[32m10.62 KB[39m
[32mESM[39m [1mdist/architecturePolicy-CLKEIGGN.js [22m[32m369.00 B[39m
[32mESM[39m [1mdist/di-5WT3VCTZ.js                 [22m[32m181.00 B[39m
[32mESM[39m [1mdist/runtimePolicy-2B3HWT46.js      [22m[32m359.00 B[39m
[32mESM[39m [1mdist/ops-RWLIR5MT.js                [22m[32m461.00 B[39m
[32mESM[39m [1mdist/bin/croco-agent.js             [22m[32m2.64 KB[39m
[32mESM[39m [1mdist/agent.js                       [22m[32m243.00 B[39m
[32mESM[39m [1mdist/chunk-SWNR6ZOF.js              [22m[32m418.59 KB[39m
[32mESM[39m [1mdist/index.js                       [22m[32m4.95 KB[39m
[32mESM[39m [1mdist/chunk-DEA7JD32.js              [22m[32m19.00 KB[39m
[32mESM[39m [1mdist/chunk-GYDQS47M.js              [22m[32m41.26 KB[39m
[32mESM[39m [1mdist/chunk-3NOZBXHM.js              [22m[32m3.45 KB[39m
[32mESM[39m [1mdist/chunk-VJHQT4EO.js              [22m[32m15.03 KB[39m
[32mESM[39m [1mdist/chunk-BMYBIHYZ.js              [22m[32m5.73 KB[39m
[32mESM[39m [1mdist/chunk-JRQVJT7Y.js              [22m[32m28.63 KB[39m
[32mESM[39m [1mdist/chunk-XUNPG5RS.js              [22m[32m7.99 KB[39m
[32mESM[39m [1mdist/chunk-PTOUJ45V.js              [22m[32m3.08 KB[39m
[32mESM[39m [1mdist/chunk-2URSQG2S.js              [22m[32m197.11 KB[39m
[32mESM[39m [1mdist/chunk-ZBMYW5IL.js              [22m[32m47.02 KB[39m
[32mESM[39m [1mdist/chunk-PE3BYQP3.js              [22m[32m2.71 KB[39m
[32mESM[39m [1mdist/chunk-N7FCQCTL.js              [22m[32m124.47 KB[39m
[32mESM[39m [1mdist/jobs.js                        [22m[32m561.00 B[39m
[32mESM[39m [1mdist/chunk-HEV2STBE.js              [22m[32m17.06 KB[39m
[32mESM[39m [1mdist/ops.js                         [22m[32m299.00 B[39m
[32mESM[39m [1mdist/chunk-F2QKHGAP.js              [22m[32m7.51 KB[39m
[32mESM[39m [1mdist/chunk-5TKGRYQP.js              [22m[32m8.59 KB[39m
[32mESM[39m [1mdist/make-ZU66EJST.js               [22m[32m245.00 B[39m
[32mESM[39m [1mdist/chunk-MEZMRDU4.js              [22m[32m12.14 KB[39m
[32mESM[39m [1mdist/create-SR3PI4WW.js             [22m[32m279.00 B[39m
[32mESM[39m [1mdist/chunk-PR5LH4CU.js              [22m[32m431.00 B[39m
[32mESM[39m [1mdist/chunk-BHKBPETB.js              [22m[32m34.17 KB[39m
[32mESM[39m [1mdist/chunk-JMQ3QKR6.js              [22m[32m27.64 KB[39m
[32mESM[39m [1mdist/chunk-RKAGPFV4.js              [22m[32m90.00 B[39m
[32mESM[39m [1mdist/chunk-ZMHMFQ6G.js              [22m[32m291.00 B[39m
[32mESM[39m [1mdist/chunk-ELAQMBOU.js              [22m[32m333.00 B[39m
[32mESM[39m [1mdist/chunk-XFYIVH5P.js              [22m[32m3.33 KB[39m
[32mESM[39m [1mdist/chunk-DA4W3WVH.js              [22m[32m1.56 KB[39m
[32mESM[39m [1mdist/chunk-X5JEJJEC.js              [22m[32m931.69 KB[39m
[32mESM[39m ⚡️ Build success in 1738ms
[34mDTS[39m Build start
[32mDTS[39m ⚡️ Build success in 54922ms
[32mDTS[39m [1mdist/bin/croco.d.ts       [22m[32m20.00 B[39m
[32mDTS[39m [1mdist/agent.d.ts           [22m[32m1008.00 B[39m
[32mDTS[39m [1mdist/index.d.ts           [22m[32m31.70 KB[39m
[32mDTS[39m [1mdist/ops.d.ts             [22m[32m1.75 KB[39m
[32mDTS[39m [1mdist/bin/croco-agent.d.ts [22m[32m20.00 B[39m
[32mDTS[39m [1mdist/jobs.d.ts            [22m[32m448.00 B[39m
[32mDTS[39m [1mdist/jobs-BsRu-P_y.d.ts   [22m[32m3.88 KB[39m
::endgroup::

  Tasks:    51 successful, 51 total
 Cached:    51 cached, 51 total
   Time:    745ms >>> FULL TURBO
Summary:    /home/runner/work/framework/framework/.turbo/runs/3KpuLV8UzZCIpkPXgeSN3bjOkGS.json


```

### Quick-start Lambda smoke

- ID: `quick-start-lambda-smoke`
- Status: not_applicable
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/quick-start-lambda-smoke.mts`
- Started at: not started
- Completed at: 2026-10-17T19:52:54.325Z
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
- Completed at: 2026-10-17T19:52:54.327Z
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
- Completed at: 2026-10-17T20:47:26.282Z
- Duration: not collected
- Timeout: not started
- Failure reason: Not applicable to the changed files in this verification context.

Artifacts:
- none

### Package binary smoke

- ID: `package-bins-smoke`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/package-bin-smoke.mts`
- Started at: 2026-10-17T19:52:54.332Z
- Completed at: 2026-10-17T19:53:12.360Z
- Duration: 18.03s
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
- Command: `node --experimental-strip-types scripts/create-croco-app-generated-smoke.mts goal-saas-api goal-spa-backend-split goal-worker goal-internal-tool graphql-lambda-api trpc-lambda-api graphql-vite-spa-docker meta-vite-fullstack-workers production-app-starter saas-golden-path saas-single-tenant rest-spa-contracts admin-console-starter ai-saas-golden-path trpc-nextjs-vercel-fullstack`
- Started at: 2026-10-17T19:53:12.364Z
- Completed at: 2026-10-17T20:37:03.644Z
- Duration: 2631.30s
- Timeout: 4500s
- Failure reason: none

Artifacts:
- Spine-blocking generated app smoke matrix markdown (required): `ci-reports/generated-apps/spine-blocking-matrix.md` present; modified at 2026-10-17T20:36:57.318Z; copied to `ci-reports/release/artifacts/generated-app-smoke/spine-blocking-matrix.md`
- Spine-blocking generated app smoke matrix JSON (required): `ci-reports/generated-apps/spine-blocking-matrix.json` present; modified at 2026-10-17T20:36:57.317Z; copied to `ci-reports/release/artifacts/generated-app-smoke/spine-blocking-matrix.json`
- Ecosystem-advisory generated app smoke matrix JSON (optional): `ci-reports/generated-apps/ecosystem-advisory-matrix.json` present; modified at 2026-10-17T20:36:57.318Z; copied to `ci-reports/release/artifacts/generated-app-smoke/ecosystem-advisory-matrix.json`
- Aggregate generated app smoke matrix JSON (optional): `ci-reports/generated-apps/matrix.json` present; modified at 2026-10-17T20:36:57.318Z; copied to `ci-reports/release/artifacts/generated-app-smoke/matrix.json`
- Generated app smoke journey bundle (optional): `ci-reports/generated-apps/spine-blocking-journeys` missing
- Generated test materialization evidence (required): `ci-reports/generated-apps/materialization-evidence.json` present; modified at 2026-10-17T20:36:57.317Z; copied to `ci-reports/release/artifacts/generated-app-smoke/materialization-evidence.json`
- Generated test materializations (required): `ci-reports/generated-apps/materialized-tests` present; modified at 2026-10-17T20:03:22.524Z; copied to `ci-reports/release/artifacts/generated-app-smoke/materialized-tests`

stdout excerpt:

```text
[truncated 14533 chars]
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
- Started at: 2026-10-17T19:52:58.446Z
- Completed at: 2026-10-17T19:53:12.203Z
- Duration: 13.76s
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
- Completed at: 2026-10-17T20:37:03.672Z
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
- Started at: 2026-10-17T20:37:03.675Z
- Completed at: 2026-10-17T20:47:26.279Z
- Duration: 622.60s
- Timeout: 1800s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
[truncated 161806 chars]
7ca980d8a
$ tsx scripts/build.ts && tsc --noEmit
::endgroup::
::group::@croco/membership-drizzle:typecheck
cache miss, executing 7e13959c8ce623b7
$ tsc --noEmit
::endgroup::
::group::@croco/etl-events-tx:typecheck
cache miss, executing 70e1c934c9ca4a6d
$ tsc --noEmit
::endgroup::
::group::@croco-example/saas-billing-golden-path:typecheck
cache miss, executing 98bf94ab7d19f9c1
$ tsc --noEmit
::endgroup::
::group::@croco/invitation-drizzle:typecheck
cache miss, executing 5ea32b879c90e5a4
$ tsc --noEmit
::endgroup::
::group::@croco-example/first-party-plugin-composition:typecheck
cache miss, executing 62931b6dde1c5738
$ tsc --noEmit
::endgroup::
::group::@croco-example/outbox-fact-source:typecheck
cache miss, executing bd7d241f1d428fc0
$ tsc --noEmit
::endgroup::
::group::@croco/admin-react:typecheck
cache miss, executing c2534d4984f6f4df
$ tsc --noEmit
::endgroup::
::group::@croco/cli:typecheck
cache miss, executing 52f519d19b3aa3f0
$ tsc --noEmit
::endgroup::
::group::@croco-example/targeting-impact:typecheck
cache miss, executing 508a9ace35938fb9
$ tsc --noEmit
::endgroup::
::group::@croco-example/growth-model:typecheck
cache miss, executing 8043b3de6a49795e
$ tsc --noEmit
::endgroup::
::group::@croco-example/fact-history:typecheck
cache miss, executing 6a5beeee4d74bae8
$ tsc --noEmit
::endgroup::
::group::@croco-example/promotion-offers:typecheck
cache miss, executing 1c96fcf76c72adef
$ tsc --noEmit
::endgroup::
::group::@croco-example/saved-intents:typecheck
cache miss, executing 06c077e5f554f36f
$ tsc --noEmit
::endgroup::
::group::@croco-example/assigned-outcomes:typecheck
cache miss, executing 33ed4a7337291e98
$ tsc --noEmit
::endgroup::
::group::@croco-example/user-reminders:typecheck
cache miss, executing 22fef12e4202dfc0
$ tsc --noEmit
::endgroup::
::group::@croco-example/reward-policy:typecheck
cache miss, executing 6e93a842095b3b5e
$ tsc --noEmit
::endgroup::
::group::@croco-example/cohort-builder:typecheck
cache miss, executing 5e122233d3d12294
$ tsc --noEmit
::endgroup::
::group::@croco-example/micro-surveys:typecheck
cache miss, executing 6caadaaa5b1517ab
$ tsc --noEmit
::endgroup::
::group::@croco-example/experience-placement:typecheck
cache miss, executing b75708376af419bd
$ tsc --noEmit
::endgroup::
::group::@croco-example/activation-candidates:typecheck
cache miss, executing 5f6505149108d0b2
$ tsc --noEmit
::endgroup::
::group::@croco-example/experiment-runtime:typecheck
cache miss, executing 18e9c89da8825e4a
$ tsc --noEmit
::endgroup::
::group::@croco-example/contact-policy:typecheck
cache miss, executing 18f2209d525f33a1
$ tsc --noEmit
::endgroup::
::group::@croco-example/referral-program:typecheck
cache miss, executing 5651a38095fb7207
$ tsc --noEmit
::endgroup::
::group::@croco-example/onboarding-goals:typecheck
cache miss, executing bea4179732ee66b1
$ tsc --noEmit
::endgroup::
::group::@croco-example/customer-explorer:typecheck
cache miss, executing 956aa54d1b86c445
$ tsc --noEmit
::endgroup::
::group::@croco-example/cooperative-challenge:typecheck
cache miss, executing 209f444b611dadb2
$ tsc --noEmit
::endgroup::
::group::@croco-example/lifecycle-journey:typecheck
cache miss, executing d38f3fd917f44759
$ tsc --noEmit
::endgroup::
::group::@croco-example/cancellation-flow:typecheck
cache miss, executing 9d78cde186a72266
$ tsc --noEmit
::endgroup::
::group::@croco-example/growth-analysis:typecheck
cache miss, executing 338b0c82497520f6
$ tsc --noEmit
::endgroup::
::group::@croco-example/warehouse-explorer:typecheck
cache miss, executing fc9fd2364a059ef0
$ tsc --noEmit
::endgroup::
::group::@croco-example/recurring-missions:typecheck
cache miss, executing 3c1958963db405b4
$ tsc --noEmit
::endgroup::
::group::@croco-example/behavior-retention:typecheck
cache miss, executing 4c3b52597852d658
$ tsc --noEmit
::endgroup::

  Tasks:    343 successful, 343 total
 Cached:    142 cached, 343 total
   Time:    10m21.836s 
Summary:    /home/runner/work/framework/framework/.turbo/runs/3Kq0yW8ND8DiZb6L5VGAroANjlJ.json


```

stderr excerpt:

```text
 WARNING  no output files found for task @croco-example/activation-candidates#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/assigned-outcomes#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/behavior-retention#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/cancellation-flow#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/cohort-builder#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/contact-policy#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/cooperative-challenge#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/customer-explorer#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/experience-placement#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/experiment-review#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/experiment-runtime#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/fact-history#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/first-party-plugin-composition#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/growth-analysis#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/growth-model#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/lifecycle-journey#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/metric-read#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/micro-surveys#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/onboarding-goals#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/outbox-fact-source#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/policy-release#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/promotion-offers#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/recurring-missions#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/referral-program#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/reward-policy#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/saas-billing-golden-path#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/saved-intents#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/targeting-impact#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/user-reminders#build. Please check your `outputs` key in `turbo.json`
 WARNING  no output files found for task @croco-example/warehouse-explorer#build. Please check your `outputs` key in `turbo.json`

```

### Summarized tests

- ID: `test`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/test-lane-runner.mts --lane fast --output ci-reports/package-quality/fast-test-lane.json`
- Started at: 2026-10-17T20:47:26.284Z
- Completed at: 2026-10-17T21:01:12.739Z
- Duration: 826.46s
- Timeout: 2700s
- Failure reason: none

Artifacts:
- Fast test lane evidence (required): `ci-reports/package-quality/fast-test-lane.json` present; modified at 2026-10-17T21:01:12.729Z; copied to `ci-reports/release/artifacts/test/fast-test-lane.json`

stdout excerpt:

```text
[truncated 221616 chars]
roup::@croco-example/experiment-runtime:test:evidence
cache miss, executing 2e76e518e9cf7874
$ pnpm run test --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
$ vitest run --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
JSON report written to /home/runner/work/framework/framework/examples/experiment-runtime/.turbo/croco-test-evidence.json
::endgroup::
::group::@croco-example/lifecycle-journey:test:evidence
cache miss, executing 32c2790ad9fc20e2
$ pnpm run test --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
$ vitest run src/tests/TaskRecovery.spec.ts --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
JSON report written to /home/runner/work/framework/framework/examples/lifecycle-journey/.turbo/croco-test-evidence.json
::endgroup::
::group::@croco-example/cancellation-flow:test:evidence
cache miss, executing ca004c271734cce0
$ pnpm run test --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
$ vitest run src/tests --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
JSON report written to /home/runner/work/framework/framework/examples/cancellation-flow/.turbo/croco-test-evidence.json
::endgroup::
::group::@croco-example/saved-intents:test:evidence
cache miss, executing eb5f82e2d1ea712f
$ pnpm run test --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
$ vitest run --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
JSON report written to /home/runner/work/framework/framework/examples/saved-intents/.turbo/croco-test-evidence.json
::endgroup::
::group::@croco-example/promotion-offers:test:evidence
cache miss, executing 7d975563eb70bc86
$ pnpm run test --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
$ vitest run src/tests --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
JSON report written to /home/runner/work/framework/framework/examples/promotion-offers/.turbo/croco-test-evidence.json
::endgroup::
::group::@croco-example/targeting-impact:test:evidence
cache miss, executing 0cdbbd604a3eb8b9
$ pnpm run test --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
$ vitest run --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
JSON report written to /home/runner/work/framework/framework/examples/targeting-impact/.turbo/croco-test-evidence.json
::endgroup::
::group::@croco/admin-react:test:evidence
cache miss, executing 72b2f2b356588324
$ pnpm run test --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
$ vitest run --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
▲ [WARNING] Ignoring this import because "../gamification-core/dist/chunk-XQP54W6Z.mjs" was marked as having no side effects [ignored-bare-import]

    ../gamification-core/dist/mission-validation.mjs:1:54:
      1 │ ...-LD6UEROA.mjs";import"./chunk-XQP54W6Z.mjs";export{i as MissionI...
        ╵                         ~~~~~~~~~~~~~~~~~~~~~~

  "sideEffects" is false in the enclosing "package.json" file:

    ../gamification-core/package.json:14:2:
      14 │   "sideEffects": false,
         ╵   ~~~~~~~~~~~~~

JSON report written to /home/runner/work/framework/framework/packages/admin-react/.turbo/croco-test-evidence.json
::endgroup::
::group::@croco/cli:test:evidence
cache miss, executing f9e1311c92e12a88
$ pnpm run test --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
$ vitest run --exclude "src/tests/integration/**" --maxWorkers=1 --reporter=json --outputFile=.turbo/croco-test-evidence.json
JSON report written to /home/runner/work/framework/framework/packages/cli/.turbo/croco-test-evidence.json
::endgroup::

  Tasks:    301 successful, 301 total
 Cached:    153 cached, 301 total
   Time:    6m53.135s 
Summary:    /home/runner/work/framework/framework/.turbo/runs/3Kq1oZIpWc0nYFQqHF6SPoRQCbs.json


```

stderr excerpt:

```text
[truncated 6952 chars]
EAD is now at 432ee25 base
Warning: you are leaving 1 commit behind, not connected to
any of your branches:

  ff76e5a Merge commit 'a96f3dbc55bf415083954c48524b8fc22e0a5a72' into HEAD

If you want to keep it by creating a new branch, this may be a good time
to do so with:

 git branch <new-branch-name> ff76e5a

Switched to a new branch 'side'
HEAD is now at e066e19 side
Switched to a new branch 'pull-request'
HEAD is now at 432ee25 base
Warning: you are leaving 1 commit behind, not connected to
any of your branches:

  ff76e5a Merge commit 'a96f3dbc55bf415083954c48524b8fc22e0a5a72' into HEAD

If you want to keep it by creating a new branch, this may be a good time
to do so with:

 git branch <new-branch-name> ff76e5a

Switched to a new branch 'side'
HEAD is now at e066e19 side
Switched to a new branch 'pull-request'
Switched to branch 'trunk'
Switched to a new branch 'pull-request'
HEAD is now at 560f755 base
Warning: you are leaving 1 commit behind, not connected to
any of your branches:

  ec5c50e Merge commit '79b732958da8d8449ffbbe8b86c68d1049b21163' into HEAD

If you want to keep it by creating a new branch, this may be a good time
to do so with:

 git branch <new-branch-name> ec5c50e

Switched to branch 'pull-request'
Switched to a new branch 'pull-request'
HEAD is now at 560f755 base
Warning: you are leaving 1 commit behind, not connected to
any of your branches:

  ec5c50e Merge commit '79b732958da8d8449ffbbe8b86c68d1049b21163' into HEAD

If you want to keep it by creating a new branch, this may be a good time
to do so with:

 git branch <new-branch-name> ec5c50e

Switched to branch 'trunk'
Cloning into '.'...
From file:///tmp/croco-ci-verification-identity-EeqI7x
 * branch            ec5c50e33031dcdb672319df54194af55ce7f6ef -> FETCH_HEAD
Cloning into '.'...
From file:///tmp/croco-ci-verification-identity-EeqI7x
 * branch            ec5c50e33031dcdb672319df54194af55ce7f6ef -> FETCH_HEAD
 * branch            trunk      -> FETCH_HEAD
Switched to a new branch 'pull-request'
HEAD is now at 227de31 base
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
HEAD is now at c9eff81 base
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
- Started at: 2026-10-17T21:01:12.742Z
- Completed at: 2026-10-17T21:10:02.432Z
- Duration: 529.69s
- Timeout: 1800s
- Failure reason: none

Artifacts:
- Integration test lane evidence (required): `ci-reports/package-quality/integration-test-lane.json` present; modified at 2026-10-17T21:10:02.424Z; copied to `ci-reports/release/artifacts/integration-test-lane/integration-test-lane.json`

stdout excerpt:

```text
JSON report written to /tmp/croco-test-lane-zsNAxp/vitest.json
JSON report written to /tmp/croco-test-lane-4mGs5w/vitest.json
JSON report written to /tmp/croco-test-lane-vlUZk6/vitest.json

Running 1 test using 1 worker
·
  1 passed (5.2m)
JSON report written to /tmp/croco-test-lane-wspQC0/vitest.json
JSON report written to /tmp/croco-test-lane-T2OkDN/vitest.json
JSON report written to /tmp/croco-test-lane-LQkXYs/vitest.json
JSON report written to /tmp/croco-test-lane-RCN3r0/vitest.json
JSON report written to /tmp/croco-test-lane-IJtTjt/vitest.json
JSON report written to /tmp/croco-test-lane-x39qnW/vitest.json

```

stderr excerpt:

```text
$ vitest run src/tests/Integration.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-zsNAxp/vitest.json
$ vitest run src/tests/integration/CliCommandIntegration.spec.ts src/tests/integration/e2e.spec.ts src/tests/integration/jobs-e2e.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-4mGs5w/vitest.json
$ vitest run src/tests/E2E.spec.ts src/tests/e2e-advanced.spec.ts src/tests/e2e-vite-spa.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-vlUZk6/vitest.json
$ playwright test e2e/verify-starlight.spec.ts --reporter=json
$ CROCO_TEST_REAL_RESOURCES=1 vitest run src/tests/OutboxFactSource.integration.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-wspQC0/vitest.json
$ vitest run src/__tests__/e2e.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-T2OkDN/vitest.json
$ vitest run src/tests/e2e.spec.ts src/tests/real-app.e2e.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-LQkXYs/vitest.json
$ vitest run src/tests/TaskRunner.integration.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-RCN3r0/vitest.json
$ CROCO_TEST_REAL_RESOURCES=1 vitest run src/tests/AssignedOutcome.integration.spec.ts src/tests/Pipeline.integration.spec.ts src/tests/PostgresMetricRead.integration.spec.ts src/tests/PostgresWarehouseFacts.integration.spec.ts src/tests/PostgresWarehouseReader.integration.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-IJtTjt/vitest.json
$ CROCO_TEST_REAL_RESOURCES=1 vitest run src/tests/DataCompiler.integration.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-x39qnW/vitest.json

```

### Inventory published-consumer test lane

- ID: `published-test-lane`
- Status: passed
- Selection reason: Selected for the full published-consumer inventory.
- Command: `node --experimental-strip-types scripts/test-lane-runner.mts --lane published --output ci-reports/package-quality/published-test-lane.json`
- Started at: 2026-10-17T21:10:02.435Z
- Completed at: 2026-10-17T21:11:08.676Z
- Duration: 66.24s
- Timeout: 2700s
- Failure reason: none

Artifacts:
- Published-consumer test lane evidence (required): `ci-reports/package-quality/published-test-lane.json` present; modified at 2026-10-17T21:11:08.665Z; copied to `ci-reports/release/artifacts/published-test-lane/published-test-lane.json`

stdout excerpt:

```text
JSON report written to /tmp/croco-test-lane-P6fLul/vitest.json
JSON report written to /tmp/croco-test-lane-NWUa1z/vitest.json
JSON report written to /tmp/croco-test-lane-ToVNQ5/vitest.json
JSON report written to /tmp/croco-test-lane-EJfHtW/vitest.json
JSON report written to /tmp/croco-test-lane-9XJ7Or/vitest.json
JSON report written to /tmp/croco-test-lane-liF2qq/vitest.json
JSON report written to /tmp/croco-test-lane-8UOi3C/vitest.json
JSON report written to /tmp/croco-test-lane-u27e11/vitest.json
JSON report written to /tmp/croco-test-lane-AHIy0y/vitest.json
JSON report written to /tmp/croco-test-lane-mLoQSU/vitest.json
JSON report written to /tmp/croco-test-lane-IxMxEx/vitest.json
JSON report written to /tmp/croco-test-lane-8X7hZE/vitest.json
JSON report written to /tmp/croco-test-lane-HVZfvB/vitest.json
JSON report written to /tmp/croco-test-lane-0QSC5f/vitest.json

```

stderr excerpt:

```text
$ vitest run src/tests/PublishedCli.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-P6fLul/vitest.json
$ vitest run src/tests/PublishedMessageContracts.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-NWUa1z/vitest.json
$ vitest run src/tests/PublishedGraphConsumer.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-ToVNQ5/vitest.json
$ vitest run src/tests/PublishedTypes.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-EJfHtW/vitest.json
$ vitest run src/tests/published-contract.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-9XJ7Or/vitest.json
$ vitest run src/tests/PublishedCli.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-liF2qq/vitest.json
$ vitest run src/tests/PublishedReactEmail.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-8UOi3C/vitest.json
$ vitest run src/tests/PublishedPolicyTypes.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-u27e11/vitest.json
$ vitest run src/tests/PublishedCli.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-AHIy0y/vitest.json
$ vitest run src/tests/PublishedSearchable.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-mLoQSU/vitest.json
$ vitest run src/tests/PublishedTypes.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-IxMxEx/vitest.json
$ vitest run src/tests/PublishedTypes.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-8X7hZE/vitest.json
$ vitest run src/tests/PublishedWorkerTypes.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-HVZfvB/vitest.json
$ vitest run src/tests/PublishedListen.spec.ts --reporter=json --outputFile=/tmp/croco-test-lane-0QSC5f/vitest.json

```

### Enforced test execution evidence

- ID: `test-evidence-reconcile`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/test-evidence-reconcile.mts --profile publish --lane-report ci-reports/package-quality/fast-test-lane.json --lane-report ci-reports/package-quality/integration-test-lane.json --lane-report ci-reports/package-quality/published-test-lane.json --materialization-evidence ci-reports/generated-apps/materialization-evidence.json --generated-root ci-reports/generated-apps/materialized-tests --required-generated-path packages/create-croco-app/templates/addons/graphql-standalone/apps/graphql-api/src/formatGraphQLError.spec.ts --required-generated-path packages/create-croco-app/templates/addons/trpc-nextjs/apps/web/src/server/tests/LocalSessionProvider.spec.ts --required-generated-path packages/create-croco-app/templates/addons/trpc-nextjs/apps/web/src/server/tests/ProductTrials.spec.ts --required-generated-path packages/create-croco-app/templates/admin-console/apps/api-server/src/tests/AdminConsole.spec.ts --required-generated-path packages/create-croco-app/templates/admin-console/apps/api-server/src/tests/CreditOperations.spec.ts --required-generated-path packages/create-croco-app/templates/admin-console/tests/journeys/plan-release.spec.ts --required-generated-path packages/create-croco-app/templates/ai-saas/apps/api-server/src/tests/AiGenerate.spec.ts --required-generated-path packages/create-croco-app/templates/ai-saas/apps/api-server/src/tests/AiReceipts.spec.ts --required-generated-path packages/create-croco-app/templates/ai-saas/apps/api-server/src/tests/AiSaas.spec.ts --required-generated-path packages/create-croco-app/templates/base-ddd/libs/shared/utils-env/src/tests/createEnv.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/ContractFuzz.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/ExecutableAssurance.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/FileBillableUsageJournal.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/FileUsageBillingGateway.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/GeneratedTelemetryEndpoint.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/ProviderProfileEnv.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/SaasDemo.spec.ts --required-generated-path packages/create-croco-app/templates/saas/apps/api-server/src/tests/node-lifecycle.spec.ts --required-generated-path packages/create-croco-app/templates/spa-be-split/apps/api-server/src/tests/app.spec.ts --required-generated-path packages/create-croco-app/templates/spa-be-split/apps/api-server/src/tests/env.spec.ts --required-generated-path packages/create-croco-app/templates/spa-be-split/apps/api-server/src/tests/node-lifecycle.spec.ts --required-generated-path packages/create-croco-app/templates/spa-be-split/apps/console-web/src/tests/ProblemNotice.spec.tsx --required-generated-path packages/create-croco-app/templates/spa-be-split/tests/journeys/create-user.spec.ts --required-generated-path packages/create-croco-app/templates/spa-be-split/tests/journeys/problem-rendering.spec.ts --output ci-reports/package-quality/test-evidence.json`
- Started at: 2026-10-17T21:11:08.679Z
- Completed at: 2026-10-17T21:11:08.843Z
- Duration: 0.17s
- Timeout: 300s
- Failure reason: none

Artifacts:
- Enforced test evidence (required): `ci-reports/package-quality/test-evidence.json` present; modified at 2026-10-17T21:11:08.831Z; copied to `ci-reports/release/artifacts/test-evidence-reconcile/test-evidence.json`

### Packed installed CLI integration evidence

- ID: `cli-packed-e2e`
- Status: not_applicable
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/test-lane-evidence-check.mts --report ci-reports/package-quality/integration-test-lane.json --lane integration --path packages/cli/src/tests/integration/CliCommandIntegration.spec.ts`
- Started at: not started
- Completed at: 2026-10-17T21:11:08.684Z
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
- Started at: 2026-10-17T19:53:12.207Z
- Completed at: 2026-10-17T19:53:13.400Z
- Duration: 1.19s
- Timeout: 600s
- Failure reason: none

Artifacts:
- Provider certification markdown (required): `ci-reports/package-quality/provider-certification.md` present; modified at 2026-10-17T19:53:12.916Z; copied to `ci-reports/release/artifacts/provider-certification/provider-certification.md`
- Provider certification JSON (required): `ci-reports/package-quality/provider-certification.json` present; modified at 2026-10-17T19:53:12.917Z; copied to `ci-reports/release/artifacts/provider-certification/provider-certification.json`

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
- Selection reason: Selected because package accountability inputs changed: packages/cli/src/tests/doctor.spec.ts, packages/docs/src/content/docs/api/problems-core/src/type-aliases/CrocoProblemRegistry.md, packages/docs/src/content/docs/en/reference/problem-recovery-cookbook.md, packages/problems-core/src/generated/problem-code-registry.ts, packages/testing/README.md, packages/testing/src/libs/telemetry-testing.ts, packages/testing/src/tests/testing.spec.ts.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported production-ready package violations -- node --experimental-strip-types scripts/production-ready-check.mts`
- Started at: 2026-10-17T21:11:08.849Z
- Completed at: 2026-10-17T21:11:11.311Z
- Duration: 2.46s
- Timeout: 600s
- Failure reason: none

Artifacts:
- Production-ready package markdown (required): `ci-reports/package-quality/production-ready.md` present; modified at 2026-10-17T21:11:10.394Z; copied to `ci-reports/release/artifacts/production-ready/production-ready.md`

stdout excerpt:

```text
production-ready-check: wrote /home/runner/work/framework/framework/ci-reports/package-quality/production-ready.md
production-ready-check: production packages=23
production-ready-check: blocking failures=0

```

### Beta spine promotion accountability

- ID: `spine-promotion`
- Status: passed
- Selection reason: Selected because package accountability inputs changed: packages/cli/src/tests/doctor.spec.ts, packages/docs/src/content/docs/api/problems-core/src/type-aliases/CrocoProblemRegistry.md, packages/docs/src/content/docs/en/reference/problem-recovery-cookbook.md, packages/problems-core/src/generated/problem-code-registry.ts, packages/testing/README.md, packages/testing/src/libs/telemetry-testing.ts, packages/testing/src/tests/testing.spec.ts.
- Command: `node --experimental-strip-types scripts/tracked-file-mutation-guard.mts --recovery Fix the reported beta spine promotion violations -- node --experimental-strip-types scripts/spine-promotion-check.mts --package cli --package docs --package problems-core --package testing`
- Started at: 2026-10-17T21:11:11.322Z
- Completed at: 2026-10-17T21:11:13.701Z
- Duration: 2.38s
- Timeout: 600s
- Failure reason: none

Artifacts:
- Beta spine promotion markdown (required): `ci-reports/package-quality/spine-promotion.md` present; modified at 2026-10-17T21:11:13.208Z; copied to `ci-reports/release/artifacts/spine-promotion/spine-promotion.md`

stdout excerpt:

```text
spine-promotion-check: wrote /home/runner/work/framework/framework/ci-reports/package-quality/spine-promotion.md
spine-promotion-check: beta spine packages=2
spine-promotion-check: blocking failures=0

```

### Core coverage gate

- ID: `core-coverage`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/core-coverage-runner.mts`
- Started at: 2026-10-17T21:11:08.686Z
- Completed at: 2026-10-17T21:17:19.268Z
- Duration: 370.58s
- Timeout: 2700s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
[truncated 173319 chars]
|   82.35 | ...25-140,171-174 
  data.ts          |   85.05 |     86.2 |   85.71 |    87.8 | ...48,180,254-262 
  ...topRemoved.ts |   77.77 |      100 |   33.33 |   77.77 | 21,36             
  di.ts            |     100 |      100 |     100 |     100 |                   
  diCheck.ts       |    82.6 |    75.65 |   82.75 |    82.3 | ...52,356-357,365 
  diGraph.ts       |   84.05 |    79.32 |   88.23 |   84.21 | ...23,628,634,641 
  doctor.ts        |   88.67 |    79.11 |   96.23 |   88.57 | ...5393,5415-5445 
  generate.ts      |     100 |      100 |     100 |     100 |                   
  ...teScaffold.ts |      60 |    45.45 |      50 |    64.7 | 35,79-92,97       
  ...eDashboard.ts |   74.66 |    57.44 |   84.21 |   75.67 | ...1224,1247-1265 
  jobs.ts          |    81.2 |    57.66 |    82.5 |   81.81 | ...84,689,696,710 
  make.ts          |     100 |      100 |     100 |     100 |                   
  ...Controller.ts |     100 |    85.71 |     100 |     100 | 121-124           
  makeEntity.ts    |   77.77 |    64.28 |      50 |   77.77 | 36-37,84-90       
  makeEvent.ts     |      80 |    64.28 |      50 |      80 | 38-39,96-102      
  makeListener.ts  |   78.94 |    64.28 |      50 |   78.94 | 37-38,98-104      
  ...Repository.ts |   78.94 |    64.28 |      50 |   78.94 | 37-38,108-114     
  migrate.ts       |   91.73 |    86.17 |      96 |   91.22 | ...72-376,382,391 
  ops.ts           |   33.33 |        0 |       0 |   33.33 | 60-69,108-118     
  options.ts       |     100 |      100 |     100 |     100 |                   
  pipeline.ts      |   93.47 |    89.36 |     100 |   95.34 | 93,100            
  projectMap.ts    |   72.86 |    58.25 |   71.96 |   72.68 | ...1795,1810,1829 
  resolveCliBin.ts |     100 |      100 |     100 |     100 |                   
  root.ts          |   80.47 |    82.83 |   73.07 |   81.76 | ...98,443-447,452 
  runtimePolicy.ts |   68.42 |     67.6 |   83.33 |   68.08 | ...19,323-324,332 
  testPlan.ts      |   85.24 |    77.55 |   80.64 |   84.95 | ...82,351-352,361 
  upgrade.ts       |   88.51 |    77.65 |    92.3 |   88.27 | ...24,341,346,458 
  upgradeRules.ts  |   98.57 |    84.37 |     100 |   98.41 | 231               
 src/libs          |    87.2 |    83.67 |   92.98 |   90.29 |                   
  CliError.ts      |     100 |      100 |     100 |     100 |                   
  ...tReadTools.ts |   87.36 |    86.27 |   83.33 |   93.02 | ...01,155,175,184 
  ...ntEvidence.ts |     100 |      100 |     100 |     100 |                   
  cliRuntime.ts    |   68.96 |     82.6 |   61.11 |   67.85 | ...48-49,70,81-88 
  constants.ts     |     100 |      100 |     100 |     100 |                   
  ...tionTarget.ts |   89.25 |    76.92 |   97.14 |   92.59 | ...05,221-223,257 
  ...ageFilters.ts |     100 |    85.71 |     100 |     100 | 14                
  ...tedCommand.ts |   95.45 |       92 |     100 |     100 | 49-59             
  ...osticCodes.ts |    90.9 |       75 |      80 |    90.9 | 199               
  fileWriter.ts    |   87.86 |    87.59 |     100 |   87.85 | ...14,517-518,531 
  ...rtContract.ts |     100 |     91.3 |     100 |     100 | 115,125           
  naming.ts        |    75.6 |       75 |     100 |   86.36 | ...65,169,173,214 
  ops.ts           |   92.78 |    87.67 |   95.83 |   93.54 | ...31,237,312,317 
  prompts.ts       |     100 |      100 |     100 |     100 |                   
  workspace.ts     |     100 |      100 |     100 |     100 |                   
 src/libs/codemods |   89.65 |    86.14 |     100 |   92.94 |                   
  ...Controller.ts |   89.65 |    86.14 |     100 |   92.94 | ...59,278,405,409 
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

(node:123880) ExperimentalWarning: v8.queryObjects() is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)

```

### Core coverage warning report

- ID: `core-coverage-warning`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/core-coverage-warning-check.mts`
- Started at: 2026-10-17T21:17:19.272Z
- Completed at: 2026-10-17T21:17:19.395Z
- Duration: 0.12s
- Timeout: 600s
- Failure reason: none

Artifacts:
- Core coverage warning markdown (required): `ci-reports/coverage/core-warning/report.md` present; modified at 2026-10-17T21:17:19.384Z; copied to `ci-reports/release/artifacts/core-coverage-warning/report.md`

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
- Started at: 2026-10-17T19:53:13.404Z
- Completed at: 2026-10-17T19:53:17.199Z
- Duration: 3.80s
- Timeout: 600s
- Failure reason: none

Artifacts:
- Public API diff markdown (required): `ci-reports/package-quality/public-api-diff.md` present; modified at 2026-10-17T19:53:16.768Z; copied to `ci-reports/release/artifacts/public-api/public-api-diff.md`
- Public API summary JSON (required): `ci-reports/package-quality/public-api-summary.json` present; modified at 2026-10-17T19:53:16.768Z; copied to `ci-reports/release/artifacts/public-api/public-api-summary.json`

stdout excerpt:

```text
public-api-surface: 139 package public API snapshot(s) match.

```

### Release-gate maintenance test evidence

- ID: `release-gate-tests`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/test-lane-evidence-check.mts --report ci-reports/package-quality/fast-test-lane.json --lane fast --path scripts/tests/alpha-release-smoke.spec.ts --path scripts/tests/api-docs-trigger-check.spec.ts --path scripts/tests/architecture-policy-check.spec.ts --path scripts/tests/bench-threshold-check.spec.ts --path scripts/tests/benchmark-workflow.spec.ts --path scripts/tests/branch-protection-policy.spec.ts --path scripts/tests/changeset-required-check.spec.ts --path scripts/tests/ci-executable-policy.spec.ts --path scripts/tests/ci-performance-budget.spec.ts --path scripts/tests/ci-verification-identity.spec.ts --path scripts/tests/ci-workflow.spec.ts --path scripts/tests/compiler-baseline-check.spec.ts --path scripts/tests/core-coverage-warning-check.spec.ts --path scripts/tests/create-croco-app-generated-smoke.spec.ts --path scripts/tests/dependency-audit-policy.spec.ts --path scripts/tests/doc-examples-check.spec.ts --path scripts/tests/first-success-verify.spec.ts --path scripts/tests/generated-secret-placeholder-policy.spec.ts --path scripts/tests/live-tests-workflow.spec.ts --path scripts/tests/normalize-packages.spec.ts --path scripts/tests/package-bin-smoke.spec.ts --path scripts/tests/package-docs-check.spec.ts --path scripts/tests/package-entrypoint-smoke.spec.ts --path scripts/tests/package-manifest-contracts.spec.ts --path scripts/tests/package-quality-report.spec.ts --path scripts/tests/package-roles.spec.ts --path scripts/tests/package-test-typecheck-check.spec.ts --path scripts/tests/problem-registry.spec.ts --path scripts/tests/production-ready-check.spec.ts --path scripts/tests/provenance-config-check.spec.ts --path scripts/tests/provider-certification-check.spec.ts --path scripts/tests/public-api-surface.spec.ts --path scripts/tests/release-docs-check.spec.ts --path scripts/tests/release-metadata-check.spec.ts --path scripts/tests/release-spine-evidence.spec.ts --path scripts/tests/release-version-sync.spec.ts --path scripts/tests/release-workflow.spec.ts --path scripts/tests/repository-policy-audit-workflow.spec.ts --path scripts/tests/security-allowlist-metadata-check.spec.ts --path scripts/tests/spine-promotion-check.spec.ts --path scripts/tests/static-misuse-check.spec.ts --path scripts/tests/strict-contract-typecheck.spec.ts --path scripts/tests/test-evidence-reconcile.spec.ts --path scripts/tests/test-inventory.spec.ts --path scripts/tests/test-lane-evidence-check.spec.ts --path scripts/tests/test-lane-runner.spec.ts --path scripts/tests/tracked-file-mutation-guard.spec.ts --path scripts/tests/turbo-cache-contract.spec.ts --path scripts/tests/turbo-canonical-cache.spec.ts --path scripts/tests/turbo-task-contract.spec.ts --path scripts/tests/verification-change-classifier.spec.ts --path scripts/tests/verification-command.spec.ts --path scripts/tests/verification-manifest.spec.ts --path scripts/tests/verification-policy.spec.ts --path scripts/tests/verify-circular-allowlist.spec.ts`
- Started at: 2026-10-17T21:01:12.747Z
- Completed at: 2026-10-17T21:01:12.947Z
- Duration: 0.20s
- Timeout: 120s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
[test-lane-evidence] fast report covers 55 required paths

```

### Spine bundle-size warning report

- ID: `spine-bundle-size`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/package-quality-report.mts`
- Started at: 2026-10-17T21:11:13.706Z
- Completed at: 2026-10-17T21:11:14.132Z
- Duration: 0.43s
- Timeout: 600s
- Failure reason: none

Artifacts:
- Package quality dashboard markdown (required): `ci-reports/package-quality/report.md` present; modified at 2026-10-17T21:11:14.077Z; copied to `ci-reports/release/artifacts/spine-bundle-size/report.md`
- Package quality dashboard JSON (required): `ci-reports/package-quality/summary.json` present; modified at 2026-10-17T21:11:14.081Z; copied to `ci-reports/release/artifacts/spine-bundle-size/summary.json`
- Bundle-size enforcement markdown (required): `ci-reports/package-quality/bundle-size.md` present; modified at 2026-10-17T21:11:14.087Z; copied to `ci-reports/release/artifacts/spine-bundle-size/bundle-size.md`

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
- Started at: 2026-10-17T19:53:17.202Z
- Completed at: 2026-10-17T19:53:24.657Z
- Duration: 7.46s
- Timeout: 600s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
dependency-audit-policy: pnpm audit --json started timeoutMs=120000
dependency-audit-policy: pnpm audit --json completed elapsedMs=729 status=1 signal=null
dependency-audit-policy: pnpm audit --prod --json started timeoutMs=120000
dependency-audit-policy: pnpm audit --prod --json completed elapsedMs=626 status=1 signal=null
dependency-audit-policy: generated template pnpm audit --json started timeoutMs=120000
dependency-audit-policy: generated template pnpm audit --json completed elapsedMs=736 status=0 signal=null
dependency-audit-policy: wrote ci-reports/security/dependency-audit-policy.md
dependency-audit-policy: passed

```

### npm provenance configuration

- ID: `provenance-config`
- Status: passed
- Selection reason: Always selected by this verification profile.
- Command: `node --experimental-strip-types scripts/provenance-config-check.mts`
- Started at: 2026-10-17T19:53:24.660Z
- Completed at: 2026-10-17T19:53:24.928Z
- Duration: 0.27s
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
- Started at: 2026-10-17T21:17:19.276Z
- Completed at: 2026-10-17T21:18:37.409Z
- Duration: 78.13s
- Timeout: 1800s
- Failure reason: none

Artifacts:
- none

stdout excerpt:

```text
[truncated 61310 chars]
.org 200 70ms
[WARN] Skipped OIDC: ERR_PNPM_AUTH_TOKEN_EXCHANGE: Failed token exchange request with body message: Unknown error (status code 404)
📦 @croco/cli@0.0.4 → https://registry.npmjs.org/
[WARN] Skip publishing @croco/cli@0.0.4 (dry run)
GET https://run-actions-1-azure-eastus.actions.githubusercontent.com/123//idtoken/37d3b866-1922-8de4-86e6-53e736ae2482/695c9813-32df-569f-9dc7-eefce2598466?api-version=2.0&audience=npm%3Aregistry.npmjs.org 200 69ms
[WARN] Skipped OIDC: ERR_PNPM_AUTH_TOKEN_EXCHANGE: Failed token exchange request with body message: Unknown error (status code 404)
📦 @croco/admin-ops@0.1.0 → https://registry.npmjs.org/
[WARN] Skip publishing @croco/admin-ops@0.1.0 (dry run)
GET https://run-actions-1-azure-eastus.actions.githubusercontent.com/123//idtoken/37d3b866-1922-8de4-86e6-53e736ae2482/695c9813-32df-569f-9dc7-eefce2598466?api-version=2.0&audience=npm%3Aregistry.npmjs.org 200 67ms
[WARN] Skipped OIDC: ERR_PNPM_AUTH_TOKEN_EXCHANGE: Failed token exchange request with body message: Unknown error (status code 404)
📦 @croco/admin-postgres@0.1.0 → https://registry.npmjs.org/
[WARN] Skip publishing @croco/admin-postgres@0.1.0 (dry run)
GET https://run-actions-1-azure-eastus.actions.githubusercontent.com/123//idtoken/37d3b866-1922-8de4-86e6-53e736ae2482/695c9813-32df-569f-9dc7-eefce2598466?api-version=2.0&audience=npm%3Aregistry.npmjs.org 200 61ms
[WARN] Skipped OIDC: ERR_PNPM_AUTH_TOKEN_EXCHANGE: Failed token exchange request with body message: Unknown error (status code 404)
📦 @croco/frontend-cloudflare@0.1.0 → https://registry.npmjs.org/
[WARN] Skip publishing @croco/frontend-cloudflare@0.1.0 (dry run)
GET https://run-actions-1-azure-eastus.actions.githubusercontent.com/123//idtoken/37d3b866-1922-8de4-86e6-53e736ae2482/695c9813-32df-569f-9dc7-eefce2598466?api-version=2.0&audience=npm%3Aregistry.npmjs.org 200 63ms
[WARN] Skipped OIDC: ERR_PNPM_AUTH_TOKEN_EXCHANGE: Failed token exchange request with body message: Unknown error (status code 404)
📦 @croco/ui-astryx@0.1.0 → https://registry.npmjs.org/
[WARN] Skip publishing @croco/ui-astryx@0.1.0 (dry run)
GET https://run-actions-1-azure-eastus.actions.githubusercontent.com/123//idtoken/37d3b866-1922-8de4-86e6-53e736ae2482/695c9813-32df-569f-9dc7-eefce2598466?api-version=2.0&audience=npm%3Aregistry.npmjs.org 200 66ms
[WARN] Skipped OIDC: ERR_PNPM_AUTH_TOKEN_EXCHANGE: Failed token exchange request with body message: Unknown error (status code 404)
📦 @croco/invitation-core@0.0.4 → https://registry.npmjs.org/
[WARN] Skip publishing @croco/invitation-core@0.0.4 (dry run)
GET https://run-actions-1-azure-eastus.actions.githubusercontent.com/123//idtoken/37d3b866-1922-8de4-86e6-53e736ae2482/695c9813-32df-569f-9dc7-eefce2598466?api-version=2.0&audience=npm%3Aregistry.npmjs.org 200 69ms
[WARN] Skipped OIDC: ERR_PNPM_AUTH_TOKEN_EXCHANGE: Failed token exchange request with body message: Unknown error (status code 404)
📦 @croco/membership-drizzle@0.0.4 → https://registry.npmjs.org/
[WARN] Skip publishing @croco/membership-drizzle@0.0.4 (dry run)
GET https://run-actions-1-azure-eastus.actions.githubusercontent.com/123//idtoken/37d3b866-1922-8de4-86e6-53e736ae2482/695c9813-32df-569f-9dc7-eefce2598466?api-version=2.0&audience=npm%3Aregistry.npmjs.org 200 66ms
[WARN] Skipped OIDC: ERR_PNPM_AUTH_TOKEN_EXCHANGE: Failed token exchange request with body message: Unknown error (status code 404)
📦 @croco/admin-react@0.1.0 → https://registry.npmjs.org/
[WARN] Skip publishing @croco/admin-react@0.1.0 (dry run)
GET https://run-actions-1-azure-eastus.actions.githubusercontent.com/123//idtoken/37d3b866-1922-8de4-86e6-53e736ae2482/695c9813-32df-569f-9dc7-eefce2598466?api-version=2.0&audience=npm%3Aregistry.npmjs.org 200 72ms
[WARN] Skipped OIDC: ERR_PNPM_AUTH_TOKEN_EXCHANGE: Failed token exchange request with body message: Unknown error (status code 404)
📦 @croco/invitation-drizzle@0.0.4 → https://registry.npmjs.org/
[WARN] Skip publishing @croco/invitation-drizzle@0.0.4 (dry run)

```

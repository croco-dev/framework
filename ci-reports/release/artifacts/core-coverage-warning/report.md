# Core Coverage Warning Report

- coverage 실행: gate step (`pnpm test:coverage:core`)에서 별도 실행
- PR 표시: CI job summary와 `core-coverage-warning-report` artifact에 동일 report 게시
- 종료 코드: 1.0 spine 누락과 invalid baseline data는 실패한다. 비-spine selection warning과 baseline regression warning은 advisory로 남긴다.

## 현재 core coverage set
- @croco/framework-context
- @croco/problems-core
- @croco/protocols-core
- @croco/protocols-rest
- @croco/openapi-spec
- @croco/rpc-codegen
- @croco/transports-http
- @croco/telemetry-api
- @croco/telemetry-sdk-node
- @croco/tx-core
- @croco/tx-drizzle
- @croco/events-core
- @croco/events-tx
- @croco/retry-core
- @croco/idempotency-core
- @croco/testing
- create-croco-app
- @croco/cli
- @croco/auth-core

## Selection 정책 신호
- 후보 입력: `docs/package-catalog.json`, public workspace package manifest, `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`.
- 후보 신호: 1.0 spine package, production-ready maturity, Core/Integration/Protocol/Transport catalog group, retry/events/context/auth/telemetry/transport/health/problem/framework contract package.
- 1.0 spine 누락은 실패한다. 비-spine 누락 후보는 warning-only로 보고한다.
- 임시 제외가 필요하면 `scripts/core-coverage-warning-check.mts`의 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 package name과 사유를 추가한다.

## Core coverage selection candidates
| 패키지 | Current set | Status | Signals | Recovery action |
| --- | --- | --- | --- | --- |
| `@croco/admin-generated` | not included | warning | catalog group: Protocol | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/admin-generated`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/ai-usage` | not included | warning | production-ready maturity | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/ai-usage`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/analytics-posthog` | not included | warning | catalog group: Integration | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/analytics-posthog`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/audit-core` | not included | warning | production-ready maturity | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/audit-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/auth-better-auth` | not included | warning | auth contract | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/auth-better-auth`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/auth-clerk` | not included | warning | auth contract | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/auth-clerk`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/auth-core` | included | included | auth contract, production-ready maturity | 현재 core coverage set에 포함됨. |
| `@croco/auth-drizzle` | not included | warning | auth contract | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/auth-drizzle`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/billing-core` | not included | warning | production-ready maturity | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/billing-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/cache-core` | not included | warning | catalog group: Core | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/cache-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/cli` | included | included | 1.0 spine package | 현재 core coverage set에 포함됨. |
| `@croco/dataloader-core` | not included | warning | catalog group: Core, production-ready maturity | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/dataloader-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/diagnostics-core` | not included | warning | catalog group: Core | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/diagnostics-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/etl-events-tx` | not included | warning | catalog group: Integration | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/etl-events-tx`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/events-core` | included | included | 1.0 spine package, catalog group: Core, events contract, production-ready maturity | 현재 core coverage set에 포함됨. |
| `@croco/events-inmemory` | not included | warning | catalog group: Core, events contract | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/events-inmemory`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/events-tx` | included | included | 1.0 spine package, catalog group: Core, events contract | 현재 core coverage set에 포함됨. |
| `@croco/features-posthog` | not included | warning | catalog group: Integration | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/features-posthog`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/framework-config` | not included | warning | catalog group: Core, framework-level contract | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/framework-config`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/framework-context` | included | included | 1.0 spine package, catalog group: Core, framework-level contract, production-ready maturity, request/context contract | 현재 core coverage set에 포함됨. |
| `@croco/framework-logger` | not included | warning | catalog group: Core, framework-level contract | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/framework-logger`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/framework-module` | not included | warning | catalog group: Core, framework-level contract | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/framework-module`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/framework-preset` | not included | warning | framework-level contract | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/framework-preset`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/framework-routes` | not included | warning | catalog group: Core, framework-level contract | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/framework-routes`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/gid-core` | not included | warning | catalog group: Core | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/gid-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/health-core` | not included | warning | catalog group: Core, health/readiness contract | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/health-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/idempotency-core` | included | included | 1.0 spine package, catalog group: Core | 현재 core coverage set에 포함됨. |
| `@croco/integrations-posthog` | not included | warning | catalog group: Integration | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/integrations-posthog`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/invitation-core` | not included | warning | production-ready maturity | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/invitation-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/membership-core` | not included | warning | production-ready maturity | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/membership-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/metering-core` | not included | warning | production-ready maturity | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/metering-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/metrics-core` | not included | warning | production-ready maturity | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/metrics-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/migration-runner` | not included | warning | production-ready maturity | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/migration-runner`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/openapi-spec` | included | included | 1.0 spine package, catalog group: Protocol | 현재 core coverage set에 포함됨. |
| `@croco/outbox-core` | not included | warning | catalog group: Core | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/outbox-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/pagination-core` | not included | warning | catalog group: Core | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/pagination-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/problems-core` | included | included | 1.0 spine package, catalog group: Core, failure/problem contract, production-ready maturity | 현재 core coverage set에 포함됨. |
| `@croco/protocol-codegen` | not included | warning | catalog group: Protocol | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/protocol-codegen`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/protocols-core` | included | included | 1.0 spine package, catalog group: Protocol | 현재 core coverage set에 포함됨. |
| `@croco/protocols-graphql` | not included | warning | catalog group: Protocol | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/protocols-graphql`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/protocols-rest` | included | included | 1.0 spine package, catalog group: Protocol, production-ready maturity | 현재 core coverage set에 포함됨. |
| `@croco/protocols-trpc` | not included | warning | catalog group: Protocol | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/protocols-trpc`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/ratelimit-core` | not included | warning | production-ready maturity | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/ratelimit-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/repository-core` | not included | warning | catalog group: Core, production-ready maturity | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/repository-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/retry-core` | included | included | 1.0 spine package, catalog group: Core, production-ready maturity, retry/reliability contract | 현재 core coverage set에 포함됨. |
| `@croco/rpc-codegen` | included | included | 1.0 spine package, catalog group: Protocol | 현재 core coverage set에 포함됨. |
| `@croco/search-core` | not included | warning | production-ready maturity | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/search-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/telemetry-api` | included | included | 1.0 spine package, catalog group: Integration, production-ready maturity, telemetry contract | 현재 core coverage set에 포함됨. |
| `@croco/telemetry-sdk-node` | included | included | 1.0 spine package, catalog group: Integration, production-ready maturity, telemetry contract | 현재 core coverage set에 포함됨. |
| `@croco/tenant-core` | not included | warning | catalog group: Core | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/tenant-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/testing` | included | included | 1.0 spine package | 현재 core coverage set에 포함됨. |
| `@croco/transports-cloudflare-workers` | not included | warning | transport runtime contract | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/transports-cloudflare-workers`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/transports-graphql` | not included | warning | catalog group: Transport, transport runtime contract | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/transports-graphql`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/transports-http` | included | included | 1.0 spine package, catalog group: Transport, production-ready maturity, transport runtime contract | 현재 core coverage set에 포함됨. |
| `@croco/tx-core` | included | included | 1.0 spine package, catalog group: Core, production-ready maturity | 현재 core coverage set에 포함됨. |
| `@croco/tx-drizzle` | included | included | 1.0 spine package, catalog group: Core, production-ready maturity | 현재 core coverage set에 포함됨. |
| `@croco/webhooks-core` | not included | warning | catalog group: Core | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/webhooks-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `create-croco-app` | included | included | 1.0 spine package | 현재 core coverage set에 포함됨. |

## Threshold 규칙
- lines: 60%
- branches: 60%
- functions: 60%
- statements: 60%
- 적용 조건: `CORE_COVERAGE=true`이고 현재 cwd가 핵심 패키지 경로일 때만 강제 threshold 적용

## 예외/범위 제한
- threshold 강제 범위는 `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 포함된 패키지로 고정한다.
- selection report는 core coverage 후보를 별도로 표시하지만, 자동으로 `test:coverage:core` filter를 확장하지 않는다.
- 전 저장소 일괄 threshold 강제는 이번 단계에서 도입하지 않는다.
- baseline 부재는 실패 대신 warning으로 기록한다.
- coverage summary가 있는 패키지의 0 baseline은 `INTENTIONAL_ZERO_BASELINE_REASONS`에 bootstrap 예외 사유가 없는 한 invalid data로 실패한다.

## 패키지별 결과
| 패키지 | Statements | Branches | Functions | Lines | Threshold warning | Baseline warning |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| `@croco/framework-context` | 86.19 | 75.20 | 94.25 | 86.28 | 없음 | 없음 |
| `@croco/problems-core` | 86.07 | 79.32 | 92.92 | 85.94 | 없음 | statements 86.07% < baseline 86.91%; lines 85.94% < baseline 86.77% |
| `@croco/protocols-core` | 86.32 | 75.73 | 92.19 | 86.69 | 없음 | functions 92.19% < baseline 92.61% |
| `@croco/protocols-rest` | 87.35 | 81.13 | 88.72 | 87.64 | 없음 | 없음 |
| `@croco/openapi-spec` | 91.57 | 81.85 | 92.94 | 91.23 | 없음 | statements 91.57% < baseline 91.82%; functions 92.94% < baseline 93.00%; lines 91.23% < baseline 91.55% |
| `@croco/rpc-codegen` | 91.19 | 81.19 | 96.92 | 91.12 | 없음 | 없음 |
| `@croco/transports-http` | 94.10 | 85.58 | 92.37 | 94.20 | 없음 | 없음 |
| `@croco/telemetry-api` | 91.95 | 91.95 | 92.98 | 92.62 | 없음 | 없음 |
| `@croco/telemetry-sdk-node` | 97.10 | 92.45 | 100.00 | 97.08 | 없음 | 없음 |
| `@croco/tx-core` | 97.53 | 90.90 | 100.00 | 97.50 | 없음 | statements 97.53% < baseline 98.15%; branches 90.90% < baseline 92.59%; lines 97.50% < baseline 98.12% |
| `@croco/tx-drizzle` | 86.56 | 78.05 | 91.76 | 86.54 | 없음 | statements 86.56% < baseline 96.90%; branches 78.05% < baseline 87.50%; functions 91.76% < baseline 96.96%; lines 86.54% < baseline 96.84% |
| `@croco/events-core` | 93.17 | 82.69 | 100.00 | 93.09 | 없음 | 없음 |
| `@croco/events-tx` | 92.96 | 86.98 | 92.70 | 93.34 | 없음 | 없음 |
| `@croco/retry-core` | 86.29 | 82.81 | 82.10 | 86.60 | 없음 | 없음 |
| `@croco/idempotency-core` | 86.22 | 80.15 | 97.00 | 86.43 | 없음 | statements 86.22% < baseline 89.81%; lines 86.43% < baseline 89.90% |
| `@croco/testing` | 84.11 | 76.84 | 87.01 | 84.38 | 없음 | 없음 |
| `create-croco-app` | 83.71 | 76.19 | 92.80 | 85.30 | 없음 | statements 83.71% < baseline 86.19%; branches 76.19% < baseline 78.36%; functions 92.80% < baseline 96.03%; lines 85.30% < baseline 89.60% |
| `@croco/cli` | 84.84 | 76.12 | 86.64 | 85.41 | 없음 | 없음 |
| `@croco/auth-core` | 95.99 | 91.51 | 100.00 | 96.10 | 없음 | 없음 |

## Warning summary
### Selection warnings
- @croco/admin-generated: candidate signals [catalog group: Protocol] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/admin-generated`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/ai-usage: candidate signals [production-ready maturity] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/ai-usage`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/analytics-posthog: candidate signals [catalog group: Integration] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/analytics-posthog`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/audit-core: candidate signals [production-ready maturity] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/audit-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/auth-better-auth: candidate signals [auth contract] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/auth-better-auth`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/auth-clerk: candidate signals [auth contract] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/auth-clerk`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/auth-drizzle: candidate signals [auth contract] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/auth-drizzle`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/billing-core: candidate signals [production-ready maturity] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/billing-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/cache-core: candidate signals [catalog group: Core] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/cache-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/dataloader-core: candidate signals [catalog group: Core, production-ready maturity] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/dataloader-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/diagnostics-core: candidate signals [catalog group: Core] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/diagnostics-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/etl-events-tx: candidate signals [catalog group: Integration] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/etl-events-tx`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/events-inmemory: candidate signals [catalog group: Core, events contract] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/events-inmemory`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/features-posthog: candidate signals [catalog group: Integration] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/features-posthog`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/framework-config: candidate signals [catalog group: Core, framework-level contract] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/framework-config`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/framework-logger: candidate signals [catalog group: Core, framework-level contract] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/framework-logger`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/framework-module: candidate signals [catalog group: Core, framework-level contract] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/framework-module`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/framework-preset: candidate signals [framework-level contract] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/framework-preset`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/framework-routes: candidate signals [catalog group: Core, framework-level contract] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/framework-routes`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/gid-core: candidate signals [catalog group: Core] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/gid-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/health-core: candidate signals [catalog group: Core, health/readiness contract] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/health-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/integrations-posthog: candidate signals [catalog group: Integration] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/integrations-posthog`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/invitation-core: candidate signals [production-ready maturity] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/invitation-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/membership-core: candidate signals [production-ready maturity] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/membership-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/metering-core: candidate signals [production-ready maturity] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/metering-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/metrics-core: candidate signals [production-ready maturity] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/metrics-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/migration-runner: candidate signals [production-ready maturity] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/migration-runner`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/outbox-core: candidate signals [catalog group: Core] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/outbox-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/pagination-core: candidate signals [catalog group: Core] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/pagination-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/protocol-codegen: candidate signals [catalog group: Protocol] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/protocol-codegen`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/protocols-graphql: candidate signals [catalog group: Protocol] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/protocols-graphql`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/protocols-trpc: candidate signals [catalog group: Protocol] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/protocols-trpc`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/ratelimit-core: candidate signals [production-ready maturity] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/ratelimit-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/repository-core: candidate signals [catalog group: Core, production-ready maturity] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/repository-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/search-core: candidate signals [production-ready maturity] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/search-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/tenant-core: candidate signals [catalog group: Core] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/tenant-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/transports-cloudflare-workers: candidate signals [transport runtime contract] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/transports-cloudflare-workers`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/transports-graphql: candidate signals [catalog group: Transport, transport runtime contract] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/transports-graphql`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/webhooks-core: candidate signals [catalog group: Core] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/webhooks-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.

### Missing coverage summaries
- 없음

### Threshold warnings
- 없음

### Core coverage configuration errors
- 없음

### Baseline data errors
- 없음

### Baseline regressions
- @croco/problems-core: statements 86.07% < baseline 86.91%
- @croco/problems-core: lines 85.94% < baseline 86.77%
- @croco/protocols-core: functions 92.19% < baseline 92.61%
- @croco/openapi-spec: statements 91.57% < baseline 91.82%
- @croco/openapi-spec: functions 92.94% < baseline 93.00%
- @croco/openapi-spec: lines 91.23% < baseline 91.55%
- @croco/tx-core: statements 97.53% < baseline 98.15%
- @croco/tx-core: branches 90.90% < baseline 92.59%
- @croco/tx-core: lines 97.50% < baseline 98.12%
- @croco/tx-drizzle: statements 86.56% < baseline 96.90%
- @croco/tx-drizzle: branches 78.05% < baseline 87.50%
- @croco/tx-drizzle: functions 91.76% < baseline 96.96%
- @croco/tx-drizzle: lines 86.54% < baseline 96.84%
- @croco/idempotency-core: statements 86.22% < baseline 89.81%
- @croco/idempotency-core: lines 86.43% < baseline 89.90%
- create-croco-app: statements 83.71% < baseline 86.19%
- create-croco-app: branches 76.19% < baseline 78.36%
- create-croco-app: functions 92.80% < baseline 96.03%
- create-croco-app: lines 85.30% < baseline 89.60%

## Enforce 전환 메모
- 대상 유지: `CORE_COVERAGE_PACKAGES`에 포함된 패키지부터 threshold를 유지한다.
- 신규 1.0 spine package는 `test:coverage:core`, `CORE_COVERAGE_PACKAGES`, baseline row가 모두 준비되어야 한다.
- 비-spine core 후보는 selection warning, coverage summary, baseline row가 PR summary에 표시된 뒤 core set에 추가한다.
- 비-spine selection warning을 blocking으로 전환하려면 누락 후보가 0이거나 각 후보에 만료 가능한 temporary exclusion 사유가 있어야 한다.
- baseline을 의도적으로 갱신할 때는 `pnpm test:coverage:core`를 먼저 실행하고, 생성된 `coverage-summary.json`의 total percentages를 `ci-reports/coverage/core-baseline.txt`에 반영한 뒤 `pnpm test:coverage:core:warning`을 실행한다.
- threshold 상향은 `retry-core functions` 개선 이후 별도 태스크에서 검토한다.
- baseline regression이 연속 0회가 아니라 안정적으로 해소된 이후에만 hard fail 전환을 검토한다.

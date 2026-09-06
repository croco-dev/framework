# Core Coverage Warning Report

- coverage 실행: gate step (`pnpm test:coverage:core`)에서 별도 실행
- PR 표시: CI job summary와 `core-coverage-warning-report` artifact에 동일 report 게시
- 종료 코드: 1.0 spine 누락, coverage/threshold set 불일치, invalid baseline data는 실패한다. 비-spine selection warning과 baseline regression warning은 advisory로 남긴다.

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

## 현재 core coverage threshold set
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
- 후보 입력: `docs/package-catalog.json`, public workspace package manifest, `package.json`의 `test:coverage:core` filter.
- 후보 신호: 1.0 spine package, production-ready maturity, Core/Integration/Protocol/Transport catalog group, retry/events/context/auth/telemetry/transport/health/problem/framework contract package.
- 1.0 spine 누락과 coverage/threshold set 불일치는 실패한다. 비-spine 누락 후보는 warning-only로 보고한다.
- 임시 제외가 필요하면 `scripts/core-coverage-warning-check.mts`의 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 package name과 사유를 추가한다.

## Core coverage selection candidates
| 패키지 | Current set | Status | Signals | Recovery action |
| --- | --- | --- | --- | --- |
| `@croco/admin-generated` | not included | warning | catalog group: Protocol | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/admin-generated`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
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
| `@croco/desktop-codegen` | not included | warning | catalog group: Protocol | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/desktop-codegen`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/diagnostics-core` | not included | warning | catalog group: Core | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/diagnostics-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/events-core` | included | included | 1.0 spine package, catalog group: Core, events contract, production-ready maturity | 현재 core coverage set에 포함됨. |
| `@croco/events-inmemory` | not included | warning | catalog group: Core, events contract | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/events-inmemory`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/events-tx` | included | included | 1.0 spine package, catalog group: Core, events contract | 현재 core coverage set에 포함됨. |
| `@croco/features-posthog` | not included | warning | catalog group: Integration | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/features-posthog`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/framework-config` | not included | warning | catalog group: Core, framework-level contract | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/framework-config`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/framework-context` | included | included | 1.0 spine package, catalog group: Core, framework-level contract, production-ready maturity, request/context contract | 현재 core coverage set에 포함됨. |
| `@croco/framework-logger` | not included | warning | catalog group: Core, framework-level contract | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/framework-logger`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/framework-module` | not included | warning | catalog group: Core, framework-level contract | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/framework-module`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/framework-preset` | not included | warning | catalog group: Core, framework-level contract | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/framework-preset`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/framework-routes` | not included | warning | catalog group: Core, framework-level contract | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/framework-routes`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/gid-core` | not included | warning | catalog group: Core | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/gid-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/health-core` | not included | warning | catalog group: Core, health/readiness contract | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/health-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/idempotency-core` | included | included | 1.0 spine package, catalog group: Core | 현재 core coverage set에 포함됨. |
| `@croco/integrations-posthog` | not included | warning | catalog group: Integration | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/integrations-posthog`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/invitation-core` | not included | warning | production-ready maturity | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/invitation-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/llm-core` | not included | warning | production-ready maturity | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/llm-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
| `@croco/llm-metering` | not included | warning | production-ready maturity | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/llm-metering`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
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
| `@croco/protocols-desktop` | not included | warning | catalog group: Protocol | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/protocols-desktop`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
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
| `@croco/transports-cloudflare-workers` | not included | warning | catalog group: Transport, transport runtime contract | `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/transports-cloudflare-workers`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다. |
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
| `@croco/framework-context` | 89.40 | 78.35 | 95.57 | 89.31 | 없음 | 없음 |
| `@croco/problems-core` | 85.87 | 78.96 | 92.70 | 85.74 | 없음 | statements 85.87% < baseline 86.91%; lines 85.74% < baseline 86.77% |
| `@croco/protocols-core` | 85.47 | 72.77 | 91.57 | 85.84 | 없음 | branches 72.77% < baseline 73.86%; functions 91.57% < baseline 92.61% |
| `@croco/protocols-rest` | 87.35 | 80.77 | 88.54 | 87.68 | 없음 | 없음 |
| `@croco/openapi-spec` | 90.45 | 81.53 | 92.77 | 91.07 | 없음 | statements 90.45% < baseline 91.82%; functions 92.77% < baseline 93.00%; lines 91.07% < baseline 91.55% |
| `@croco/rpc-codegen` | 91.09 | 81.01 | 96.87 | 91.01 | 없음 | 없음 |
| `@croco/transports-http` | 93.15 | 83.14 | 91.03 | 93.35 | 없음 | 없음 |
| `@croco/telemetry-api` | 90.44 | 88.17 | 97.22 | 90.78 | 없음 | 없음 |
| `@croco/telemetry-sdk-node` | 97.00 | 92.25 | 100.00 | 96.98 | 없음 | 없음 |
| `@croco/tx-core` | 97.42 | 91.83 | 100.00 | 97.38 | 없음 | statements 97.42% < baseline 98.15%; branches 91.83% < baseline 92.59%; lines 97.38% < baseline 98.12% |
| `@croco/tx-drizzle` | 84.63 | 73.45 | 90.58 | 84.61 | 없음 | statements 84.63% < baseline 96.90%; branches 73.45% < baseline 87.50%; functions 90.58% < baseline 96.96%; lines 84.61% < baseline 96.84% |
| `@croco/events-core` | 91.70 | 80.66 | 99.03 | 91.60 | 없음 | 없음 |
| `@croco/events-tx` | 92.51 | 85.06 | 90.95 | 92.93 | 없음 | 없음 |
| `@croco/retry-core` | 84.06 | 79.83 | 79.76 | 84.32 | 없음 | 없음 |
| `@croco/idempotency-core` | 85.31 | 78.03 | 96.80 | 85.56 | 없음 | statements 85.31% < baseline 89.81%; lines 85.56% < baseline 89.90% |
| `@croco/testing` | 84.40 | 76.60 | 87.09 | 84.66 | 없음 | 없음 |
| `create-croco-app` | 81.91 | 73.41 | 92.33 | 83.52 | 없음 | statements 81.91% < baseline 86.19%; branches 73.41% < baseline 78.36%; functions 92.33% < baseline 96.03%; lines 83.52% < baseline 89.60% |
| `@croco/cli` | 84.28 | 76.08 | 85.94 | 85.14 | 없음 | 없음 |
| `@croco/auth-core` | 93.75 | 90.29 | 96.20 | 93.81 | 없음 | statements 93.75% < baseline 94.09%; lines 93.81% < baseline 94.20% |

## Warning summary
### Selection warnings
- @croco/admin-generated: candidate signals [catalog group: Protocol] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/admin-generated`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/analytics-posthog: candidate signals [catalog group: Integration] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/analytics-posthog`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/audit-core: candidate signals [production-ready maturity] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/audit-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/auth-better-auth: candidate signals [auth contract] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/auth-better-auth`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/auth-clerk: candidate signals [auth contract] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/auth-clerk`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/auth-drizzle: candidate signals [auth contract] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/auth-drizzle`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/billing-core: candidate signals [production-ready maturity] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/billing-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/cache-core: candidate signals [catalog group: Core] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/cache-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/dataloader-core: candidate signals [catalog group: Core, production-ready maturity] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/dataloader-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/desktop-codegen: candidate signals [catalog group: Protocol] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/desktop-codegen`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/diagnostics-core: candidate signals [catalog group: Core] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/diagnostics-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/events-inmemory: candidate signals [catalog group: Core, events contract] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/events-inmemory`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/features-posthog: candidate signals [catalog group: Integration] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/features-posthog`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/framework-config: candidate signals [catalog group: Core, framework-level contract] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/framework-config`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/framework-logger: candidate signals [catalog group: Core, framework-level contract] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/framework-logger`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/framework-module: candidate signals [catalog group: Core, framework-level contract] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/framework-module`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/framework-preset: candidate signals [catalog group: Core, framework-level contract] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/framework-preset`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/framework-routes: candidate signals [catalog group: Core, framework-level contract] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/framework-routes`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/gid-core: candidate signals [catalog group: Core] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/gid-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/health-core: candidate signals [catalog group: Core, health/readiness contract] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/health-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/integrations-posthog: candidate signals [catalog group: Integration] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/integrations-posthog`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/invitation-core: candidate signals [production-ready maturity] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/invitation-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/llm-core: candidate signals [production-ready maturity] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/llm-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/llm-metering: candidate signals [production-ready maturity] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/llm-metering`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/membership-core: candidate signals [production-ready maturity] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/membership-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/metering-core: candidate signals [production-ready maturity] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/metering-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/metrics-core: candidate signals [production-ready maturity] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/metrics-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/migration-runner: candidate signals [production-ready maturity] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/migration-runner`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/outbox-core: candidate signals [catalog group: Core] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/outbox-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/pagination-core: candidate signals [catalog group: Core] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/pagination-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/protocol-codegen: candidate signals [catalog group: Protocol] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/protocol-codegen`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/protocols-desktop: candidate signals [catalog group: Protocol] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/protocols-desktop`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/protocols-graphql: candidate signals [catalog group: Protocol] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/protocols-graphql`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/protocols-trpc: candidate signals [catalog group: Protocol] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/protocols-trpc`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/ratelimit-core: candidate signals [production-ready maturity] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/ratelimit-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/repository-core: candidate signals [catalog group: Core, production-ready maturity] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/repository-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/search-core: candidate signals [production-ready maturity] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/search-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/tenant-core: candidate signals [catalog group: Core] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/tenant-core`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
- @croco/transports-cloudflare-workers: candidate signals [catalog group: Transport, transport runtime contract] but missing from test:coverage:core. `scripts/core-coverage-config.mts`의 `CORE_COVERAGE_PACKAGES`에 `@croco/transports-cloudflare-workers`를 추가하고 `pnpm test:coverage:core`로 baseline row를 만든다. 아직 준비되지 않았다면 `TEMPORARY_CORE_COVERAGE_SELECTION_EXCLUSIONS`에 사유를 기록한다.
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
- @croco/problems-core: statements 85.87% < baseline 86.91%
- @croco/problems-core: lines 85.74% < baseline 86.77%
- @croco/protocols-core: branches 72.77% < baseline 73.86%
- @croco/protocols-core: functions 91.57% < baseline 92.61%
- @croco/openapi-spec: statements 90.45% < baseline 91.82%
- @croco/openapi-spec: functions 92.77% < baseline 93.00%
- @croco/openapi-spec: lines 91.07% < baseline 91.55%
- @croco/tx-core: statements 97.42% < baseline 98.15%
- @croco/tx-core: branches 91.83% < baseline 92.59%
- @croco/tx-core: lines 97.38% < baseline 98.12%
- @croco/tx-drizzle: statements 84.63% < baseline 96.90%
- @croco/tx-drizzle: branches 73.45% < baseline 87.50%
- @croco/tx-drizzle: functions 90.58% < baseline 96.96%
- @croco/tx-drizzle: lines 84.61% < baseline 96.84%
- @croco/idempotency-core: statements 85.31% < baseline 89.81%
- @croco/idempotency-core: lines 85.56% < baseline 89.90%
- create-croco-app: statements 81.91% < baseline 86.19%
- create-croco-app: branches 73.41% < baseline 78.36%
- create-croco-app: functions 92.33% < baseline 96.03%
- create-croco-app: lines 83.52% < baseline 89.60%
- @croco/auth-core: statements 93.75% < baseline 94.09%
- @croco/auth-core: lines 93.81% < baseline 94.20%

## Enforce 전환 메모
- 대상 유지: `CORE_COVERAGE_PACKAGES`에 포함된 패키지부터 threshold를 유지한다.
- 신규 1.0 spine package는 `test:coverage:core`, `CORE_COVERAGE_PACKAGES`, baseline row가 모두 준비되어야 한다.
- 비-spine core 후보는 selection warning, coverage summary, baseline row가 PR summary에 표시된 뒤 core set에 추가한다.
- 비-spine selection warning을 blocking으로 전환하려면 누락 후보가 0이거나 각 후보에 만료 가능한 temporary exclusion 사유가 있어야 한다.
- baseline을 의도적으로 갱신할 때는 `pnpm test:coverage:core`를 먼저 실행하고, 생성된 `coverage-summary.json`의 total percentages를 `ci-reports/coverage/core-baseline.txt`에 반영한 뒤 `pnpm test:coverage:core:warning`을 실행한다.
- threshold 상향은 `retry-core functions` 개선 이후 별도 태스크에서 검토한다.
- baseline regression이 연속 0회가 아니라 안정적으로 해소된 이후에만 hard fail 전환을 검토한다.

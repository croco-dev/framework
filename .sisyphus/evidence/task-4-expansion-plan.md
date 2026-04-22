# Task 4: Coverage Expansion Target Selection & Baseline Design

## Current Core Coverage Gate

**File**: `vitest.config.ts`
- **Provider**: v8
- **Threshold**: 60% across statements/branches/functions/lines
- **Scope**: Only 5 core packages when `CORE_COVERAGE=true`:
  - `@croco/framework-context`
  - `@croco/retry-core`
  - `@croco/events-core`
  - `@croco/auth-core`
  - `@croco/telemetry-api`

**CI Hard Gate**: `pnpm test:coverage:core` — enforces 60% on these 5 packages only

## Core-Adjacent Package Candidates (Risk-Based Selection)

### Selection Criteria
1. **Change frequency**: 변경 빈도가 높은 패키지
2. **Deployment impact**: 배포 영향도 (다른 패키지의 직접 의존 대상)
3. **Failure cost**: 장애 비용 (auth, security, events, transaction 등 핵심 기능)

### Recommended Wave 1 Targets (core-adjacent)
| Package | Reason |
|---------|--------|
| `@croco/framework-logger` | 모든 패키지가 의존하는 인프라 패키지 |
| `@croco/repository-core` | 인터페이스 레이어, 다른 구현체가 의존 |
| `@croco/framework-config` | env 검증, 모든 앱 시작 시 필수 |
| `@croco/problems-core` | 도메인 에러 공통 기반 |
| `@croco/ratelimit-core` | 보안/성능 크로스코팅 |

### Phase Expansion Plan

| Phase | Target | Threshold | Timeline |
|-------|--------|-----------|----------|
| Current | 5 core packages | 60% | Now |
| Phase 1 | +5 core-adjacent | 50% | Next quarter |
| Phase 2 | All framework-layer packages | 60% | Quarter +2 |
| Phase 3 | transports + protocols | 50% | Q3+ |

### Exclusion Criteria
- `integrations/*` — 외부 서비스 래퍼, 테스트는 integration 테스트로 커버
- `*-drizzle` — ORM 구현 레이어, 별도 integration 테스트로 확인
- CLI/CLI helpers — 사용자 인터랙션 중심, coverage 로 측정 어려움
- Template/scaffold packages — `create-croco-app` 등

## Files to Review
- `vitest.config.ts` — CORE_COVERAGE_PACKAGES 배열 확장
- `.github/workflows/ci.yml` — coverage gate 단계 확장

## Policy Guardrails
- **NO** repo-wide immediate 60% enforce
- **NO** new test framework adoption
- **Gradual expansion only** with per-phase threshold adjustment

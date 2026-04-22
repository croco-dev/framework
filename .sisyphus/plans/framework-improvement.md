# Croco Framework 프로덕션 레디니스 개선

## TL;DR

> **Quick Summary**: 87개 패키지 모노레포의 프로덕션 준비도를 전면 개선한다. Raw Error 167개를 Problem으로 마이그레이션, 위험한 기본값 수정, 보안 인프라 구축, 미완성 패키지 20+개 완전 구현, 테스트 커버리지 확대(Tier1 80%+, Tier2 60%+), README/JSDoc 문서화.
>
> **Deliverables**:
> - Raw Error → Problem 전환 완료 (167개 → 0개)
> - console.log 프로덕션 코드 제거 (56개 → 0개)
> - 위험한 기본값 수정 (maxConcurrency, BatchLoader bounds, retry validation)
> - 보안 헤더 미들웨어 + 입력 검증 인프라
> - Graceful shutdown + Health check 고도화
> - 미완성 외부 연동 패키지 완전 구현 (auth-clerk, auth-better-auth, storage-*, notifications-resend, metering-upstash, ratelimit-upstash, analytics-posthog, features-posthog, search-meilisearch, batch-qstash, tasks-qstash 등)
> - Drizzle 구현체 패키지 완전 구현 (access-drizzle, audit-drizzle, entitlements-drizzle, execution-drizzle, invitation-drizzle, membership-drizzle, onboarding-drizzle, customer-health-drizzle, search-drizzle, metering-drizzle)
> - 테스트 커버리지: Tier 1 ≥80%, Tier 2 ≥60%, 통합 테스트 ≥8 파일
> - 모든 패키지 README + 공개 API JSDoc
> - 간단한 마이그레이션 러너
>
> **Estimated Effort**: XL
> **Parallel Execution**: YES - 8 waves
> **Critical Path**: Wave1(Foundation) → Wave2-5(Packages) → Wave6(Tests) → Wave7(Docs) → Wave8(Migration) → FINAL

---

## Context

### Original Request
프레임워크를 가혹하게 비판적으로 평가하고, 발견된 모든 문제를 수정하는 전면 개선 계획.

### Interview Summary
**Key Discussions**:
- 범위: 10개 개선 영역 전부 (Error 마이그레이션, 기본값, 보안, 패키지 완성, 테스트, 문서, 마이그레이션 등)
- 미완성 패키지: Mock 기반 테스트로 완전 구현 (실제 API 키 불필요)
- 테스트: Tests-after 전략 (Vitest 4.0.16)
- 문서: README ≤150줄 + 공개 API JSDoc만
- 브랜치: main 직접 커밋

**Research Findings**:
- 87개 패키지 중 19개만 프로덕션 레디 (22%)
- 테스트-소스 비율 13% (104 테스트 / 785 소스), 테스트 품질은 우수
- Raw `throw new Error` 167개 (34%) vs Problem throw 329개 (66%)
- console.log 56개, 27개 프로덕션 파일
- InMemoryEventBus maxConcurrency=Infinity, BatchLoader 무제한
- 보안 인프라 완전 부재
- 마이그레이션/버저닝 시스템 부재
- 통합 테스트 3개 파일만

### Metis Review
**Identified Gaps** (addressed):
- 다운스트림 사용량 확인 필요 → Wave1에 연구 태스크로 추가하지 않음 (시간 대비 효과 낮음, 모든 패키지 개선 범위이므로)
- Breaking change 정책 → 내부 변경 허용 (patch), API 변경은 감사 필요
- Mock 검증 방법 → vitest.mock + SDK 시그니처 수동 검증
- 프로덕션 레디 정의 → 티어별 명시적 체크리스트 설정
- 보안 범위 → input validation + security headers ONLY (OAuth2, WAF, cert mgmt 제외)
- 문서 범위 → README ≤150줄, JSDoc 공개 API만 (튜토리얼/가이드 제외)
- 마이그레이션 범위 → 단순 러너만 (rollback CLI, 스키마 버저닝 제외)

---

## Work Objectives

### Core Objective
Croco Framework 87개 패키지의 프로덕션 준비도를 체계적으로 끌어올려, 외부 개발자가 신뢰하고 사용할 수 있는 수준으로 만든다.

### Concrete Deliverables
- `grep -r "throw new Error" packages/*/src/` 결과 0건
- `grep -r "console.log" packages/*/src/` 결과 0건 (테스트 제외)
- 모든 위험한 기본값에 유효성 검증 추가
- 보안 헤더 미들웨어 + Zod 기반 입력 검증 인프라
- Graceful shutdown 개선 (이벤트 버스 드레인, 정상 종료)
- Health check readiness/liveness 분리
- 20+개 미완성 패키지 완전 구현 + mock 테스트
- Tier 1 커버리지 ≥80%, Tier 2 ≥60%, 통합 테스트 ≥8 파일
- 모든 패키지 README + 공개 API JSDoc
- 간단한 마이그레이션 러너

### Definition of Done
- [ ] `grep -r "throw new Error" packages/*/src/ --include="*.ts" | grep -v "spec.ts" | grep -v "test.ts"` → 0 results
- [ ] `grep -r "console\.log" packages/*/src/ --include="*.ts" | grep -v "spec.ts" | grep -v "test.ts"` → 0 results
- [ ] `pnpm test` → ALL PASS
- [ ] `pnpm typecheck` → ALL PASS
- [ ] `pnpm check` → ALL PASS (Biome)

### Must Have
- 모든 Raw Error를 Problem 서브클래스로 전환 (메시지 의미 보존)
- 위험한 기본값에 bounds 검증 (maxConcurrency, batchSize, maxAttempts 등)
- 보안 헤더 미들웨어 (X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security)
- 미완성 패키지: 공식 SDK 문서에 있는 메서드만 구현
- 테스트: 현실적인 시나리오만 (상위 20개 실패 모드)
- 문서: README ≤150줄, JSDoc은 공개 API만

### Must NOT Have (Guardrails)
- 공식 SDK에 없는 커스텀 헬퍼 함수 추가 금지
- OAuth2 서버, WAF, 인증서 관리 등 보안 플랫폼 구축 금지
- 튜토리얼 시리즈, 비디오 스크립트, 마이그레이션 가이드 금지
- Full schema versioning, rollback CLI 금지
- 0.01% 미만 확률 엣지 케이스 테스트 금지
- Breaking API 변경 (signature 변경) 금지 — 내부 구현만 변경
- 과도한 추상화 (3번 반복 전 추상화 도입 금지)
- AI slop: 불필요한 주석, 과도한 JSDoc, generic 변수명 (data/result/item/temp)

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: Tests-after
- **Framework**: Vitest 4.0.16
- **Test file convention**: `src/tests/[ClassName].spec.ts`

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Library/Module**: Use Bash — `pnpm vitest run [path]`, grep validation commands
- **API/Backend**: Use Bash (curl) — request assertions
- **Frontend/UI**: N/A (no UI tasks)

### Coverage Targets
| Tier | Target | Validation |
|------|--------|------------|
| Tier 1 (Production Ready) | ≥80% | `vitest run --coverage` |
| Tier 2 (Beta) | ≥60% | `vitest run --coverage` |
| Tier 3 → Tier 2 | ≥50% + mock tests | coverage + SDK signature verification |

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation Fixes — 7 parallel tasks):
├── Task 1: Raw Error → Problem migration [unspecified-high]
├── Task 2: console.log cleanup [quick]
├── Task 3: Dangerous defaults fix [unspecified-high]
├── Task 4: Graceful shutdown improvement [unspecified-high]
├── Task 5: Health check readiness/liveness [quick]
├── Task 6: Security headers middleware [quick]
└── Task 7: Input validation infrastructure [unspecified-high]

Wave 2 (Auth Packages — 2 parallel tasks, depends: Wave 1):
├── Task 8: auth-clerk completion [unspecified-high]
└── Task 9: auth-better-auth completion [unspecified-high]

Wave 3 (Storage + Notification — 4 parallel tasks, depends: Wave 1):
├── Task 10: storage-r2 completion [unspecified-high]
├── Task 11: storage-cloudflare completion [quick]
├── Task 12: storage-cloudinary completion [quick]
└── Task 13: notifications-resend completion [quick]

Wave 4 (Analytics/Metering/Search/Queue — 5 parallel tasks, depends: Wave 1):
├── Task 14: analytics-posthog + features-posthog completion [unspecified-high]
├── Task 15: metering-upstash completion [unspecified-high]
├── Task 16: ratelimit-upstash completion [unspecified-high]
├── Task 17: search-meilisearch completion [unspecified-high]
└── Task 18: batch-qstash + tasks-qstash completion [unspecified-high]

Wave 5 (Drizzle Implementations — 5 parallel tasks, depends: Wave 1):
├── Task 19: access-drizzle + auth-drizzle completion [unspecified-high]
├── Task 20: audit-drizzle + metering-drizzle completion [unspecified-high]
├── Task 21: entitlements-drizzle + execution-drizzle completion [unspecified-high]
├── Task 22: invitation-drizzle + membership-drizzle completion [unspecified-high]
└── Task 23: onboarding-drizzle + customer-health-drizzle + search-drizzle completion [unspecified-high]

Wave 6 (Test Coverage Expansion — 4 parallel tasks, depends: Waves 2-5):
├── Task 24: Tier 1 core packages test expansion [unspecified-high]
├── Task 25: Tier 2 SaaS packages test expansion [unspecified-high]
├── Task 26: Integration test creation (cross-package) [deep]
└── Task 27: Remaining packages test coverage [unspecified-high]

Wave 7 (Documentation — 4 parallel tasks, depends: Wave 6):
├── Task 28: Core infrastructure README + JSDoc [writing]
├── Task 29: SaaS business logic README + JSDoc [writing]
├── Task 30: External integration packages README + JSDoc [writing]
└── Task 31: Drizzle implementations README + JSDoc [writing]

Wave 8 (Migration System — 1 task, depends: Wave 1):
└── Task 32: Simple migration runner [deep]

Wave FINAL (After ALL — 4 parallel reviews, then user okay):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay

Critical Path: W1 → W2-5 (parallel) → W6 → W7 → FINAL
Parallel Speedup: ~65% faster than sequential
Max Concurrent: 7 (Wave 1)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1-7 | None | 8-23, 32 | 1 |
| 8-9 | Wave 1 | 24-27 | 2 |
| 10-13 | Wave 1 | 24-27 | 3 |
| 14-18 | Wave 1 | 24-27 | 4 |
| 19-23 | Wave 1 | 24-27 | 5 |
| 24-27 | Waves 2-5 | 28-31 | 6 |
| 28-31 | Wave 6 | FINAL | 7 |
| 32 | Wave 1 | FINAL | 8 |
| F1-F4 | ALL | User okay | FINAL |

### Agent Dispatch Summary

| Wave | Tasks | Categories |
|------|-------|------------|
| 1 | 7 | T1→unspecified-high, T2→quick, T3→unspecified-high, T4→unspecified-high, T5→quick, T6→quick, T7→unspecified-high |
| 2 | 2 | T8-9→unspecified-high |
| 3 | 4 | T10→unspecified-high, T11-13→quick |
| 4 | 5 | T14-18→unspecified-high |
| 5 | 5 | T19-23→unspecified-high |
| 6 | 4 | T24-25→unspecified-high, T26→deep, T27→unspecified-high |
| 7 | 4 | T28-31→writing |
| 8 | 1 | T32→deep |
| FINAL | 4 | F1→oracle, F2→unspecified-high, F3→unspecified-high, F4→deep |

---

## TODOs

> Implementation + Test = ONE Task. Never separate.
> EVERY task MUST have: Recommended Agent Profile + Parallelization info + QA Scenarios.

### Wave 1: Foundation Fixes

- [x] 1. Raw Error → Problem 마이그레이션

  **What to do**:
  - `grep -r "throw new Error" packages/*/src/ --include="*.ts"` 로 167개 인스턴스 전수 조사 (테스트 파일 제외)
  - 각 `throw new Error(...)` 를 적절한 Problem 서브클래스로 교체
  - 기존 Problem 서브클래스가 적합하면 재사용, 없으면 신규 생성
  - 에러 메시지 의미 보존 (동일한 사용자 대면 메시지)
  - RFC 7807 구조 준수: code, category, message 필수
  - `problems-core`에 이미 있는 Problem 계층 구조 참고하여 일관성 유지
  - 패키지별로 필요한 Problem 서브클래스를 해당 패키지 내에 정의 (problems-core에 범용적인 것만)

  **Must NOT do**:
  - 에러 메시지 의미 변경 금지
  - 기존 catch 블록의 Error 타입 체크 깨뜨리지 않기
  - 불필요한 Problem 서브클래스 과잉 생성 금지 (유사한 것은 통합)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 87개 패키지 횡단 작업, 패턴 인식 + 일관성 유지 필요
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `ai-slop-remover`: 단일 파일이 아닌 다수 파일 횡단 작업이므로 부적합

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2-7)
  - **Blocks**: Tasks 8-23 (패키지 완성 시 Problem 패턴 필요), Task 32
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `packages/problems-core/src/libs/Problem.ts` — Problem 기본 클래스, code/category/message 구조
  - `packages/problems-core/src/libs/problems/` — 기존 Problem 서브클래스들 (NotFoundProblem 등), 이 패턴 따라서 신규 생성
  - `packages/billing-core/src/libs/problems/` — 도메인별 Problem 정의 예시 (BillingProblem 등)

  **API/Type References**:
  - `packages/problems-core/src/libs/types.ts` — ProblemCategory enum, Problem 관련 타입

  **External References**:
  - RFC 7807: https://tools.ietf.org/html/rfc7807 — Problem Details 표준

  **WHY Each Reference Matters**:
  - Problem.ts: 모든 신규 Problem은 이 기본 클래스를 상속해야 함
  - 기존 Problem 서브클래스: 네이밍 컨벤션과 구조를 동일하게 따라야 일관성 유지
  - BillingProblem: 도메인별 Problem을 해당 패키지 내에 정의하는 패턴의 실례

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Raw Error 완전 제거 확인
    Tool: Bash
    Preconditions: 모든 파일 수정 완료
    Steps:
      1. grep -r "throw new Error" packages/*/src/ --include="*.ts" | grep -v "spec.ts" | grep -v "test.ts" | wc -l
      2. 결과가 0인지 확인
    Expected Result: 0
    Failure Indicators: 1 이상의 숫자
    Evidence: .sisyphus/evidence/task-1-error-grep.txt

  Scenario: Problem 서브클래스 구조 검증
    Tool: Bash
    Preconditions: 신규 Problem 클래스 생성 완료
    Steps:
      1. pnpm typecheck 실행
      2. pnpm test 실행 (기존 테스트가 깨지지 않는지)
    Expected Result: typecheck PASS, test ALL PASS
    Failure Indicators: type error 또는 test failure
    Evidence: .sisyphus/evidence/task-1-typecheck.txt

  Scenario: 에러 메시지 의미 보존 확인
    Tool: Bash
    Preconditions: 마이그레이션 완료
    Steps:
      1. 각 패키지에서 Problem 서브클래스의 message가 기존 Error message와 동일한지 spot-check (최소 10개)
      2. grep -r "extends Problem" packages/*/src/ --include="*.ts" | wc -l 로 생성된 Problem 수 확인
    Expected Result: 메시지 일치, Problem 서브클래스 수가 합리적 (10-30개 범위)
    Failure Indicators: 메시지 불일치 또는 과도한 서브클래스 (50개 이상)
    Evidence: .sisyphus/evidence/task-1-problem-audit.txt
  ```

  **Commit**: YES
  - Message: `fix(problems): migrate all raw Error throws to Problem subclasses`
  - Files: `packages/*/src/**/*.ts` (테스트 파일 제외)
  - Pre-commit: `pnpm typecheck && pnpm test`

- [x] 2. console.log 프로덕션 코드 정리

  **What to do**:
  - `grep -r "console\.log" packages/*/src/ --include="*.ts"` 로 56개 인스턴스 확인 (테스트 파일 제외)
  - 디버깅 목적 console.log → 완전 제거
  - 의미있는 로그인 경우 → `@croco/logging-pino` 의 Logger로 교체 (import 추가)
  - `console.warn`, `console.error` 도 같이 점검하여 Logger로 교체
  - 테스트 파일의 console.log는 건드리지 않음

  **Must NOT do**:
  - 테스트 파일 수정 금지
  - 새로운 로깅 의존성 추가 금지 (기존 logging-pino 사용)
  - 로그 레벨 무분별 변경 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 단순 패턴 교체, 복잡한 로직 판단 불필요
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3-7)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `packages/logging-pino/src/` — Pino Logger 구현체, 사용 패턴
  - `packages/logging-core/src/` — Logger 인터페이스, 로그 레벨 정의

  **WHY Each Reference Matters**:
  - logging-pino: console.log를 교체할 때 이 Logger 패턴을 따라야 함
  - logging-core: Logger 인터페이스를 통해 DI로 주입받는 패턴 확인

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: console.log 완전 제거 확인
    Tool: Bash
    Preconditions: 모든 파일 수정 완료
    Steps:
      1. grep -r "console\.log" packages/*/src/ --include="*.ts" | grep -v "spec.ts" | grep -v "test.ts" | wc -l
      2. grep -r "console\.warn" packages/*/src/ --include="*.ts" | grep -v "spec.ts" | grep -v "test.ts" | wc -l
    Expected Result: 둘 다 0
    Failure Indicators: 1 이상
    Evidence: .sisyphus/evidence/task-2-console-grep.txt

  Scenario: 빌드 및 테스트 통과
    Tool: Bash
    Steps:
      1. pnpm typecheck
      2. pnpm test
    Expected Result: ALL PASS
    Evidence: .sisyphus/evidence/task-2-build-test.txt
  ```

  **Commit**: YES
  - Message: `fix(logging): remove console.log from production code, use Logger`
  - Files: `packages/*/src/**/*.ts` (테스트 파일 제외)
  - Pre-commit: `pnpm typecheck && pnpm test`

- [x] 3. 위험한 기본값 수정 + 유효성 검증

  **What to do**:
  - InMemoryEventBus: `maxConcurrency` 기본값 Infinity → 합리적 값 (예: 100) + 유효성 검증 (양수 정수)
  - BatchLoader: 무제한 배치 → `maxBatchSize` 기본값 추가 (예: 50) + 유효성 검증
  - RetryTemplate/CircuitBreaker: `maxAttempts` 음수/NaN 허용 → 유효성 검증 추가
  - CircuitBreaker: `failureThreshold` 0/음수 허용 → 유효성 검증 추가
  - CircuitBreaker: `openDuration` 0 허용 → 최소값 검증 추가
  - 각 설정값에 Zod 또는 수동 검증 추가 (생성자/팩토리에서)
  - 유효하지 않은 값 → 명확한 에러 메시지와 함께 Problem throw (Task 1과 연계)

  **Must NOT do**:
  - 기존 동작 변경 금지 (유효한 값에 대해서는 동일하게 동작)
  - 기존 테스트 깨뜨리기 금지
  - 과도한 검증 금지 (핵심 설정값만)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 여러 패키지의 핵심 설정 로직 수정, 영향 범위 분석 필요
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-2, 4-7)
  - **Blocks**: Tasks 8-23 (패키지 완성 시 안전한 기본값 필요)
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `packages/events-inmemory/src/libs/InMemoryEventBus.ts` — maxConcurrency 기본값 위치
  - `packages/dataloader-core/src/libs/BatchLoader.ts` — BatchLoader 설정 위치
  - `packages/retry-core/src/libs/RetryTemplate.ts` — maxAttempts, backoff 설정
  - `packages/retry-core/src/libs/CircuitBreaker.ts` — failureThreshold, openDuration 설정

  **WHY Each Reference Matters**:
  - InMemoryEventBus: Infinity 기본값이 메모리 폭발 가능, 프로덕션에서 치명적
  - BatchLoader: 무제한 배치가 DB 쿼리 폭발 가능
  - RetryTemplate: 음수 maxAttempts로 무한 루프 가능
  - CircuitBreaker: 0 threshold로 즉시 오픈, 0 duration으로 의미없는 차단

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: 음수/NaN maxAttempts 거부
    Tool: Bash
    Steps:
      1. 테스트 코드에서 maxAttempts: -1 로 RetryTemplate 생성 시도
      2. maxAttempts: NaN 으로 생성 시도
    Expected Result: Problem throw with clear message
    Evidence: .sisyphus/evidence/task-3-retry-validation.txt

  Scenario: InMemoryEventBus 기본값 변경 확인
    Tool: Bash
    Steps:
      1. grep -n "maxConcurrency" packages/events-inmemory/src/libs/InMemoryEventBus.ts
      2. 기본값이 Infinity가 아닌 유한한 양수인지 확인
    Expected Result: maxConcurrency defaults to 100 (or similar bounded value)
    Evidence: .sisyphus/evidence/task-3-eventbus-default.txt

  Scenario: 전체 테스트 통과
    Tool: Bash
    Steps:
      1. pnpm test
    Expected Result: ALL PASS
    Evidence: .sisyphus/evidence/task-3-test-pass.txt
  ```

  **Commit**: YES
  - Message: `fix(defaults): add validation for dangerous config defaults`
  - Files: `packages/events-inmemory/src/`, `packages/dataloader-core/src/`, `packages/retry-core/src/`
  - Pre-commit: `pnpm typecheck && pnpm test`

- [x] 4. Graceful Shutdown 개선

  **What to do**:
  - 기존 `ShutdownManager`에 이벤트 버스 드레인 단계 추가
  - `process.exit(0)` 직접 호출 → 정상적인 이벤트 루프 종료로 변경
  - 셧다운 순서: 새 요청 거부 → 진행 중 요청 완료 대기 → 이벤트 버스 드레인 → 리소스 정리 → 종료
  - 타임아웃 설정 (기본 30초) — 초과 시 강제 종료
  - 셧다운 시작/완료 로그 추가 (Logger 사용)

  **Must NOT do**:
  - 기존 ShutdownManager API 시그니처 변경 금지
  - Lambda 환경 고려하지 않은 설계 금지 (Lambda는 자체 lifecycle)
  - 복잡한 의존성 그래프 기반 셧다운 순서 금지

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 프로세스 생명주기 관련 핵심 인프라 변경
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-3, 5-7)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `packages/transports-http/src/libs/ShutdownManager.ts` — 기존 셧다운 관리자 (있다면)
  - `packages/events-inmemory/src/libs/InMemoryEventBus.ts` — 이벤트 버스 드레인 메서드 확인
  - `packages/transports-http/src/libs/HonoApplication.ts` — HTTP 서버 종료 흐름

  **WHY Each Reference Matters**:
  - ShutdownManager: 기존 구현 확장, API 호환성 유지
  - InMemoryEventBus: 드레인 가능 여부와 메서드 확인
  - HonoApplication: HTTP 서버와 셧다운 연동 지점

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: 셧다운 순서 검증
    Tool: Bash
    Steps:
      1. 셧다운 매니저 테스트에서 등록된 핸들러 순서 확인
      2. 타임아웃 초과 시 강제 종료 테스트
    Expected Result: 순서대로 실행, 타임아웃 시 강제 종료
    Evidence: .sisyphus/evidence/task-4-shutdown-order.txt

  Scenario: 테스트 통과
    Tool: Bash
    Steps:
      1. pnpm test --filter=@croco/transports-http
    Expected Result: ALL PASS
    Evidence: .sisyphus/evidence/task-4-test.txt
  ```

  **Commit**: YES
  - Message: `fix(shutdown): improve graceful shutdown with event bus draining`
  - Files: `packages/transports-http/src/`
  - Pre-commit: `pnpm typecheck && pnpm test`

- [x] 5. Health Check Readiness/Liveness 분리

  **What to do**:
  - 기존 `HealthCheckService`에 readiness/liveness 구분 추가
  - Liveness: 프로세스 살아있는지 (단순 ping)
  - Readiness: 의존성 준비 완료 여부 (DB 연결, 캐시 연결 등)
  - `/health/live` + `/health/ready` 엔드포인트 분리 (또는 쿼리 파라미터)
  - 기본 indicator 추가: EventBus ready, 사용자 정의 indicator 등록 API
  - K8s 호환 응답 형식 (200 OK / 503 Service Unavailable)

  **Must NOT do**:
  - 복잡한 건강 점수 계산 시스템 금지
  - 외부 모니터링 연동 금지
  - 기존 `/health` 엔드포인트 제거 금지 (하위 호환)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 기존 패키지에 2개 엔드포인트 추가하는 비교적 단순한 작업
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-4, 6-7)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `packages/health-core/src/` — 기존 HealthCheckService 구현
  - `packages/transports-http/src/` — HTTP 엔드포인트 등록 패턴

  **WHY Each Reference Matters**:
  - health-core: 기존 구현 확장, 인터페이스 확인
  - transports-http: 엔드포인트 등록 방식 참고

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Liveness/Readiness 엔드포인트 분리 확인
    Tool: Bash
    Steps:
      1. HealthCheckService에 isLive(), isReady() 메서드 존재 확인
      2. 테스트에서 의존성 미준비 시 readiness=false, liveness=true 확인
    Expected Result: 두 메서드 존재, 독립 동작
    Evidence: .sisyphus/evidence/task-5-health-check.txt

  Scenario: 테스트 통과
    Tool: Bash
    Steps:
      1. pnpm test --filter=@croco/health-core
    Expected Result: ALL PASS
    Evidence: .sisyphus/evidence/task-5-test.txt
  ```

  **Commit**: YES
  - Message: `feat(health): add readiness/liveness probe separation`
  - Files: `packages/health-core/src/`
  - Pre-commit: `pnpm typecheck && pnpm test`

- [x] 6. Security Headers 미들웨어

  **What to do**:
  - `@croco/transports-http` 에 보안 헤더 미들웨어 추가 (Hono 미들웨어로)
  - 기본 헤더: X-Frame-Options (DENY), X-Content-Type-Options (nosniff), X-XSS-Protection (0), Strict-Transport-Security, Referrer-Policy (strict-origin-when-cross-origin), Content-Security-Policy (기본값)
  - 커스터마이즈 가능한 옵션 객체로 헤더 활성화/비활성화
  - 기본적으로 활성화, opt-out 방식
  - Hono의 기존 미들웨어 패턴 따라서 구현

  **Must NOT do**:
  - CSRF 토큰 시스템 구현 금지 (범위 밖)
  - helmet 패키지 의존성 추가 금지 (직접 구현)
  - CSP를 과도하게 엄격하게 설정 금지 (합리적 기본값만)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Hono 미들웨어 패턴 따라 헤더 설정하는 단순 작업
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-5, 7)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `packages/transports-http/src/libs/middlewares/` — 기존 Hono 미들웨어 패턴
  - `packages/transports-http/src/libs/HonoApplication.ts` — 미들웨어 등록 방식

  **External References**:
  - Hono middleware docs: https://hono.dev/docs/middleware/builtin/secure-headers

  **WHY Each Reference Matters**:
  - 기존 미들웨어: 동일한 패턴으로 보안 헤더 미들웨어 구현
  - Hono 공식: Hono에 이미 secureHeaders 미들웨어가 있을 수 있으므로 확인 (있으면 래핑, 없으면 직접 구현)

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: 보안 헤더 포함 확인
    Tool: Bash
    Steps:
      1. 테스트에서 보안 헤더 미들웨어 적용 후 응답 헤더 확인
      2. X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security 존재 확인
    Expected Result: 모든 보안 헤더 포함
    Evidence: .sisyphus/evidence/task-6-security-headers.txt

  Scenario: 옵션으로 비활성화 가능
    Tool: Bash
    Steps:
      1. 특정 헤더를 비활성화하는 옵션으로 미들웨어 생성
      2. 해당 헤더 미포함 확인
    Expected Result: 비활성화된 헤더 미포함
    Evidence: .sisyphus/evidence/task-6-disable-header.txt
  ```

  **Commit**: YES
  - Message: `feat(security): add security headers middleware`
  - Files: `packages/transports-http/src/libs/middlewares/`
  - Pre-commit: `pnpm typecheck && pnpm test`

- [x] 7. Input Validation 인프라 (Zod 기반)

  **What to do**:
  - `@croco/protocols-rest` 에 Zod 기반 요청 바디/쿼리/파라미터 검증 데코레이터 추가
  - `@Validate()` 데코레이터 또는 `@Body(zodSchema)` 패턴으로 자동 검증
  - 검증 실패 시 Problem (400 Bad Request) 자동 응답 — RFC 7807 형식
  - 기존 `@Body()`, `@Query()`, `@Param()` 데코레이터와 통합
  - Zod는 이미 모노레포에 있으므로 추가 설치 불필요 (확인 필요)

  **Must NOT do**:
  - class-validator 패턴 도입 금지 (Zod 일원화)
  - 복잡한 검증 파이프라인 금지 (단일 Zod 스키마 검증만)
  - GraphQL 프로토콜 검증 금지 (REST만, GraphQL은 자체 스키마 검증)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 데코레이터 시스템 확장, DI 통합, 에러 처리 연동 필요
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-6)
  - **Blocks**: None (패키지 완성은 각자 필요시 검증 추가)
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `packages/protocols-rest/src/libs/decorators/` — 기존 @Body, @Query, @Param 데코레이터
  - `packages/protocols-rest/src/libs/metadata/` — 메타데이터 저장 패턴
  - `packages/transports-http/src/libs/HonoRouteBuilder.ts` — 라우트 빌드 시 파라미터 추출 방식

  **External References**:
  - Zod: https://zod.dev/?id=basic-usage — 스키마 정의 문법

  **WHY Each Reference Matters**:
  - 기존 데코레이터: 동일한 메타데이터 패턴으로 검증 통합
  - HonoRouteBuilder: 검증 로직 삽입 지점 확인
  - Zod: 스키마 기반 검증 API 참고

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Zod 스키마 검증 동작 확인
    Tool: Bash
    Steps:
      1. 테스트에서 @Body(zodSchema) 데코레이터 적용 후 유효하지 않은 바디 전송
      2. 400 응답 + Problem 형식 확인
    Expected Result: 400 status, application/problem+json content-type, validation errors in body
    Evidence: .sisyphus/evidence/task-7-validation.txt

  Scenario: 유효한 바디는 통과
    Tool: Bash
    Steps:
      1. Zod 스키마에 맞는 유효한 바디 전송
      2. 정상 처리 확인
    Expected Result: 200 or 201 status
    Evidence: .sisyphus/evidence/task-7-valid-body.txt

  Scenario: 타입체크 및 테스트 통과
    Tool: Bash
    Steps:
      1. pnpm typecheck
      2. pnpm test --filter=@croco/protocols-rest --filter=@croco/transports-http
    Expected Result: ALL PASS
    Evidence: .sisyphus/evidence/task-7-build-test.txt
  ```

  **Commit**: YES
  - Message: `feat(validation): add Zod-based input validation infrastructure`
  - Files: `packages/protocols-rest/src/`, `packages/transports-http/src/`
  - Pre-commit: `pnpm typecheck && pnpm test`

### Wave 2: Auth Packages

- [x] 8. auth-clerk 완전 구현

  **What to do**:
  - `packages/auth-clerk/` 의 기존 구현 확인 후 미완성 부분 완성
  - Clerk SDK 공식 문서 기반으로 필요한 메서드 구현 (사용자 인증, 세션 관리, 조직 관리)
  - `@croco/auth-core` 의 인터페이스 구현 (AuthProvider, SessionProvider 등)
  - Mock 기반 테스트 작성 (vitest.mock으로 Clerk SDK 모킹)
  - README 작성 (설치, 설정, 사용 예시)
  - Problem 서브클래스 사용 (Raw Error 금지)

  **Must NOT do**:
  - Clerk SDK에 없는 커스텀 기능 추가 금지
  - 실제 API 키 필요한 테스트 작성 금지
  - auth-core 인터페이스 변경 금지

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 외부 SDK 통합, 인터페이스 구현, mock 테스트 작성 필요
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 9)
  - **Blocks**: Tasks 24-27 (테스트 확장)
  - **Blocked By**: Wave 1 (Problem 패턴 필요)

  **References**:

  **Pattern References**:
  - `packages/auth-clerk/src/` — 기존 구현 (5 src, 4 test 파일)
  - `packages/auth-core/src/` — AuthProvider 인터페이스 정의
  - `packages/auth-better-auth/src/` — 유사한 auth provider 구현 참고

  **External References**:
  - Clerk Node.js SDK: https://clerk.com/docs/references/nodejs/overview

  **WHY Each Reference Matters**:
  - auth-clerk 기존: 이미 있는 코드 위에 빌드, 중복 방지
  - auth-core: 구현해야 할 인터페이스 정의 확인
  - Clerk SDK docs: 구현할 메서드 목록과 시그니처

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: AuthProvider 인터페이스 완전 구현 확인
    Tool: Bash
    Steps:
      1. pnpm typecheck --filter=@croco/auth-clerk
      2. auth-core의 모든 인터페이스 메서드가 구현되었는지 확인
    Expected Result: typecheck PASS, 모든 인터페이스 메서드 구현
    Evidence: .sisyphus/evidence/task-8-typecheck.txt

  Scenario: Mock 테스트 통과
    Tool: Bash
    Steps:
      1. pnpm test --filter=@croco/auth-clerk
    Expected Result: ALL PASS, coverage ≥50%
    Evidence: .sisyphus/evidence/task-8-test.txt

  Scenario: Raw Error 미사용 확인
    Tool: Bash
    Steps:
      1. grep -r "throw new Error" packages/auth-clerk/src/ --include="*.ts" | grep -v "spec.ts" | wc -l
    Expected Result: 0
    Evidence: .sisyphus/evidence/task-8-no-raw-error.txt
  ```

  **Commit**: YES
  - Message: `feat(auth-clerk): implement complete Clerk SDK integration`
  - Files: `packages/auth-clerk/src/`
  - Pre-commit: `pnpm typecheck && pnpm test --filter=@croco/auth-clerk`

- [x] 9. auth-better-auth 완전 구현

  **What to do**:
  - `packages/auth-better-auth/` 의 기존 구현 확인 후 미완성 부분 완성
  - Better Auth 공식 문서 기반으로 필요한 메서드 구현
  - `@croco/auth-core` 의 인터페이스 구현
  - Mock 기반 테스트 작성
  - README 작성
  - Problem 서브클래스 사용

  **Must NOT do**:
  - Better Auth에 없는 커스텀 기능 추가 금지
  - 실제 DB 필요한 테스트 작성 금지
  - auth-core 인터페이스 변경 금지

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 8)
  - **Blocks**: Tasks 24-27
  - **Blocked By**: Wave 1

  **References**:

  **Pattern References**:
  - `packages/auth-better-auth/src/` — 기존 구현 (6 src, 2 test)
  - `packages/auth-core/src/` — AuthProvider 인터페이스
  - `packages/auth-clerk/src/` — 유사 구현 참고

  **External References**:
  - Better Auth: https://www.better-auth.com/docs

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: 인터페이스 완전 구현 + 테스트 통과
    Tool: Bash
    Steps:
      1. pnpm typecheck --filter=@croco/auth-better-auth
      2. pnpm test --filter=@croco/auth-better-auth
    Expected Result: typecheck PASS, test ALL PASS, coverage ≥50%
    Evidence: .sisyphus/evidence/task-9-test.txt

  Scenario: Raw Error 미사용
    Tool: Bash
    Steps:
      1. grep -r "throw new Error" packages/auth-better-auth/src/ --include="*.ts" | grep -v "spec.ts" | wc -l
    Expected Result: 0
    Evidence: .sisyphus/evidence/task-9-no-raw-error.txt
  ```

  **Commit**: YES
  - Message: `feat(auth-better-auth): implement complete Better Auth integration`
  - Files: `packages/auth-better-auth/src/`
  - Pre-commit: `pnpm typecheck && pnpm test --filter=@croco/auth-better-auth`

### Wave 3: Storage + Notification Packages

- [x] 10. storage-r2 완전 구현

  **What to do**:
  - `packages/storage-r2/` 기존 구현 확인 (6 src, 1 test) 후 미완성 완성
  - Cloudflare R2 SDK (S3-compatible API) 기반으로 `@croco/storage-core` 인터페이스 구현
  - 핵심 메서드: upload, download, delete, list, getSignedUrl
  - Mock 기반 테스트 (vitest.mock으로 R2 클라이언트 모킹)
  - README 작성, Problem 서브클래스 사용

  **Must NOT do**: R2 SDK에 없는 기능 금지, 실제 R2 버킷 필요 테스트 금지, storage-core 인터페이스 변경 금지

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 11-13)
  - **Blocks**: Tasks 24-27
  - **Blocked By**: Wave 1

  **References**:
  - `packages/storage-r2/src/` — 기존 구현
  - `packages/storage-core/src/` — StorageProvider 인터페이스
  - Cloudflare R2 docs: https://developers.cloudflare.com/r2/

  **Acceptance Criteria**:
  **QA Scenarios (MANDATORY):**
  ```
  Scenario: 인터페이스 완전 구현 + 테스트 통과
    Tool: Bash
    Steps:
      1. pnpm typecheck --filter=@croco/storage-r2
      2. pnpm test --filter=@croco/storage-r2
    Expected Result: typecheck PASS, test ALL PASS, coverage ≥50%
    Evidence: .sisyphus/evidence/task-10-test.txt

  Scenario: Raw Error 미사용
    Tool: Bash
    Steps:
      1. grep -r "throw new Error" packages/storage-r2/src/ --include="*.ts" | grep -v "spec.ts" | wc -l
    Expected Result: 0
    Evidence: .sisyphus/evidence/task-10-no-raw-error.txt
  ```

  **Commit**: YES
  - Message: `feat(storage-r2): implement complete R2 storage integration`
  - Pre-commit: `pnpm typecheck && pnpm test --filter=@croco/storage-r2`

- [x] 11. storage-cloudflare 완전 구현

  **What to do**:
  - `packages/storage-cloudflare/` 기존 구현 확인 (3 src, 1 test) 후 완성
  - Cloudflare Images API 기반 `@croco/storage-core` 인터페이스 구현
  - Mock 기반 테스트, README, Problem 서브클래스 사용

  **Must NOT do**: Cloudflare Images API에 없는 기능 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**: Wave 3, **Blocked By**: Wave 1

  **References**:
  - `packages/storage-cloudflare/src/` — 기존 구현
  - `packages/storage-core/src/` — StorageProvider 인터페이스
  - Cloudflare Images: https://developers.cloudflare.com/images/

  **Acceptance Criteria**:
  **QA Scenarios (MANDATORY):**
  ```
  Scenario: typecheck + test 통과 + Raw Error 0
    Tool: Bash
    Steps:
      1. pnpm typecheck --filter=@croco/storage-cloudflare
      2. pnpm test --filter=@croco/storage-cloudflare
      3. grep -r "throw new Error" packages/storage-cloudflare/src/ --include="*.ts" | grep -v "spec.ts" | wc -l
    Expected Result: typecheck PASS, test PASS, 0 raw errors
    Evidence: .sisyphus/evidence/task-11-test.txt
  ```
  **Commit**: YES — `feat(storage-cloudflare): implement Cloudflare Images integration`

- [x] 12. storage-cloudinary 완전 구현

  **What to do**:
  - `packages/storage-cloudinary/` 기존 구현 확인 (3 src, 1 test) 후 완성
  - Cloudinary SDK 기반 `@croco/storage-core` 인터페이스 구현
  - Mock 기반 테스트, README, Problem 서브클래스 사용

  **Must NOT do**: Cloudinary SDK에 없는 기능 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**: Wave 3, **Blocked By**: Wave 1

  **References**:
  - `packages/storage-cloudinary/src/` — 기존 구현
  - `packages/storage-core/src/` — StorageProvider 인터페이스
  - Cloudinary Node.js: https://cloudinary.com/documentation/node_integration

  **Acceptance Criteria**:
  **QA Scenarios (MANDATORY):**
  ```
  Scenario: typecheck + test 통과 + Raw Error 0
    Tool: Bash
    Steps:
      1. pnpm typecheck --filter=@croco/storage-cloudinary
      2. pnpm test --filter=@croco/storage-cloudinary
      3. grep -r "throw new Error" packages/storage-cloudinary/src/ --include="*.ts" | grep -v "spec.ts" | wc -l
    Expected Result: typecheck PASS, test PASS, 0 raw errors
    Evidence: .sisyphus/evidence/task-12-test.txt
  ```
  **Commit**: YES — `feat(storage-cloudinary): implement Cloudinary integration`

- [x] 13. notifications-resend 완전 구현

  **What to do**:
  - `packages/notification-resend/` 기존 구현 확인 (2 src, 1 test) 후 완성 (패키지명 정확히 확인 필요)
  - Resend SDK 기반으로 이메일 발송, 템플릿, 배치 발송 구현
  - `@croco/notification-core` 인터페이스 구현 (있다면)
  - Mock 기반 테스트, README, Problem 서브클래스 사용

  **Must NOT do**: Resend SDK에 없는 기능 금지, notification-core가 없으면 자체 인터페이스만 구현

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**: Wave 3, **Blocked By**: Wave 1

  **References**:
  - `packages/notification-resend/src/` (또는 `packages/notifications-resend/src/`)
  - `packages/notification-core/src/` — NotificationProvider 인터페이스 (존재 여부 확인)
  - Resend SDK: https://resend.com/docs/sdks/typescript

  **Acceptance Criteria**:
  **QA Scenarios (MANDATORY):**
  ```
  Scenario: typecheck + test 통과 + Raw Error 0
    Tool: Bash
    Steps:
      1. pnpm typecheck --filter=@croco/notification-resend (또는 notifications-resend)
      2. pnpm test --filter=@croco/notification-resend
      3. grep -r "throw new Error" packages/notification*/src/ --include="*.ts" | grep -v "spec.ts" | wc -l
    Expected Result: typecheck PASS, test PASS, 0 raw errors
    Evidence: .sisyphus/evidence/task-13-test.txt
  ```
  **Commit**: YES — `feat(notification-resend): implement Resend email integration`

### Wave 4: Analytics/Metering/Search/Queue Packages

- [x] 14. analytics-posthog + features-posthog 완전 구현

  **What to do**:
  - `packages/analytics-posthog/` (1 src, 1 test) + `packages/features-posthog/` (1 src, 1 test) 확인 후 완성
  - PostHog SDK 기반 이벤트 트래킹(analytics) + 피처 플래그(features) 구현
  - `@croco/analytics-core`, `@croco/features-core` 인터페이스 구현
  - Mock 기반 테스트, README, Problem 서브클래스

  **Must NOT do**: PostHog SDK에 없는 기능 금지, A/B 테스트 고급 기능 금지

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 2개 패키지 동시 작업, PostHog SDK 이해 필요
  - **Skills**: []

  **Parallelization**: Wave 4, **Blocked By**: Wave 1

  **References**:
  - `packages/analytics-posthog/src/`, `packages/features-posthog/src/`
  - `packages/analytics-core/src/`, `packages/features-core/src/` — 인터페이스
  - `packages/integrations-posthog/src/` — 기존 PostHog 통합 참고
  - PostHog Node.js: https://posthog.com/docs/libraries/node

  **Acceptance Criteria**:
  **QA Scenarios (MANDATORY):**
  ```
  Scenario: 두 패키지 typecheck + test 통과
    Tool: Bash
    Steps:
      1. pnpm typecheck --filter=@croco/analytics-posthog --filter=@croco/features-posthog
      2. pnpm test --filter=@croco/analytics-posthog --filter=@croco/features-posthog
      3. grep -r "throw new Error" packages/analytics-posthog/src/ packages/features-posthog/src/ --include="*.ts" | grep -v "spec.ts" | wc -l
    Expected Result: ALL PASS, 0 raw errors
    Evidence: .sisyphus/evidence/task-14-test.txt
  ```
  **Commit**: YES — `feat(posthog): implement analytics and feature flags integration`

- [x] 15. metering-upstash 완전 구현

  **What to do**:
  - `packages/metering-upstash/` (1 src, 1 test) 확인 후 완성
  - Upstash Redis SDK 기반 미터링 데이터 저장/집계 구현
  - `@croco/metering-core` 인터페이스 구현 (MeterStore, MeterAggregator 등)
  - Mock 기반 테스트, README, Problem 서브클래스

  **Must NOT do**: Upstash SDK에 없는 기능 금지, 복잡한 집계 파이프라인 금지

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**: Wave 4, **Blocked By**: Wave 1

  **References**:
  - `packages/metering-upstash/src/` — 기존 구현
  - `packages/metering-core/src/` — MeterStore 인터페이스
  - Upstash Redis: https://upstash.com/docs/redis/sdks/ts/overview

  **Acceptance Criteria**:
  **QA Scenarios (MANDATORY):**
  ```
  Scenario: typecheck + test 통과 + Raw Error 0
    Tool: Bash
    Steps:
      1. pnpm typecheck --filter=@croco/metering-upstash
      2. pnpm test --filter=@croco/metering-upstash
      3. grep -r "throw new Error" packages/metering-upstash/src/ --include="*.ts" | grep -v "spec.ts" | wc -l
    Expected Result: ALL PASS, 0 raw errors
    Evidence: .sisyphus/evidence/task-15-test.txt
  ```
  **Commit**: YES — `feat(metering-upstash): implement Upstash Redis metering`

- [x] 16. ratelimit-upstash 완전 구현

  **What to do**:
  - `packages/ratelimit-upstash/` (4 src, 1 test) 확인 후 완성
  - @upstash/ratelimit SDK 기반 분산 레이트 리밋 구현
  - `@croco/ratelimit-core` 인터페이스 구현 (RateLimiter 등)
  - 알고리즘: 고정 윈도우, 슬라이딩 윈도우, 토큰 버킷 (core에 정의된 것만)
  - Mock 기반 테스트, README, Problem 서브클래스

  **Must NOT do**: ratelimit-core에 없는 알고리즘 추가 금지

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**: Wave 4, **Blocked By**: Wave 1

  **References**:
  - `packages/ratelimit-upstash/src/` — 기존 구현
  - `packages/ratelimit-core/src/` — RateLimiter 인터페이스
  - @upstash/ratelimit: https://upstash.com/docs/redis/sdks/ratelimit-ts/overview

  **Acceptance Criteria**:
  **QA Scenarios (MANDATORY):**
  ```
  Scenario: typecheck + test 통과 + Raw Error 0
    Tool: Bash
    Steps:
      1. pnpm typecheck --filter=@croco/ratelimit-upstash
      2. pnpm test --filter=@croco/ratelimit-upstash
      3. grep -r "throw new Error" packages/ratelimit-upstash/src/ --include="*.ts" | grep -v "spec.ts" | wc -l
    Expected Result: ALL PASS, 0 raw errors
    Evidence: .sisyphus/evidence/task-16-test.txt
  ```
  **Commit**: YES — `feat(ratelimit-upstash): implement Upstash rate limiting`

- [x] 17. search-meilisearch 완전 구현

  **What to do**:
  - `packages/search-meilisearch/` (3 src, 2 test) 확인 후 완성
  - Meilisearch SDK 기반 전문 검색 구현
  - `@croco/search-core` 인터페이스 구현 (SearchEngine 등)
  - Mock 기반 테스트, README, Problem 서브클래스

  **Must NOT do**: Meilisearch SDK에 없는 기능 금지

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**: Wave 4, **Blocked By**: Wave 1

  **References**:
  - `packages/search-meilisearch/src/` — 기존 구현
  - `packages/search-core/src/` — SearchEngine 인터페이스
  - Meilisearch JS: https://www.meilisearch.com/docs/sdks/javascript/overview

  **Acceptance Criteria**:
  **QA Scenarios (MANDATORY):**
  ```
  Scenario: typecheck + test 통과 + Raw Error 0
    Tool: Bash
    Steps:
      1. pnpm typecheck --filter=@croco/search-meilisearch
      2. pnpm test --filter=@croco/search-meilisearch
      3. grep -r "throw new Error" packages/search-meilisearch/src/ --include="*.ts" | grep -v "spec.ts" | wc -l
    Expected Result: ALL PASS, 0 raw errors
    Evidence: .sisyphus/evidence/task-17-test.txt
  ```
  **Commit**: YES — `feat(search-meilisearch): implement Meilisearch search integration`

- [x] 18. batch-qstash + tasks-qstash 완전 구현

  **What to do**:
  - `packages/batch-qstash/` (1 src, 1 test) + `packages/tasks-qstash/` (1 src, 1 test) 확인 후 완성
  - QStash SDK 기반 비동기 배치 처리 + 태스크 큐 구현
  - `@croco/batch-core`, `@croco/tasks-core` 인터페이스 구현
  - Mock 기반 테스트, README, Problem 서브클래스
  - triggers-qstash도 확인하여 필요시 함께 완성

  **Must NOT do**: QStash SDK에 없는 기능 금지, 복잡한 워크플로우 엔진 금지

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 2-3개 패키지 동시, QStash SDK 이해 필요
  - **Skills**: []

  **Parallelization**: Wave 4, **Blocked By**: Wave 1

  **References**:
  - `packages/batch-qstash/src/`, `packages/tasks-qstash/src/`, `packages/triggers-qstash/src/`
  - `packages/batch-core/src/`, `packages/tasks-core/src/`, `packages/triggers-core/src/`
  - QStash SDK: https://upstash.com/docs/qstash/sdks/ts/overview

  **Acceptance Criteria**:
  **QA Scenarios (MANDATORY):**
  ```
  Scenario: 모든 QStash 패키지 typecheck + test 통과
    Tool: Bash
    Steps:
      1. pnpm typecheck --filter=@croco/batch-qstash --filter=@croco/tasks-qstash
      2. pnpm test --filter=@croco/batch-qstash --filter=@croco/tasks-qstash
      3. grep -r "throw new Error" packages/batch-qstash/src/ packages/tasks-qstash/src/ --include="*.ts" | grep -v "spec.ts" | wc -l
    Expected Result: ALL PASS, 0 raw errors
    Evidence: .sisyphus/evidence/task-18-test.txt
  ```
  **Commit**: YES — `feat(qstash): implement batch and task queue integration`

### Wave 5: Drizzle Implementation Packages

> Drizzle 구현체들은 *-core 패키지의 인터페이스(Repository, Store 등)를 Drizzle ORM으로 구현하는 패키지.
> 공통 패턴: AbstractDrizzleRepository 상속, Drizzle 스키마 정의, TX 컨텍스트 연동.
> **참고**: repository-core는 인터페이스 레이어이므로 drizzle-orm 직접 참조 금지 (AGENTS.md 규칙).

- [x] 19. access-drizzle + auth-drizzle 완전 구현

  **What to do**:
  - `packages/access-drizzle/` + `packages/auth-drizzle/` 기존 구현 확인 후 완성
  - `@croco/access-core` (ACL), `@croco/auth-core` (권한 저장소) 인터페이스의 Drizzle 구현체
  - Drizzle 스키마 정의 (테이블, 인덱스)
  - `@croco/tx-drizzle` 트랜잭션 컨텍스트 연동
  - Mock 기반 테스트 (Drizzle mock 또는 in-memory DB), README, Problem 서브클래스

  **Must NOT do**: 실제 DB 연결 테스트 금지, access-core/auth-core 인터페이스 변경 금지, repository-core에 drizzle 의존성 추가 금지

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**: Wave 5 (with Tasks 20-23), **Blocked By**: Wave 1

  **References**:
  - `packages/access-drizzle/src/`, `packages/auth-drizzle/src/` — 기존 구현 (2-3 src each)
  - `packages/access-core/src/`, `packages/auth-core/src/` — 인터페이스 정의
  - `packages/tx-drizzle/src/` — Drizzle TX 연동 패턴 (Tier 1 패키지, test ratio 0.87)
  - `packages/repository-core/src/` — Repository 인터페이스 (drizzle 직접 참조 금지)

  **Acceptance Criteria**:
  **QA Scenarios (MANDATORY):**
  ```
  Scenario: typecheck + test 통과
    Tool: Bash
    Steps:
      1. pnpm typecheck --filter=@croco/access-drizzle --filter=@croco/auth-drizzle
      2. pnpm test --filter=@croco/access-drizzle --filter=@croco/auth-drizzle
      3. grep -r "throw new Error" packages/access-drizzle/src/ packages/auth-drizzle/src/ --include="*.ts" | grep -v "spec.ts" | wc -l
    Expected Result: ALL PASS, 0 raw errors
    Evidence: .sisyphus/evidence/task-19-test.txt

  Scenario: repository-core 의존성 규칙 준수
    Tool: Bash
    Steps:
      1. grep -r "drizzle" packages/repository-core/src/ | wc -l
    Expected Result: 0
    Evidence: .sisyphus/evidence/task-19-dep-rule.txt
  ```
  **Commit**: YES — `feat(drizzle): implement access and auth Drizzle repositories`

- [x] 20. audit-drizzle + metering-drizzle 완전 구현

  **What to do**:
  - `packages/audit-drizzle/` + `packages/metering-drizzle/` 기존 구현 확인 후 완성
  - `@croco/audit-core` (감사 로그 저장소), `@croco/metering-core` (미터링 데이터 저장소) Drizzle 구현체
  - Drizzle 스키마, TX 연동, Mock 테스트, README, Problem 서브클래스

  **Must NOT do**: 실제 DB 연결 금지, core 인터페이스 변경 금지

  **Recommended Agent Profile**: `unspecified-high`, Skills: []
  **Parallelization**: Wave 5, **Blocked By**: Wave 1

  **References**:
  - `packages/audit-drizzle/src/`, `packages/metering-drizzle/src/`
  - `packages/audit-core/src/`, `packages/metering-core/src/`
  - `packages/tx-drizzle/src/` — TX 패턴 참고

  **Acceptance Criteria**:
  **QA Scenarios (MANDATORY):**
  ```
  Scenario: typecheck + test 통과 + Raw Error 0
    Tool: Bash
    Steps:
      1. pnpm typecheck --filter=@croco/audit-drizzle --filter=@croco/metering-drizzle
      2. pnpm test --filter=@croco/audit-drizzle --filter=@croco/metering-drizzle
      3. grep -r "throw new Error" packages/audit-drizzle/src/ packages/metering-drizzle/src/ --include="*.ts" | grep -v "spec.ts" | wc -l
    Expected Result: ALL PASS, 0 raw errors
    Evidence: .sisyphus/evidence/task-20-test.txt
  ```
  **Commit**: YES — `feat(drizzle): implement audit and metering Drizzle repositories`

- [x] 21. entitlements-drizzle + execution-drizzle 완전 구현

  **What to do**:
  - `packages/entitlements-drizzle/` + `packages/execution-drizzle/` 기존 구현 확인 후 완성
  - `@croco/entitlements-core` (기능 사용권), `@croco/execution-core` (실행 기록) Drizzle 구현체
  - Drizzle 스키마, TX 연동, Mock 테스트, README, Problem 서브클래스

  **Must NOT do**: 실제 DB 연결 금지, core 인터페이스 변경 금지

  **Recommended Agent Profile**: `unspecified-high`, Skills: []
  **Parallelization**: Wave 5, **Blocked By**: Wave 1

  **References**:
  - `packages/entitlements-drizzle/src/`, `packages/execution-drizzle/src/`
  - `packages/entitlements-core/src/`, `packages/execution-core/src/`
  - `packages/tx-drizzle/src/` — TX 패턴 참고

  **Acceptance Criteria**:
  **QA Scenarios (MANDATORY):**
  ```
  Scenario: typecheck + test 통과 + Raw Error 0
    Tool: Bash
    Steps:
      1. pnpm typecheck --filter=@croco/entitlements-drizzle --filter=@croco/execution-drizzle
      2. pnpm test --filter=@croco/entitlements-drizzle --filter=@croco/execution-drizzle
      3. grep -r "throw new Error" packages/entitlements-drizzle/src/ packages/execution-drizzle/src/ --include="*.ts" | grep -v "spec.ts" | wc -l
    Expected Result: ALL PASS, 0 raw errors
    Evidence: .sisyphus/evidence/task-21-test.txt
  ```
  **Commit**: YES — `feat(drizzle): implement entitlements and execution Drizzle repositories`

- [x] 22. invitation-drizzle + membership-drizzle 완전 구현

  **What to do**:
  - `packages/invitation-drizzle/` + `packages/membership-drizzle/` 기존 구현 확인 후 완성
  - `@croco/invitation-core` (초대), `@croco/membership-core` (멤버십) Drizzle 구현체
  - Drizzle 스키마, TX 연동, Mock 테스트, README, Problem 서브클래스

  **Must NOT do**: 실제 DB 연결 금지, core 인터페이스 변경 금지

  **Recommended Agent Profile**: `unspecified-high`, Skills: []
  **Parallelization**: Wave 5, **Blocked By**: Wave 1

  **References**:
  - `packages/invitation-drizzle/src/`, `packages/membership-drizzle/src/`
  - `packages/invitation-core/src/`, `packages/membership-core/src/`
  - `packages/tx-drizzle/src/` — TX 패턴 참고

  **Acceptance Criteria**:
  **QA Scenarios (MANDATORY):**
  ```
  Scenario: typecheck + test 통과 + Raw Error 0
    Tool: Bash
    Steps:
      1. pnpm typecheck --filter=@croco/invitation-drizzle --filter=@croco/membership-drizzle
      2. pnpm test --filter=@croco/invitation-drizzle --filter=@croco/membership-drizzle
      3. grep -r "throw new Error" packages/invitation-drizzle/src/ packages/membership-drizzle/src/ --include="*.ts" | grep -v "spec.ts" | wc -l
    Expected Result: ALL PASS, 0 raw errors
    Evidence: .sisyphus/evidence/task-22-test.txt
  ```
  **Commit**: YES — `feat(drizzle): implement invitation and membership Drizzle repositories`

- [x] 23. onboarding-drizzle + customer-health-drizzle + search-drizzle 완전 구현

  **What to do**:
  - `packages/onboarding-drizzle/` + `packages/customer-health-drizzle/` + `packages/search-drizzle/` 완성
  - 각 core 패키지 인터페이스의 Drizzle 구현체
  - Drizzle 스키마, TX 연동, Mock 테스트, README, Problem 서브클래스

  **Must NOT do**: 실제 DB 연결 금지, core 인터페이스 변경 금지

  **Recommended Agent Profile**: `unspecified-high`, Skills: []
  **Parallelization**: Wave 5, **Blocked By**: Wave 1

  **References**:
  - `packages/onboarding-drizzle/src/`, `packages/customer-health-drizzle/src/`, `packages/search-drizzle/src/`
  - `packages/onboarding-core/src/`, `packages/customer-health-core/src/`, `packages/search-core/src/`
  - `packages/tx-drizzle/src/` — TX 패턴 참고

  **Acceptance Criteria**:
  **QA Scenarios (MANDATORY):**
  ```
  Scenario: typecheck + test 통과 + Raw Error 0
    Tool: Bash
    Steps:
      1. pnpm typecheck --filter=@croco/onboarding-drizzle --filter=@croco/customer-health-drizzle --filter=@croco/search-drizzle
      2. pnpm test --filter=@croco/onboarding-drizzle --filter=@croco/customer-health-drizzle --filter=@croco/search-drizzle
      3. grep -r "throw new Error" packages/onboarding-drizzle/src/ packages/customer-health-drizzle/src/ packages/search-drizzle/src/ --include="*.ts" | grep -v "spec.ts" | wc -l
    Expected Result: ALL PASS, 0 raw errors
    Evidence: .sisyphus/evidence/task-23-test.txt
  ```
  **Commit**: YES — `feat(drizzle): implement onboarding, customer-health, search Drizzle repositories`

### Wave 6: Test Coverage Expansion

- [x] 24. Tier 1 Core Infrastructure 테스트 확대

  **What to do**:
  - Tier 1 패키지 (framework-context, protocols-rest, transports-http, events-core, events-inmemory, problems-core, tx-core, retry-core, telemetry-api, telemetry-sdk-node, metering-core, billing-core, metrics-core, auth-core, llm-core, llm-metering, membership-core, invitation-core, ratelimit-core)의 테스트 커버리지 ≥80% 달성
  - 현재 커버리지 측정 → 부족한 패키지 식별 → 테스트 추가
  - 엣지 케이스: 빈 입력, null/undefined, 타임아웃, 동시성
  - 기존 테스트 패턴 따라 작성 (describe/it, beforeEach Container.reset)

  **Must NOT do**: 0.01% 미만 확률 엣지 케이스 금지, 기존 테스트 수정 금지 (추가만), mock 과용 금지

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 19개 패키지 횡단, 커버리지 분석 + 테스트 작성
  - **Skills**: []

  **Parallelization**: Wave 6 (with Tasks 25-27), **Blocked By**: Waves 2-5

  **References**:
  - `packages/retry-core/src/tests/Retryable.spec.ts` — 우수한 테스트 패턴 (backoff, recovery)
  - `packages/tx-core/src/tests/TxManager.spec.ts` — 트랜잭션 테스트 패턴
  - `packages/billing-core/src/tests/BillingService.spec.ts` — 상태 머신 테스트 패턴

  **Acceptance Criteria**:
  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Tier 1 커버리지 ≥80%
    Tool: Bash
    Steps:
      1. 각 Tier 1 패키지에서 pnpm vitest run --coverage 실행
      2. 라인 커버리지 80% 이상 확인
    Expected Result: 모든 Tier 1 패키지 ≥80%
    Evidence: .sisyphus/evidence/task-24-coverage-report.txt

  Scenario: 전체 테스트 통과
    Tool: Bash
    Steps:
      1. pnpm test
    Expected Result: ALL PASS
    Evidence: .sisyphus/evidence/task-24-test-pass.txt
  ```
  **Commit**: YES — `test(tier1): expand core infrastructure test coverage to 80%+`

- [x] 25. Tier 2 SaaS Packages 테스트 확대

  **What to do**:
  - Tier 2 패키지 (protocols-graphql, transports-graphql, tenant-core, repository-core, entitlements-core, search-core, dataloader-core, audit-core, pagination-core, gid-core, health-core, cache-core)의 커버리지 ≥60% 달성
  - 현재 커버리지 측정 → 부족한 패키지 식별 → 테스트 추가

  **Must NOT do**: 과도한 엣지 케이스 금지, 기존 테스트 수정 금지

  **Recommended Agent Profile**: `unspecified-high`, Skills: []
  **Parallelization**: Wave 6, **Blocked By**: Waves 2-5

  **References**: 동일한 테스트 패턴 참고 (Task 24 references)

  **Acceptance Criteria**:
  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Tier 2 커버리지 ≥60%
    Tool: Bash
    Steps:
      1. 각 Tier 2 패키지에서 vitest run --coverage
      2. 라인 커버리지 60% 이상 확인
    Expected Result: 모든 Tier 2 패키지 ≥60%
    Evidence: .sisyphus/evidence/task-25-coverage-report.txt
  ```
  **Commit**: YES — `test(tier2): expand SaaS packages test coverage to 60%+`

- [x] 26. 통합 테스트 확대 (Cross-Package Workflows)

  **What to do**:
  - 현재 3개 통합 테스트 → 8개 이상으로 확대
  - 핵심 워크플로우 테스트:
    1. HTTP 요청 → Controller → Service → EventBus → EventHandler 전체 흐름
    2. 트랜잭션: Transactional → TxManager → afterCommit hook → 이벤트 발행
    3. 인증: AuthGuard → AuthProvider → RBAC 체크
    4. 미터링: @Metered → MeterStore → Quota 체크
    5. 빌링: Subscription 생성 → 이벤트 → Metrics 계산
  - Mock 기반 (실제 DB/API 불필요)

  **Must NOT do**: E2E 테스트 (실제 서버 기동) 금지, 실제 외부 서비스 연동 금지

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Cross-package 워크플로우 이해, 복잡한 mock 설정 필요
  - **Skills**: []

  **Parallelization**: Wave 6, **Blocked By**: Waves 2-5

  **References**:
  - `packages/tx-drizzle/src/tests/` — 기존 통합 테스트 패턴
  - `packages/entitlements-core/src/tests/` — Cross-package 테스트 예시
  - `packages/transports-http/src/tests/` — HTTP 통합 테스트

  **Acceptance Criteria**:
  **QA Scenarios (MANDATORY):**
  ```
  Scenario: 통합 테스트 ≥8 파일
    Tool: Bash
    Steps:
      1. find packages/*/src/tests/ -name "*.integration.spec.ts" -o -name "*Integration*.spec.ts" | wc -l
      2. 8개 이상 확인
      3. pnpm test 전체 통과
    Expected Result: ≥8 통합 테스트 파일, ALL PASS
    Evidence: .sisyphus/evidence/task-26-integration-count.txt
  ```
  **Commit**: YES — `test(integration): add cross-package workflow integration tests`

- [x] 27. 나머지 패키지 테스트 커버리지

  **What to do**:
  - Wave 2-5에서 구현된 패키지들 + 기존 저커버리지 패키지 (batch-core, execution-core, onboarding-core, repository-core, utils-node 등) 커버리지 ≥50% 달성
  - 미완성 → 완성된 패키지들의 mock 테스트 보강

  **Must NOT do**: 과도한 엣지 케이스 금지

  **Recommended Agent Profile**: `unspecified-high`, Skills: []
  **Parallelization**: Wave 6, **Blocked By**: Waves 2-5

  **Acceptance Criteria**:
  **QA Scenarios (MANDATORY):**
  ```
  Scenario: 완성된 패키지 커버리지 ≥50%
    Tool: Bash
    Steps:
      1. Wave 2-5 패키지 각각 vitest run --coverage
      2. 모든 패키지 ≥50% 확인
    Expected Result: ALL ≥50%
    Evidence: .sisyphus/evidence/task-27-coverage-report.txt
  ```
  **Commit**: YES — `test(packages): ensure minimum 50% coverage for all completed packages`

### Wave 7: Documentation

- [x] 28. Core Infrastructure README + JSDoc

  **What to do**:
  - Tier 1 core 패키지에 README.md 작성 (없거나 부실한 경우): framework-context, problems-core, events-core, events-inmemory, tx-core, retry-core, cache-core, pagination-core, dataloader-core, repository-core, gid-core, health-core
  - README 구조: Purpose (1-2줄), Installation, Quick Start, API Reference, Configuration
  - ≤150줄 제한
  - 공개 API에 JSDoc 추가 (private 제외)
  - 기존 README가 있으면 보강만

  **Must NOT do**: 150줄 초과 금지, 튜토리얼/가이드 금지, 이모지 남용 금지

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: 문서 작성 전문
  - **Skills**: []

  **Parallelization**: Wave 7 (with Tasks 29-31), **Blocked By**: Wave 6

  **Acceptance Criteria**:
  **QA Scenarios (MANDATORY):**
  ```
  Scenario: 모든 core 패키지에 README 존재
    Tool: Bash
    Steps:
      1. ls packages/framework-context/README.md packages/problems-core/README.md packages/events-core/README.md packages/tx-core/README.md packages/retry-core/README.md
      2. 각 README가 150줄 이하인지 wc -l 확인
    Expected Result: 모든 파일 존재, ≤150줄
    Evidence: .sisyphus/evidence/task-28-readme-check.txt
  ```
  **Commit**: YES — `docs(core): add README and JSDoc for core infrastructure packages`

- [x] 29. SaaS Business Logic README + JSDoc

  **What to do**:
  - SaaS 패키지에 README.md 작성: billing-core, billing-polar, metering-core, metrics-core, entitlements-core, customer-health-core, membership-core, invitation-core, tenant-core, onboarding-core, ratelimit-core, auth-core, impersonation-core
  - 동일 구조, ≤150줄, 공개 API JSDoc

  **Must NOT do**: 150줄 초과 금지, 비즈니스 로직 설명서 금지

  **Recommended Agent Profile**: `writing`, Skills: []
  **Parallelization**: Wave 7, **Blocked By**: Wave 6

  **Acceptance Criteria**:
  **QA Scenarios (MANDATORY):**
  ```
  Scenario: 모든 SaaS 패키지에 README 존재 + ≤150줄
    Tool: Bash
    Steps:
      1. ls packages/billing-core/README.md packages/metering-core/README.md packages/metrics-core/README.md packages/membership-core/README.md packages/invitation-core/README.md
      2. wc -l 각 파일
    Expected Result: 모든 파일 존재, ≤150줄
    Evidence: .sisyphus/evidence/task-29-readme-check.txt
  ```
  **Commit**: YES — `docs(saas): add README and JSDoc for SaaS business logic packages`

- [x] 30. External Integration Packages README + JSDoc

  **What to do**:
  - 외부 연동 패키지에 README.md 작성: auth-clerk, auth-better-auth, storage-r2, storage-cloudflare, storage-cloudinary, notification-resend, analytics-posthog, features-posthog, metering-upstash, ratelimit-upstash, search-meilisearch, batch-qstash, tasks-qstash
  - ≤150줄, 설정 방법 + 환경 변수 + SDK 문서 링크 포함

  **Must NOT do**: 150줄 초과 금지

  **Recommended Agent Profile**: `writing`, Skills: []
  **Parallelization**: Wave 7, **Blocked By**: Wave 6

  **Acceptance Criteria**:
  **QA Scenarios (MANDATORY):**
  ```
  Scenario: 외부 연동 패키지에 README 존재
    Tool: Bash
    Steps:
      1. ls packages/auth-clerk/README.md packages/storage-r2/README.md packages/metering-upstash/README.md
      2. wc -l 각 파일
    Expected Result: 모든 파일 존재, ≤150줄
    Evidence: .sisyphus/evidence/task-30-readme-check.txt
  ```
  **Commit**: YES — `docs(integrations): add README and JSDoc for external integration packages`

- [x] 31. Drizzle Implementations README + JSDoc

  **What to do**:
  - Drizzle 구현체 패키지에 README.md 작성: tx-drizzle, access-drizzle, auth-drizzle, audit-drizzle, metering-drizzle, entitlements-drizzle, execution-drizzle, invitation-drizzle, membership-drizzle, onboarding-drizzle, customer-health-drizzle, search-drizzle
  - ≤150줄, 스키마 마이그레이션 안내 + core 패키지 링크 포함

  **Must NOT do**: 150줄 초과 금지, Drizzle ORM 자체 문서 작성 금지

  **Recommended Agent Profile**: `writing`, Skills: []
  **Parallelization**: Wave 7, **Blocked By**: Wave 6

  **Acceptance Criteria**:
  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Drizzle 패키지에 README 존재
    Tool: Bash
    Steps:
      1. find packages/*-drizzle/README.md | wc -l
      2. 12개 이상 확인 (tx-drizzle 포함)
    Expected Result: ≥12 README 파일
    Evidence: .sisyphus/evidence/task-31-readme-check.txt
  ```
  **Commit**: YES — `docs(drizzle): add README and JSDoc for Drizzle implementation packages`

### Wave 8: Migration System

- [x] 32. Simple Migration Runner

  **What to do**:
  - 간단한 마이그레이션 러너 패키지 생성 또는 기존 패키지에 추가
  - 기능: 마이그레이션 파일 스캔 → 순서대로 실행 → 실행 기록 저장
  - 마이그레이션 파일 형식: `YYYYMMDDHHMMSS_description.ts` (export up/down)
  - 실행 기록: 간단한 테이블 또는 JSON 파일
  - CLI 엔트리포인트는 선택사항 (프로그래매틱 API 우선)

  **Must NOT do**: 
  - Full schema versioning 금지
  - Rollback CLI 금지
  - 마이그레이션 감사 로그 금지
  - 복잡한 의존성 그래프 기반 마이그레이션 금지

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 새 패키지 설계, DB 스키마 상호작용, 파일 시스템 스캔
  - **Skills**: []

  **Parallelization**: Wave 8 (독립), **Blocked By**: Wave 1 (Problem 패턴)

  **References**:
  - `packages/tx-drizzle/src/` — Drizzle 트랜잭션 패턴 (마이그레이션도 TX 내에서 실행)
  - Drizzle Kit migrate: https://orm.drizzle.team/docs/kit-overview — 참고만 (Drizzle Kit 자체를 사용하지는 않음)

  **Acceptance Criteria**:
  **QA Scenarios (MANDATORY):**
  ```
  Scenario: 마이그레이션 러너 기본 동작
    Tool: Bash
    Steps:
      1. 테스트에서 마이그레이션 파일 2개 → 러너 실행 → 순서대로 실행 확인
      2. 이미 실행된 마이그레이션 스킵 확인
    Expected Result: 순서 실행, 중복 스킵
    Evidence: .sisyphus/evidence/task-32-migration-test.txt

  Scenario: typecheck + test 통과
    Tool: Bash
    Steps:
      1. pnpm typecheck
      2. pnpm test
    Expected Result: ALL PASS
    Evidence: .sisyphus/evidence/task-32-build-test.txt
  ```
  **Commit**: YES — `feat(migration): add simple migration runner`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `pnpm typecheck` + `pnpm check` + `pnpm test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high`
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration. Test edge cases: empty state, invalid input, rapid actions. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built, nothing beyond spec was built. Check "Must NOT do" compliance. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

| Wave | Commits | Message Pattern |
|------|---------|-----------------|
| 1 | 7 commits (1 per task) | `fix(scope): description` |
| 2 | 2 commits | `feat(auth-clerk): implement SDK integration` |
| 3 | 4 commits | `feat(storage-*): implement SDK integration` |
| 4 | 5 commits | `feat(scope): implement SDK integration` |
| 5 | 5 commits | `feat(scope-drizzle): implement repository` |
| 6 | 4 commits | `test(scope): expand coverage to N%` |
| 7 | 4 commits | `docs(scope): add README and JSDoc` |
| 8 | 1 commit | `feat(migration): add simple migration runner` |

**Total**: ~32 commits

---

## Success Criteria

### Verification Commands
```bash
# Error migration complete
grep -r "throw new Error" packages/*/src/ --include="*.ts" | grep -v "spec.ts" | grep -v "test.ts" | wc -l
# Expected: 0

# Console.log cleanup complete
grep -r "console\.log" packages/*/src/ --include="*.ts" | grep -v "spec.ts" | grep -v "test.ts" | wc -l
# Expected: 0

# All tests pass
pnpm test
# Expected: ALL PASS

# Type check passes
pnpm typecheck
# Expected: no errors

# Lint passes
pnpm check
# Expected: no errors
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass
- [ ] All packages have README.md
- [ ] All public APIs have JSDoc
- [ ] Coverage targets met per tier

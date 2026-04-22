# A+B+C 그룹 리팩토링: Silent Failure 근절 + Unsafe Defaults + 의존성 아키텍처

## TL;DR
> **Summary**: 13개 GitHub 이슈(#493, #478, #477, #492, #327, #476, #495, #494, #486, #485, #481, #480, #487)를 3개 그룹으로 묶어 체계적으로 해결. ILogger 인터페이스 추출 → 설정 안전성 강화 → 에러 핸들링 개선 순서로 진행.
> **Deliverables**: 13개 이슈 해결, 각 변경에 대한 테스트, #326 중복 클로징, **PR 생성 + CI 전체 통과**
> **Effort**: Large (15 implementation tasks across 12+ packages + PR/CI)
> **Parallel**: YES — 5 waves + post-implementation verification
> **Critical Path**: T1 (ILogger) → T2 (LoggingInterceptor) → T4 (Container.get() 5곳) → F1-F4 (Verification) → P1 (PR + CI)

## Context

### Original Request
croco-dev/framework 레포의 20개 오픈 이슈를 분석하여 6개 그룹으로 분류. 사용자가 Group A (Silent Failure, 6개), Group B (Unsafe Defaults, 4개), Group C (Dependency Architecture, 3개) 통합 리팩토링을 선택.

### Interview Summary
- **Breaking change 허용**: 내부 프레임워크, 배포 전 단계
- **Unsafe defaults 전략**: OTLP/PostHog → 필수화(throw), InMemoryCache/TTL → 경고+기본값
- **테스트**: 각 변경 파일에 Vitest 테스트 추가
- **#326**: #478 중복으로 클로징
- **브랜치**: 단일 브랜치로 13개 이슈 통합 진행
- **Changeset**: 불필요 (배포 전 단계)

### Metis Review (gaps addressed)
- BatchLoader.prime()은 **의도적으로** rejected promise를 캐싱 — 동작 변경 금지, 로깅만 추가
- OTLP localhost fallback 제거 시 로컬 개발 환경 깨짐 — 명확한 에러 메시지 제공
- ILogger는 아직 존재하지 않음 — framework-context에 최소 인터페이스 생성 필요
- Container.get() 리팩토링 대상 6곳 확인 (LoggingInterceptor 포함)
- 기존 좋은 constructor injection 패턴: `packages/batch-core/src/libs/ChunkExecutor.ts`, AuthGuard.ts, EntitlementManager.ts
- Problem subclass 88개 존재 — 기존 패턴(readonly code + readonly category) 따를 것

### Oracle Review (architecture decisions — ALL CONDITIONAL)

**Decision 1: ILogger Interface (CONDITIONAL)**
- `framework-context`에 배치 — 승인
- 조건 1: ILogger 시그니처를 현재 Logger.ts 실제 패턴 `(message: string, context?: Record<string, unknown>)` 과 맞출 것 (`...args: unknown[]` 아님)
- 조건 2: `LOGGER_TOKEN = new Token<ILogger>('ILogger')` 를 반드시 함께 생성 (인터페이스는 런타임 토큰이 아님)
- 조건 3: `child()` 반환형은 concrete Logger가 아닌 `ILogger`
- 조건 4: `fatal()`은 교차 계층 사용이 거의 없으므로 제외 가능

**Decision 2: IBatchLoaderFactory (CONDITIONAL)**
- `repository-core`에 배치 — 승인
- 조건 1: 반환 타입도 repository-core 소유 (`BatchLoaderLike<K,V>` 인터페이스)
- 조건 2: `BatchLoaderFactoryOptions<K,V>`에 `name` + `batchFn: (keys: ReadonlyArray<K>) => Promise<ReadonlyArray<V | Error | null>>` 포함
- 조건 3: `BATCH_LOADER_FACTORY_TOKEN` 런타임 토큰 생성
- 조건 4: 미등록 시 명시적 Problem throw (조용한 fallback 금지)

**Decision 3: Container.get() 제거 (CONDITIONAL)**
- 조건 1: 토큰 기반 주입은 추상 계약만 (ILogger, IBatchLoaderFactory). ErrorHandler/HealthCheckRegistry/AuditLogRepository 등 concrete class는 일반 constructor injection
- 조건 2: RouteCompiler의 `instantiateProvider()` → `new Ctor()` 경로 확인 필수. interceptor 생성자 변경 시 이 경로에서 터질 수 있음
- 조건 3: CrocoApp/createApp()을 composition root로 삼아 의존성 조립
- 조건 4: AuditInterceptor/LoggingInterceptor의 "직접 new" 경로 존재 여부 확인 후 처리

## Work Objectives

### Core Objective
프레임워크의 에러 핸들링, 설정 안전성, 의존성 아키텍처를 체계적으로 개선하여 운영 신뢰성 향상.

### Deliverables
1. ILogger 인터페이스 (framework-context)
2. 레이어 위반 2건 해소 (#481 LoggingInterceptor, #480 BatchLoad)
3. Container.get() 기본값 6곳 제거 → 명시적 constructor injection (#487)
4. 설정 누락 방어 4건 (#495, #494, #486, #485)
5. Silent failure 6건 로깅/에러 처리 추가 (#493, #478, #477, #492, #327, #476)
6. 각 변경에 대한 Vitest 테스트
7. #326 중복 이슈 클로징

### Definition of Done (verifiable conditions with commands)
```bash
# 전체 테스트 통과
pnpm test

# 전체 타입 체크 통과
pnpm typecheck

# Biome 린트 통과
pnpm check

# 레이어 위반 없음
grep -r "from '@croco/framework-logger'" packages/protocols-rest/src/ | wc -l  # 0
grep -r "from '@croco/dataloader-core'" packages/repository-core/src/ | wc -l  # 0

# Container.get() 기본 파라미터 없음 (대상 6곳)
grep -n "Container.get(" packages/protocols-rest/src/libs/interceptors/LoggingInterceptor.ts | wc -l  # 0
grep -n "= Container.get(" packages/transports-http/src/libs/RouteCompiler.ts | wc -l  # 0
grep -n "new Error" packages/framework-context/src/libs/MiddlewareChain.ts | wc -l  # 0
```

### Must Have
- ILogger 인터페이스 (info, warn, error, debug, child 메서드)
- 모든 silent catch에 recordError() + logger.warn() 패턴 적용
- OTLP/PostHog 설정 누락 시 시작 시점에서 throw
- InMemoryCache maxEntries 기본값 + 경고 로깅
- 각 변경에 대한 최소 1개 테스트

### Must NOT Have (guardrails)
- BatchLoader.prime()의 rejected promise 캐싱 동작 변경
- ProblemFactory로 충분한 곳에 새 Problem subclass 생성
- 대상 외 파일 수정 (scope creep 방지)
- human intervention이 필요한 acceptance criteria
- changeset 파일 생성

## Verification Strategy
> ZERO HUMAN INTERVENTION — 모든 검증은 agent 실행.
- **Test decision**: tests-after (각 태스크에서 구현 + 테스트 통합)
- **Framework**: Vitest v4.0.16, `src/tests/*.spec.ts` 패턴
- **QA policy**: 모든 태스크에 agent-executable 시나리오 포함
- **Evidence**: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy

### Parallel Execution Waves

**Wave 1 — Foundation (2 tasks)**
> ILogger 인터페이스 생성 + BatchLoad 의존성 위반 해소. T1/T3는 병렬.
- T1: Branch + ILogger 인터페이스 [deep]
- T3: BatchLoad 의존성 위반 해소 [unspecified-high] (#480)

**Wave 2 — Container.get() 제거 + 설정 안전성 (6 tasks)**
> **⚠️ 중요**: T4를 먼저 실행 후 T2 실행 (RouteCompiler instantiateProvider 경로 문제 방지)
> T4 → T2 순서로 실행, T5-T8은 독립적으로 병렬.
- T4: Container.get() 기본값 제거 5곳 + composition root 구축 [unspecified-high] (#487)
- T2: LoggingInterceptor ILogger 마이그레이션 [quick] (#481) — T4 완료 후 실행
- T5: OTLP 엔드포인트 필수화 [quick] (#495)
- T6: PostHog 호스트 필수화 [quick] (#494)
- T7: InMemoryCache maxEntries 기본값 [quick] (#486)
- T8: Upload TTL 설정 추출 [unspecified-low] (#485)

**Wave 3 — Silent Failure 근절 (6 tasks, 모두 병렬)**
> 각 태스크가 독립적인 파일/패키지. 모두 병렬 실행.
- T9: BatchLoader 로깅 [quick] (#493)
- T10: Auditable 로깅 [quick] (#478)
- T11: PolarBillingGateway 로깅 [quick] (#477)
- T12: CloudflareImages null guard [quick] (#492)
- T13: TaskRunner DI fallback 로깅 [quick] (#327)
- T14: MiddlewareChain Problem 전환 [quick] (#476)

**Wave 4 — Cleanup (1 task)**
- T15: #326 중복 이슈 클로징 [quick]

### Dependency Matrix

| Task | Depends On | Blocks |
|------|-----------|--------|
| T1 (ILogger) | — | T2, T4 |
| T2 (LoggingInterceptor) | T1, T4 | — |  <!-- T4와 같은 웨이브, T4 완료 후 실행 -->
| T3 (BatchLoad) | — | — |
| T4 (Container.get() 5곳) | T1 | T2 |  <!-- T2보다 먼저 실행 -->
| T5 (OTLP) | — | — |
| T6 (PostHog) | — | — |
| T7 (InMemoryCache) | — | — |
| T8 (TTL) | — | — |
| T9 (BatchLoader) | — | — |
| T10 (Auditable) | — | — |
| T11 (PolarBillingGateway) | — | — |
| T12 (CloudflareImages) | — | — |
| T13 (TaskRunner) | — | — |
| T14 (MiddlewareChain) | — | — |
| T15 (#326 close) | T10 | — |
| F1-F4 (Verification) | T1-T15 | P1 |
| P1 (PR + CI) | F1, F2, F3, F4 | — |

### Agent Dispatch Summary

| Wave | Tasks | Categories |
|------|-------|------------|
| Wave 1 | 2 | deep ×1, unspecified-high ×1 |
| Wave 2 | 6 | unspecified-high ×1, quick ×4, unspecified-low ×1 |
| Wave 3 | 6 | quick ×6 |
| Wave 4 | 1 | quick ×1 |
| Verification | 4 | deep ×2, unspecified-high ×2 |
| Post-Impl | 1 | quick ×1 |

## TODOs

### Wave 1 — Foundation

- [x] T1. Branch 생성 + ILogger 인터페이스 추출 (framework-context)

  **What to do**:
  1. `trunk`에서 `refactor/abc-group-issues` 브랜치 생성
  2. `packages/framework-context/src/libs/ILogger.ts` 파일 생성
  3. ILogger 인터페이스 정의 (아래 스펙 참고)
  4. `packages/framework-context/src/index.ts`에서 ILogger export 추가
  5. `packages/framework-logger/src/Logger.ts`에서 `implements ILogger` 추가
  6. 테스트 작성: ILogger 타입 호환성 검증

  **ILogger 인터페이스 + 토큰 스펙** (Oracle CONDITIONAL 조건 반영):
  ```typescript
  // packages/framework-context/src/libs/ILogger.ts
  import { Token } from '../Container';  // 또는 실제 Token import 경로

  export interface ILogger {
    debug(message: string, context?: Record<string, unknown>): void;
    info(message: string, context?: Record<string, unknown>): void;
    warn(message: string, context?: Record<string, unknown>): void;
    error(message: string, context?: Record<string, unknown> | Error): void;
    child(bindings: Record<string, unknown>): ILogger;
  }

  export const LOGGER_TOKEN = new Token<ILogger>('ILogger');
  ```
  - **Oracle 조건 1**: 시그니처를 `(message, context?)` 패턴으로 — Logger.ts의 실제 사용 패턴과 일치시킬 것 (`...args: unknown[]` 아님)
  - **Oracle 조건 2**: `LOGGER_TOKEN`을 반드시 함께 생성 — 인터페이스는 런타임 토큰이 아니므로 없이는 주입 불가
  - **Oracle 조건 3**: `child()` 반환형은 `ILogger` (concrete Logger 아님)
  - **Oracle 조건 4**: `fatal()`은 교차 계층 사용 거의 없으므로 제외
  - **주의**: Logger 클래스의 실제 메서드 시그니처를 먼저 확인하고, ILogger를 그에 맞출 것. 위 스펙은 Oracle 권장안이며 실제 Logger와 불일치 시 Logger 기준으로 맞춤

  **Must NOT do**:
  - Logger 클래스의 기존 동작 변경
  - framework-logger 외 다른 패키지에서 ILogger import 추가 (T2/T4에서 처리)
  - `fatal()` 메서드를 ILogger에 포함 (교차 계층 사용 없음)
  - `...args: unknown[]` 가변인자 시그니처 사용 (현재 Logger는 `message + context` 패턴)

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: 인터페이스 설계가 다수 패키지에 영향, Logger 실제 시그니처 분석 필요
  - Skills: [] — 내부 프레임워크 작업이므로 외부 스킬 불필요
  - Omitted: [`code-review`] — 생성 단계에서는 불필요

  **Parallelization**: Can Parallel: NO (첫 번째 태스크) | Wave 1 | Blocks: T2, T4 | Blocked By: —

  **References**:
  - Pattern: `packages/framework-logger/src/Logger.ts` — Logger 클래스 메서드 시그니처 확인
  - Pattern: `packages/framework-context/src/index.ts` — barrel export 패턴 확인
  - Pattern: `packages/framework-context/src/libs/` — 기존 인터페이스 파일 구조 확인
  - Example: `packages/retry-core/src/libs/RetryPolicy.ts` — 인터페이스 정의 패턴 참고

  **Acceptance Criteria**:
  - [ ] `packages/framework-context/src/libs/ILogger.ts` 파일 존재
  - [ ] `import type { ILogger } from '@croco/framework-context'`가 동작
  - [ ] `import { LOGGER_TOKEN } from '@croco/framework-context'`가 동작
  - [ ] Logger 클래스가 ILogger를 implements
  - [ ] `pnpm typecheck --filter=@croco/framework-context` 통과
  - [ ] `pnpm typecheck --filter=@croco/framework-logger` 통과

  **QA Scenarios**:
  ```
  Scenario: ILogger 인터페이스 타입 호환성
    Tool: Bash
    Steps: cd packages/framework-context && pnpm vitest run src/tests/ILogger.spec.ts
    Expected: Logger 인스턴스가 ILogger 타입에 할당 가능
    Evidence: .sisyphus/evidence/task-1-ilogger-compat.txt

  Scenario: barrel export 확인
    Tool: Bash
    Steps: grep "ILogger\|LOGGER_TOKEN" packages/framework-context/src/index.ts
    Expected: export type { ILogger } 및 export { LOGGER_TOKEN } 존재
    Evidence: .sisyphus/evidence/task-1-ilogger-export.txt
  ```

  **Commit**: YES | Message: `fix(framework-context): extract ILogger interface and LOGGER_TOKEN (#481 prereq)` | Files: `packages/framework-context/src/libs/ILogger.ts`, `packages/framework-context/src/index.ts`, `packages/framework-logger/src/Logger.ts`, `packages/framework-context/src/tests/ILogger.spec.ts`

- [x] T2. LoggingInterceptor → ILogger + constructor injection (#481)

  **What to do**:
  1. `packages/protocols-rest/src/libs/interceptors/LoggingInterceptor.ts` 수정
  2. `import { Logger } from '@croco/framework-logger'` → `import type { ILogger } from '@croco/framework-context'`로 변경
  3. `= Container.get(Logger)` 기본값 제거 → constructor parameter로 ILogger 주입
  4. `packages/protocols-rest/package.json`에서 `@croco/framework-logger` 의존성 제거
  5. `@croco/framework-context`가 이미 의존성에 있는지 확인 (없으면 추가)
  6. 기존 테스트가 있으면 수정, 없으면 생성

  **Constructor injection 패턴** (Oracle 조건 반영):
  ```typescript
  // Before
  import { Logger } from '@croco/framework-logger';
  private readonly logger = Container.get(Logger);

  // After
  import type { ILogger } from '@croco/framework-context';
  import { LOGGER_TOKEN } from '@croco/framework-context';
  import { Inject } from '...';  // 실제 Inject 데코레이터 import 경로 확인

  constructor(@Inject(LOGGER_TOKEN) private readonly logger: ILogger) {}
  ```
  - **Oracle 조건**: ILogger는 인터페이스이므로 반드시 `@Inject(LOGGER_TOKEN)` 사용 (타입 기반 주입 불가)
  - **주의**: `@Inject` 데코레이터의 실제 import 경로를 ChunkExecutor.ts 등 기존 예시에서 확인할 것

  **Must NOT do**:
  - LoggingInterceptor의 로깅 동작 변경
  - 다른 인터셉터 파일 수정 (이 태스크는 LoggingInterceptor만)

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: 단일 파일의 import/DI 패턴 변경
  - Skills: [] — 단순 리팩토링
  - Omitted: [`code-review`] — 패턴이 명확

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: — | Blocked By: T1, T4
  **⚠️ 실행 순서**: T4 완료 후 실행 (RouteCompiler instantiateProvider 경로가 T4에서 수정됨)

  **References**:
  - Target: `packages/protocols-rest/src/libs/interceptors/LoggingInterceptor.ts` — 수정 대상
  - Pattern: `packages/batch-core/src/libs/ChunkExecutor.ts` — 좋은 constructor injection 예시
  - Pattern: `packages/auth-core/src/libs/guards/AuthGuard.ts` — 좋은 constructor injection 예시
  - Package: `packages/protocols-rest/package.json` — 의존성 수정

  **Acceptance Criteria**:
  - [ ] `grep -r "framework-logger" packages/protocols-rest/src/` 결과 0건
  - [ ] `grep "Container.get" packages/protocols-rest/src/libs/interceptors/LoggingInterceptor.ts` 결과 0건
  - [ ] `pnpm typecheck --filter=@croco/protocols-rest` 통과
  - [ ] `pnpm test --filter=@croco/protocols-rest` 통과

  **QA Scenarios**:
  ```
  Scenario: 레이어 위반 해소 확인
    Tool: Bash
    Steps: grep -r "from '@croco/framework-logger'" packages/protocols-rest/src/
    Expected: 결과 0건 (레이어 위반 없음)
    Evidence: .sisyphus/evidence/task-2-layer-violation.txt

  Scenario: constructor injection 동작 확인
    Tool: Bash
    Steps: cd packages/protocols-rest && pnpm vitest run src/tests/interceptors/LoggingInterceptor.spec.ts
    Expected: ILogger mock 주입으로 테스트 통과
    Evidence: .sisyphus/evidence/task-2-logging-interceptor-test.txt
  ```

  **Commit**: YES | Message: `fix(protocols-rest): migrate LoggingInterceptor to ILogger (#481)` | Files: `packages/protocols-rest/src/libs/interceptors/LoggingInterceptor.ts`, `packages/protocols-rest/package.json`, `packages/protocols-rest/src/tests/interceptors/LoggingInterceptor.spec.ts`

- [x] T3. BatchLoad 의존성 위반 해소 (#480)

  **What to do**:
  1. `packages/repository-core/src/libs/decorators/BatchLoad.ts` 분석
  2. `import { createBatchLoader } from '@croco/dataloader-core'` 제거
  3. repository-core에 **로컬 계약 전체** 정의 (Oracle CONDITIONAL 조건):
     ```typescript
     // packages/repository-core/src/libs/IBatchLoaderFactory.ts
     import { Token } from '@croco/framework-context';  // 실제 Token import 경로 확인

     export interface BatchLoaderLike<K, V> {
       load(key: K): Promise<V | null>;
     }

     export type BatchLoaderFactoryOptions<K, V> = {
       name: string;
       batchFn: (keys: ReadonlyArray<K>) => Promise<ReadonlyArray<V | Error | null>>;
     };

     export interface IBatchLoaderFactory {
       create<K, V>(options: BatchLoaderFactoryOptions<K, V>): BatchLoaderLike<K, V>;
     }

     export const BATCH_LOADER_FACTORY_TOKEN = new Token<IBatchLoaderFactory>('IBatchLoaderFactory');
     ```
  4. BatchLoad 데코레이터에서 `Container.get(BATCH_LOADER_FACTORY_TOKEN)`으로 런타임 resolve
  5. **미등록 시 명시적 Problem throw** — 조용한 fallback 금지 (Oracle 조건)
  6. dataloader-core에서 IBatchLoaderFactory 구현체 어댑터 생성 + 등록
  7. repository-core의 package.json에서 @croco/dataloader-core 의존성 제거
  8. 테스트 작성 (등록/미등록 케이스 모두)

  **Oracle 조건 요약**:
  - 반환 타입 `BatchLoaderLike<K,V>`도 repository-core 소유여야 함 (dataloader-core 타입 노출 금지)
  - batchFn 시그니처는 `ReadonlyArray<K> → Promise<ReadonlyArray<V | Error | null>>` (순서 보장 + 부분 실패 표현)
  - BATCH_LOADER_FACTORY_TOKEN 런타임 토큰 필수
  - context-scoped 캐시 동작 유지 확인

  **주의**: 데코레이터는 인스턴스 메서드가 아니므로 constructor injection 불가. Container.get()으로 런타임 resolve는 허용 (이것은 DI 패턴의 정상 사용).

  **Must NOT do**:
  - BatchLoad 데코레이터의 기존 동작/API 변경
  - 데코레이터 사용처 수정 (인터페이스만 추상화)

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: 인터페이스 추출 + 2개 패키지 동시 수정 + 데코레이터 패턴
  - Skills: [] — 내부 프레임워크 작업
  - Omitted: [`code-review`] — 생성 단계

  **Parallelization**: Can Parallel: YES (T2와 병렬) | Wave 1 | Blocks: — | Blocked By: —

  **References**:
  - Target: `packages/repository-core/src/libs/decorators/BatchLoad.ts` — 수정 대상 (createBatchLoader import 위치 확인)
  - Pattern: `packages/dataloader-core/src/libs/createBatchLoader.ts` — 팩토리 함수 시그니처 확인
  - Pattern: `packages/dataloader-core/src/index.ts` — export 구조 확인
  - AGENTS.md: "repository-core는 drizzle-orm, @croco/tx-drizzle, @croco/tx-core의 Drizzle 관련 타입 직접 사용 금지" — 같은 원칙으로 dataloader-core도 금지
  - Pattern: `packages/repository-core/src/index.ts` — barrel export에 IBatchLoaderFactory 추가

  **Acceptance Criteria**:
  - [ ] `grep -r "from '@croco/dataloader-core'" packages/repository-core/src/` 결과 0건
  - [ ] `pnpm typecheck --filter=@croco/repository-core` 통과
  - [ ] `pnpm typecheck --filter=@croco/dataloader-core` 통과
  - [ ] `pnpm test --filter=@croco/repository-core` 통과

  **QA Scenarios**:
  ```
  Scenario: 레이어 위반 해소 확인
    Tool: Bash
    Steps: grep -r "from '@croco/dataloader-core'" packages/repository-core/src/
    Expected: 결과 0건
    Evidence: .sisyphus/evidence/task-3-layer-violation.txt

  Scenario: BatchLoad 데코레이터 동작 유지 (팩토리 등록됨)
    Tool: Bash
    Steps: cd packages/repository-core && pnpm vitest run src/tests/decorators/BatchLoad.spec.ts -t "should batch load"
    Expected: 기존 동작과 동일하게 배치 로딩 수행
    Evidence: .sisyphus/evidence/task-3-batchload-test.txt

  Scenario: IBatchLoaderFactory 미등록 시 명시적 에러
    Tool: Bash
    Steps: cd packages/repository-core && pnpm vitest run src/tests/decorators/BatchLoad.spec.ts -t "should throw when factory not registered"
    Expected: Problem throw (조용한 fallback 아님)
    Evidence: .sisyphus/evidence/task-3-batchload-unregistered.txt
  ```

  **Commit**: YES | Message: `fix(repository-core): remove dataloader-core import in BatchLoad (#480)` | Files: `packages/repository-core/src/libs/decorators/BatchLoad.ts`, `packages/repository-core/src/libs/IBatchLoaderFactory.ts`, `packages/repository-core/src/index.ts`, `packages/repository-core/package.json`, `packages/dataloader-core/src/libs/BatchLoaderFactory.ts`, `packages/dataloader-core/src/index.ts`, `packages/repository-core/src/tests/decorators/BatchLoad.spec.ts`

### Wave 2 — Container.get() 제거 + 설정 안전성

- [x] T4. Container.get() 기본 파라미터 제거 — 5개 파일 (#487)

  **What to do**:
  대상 5개 파일에서 `Container.get()` 기본 파라미터를 제거하고 명시적 constructor injection으로 전환.

  **파일별 수정 내용**:

  1. **`packages/transports-http/src/libs/CrocoApp.ts`**:
     - constructor body에서 `Container.get(Logger)`, `Container.get(ErrorHandler)`, `Container.get(HealthCheckRegistry)` 호출 제거
     - constructor parameter로 주입받도록 변경
     - Logger → ILogger 타입으로 변경

  2. **`packages/transports-http/src/libs/PipelineRunner.ts`**:
     - `Container.get(ErrorHandler)` 제거, constructor injection
     - Logger getter → constructor injection + ILogger

  3. **`packages/transports-http/src/libs/RouteCompiler.ts`**:
     - `= Container.get(Logger)` field initializer 제거
     - constructor parameter로 ILogger 주입

  4. **`packages/audit-core/src/libs/AuditInterceptor.ts`**:
     - `= Container.get(AuditLogRepository)` 기본 파라미터 제거
     - constructor parameter로 명시적 주입

  5. **`packages/analytics-posthog/src/libs/PostHogAnalyticsManager.ts`**:
     - `= Container.get(Logger)` 기본 파라미터 제거
     - constructor parameter로 ILogger 주입

  **Oracle 조건 반영 — 주입 전략 분류**:
  - **ILogger (추상 계약)**: `@Inject(LOGGER_TOKEN)` 토큰 기반 주입 사용 (CrocoApp, PipelineRunner, RouteCompiler, PostHogAnalyticsManager)
  - **ErrorHandler, HealthCheckRegistry, AuditLogRepository (concrete class)**: 일반 constructor injection 사용 (토큰화 금지 — Oracle 조건)

  **공통 패턴**:
  ```typescript
  // ILogger (추상 계약) — 토큰 기반
  import type { ILogger } from '@croco/framework-context';
  import { LOGGER_TOKEN } from '@croco/framework-context';

  class SomeClass {
    constructor(@Inject(LOGGER_TOKEN) private readonly logger: ILogger) {}
  }

  // ErrorHandler 등 (concrete class) — 일반 주입
  class SomeClass {
    constructor(private readonly errorHandler: ErrorHandler) {}
  }
  ```

  **⚠️ Oracle 경고 — RouteCompiler 특별 주의**:
  - RouteCompiler의 `instantiateProvider()`는 `new Ctor()`로 인터셉터를 생성할 수 있음
  - LoggingInterceptor 등의 생성자가 변경되면 이 경로에서 런타임 에러 발생 가능
  - **반드시 확인**: `instantiateProvider()` 경로가 Container를 통해 인스턴스를 생성하는지, 직접 `new`하는지
  - 직접 `new` 경로가 있다면: container 기반 instantiate로 변경하거나, CrocoApp/createApp() composition root에서 의존성 조립

  **Composition Root 구축 (필수)**:
  CrocoApp 또는 createApp()을 composition root로 삼아 의존성 조립:

  ```typescript
  // 예시: CrocoApp.boot() 또는 createApp()
  async boot() {
    // 1. Logger 인스턴스 획득 (토큰으로 등록된 것 사용)
    const logger = Container.get(LOGGER_TOKEN);
    const errorHandler = Container.get(ErrorHandler);
    const healthCheckRegistry = Container.get(HealthCheckRegistry);

    // 2. PipelineRunner 생성 (의존성 명시 전달)
    const pipelineRunner = new PipelineRunner(errorHandler, logger);

    // 3. RouteCompiler 생성 (의존성 명시 전달)
    const routeCompiler = new RouteCompiler(logger, pipelineRunner);

    // 4. 기존 코드와 호환되도록 Container에 등록 (선택적)
    Container.set(RouteCompiler, routeCompiler);
    Container.set(PipelineRunner, pipelineRunner);
  }
  ```

  **생성 경로 매핑 (사전 확인 필요)**:
  | 클래스 | 현재 생성 방식 | 변경 후 |
  |--------|---------------|---------|
  | CrocoApp | `new CrocoApp()` | Container.get(CrocoApp) 또는 createApp() |
  | RouteCompiler | `new RouteCompiler()` in CrocoApp | constructor에서 logger 주입 |
  | PipelineRunner | `new PipelineRunner()` in RouteCompiler? | constructor에서 errorHandler, logger 주입 |
  | LoggingInterceptor | `new Ctor()` in instantiateProvider? | Container 기반 instantiate로 변경 필요 |

  **⚠️ Oracle 경고 — AuditInterceptor/LoggingInterceptor "직접 new" 경로**:
  - 이 인터셉터들이 어딘가에서 직접 `new AuditInterceptor()`로 생성되는지 확인
  - 직접 new 경로가 있으면 인스턴스 제공 방식으로 전환 필요

  **각 파일 수정 후 해당 패키지 테스트 실행 필수**:
  ```bash
  pnpm test --filter=@croco/transports-http
  pnpm test --filter=@croco/audit-core
  pnpm test --filter=@croco/analytics-posthog
  ```

  **Must NOT do**:
  - LoggingInterceptor 수정 (T2에서 완료)
  - Container.get()의 런타임 resolve 사용처까지 제거 (데코레이터 내부 등은 허용)
  - 클래스의 public API 외 동작 변경
  - ErrorHandler, HealthCheckRegistry, AuditLogRepository를 토큰화 (Oracle: concrete class까지 토큰화하면 이득보다 소음이 큼)

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: 5개 파일 × 4개 패키지, 일관된 패턴 적용 필요
  - Skills: [] — 내부 프레임워크 리팩토링
  - Omitted: [`code-review`] — 패턴이 반복적

  **Parallelization**: Can Parallel: YES (T5-T8과 병렬) | Wave 2 | Blocks: T2 | Blocked By: T1

  **References**:
  - Pattern: `packages/batch-core/src/libs/ChunkExecutor.ts` — constructor injection 모범 예시
  - Pattern: `packages/auth-core/src/libs/guards/AuthGuard.ts` — constructor injection 모범 예시
  - Pattern: `packages/entitlements-core/src/libs/EntitlementManager.ts` — constructor injection 모범 예시
  - Target: 위 5개 파일 각각 — 정확한 Container.get() 위치는 grep으로 확인
  - Type: `packages/framework-context/src/libs/ILogger.ts` — T1에서 생성된 ILogger 인터페이스

  **Acceptance Criteria**:
  - [ ] 대상 5개 파일에서 `= Container.get(` 패턴 0건
  - [ ] `pnpm typecheck --filter=@croco/transports-http` 통과
  - [ ] `pnpm typecheck --filter=@croco/audit-core` 통과
  - [ ] `pnpm typecheck --filter=@croco/analytics-posthog` 통과
  - [ ] 각 패키지 테스트 통과

  **QA Scenarios**:
  ```
  Scenario: Container.get() 기본값 제거 확인
    Tool: Bash
    Steps: grep -rn "= Container.get(" packages/transports-http/src/libs/CrocoApp.ts packages/transports-http/src/libs/RouteCompiler.ts packages/transports-http/src/libs/PipelineRunner.ts packages/audit-core/src/libs/AuditInterceptor.ts packages/analytics-posthog/src/
    Expected: 결과 0건
    Evidence: .sisyphus/evidence/task-4-container-get.txt

  Scenario: 전체 typecheck 통과
    Tool: Bash
    Steps: pnpm typecheck
    Expected: exit code 0
    Evidence: .sisyphus/evidence/task-4-typecheck.txt
  ```

  **Commit**: YES | Message: `refactor(framework): remove Container.get() defaults (#487)` | Files: 위 5개 파일 + 관련 테스트 파일

- [x] T5. OTLP 엔드포인트 필수화 (#495)

  **What to do**:
  1. `packages/telemetry-sdk-node/src/runtime.ts` 에서 `localhost:4318` fallback 제거
  2. `packages/telemetry-sdk-node/src/libs/presets/lambda.ts` 에서 동일 fallback 제거
  3. OTLP endpoint가 없으면 명확한 에러 메시지와 함께 throw:
     ```typescript
     if (!endpoint) {
       throw new Error(
         '[TelemetryRuntime] OTLP endpoint is required. ' +
         'Set OTEL_EXPORTER_OTLP_ENDPOINT environment variable or pass endpoint in config. ' +
         'For local development, run an OTLP collector on localhost:4318.'
       );
     }
     ```
  4. 테스트 작성: endpoint 누락 시 throw 확인

  **Must NOT do**:
  - Problem subclass 사용 (이것은 startup 실패이므로 plain Error 사용)
  - endpoint가 제공된 경우의 동작 변경

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: 2개 파일의 fallback 제거 + throw 추가
  - Skills: [] — 단순 수정
  - Omitted: [`cloudflare`] — OTLP 관련이지 Cloudflare 아님

  **Parallelization**: Can Parallel: YES (T4, T6-T8과 병렬) | Wave 2 | Blocks: — | Blocked By: —

  **References**:
  - Target: `packages/telemetry-sdk-node/src/runtime.ts` — localhost fallback 위치
  - Target: `packages/telemetry-sdk-node/src/libs/presets/lambda.ts` — localhost fallback 위치
  - AGENTS.md: Telemetry & Tracing 섹션 — OTLP 전용 정책 확인

  **Acceptance Criteria**:
  - [ ] `grep "localhost" packages/telemetry-sdk-node/src/runtime.ts` 결과 0건
  - [ ] `grep "localhost" packages/telemetry-sdk-node/src/libs/presets/lambda.ts` 결과 0건
  - [ ] `pnpm test --filter=@croco/telemetry-sdk-node` 통과

  **QA Scenarios**:
  ```
  Scenario: endpoint 누락 시 throw
    Tool: Bash
    Steps: cd packages/telemetry-sdk-node && pnpm vitest run -t "should throw when OTLP endpoint missing"
    Expected: Error with message containing "OTLP endpoint is required"
    Evidence: .sisyphus/evidence/task-5-otlp-throw.txt

  Scenario: endpoint 제공 시 정상 동작
    Tool: Bash
    Steps: cd packages/telemetry-sdk-node && pnpm vitest run -t "should initialize with provided endpoint"
    Expected: 정상 초기화
    Evidence: .sisyphus/evidence/task-5-otlp-normal.txt
  ```

  **Commit**: YES | Message: `fix(telemetry-sdk-node): require OTLP endpoint configuration (#495)` | Files: `packages/telemetry-sdk-node/src/runtime.ts`, `packages/telemetry-sdk-node/src/libs/presets/lambda.ts`, `packages/telemetry-sdk-node/src/tests/runtime.spec.ts`

- [x] T6. PostHog 호스트 필수화 (#494)

  **What to do**:
  1. `packages/integrations-posthog/src/libs/PostHogClient.ts` (또는 유사 경로) 에서 US host (`https://us.i.posthog.com`) 기본값 제거
  2. host가 없으면 명확한 에러 메시지와 함께 throw:
     ```typescript
     if (!host) {
       throw new Error(
         '[PostHogClient] PostHog host is required. ' +
         'Set POSTHOG_HOST environment variable or pass host in config. ' +
         'Options: https://us.i.posthog.com (US) or https://eu.i.posthog.com (EU).'
       );
     }
     ```
  3. 테스트 작성

  **Must NOT do**:
  - PostHog API 호출 동작 변경
  - host가 제공된 경우의 동작 변경

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: 단일 파일 수정
  - Skills: [] — 단순 수정

  **Parallelization**: Can Parallel: YES (T4-T5, T7-T8과 병렬) | Wave 2 | Blocks: — | Blocked By: —

  **References**:
  - Target: `packages/integrations-posthog/src/libs/PostHogClient.ts` — 정확한 경로는 `grep -r "posthog.com" packages/` 로 확인
  - Pattern: T5의 에러 메시지 패턴 — 일관된 형식 유지

  **Acceptance Criteria**:
  - [ ] `grep "us.i.posthog.com" packages/integrations-posthog/src/` 결과 0건 (또는 에러 메시지 내에서만 사용)
  - [ ] `pnpm test --filter=@croco/integrations-posthog` 통과

  **QA Scenarios**:
  ```
  Scenario: host 누락 시 throw
    Tool: Bash
    Steps: cd packages/integrations-posthog && pnpm vitest run -t "should throw when PostHog host missing"
    Expected: Error with message containing "PostHog host is required"
    Evidence: .sisyphus/evidence/task-6-posthog-throw.txt
  ```

  **Commit**: YES | Message: `fix(integrations-posthog): require PostHog host configuration (#494)` | Files: `packages/integrations-posthog/src/libs/PostHogClient.ts`, `packages/integrations-posthog/src/tests/PostHogClient.spec.ts`

- [x] T7. InMemoryCache maxEntries 기본값 + 경고 (#486)

  **What to do**:
  1. `packages/cache-core/src/libs/InMemoryCacheStore.ts` 에서 `maxEntries = null` (무제한) 수정
  2. maxEntries가 null/undefined이면:
     - 기본값 1000 적용
     - Logger.warn() 으로 경고 로깅:
       ```typescript
       logger.warn('[InMemoryCacheStore] maxEntries not configured, defaulting to 1000. ' +
         'Set maxEntries explicitly to avoid unbounded memory growth.');
       ```
  3. constructor에서 Logger 주입 (없으면 console.warn fallback)
  4. 테스트 작성

  **Must NOT do**:
  - maxEntries가 명시적으로 설정된 경우의 동작 변경
  - throw (이것은 warn+default 전략)

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: 단일 파일 수정
  - Skills: [] — 단순 수정

  **Parallelization**: Can Parallel: YES (T4-T6, T8과 병렬) | Wave 2 | Blocks: — | Blocked By: —

  **References**:
  - Target: `packages/cache-core/src/libs/InMemoryCacheStore.ts:32` — maxEntries=null 위치
  - Pattern: `packages/tx-core/src/libs/safeLog.ts` — safeLog() 패턴 참고 (Logger 없을 때 fallback)

  **Acceptance Criteria**:
  - [ ] maxEntries 미설정 시 기본값 1000 적용
  - [ ] maxEntries 미설정 시 경고 로그 출력
  - [ ] `pnpm test --filter=@croco/cache-core` 통과

  **QA Scenarios**:
  ```
  Scenario: maxEntries 미설정 시 기본값 적용
    Tool: Bash
    Steps: cd packages/cache-core && pnpm vitest run -t "should default maxEntries to 1000"
    Expected: maxEntries가 1000으로 설정됨
    Evidence: .sisyphus/evidence/task-7-cache-default.txt

  Scenario: maxEntries 미설정 시 경고 로그
    Tool: Bash
    Steps: cd packages/cache-core && pnpm vitest run -t "should warn when maxEntries not configured"
    Expected: logger.warn 호출 확인
    Evidence: .sisyphus/evidence/task-7-cache-warn.txt
  ```

  **Commit**: YES | Message: `fix(cache-core): add default maxEntries with warning (#486)` | Files: `packages/cache-core/src/libs/InMemoryCacheStore.ts`, `packages/cache-core/src/tests/InMemoryCacheStore.spec.ts`

- [x] T8. Upload Intent TTL 설정 추출 (#485)

  **What to do**:
  1. `packages/storage-core/src/libs/types.ts` 에서 `UploadIntent` 또는 `getUploadIntent` 관련 타입에 `expiresIn?: number` 추가
  2. `packages/storage-cloudinary/src/libs/CloudinaryProvider.ts:377` — 하드코딩 3600 → config에서 읽기
  3. `packages/storage-cloudflare/src/libs/CloudflareImagesProvider.ts:204,224` — 하드코딩 3600 → config에서 읽기
  4. 기본값 3600 유지하되, 경고 로그 추가:
     ```typescript
     if (!options.expiresIn) {
       logger.warn('[StorageProvider] Upload intent TTL not configured, defaulting to 3600s.');
     }
     const ttl = options.expiresIn ?? 3600;
     ```
  5. 테스트 작성

  **Must NOT do**:
  - expiresIn이 명시적으로 설정된 경우의 동작 변경
  - 기본값 3600 제거 (warn+default 전략)
  - storage-r2 등 다른 storage 패키지 수정

  **Recommended Agent Profile**:
  - Category: `unspecified-low` — Reason: 3개 파일 수정이나 패턴이 동일하고 단순
  - Skills: [] — 단순 수정

  **Parallelization**: Can Parallel: YES (T4-T7과 병렬) | Wave 2 | Blocks: — | Blocked By: —

  **References**:
  - Target: `packages/storage-core/src/libs/types.ts:231` — TTL 관련 타입 위치
  - Target: `packages/storage-cloudinary/src/libs/CloudinaryProvider.ts:377` — 하드코딩 TTL
  - Target: `packages/storage-cloudflare/src/libs/CloudflareImagesProvider.ts:204,224` — 하드코딩 TTL

  **Acceptance Criteria**:
  - [ ] `grep -n "3600" packages/storage-cloudinary/src/libs/CloudinaryProvider.ts` — config에서 읽는 형태로 변경
  - [ ] `grep -n "3600" packages/storage-cloudflare/src/libs/CloudflareImagesProvider.ts` — config에서 읽는 형태로 변경
  - [ ] `pnpm typecheck --filter=@croco/storage-core` 통과
  - [ ] `pnpm test --filter=@croco/storage-cloudinary` 통과 (테스트 존재 시)
  - [ ] `pnpm test --filter=@croco/storage-cloudflare` 통과 (테스트 존재 시)

  **QA Scenarios**:
  ```
  Scenario: TTL 설정 가능 확인
    Tool: Bash
    Steps: cd packages/storage-cloudinary && pnpm vitest run -t "should use configured TTL"
    Expected: expiresIn 파라미터가 반영됨
    Evidence: .sisyphus/evidence/task-8-ttl-config.txt

  Scenario: TTL 미설정 시 기본값 + 경고
    Tool: Bash
    Steps: cd packages/storage-cloudflare && pnpm vitest run -t "should default TTL to 3600"
    Expected: 기본값 3600 + 경고 로그
    Evidence: .sisyphus/evidence/task-8-ttl-default.txt
  ```

  **Commit**: YES | Message: `fix(storage-core): extract TTL to configuration (#485)` | Files: `packages/storage-core/src/libs/types.ts`, `packages/storage-cloudinary/src/libs/CloudinaryProvider.ts`, `packages/storage-cloudflare/src/libs/CloudflareImagesProvider.ts`, 관련 테스트 파일

### Wave 3 — Silent Failure 근절

- [x] T9. BatchLoader silent failure 로깅 (#493)

  **What to do**:
  1. `packages/dataloader-core/src/libs/BatchLoader.ts` 수정
  2. Line 62: `void rejected.catch(() => undefined)` → rejected promise 로깅 추가
     ```typescript
     void rejected.catch((error) => {
       recordError(error);
       logger.warn('[BatchLoader] Failed to prime cache with rejected promise', {
         error: error instanceof Error ? error.message : String(error),
       });
     });
     ```
  3. Line 75: `void dispatch` — dispatch 실패 시 로깅 추가 (dispatch가 Promise를 반환하면)
  4. Logger를 constructor injection으로 추가 (ILogger 사용)
  5. `recordError` import 추가 from `@croco/telemetry-api`
  6. 테스트 작성

  **⚠️ CRITICAL**: `prime()` 메서드는 **의도적으로** rejected promise를 캐싱한다. 이 동작을 **절대** 변경하지 말 것. `.catch()` 안에서 로깅만 추가하고, promise 체인의 결과는 그대로 유지.

  **Must NOT do**:
  - prime()의 rejected promise 캐싱 동작 변경
  - catch에서 에러를 re-throw
  - dispatch의 동작 변경

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: 단일 파일, 로깅 추가만
  - Skills: [] — 단순 수정

  **Parallelization**: Can Parallel: YES (T10-T14와 병렬) | Wave 3 | Blocks: — | Blocked By: —

  **References**:
  - Target: `packages/dataloader-core/src/libs/BatchLoader.ts:62,75` — 수정 대상
  - Pattern: `recordError` from `packages/telemetry-api/src/libs/span.ts` — 에러 기록 함수
  - Guardrail: Metis — "BatchLoader.prime() INTENTIONALLY caches rejected promises"

  **Acceptance Criteria**:
  - [ ] prime() 실패 시 logger.warn + recordError 호출 확인
  - [ ] prime()의 rejected promise 캐싱 동작 유지
  - [ ] `pnpm test --filter=@croco/dataloader-core` 통과

  **QA Scenarios**:
  ```
  Scenario: rejected promise에 대한 로깅
    Tool: Bash
    Steps: cd packages/dataloader-core && pnpm vitest run -t "should log warning when priming with error"
    Expected: logger.warn 호출 + recordError 호출
    Evidence: .sisyphus/evidence/task-9-batchloader-log.txt

  Scenario: rejected promise 캐싱 동작 유지
    Tool: Bash
    Steps: cd packages/dataloader-core && pnpm vitest run -t "should cache rejected promises in prime"
    Expected: prime 후 load 시 동일한 rejected promise 반환
    Evidence: .sisyphus/evidence/task-9-batchloader-cache.txt
  ```

  **Commit**: YES | Message: `fix(dataloader-core): add logging for BatchLoader silent failures (#493)` | Files: `packages/dataloader-core/src/libs/BatchLoader.ts`, `packages/dataloader-core/src/tests/BatchLoader.spec.ts`

- [x] T10. Auditable fire-and-forget 로깅 (#478)

  **What to do**:
  1. `packages/audit-core/src/libs/Auditable.ts` 수정
  2. Line 63-69: `.catch(() => undefined)` → 에러 로깅으로 대체:
     ```typescript
     .catch((error) => {
       recordError(error);
       logger.warn('[Auditable] Failed to write audit log', {
         operation: propertyKey,
         error: error instanceof Error ? error.message : String(error),
       });
     });
     ```
  3. Logger injection 추가 (데코레이터이므로 Container.get() 런타임 resolve 허용)
  4. `recordError` import 추가
  5. 테스트 작성

  **Must NOT do**:
  - 감사 로그 실패 시 원래 메서드 실행을 중단 (fire-and-forget 유지)
  - catch에서 에러를 re-throw

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: 단일 파일, 로깅 추가만
  - Skills: [] — 단순 수정

  **Parallelization**: Can Parallel: YES (T9, T11-T14와 병렬) | Wave 3 | Blocks: T15 | Blocked By: —

  **References**:
  - Target: `packages/audit-core/src/libs/Auditable.ts:63-69` — 수정 대상
  - Pattern: T9의 로깅 패턴과 동일한 형식 사용

  **Acceptance Criteria**:
  - [ ] `.catch(() => undefined)` 패턴 제거 (grep 확인)
  - [ ] 감사 로그 실패 시 logger.warn + recordError 호출
  - [ ] `pnpm test --filter=@croco/audit-core` 통과

  **QA Scenarios**:
  ```
  Scenario: 감사 로그 실패 시 경고 로깅
    Tool: Bash
    Steps: cd packages/audit-core && pnpm vitest run -t "should log warning when audit write fails"
    Expected: logger.warn 호출 + recordError 호출 + 원래 메서드 결과 정상 반환
    Evidence: .sisyphus/evidence/task-10-auditable-log.txt
  ```

  **Commit**: YES | Message: `fix(audit-core): add logging for Auditable write failures (#478)` | Files: `packages/audit-core/src/libs/Auditable.ts`, `packages/audit-core/src/tests/Auditable.spec.ts`

- [x] T11. PolarBillingGateway catch-all 로깅 (#477)

  **What to do**:
  1. `packages/billing-polar/src/libs/PolarBillingGateway.ts` 수정
  2. Line 56-60: `isCustomerNotFoundError` catch 블록에 로깅 추가
     - **중요**: 이 catch는 "고객이 없으면 새로 생성"하는 **의도적 패턴**
     - 실제 코드: catch에서 아무것도 반환하지 않고 계속 진행 → Line 62-68에서 `customers.create()` 호출 → `created.id` (string) 반환
     - 로깅만 추가, 기존 흐름 유지:
     ```typescript
     } catch (error) {
       if (!this.isCustomerNotFoundError(error)) {
         throw error;
       }
       // 로깅 추가 (기존 동작: 계속 진행하여 새 고객 생성)
       recordError(error);
       logger.warn('[PolarBillingGateway] Customer not found, proceeding to create new customer', {
         externalId: billingAccountId,
       });
     }
     // 이후 Line 62-68: customers.create() 실행
     ```
  3. Logger constructor injection 추가 (ILogger + @Inject(LOGGER_TOKEN))
  4. `recordError` import 추가
  5. 테스트 작성

  **기존 동작 요약 (반드시 유지)**:
  - 메서드 반환형: `Promise<string>` (customer ID)
  - catch 후 계속 진행: `customers.create()` 호출로 새 고객 생성
  - `isCustomerNotFoundError`가 아닌 에러는 여전히 throw

  **Must NOT do**:
  - catch에서 `return null` 추가 (기존 코드에 없음, 동작 변경)
  - customer creation fallback 제거
  - `isCustomerNotFoundError`가 아닌 에러에 대한 로깅 추가 (여전히 throw여야 함)

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: 단일 파일, 로깅 추가만
  - Skills: [] — 단순 수정

  **Parallelization**: Can Parallel: YES (T9-T10, T12-T14와 병렬) | Wave 3 | Blocks: — | Blocked By: —

  **References**:
  - Target: `packages/billing-polar/src/libs/PolarBillingGateway.ts:56-60` — 수정 대상
  - Pattern: T9/T10의 로깅 패턴과 동일한 형식

  **Acceptance Criteria**:
  - [ ] `isCustomerNotFoundError`인 경우 logger.warn + recordError 호출
  - [ ] 메서드가 여전히 `Promise<string>` 반환 (customer ID)
  - [ ] not-found catch 후 `customers.create()` 호출 유지
  - [ ] `pnpm test --filter=@croco/billing-polar` 통과

  **QA Scenarios**:
  ```
  Scenario: customer not found 시 로깅 + 신규 생성
    Tool: Bash
    Steps: cd packages/billing-polar && pnpm vitest run -t "should log warning and create customer when not found"
    Expected: logger.warn 호출 + customers.create() 호출 + string (customer ID) 반환
    Evidence: .sisyphus/evidence/task-11-polar-log.txt

  Scenario: not-found 외 에러는 여전히 throw
    Tool: Bash
    Steps: cd packages/billing-polar && pnpm vitest run -t "should throw non-not-found errors"
    Expected: 에러 throw (로깅 후 throw 아님, 기존대로 바로 throw)
    Evidence: .sisyphus/evidence/task-11-polar-throw.txt
  ```

  **Commit**: YES | Message: `fix(billing-polar): add logging for PolarBillingGateway catch-all (#477)` | Files: `packages/billing-polar/src/libs/PolarBillingGateway.ts`, `packages/billing-polar/src/tests/PolarBillingGateway.spec.ts`

- [x] T12. CloudflareImages null dereference guard (#492)

  **What to do**:
  1. `packages/storage-cloudflare/src/libs/CloudflareImagesProvider.ts` 수정
  2. Line 177: `result.result` 접근 전에 null/undefined 체크 추가
  3. Line 222: 동일하게 null guard 추가
  4. result가 null이면 적절한 Problem throw:
     ```typescript
     if (!result?.result) {
       throw ProblemFactory.internalServerError(
         'CLOUDFLARE_IMAGES_NULL_RESULT',
         'Cloudflare Images API returned null result'
       );
     }
     ```
  5. 테스트 작성

  **Must NOT do**:
  - Cloudflare API 호출 로직 변경
  - result가 정상인 경우의 동작 변경

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: 단일 파일, null guard 추가만
  - Skills: [] — 단순 수정

  **Parallelization**: Can Parallel: YES (T9-T11, T13-T14와 병렬) | Wave 3 | Blocks: — | Blocked By: —

  **References**:
  - Target: `packages/storage-cloudflare/src/libs/CloudflareImagesProvider.ts:177,222` — 수정 대상
  - Pattern: `packages/problems-core/src/libs/ProblemFactory.ts` — ProblemFactory.internalServerError() 사용법

  **Acceptance Criteria**:
  - [ ] result가 null일 때 ProblemFactory.internalServerError() throw
  - [ ] result가 정상일 때 기존 동작 유지
  - [ ] `pnpm typecheck --filter=@croco/storage-cloudflare` 통과

  **QA Scenarios**:
  ```
  Scenario: null result에 대한 guard
    Tool: Bash
    Steps: cd packages/storage-cloudflare && pnpm vitest run -t "should throw when Cloudflare returns null result"
    Expected: Problem throw with code CLOUDFLARE_IMAGES_NULL_RESULT
    Evidence: .sisyphus/evidence/task-12-cloudflare-null.txt

  Scenario: 정상 result 처리
    Tool: Bash
    Steps: cd packages/storage-cloudflare && pnpm vitest run -t "should process valid Cloudflare result"
    Expected: 정상 반환
    Evidence: .sisyphus/evidence/task-12-cloudflare-normal.txt
  ```

  **Commit**: YES | Message: `fix(storage-cloudflare): add null guard for CloudflareImages result (#492)` | Files: `packages/storage-cloudflare/src/libs/CloudflareImagesProvider.ts`, `packages/storage-cloudflare/src/tests/CloudflareImagesProvider.spec.ts`

- [x] T13. TaskRunner DI fallback 로깅 (#327)

  **What to do**:
  1. `packages/tasks-core/src/libs/TaskRunner.ts` 수정
  2. Line 51-57: DI 실패 시 silent fallback에 로깅 추가:
     ```typescript
     try {
       instance = Container.get(taskClass);
     } catch (error) {
       recordError(error);
       logger.warn('[TaskRunner] DI resolution failed, falling back to manual instantiation', {
         taskClass: taskClass.name,
         error: error instanceof Error ? error.message : String(error),
       });
       instance = new taskClass();
     }
     ```
  3. Logger injection 추가
  4. `recordError` import 추가
  5. 테스트 작성

  **Must NOT do**:
  - DI fallback 동작 자체를 제거 (로깅만 추가)
  - TaskRunner의 다른 메서드 수정

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: 단일 파일, 로깅 추가만
  - Skills: [] — 단순 수정

  **Parallelization**: Can Parallel: YES (T9-T12, T14와 병렬) | Wave 3 | Blocks: — | Blocked By: —

  **References**:
  - Target: `packages/tasks-core/src/libs/TaskRunner.ts:51-57` — 수정 대상
  - Pattern: T9의 로깅 패턴과 동일한 형식

  **Acceptance Criteria**:
  - [ ] DI 실패 시 logger.warn + recordError 호출
  - [ ] DI 실패 시 여전히 manual instantiation 동작
  - [ ] `pnpm test --filter=@croco/tasks-core` 통과

  **QA Scenarios**:
  ```
  Scenario: DI 실패 시 경고 로깅
    Tool: Bash
    Steps: cd packages/tasks-core && pnpm vitest run -t "should log warning when DI fails for task"
    Expected: logger.warn 호출 + manual instantiation 성공
    Evidence: .sisyphus/evidence/task-13-taskrunner-log.txt
  ```

  **Commit**: YES | Message: `fix(tasks-core): add logging for TaskRunner DI fallback (#327)` | Files: `packages/tasks-core/src/libs/TaskRunner.ts`, `packages/tasks-core/src/tests/TaskRunner.spec.ts`

- [x] T14. MiddlewareChain plain Error → MiddlewareProblem (#476)

  **What to do**:
  1. `packages/framework-context/src/libs/MiddlewareChain.ts` 수정
  2. Line 27: `new Error(...)` → MiddlewareProblem으로 교체
  3. Line 45: 동일하게 교체
  4. MiddlewareProblem 클래스 생성 (framework-context 내부):
     ```typescript
     export class MiddlewareProblem extends Problem {
       readonly code = 'MIDDLEWARE_EXECUTION_ERROR';
       readonly category = ProblemCategory.InternalServerError;

       constructor(detail: string) {
         super(detail);
       }
     }
     ```
  5. MiddlewareProblem 위치: `packages/framework-context/src/libs/problems/MiddlewareProblem.ts` (패키지 내부 문제이므로)
  6. 테스트 작성

  **Must NOT do**:
  - MiddlewareChain의 미들웨어 실행 로직 변경
  - Problem이 아닌 다른 에러 타입 사용
  - ProblemFactory 사용 (이것은 구체적인 Problem subclass가 필요한 케이스)

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: 단일 파일 + Problem 클래스 1개 생성
  - Skills: [] — 단순 수정

  **Parallelization**: Can Parallel: YES (T9-T13과 병렬) | Wave 3 | Blocks: — | Blocked By: —

  **References**:
  - Target: `packages/framework-context/src/libs/MiddlewareChain.ts:27,45` — 수정 대상
  - Pattern: `packages/problems-core/src/libs/Problem.ts` — Problem base class
  - Pattern: `packages/problems-core/src/libs/ProblemCategory.ts` — ProblemCategory enum
  - Example: 기존 Problem subclass 88개 중 아무거나 (readonly code + readonly category 패턴)

  **Acceptance Criteria**:
  - [ ] `grep "new Error" packages/framework-context/src/libs/MiddlewareChain.ts` 결과 0건
  - [ ] MiddlewareProblem이 Problem을 extends
  - [ ] `pnpm typecheck --filter=@croco/framework-context` 통과
  - [ ] `pnpm test --filter=@croco/framework-context` 통과

  **QA Scenarios**:
  ```
  Scenario: MiddlewareProblem throw 확인
    Tool: Bash
    Steps: cd packages/framework-context && pnpm vitest run -t "should throw MiddlewareProblem"
    Expected: MiddlewareProblem with code MIDDLEWARE_EXECUTION_ERROR
    Evidence: .sisyphus/evidence/task-14-middleware-problem.txt
  ```

  **Commit**: YES | Message: `fix(framework-context): replace Error with MiddlewareProblem (#476)` | Files: `packages/framework-context/src/libs/MiddlewareChain.ts`, `packages/framework-context/src/libs/problems/MiddlewareProblem.ts`, `packages/framework-context/src/tests/MiddlewareChain.spec.ts`

### Wave 4 — Cleanup

- [x] T15. #326 이슈 중복 클로징

  **What to do**:
  1. GitHub CLI로 #326 이슈를 duplicate of #478로 클로징:
     ```bash
     gh issue close 326 -R croco-dev/framework -c "Duplicate of #478. Fixed in the same PR."
     ```

  **Must NOT do**:
  - 다른 이슈 상태 변경
  - 코드 수정

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: CLI 명령어 1개
  - Skills: [] — 불필요

  **Parallelization**: Can Parallel: NO (T10 완료 후) | Wave 4 | Blocks: — | Blocked By: T10

  **References**:
  - Issue: https://github.com/croco-dev/framework/issues/326 — 중복 이슈
  - Issue: https://github.com/croco-dev/framework/issues/478 — 원본 이슈

  **Acceptance Criteria**:
  - [ ] #326 이슈 상태가 closed
  - [ ] 클로징 코멘트에 #478 참조 포함

  **QA Scenarios**:
  ```
  Scenario: 이슈 클로징 확인
    Tool: Bash
    Steps: gh issue view 326 -R croco-dev/framework --json state
    Expected: state = "CLOSED"
    Evidence: .sisyphus/evidence/task-15-issue-close.txt
  ```

  **Commit**: NO

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**

- [ ] F1. Plan Compliance Audit

  **What to do**: `.sisyphus/plans/abc-group-refactoring.md`를 기준으로 모든 태스크가 계획대로 구현되었는지 검증. oracle 서브에이전트 호출로 아키텍처 결정 준수 여부 확인.
  **Recommended Agent Profile**: Category: `deep` — oracle 서브에이전트를 호출하여 검증 수행
  **Parallelization**: Can Parallel: YES (F2, F3, F4와 병렬) | Blocked By: T1-T15 전체

  **QA Scenarios**:
  ```
  Scenario: 13개 이슈 각각의 Acceptance Criteria 충족 검증
    Tool: Bash
    Steps:
      1. cat .sisyphus/plans/abc-group-refactoring.md | grep "Acceptance Criteria" -A 10 으로 모든 AC 추출
      2. 각 AC의 커맨드(grep, pnpm typecheck 등)를 실행하여 통과 여부 확인
      3. 결과를 .sisyphus/evidence/f1-compliance-audit.md에 기록
    Expected: 모든 T1-T15의 Acceptance Criteria 100% 통과. 하나라도 실패 시 REJECT
    Evidence: .sisyphus/evidence/f1-compliance-audit.md

  Scenario: Oracle 조건(ILogger 시그니처, LOGGER_TOKEN, IBatchLoaderFactory 계약) 충족 확인
    Tool: Bash
    Steps:
      1. grep "LOGGER_TOKEN" packages/framework-context/src/libs/ILogger.ts — 토큰 존재 확인
      2. grep "BATCH_LOADER_FACTORY_TOKEN" packages/repository-core/src/libs/IBatchLoaderFactory.ts — 토큰 존재 확인
      3. grep "@Inject(LOGGER_TOKEN)" packages/protocols-rest/src/ -r — ILogger 토큰 기반 주입 확인
      4. grep "BatchLoaderLike" packages/repository-core/src/libs/IBatchLoaderFactory.ts — 반환 타입 소유 확인
    Expected: 4개 모두 결과 있음
    Evidence: .sisyphus/evidence/f1-oracle-conditions.md
  ```

- [ ] F2. Code Quality Review — unspecified-high

  **What to do**: 변경된 모든 파일에 대해 코드 리뷰. Biome 규칙, 네이밍 컨벤션, import 순서, Problem 패턴 준수 확인.
  **Recommended Agent Profile**: Category: `unspecified-high`, Skills: [`code-review`]
  **Parallelization**: Can Parallel: YES (F1, F3, F4와 병렬) | Blocked By: T1-T15 전체

  **QA Scenarios**:
  ```
  Scenario: Biome lint + format 통과
    Tool: Bash
    Steps: pnpm check
    Expected: 에러 0건 (exit code 0)
    Evidence: .sisyphus/evidence/f2-biome-check.txt

  Scenario: TypeScript 타입 체크 통과
    Tool: Bash
    Steps: pnpm typecheck
    Expected: 에러 0건 (exit code 0)
    Evidence: .sisyphus/evidence/f2-typecheck.txt

  Scenario: Problem subclass 패턴 준수 (MiddlewareProblem)
    Tool: Bash
    Steps: grep -n "readonly code\|readonly category" packages/framework-context/src/libs/problems/MiddlewareProblem.ts
    Expected: readonly code = 'MIDDLEWARE_EXECUTION_ERROR' 및 readonly category = ProblemCategory.InternalServerError 패턴 확인
    Evidence: .sisyphus/evidence/f2-problem-pattern.txt

  Scenario: import type 규칙 준수
    Tool: Bash
    Steps: git diff trunk --name-only | xargs grep "import { ILogger }" 2>/dev/null || true
    Expected: 결과 0건 (모두 import type { ILogger }여야 함)
    Evidence: .sisyphus/evidence/f2-import-type.txt
  ```

- [ ] F3. Real Manual QA — unspecified-high

  **What to do**: 변경된 모든 패키지의 테스트 실행 및 결과 검증. 새로 추가된 테스트가 의미있는 검증을 수행하는지 확인.
  **Recommended Agent Profile**: Category: `unspecified-high`
  **Parallelization**: Can Parallel: YES (F1, F2, F4와 병렬) | Blocked By: T1-T15 전체

  **QA Scenarios**:
  ```
  Scenario: 전체 테스트 스위트 통과
    Tool: Bash
    Steps: pnpm test
    Expected: 전체 테스트 통과 (exit code 0)
    Evidence: .sisyphus/evidence/f3-full-test.txt

  Scenario: 레이어 위반 0건 확인
    Tool: Bash
    Steps:
      1. grep -r "from '@croco/framework-logger'" packages/protocols-rest/src/
      2. grep -r "from '@croco/dataloader-core'" packages/repository-core/src/
    Expected: 두 명령 모두 결과 0건
    Evidence: .sisyphus/evidence/f3-layer-violations.txt

  Scenario: Container.get() 기본 파라미터 제거 확인
    Tool: Bash
    Steps: grep -rn "= Container.get(" packages/transports-http/src/libs/CrocoApp.ts packages/transports-http/src/libs/PipelineRunner.ts packages/transports-http/src/libs/RouteCompiler.ts packages/audit-core/src/libs/AuditInterceptor.ts packages/protocols-rest/src/libs/interceptors/LoggingInterceptor.ts packages/analytics-posthog/src/libs/PostHogAnalyticsManager.ts
    Expected: 결과 0건 (6곳 모두 제거됨)
    Evidence: .sisyphus/evidence/f3-container-get-removed.txt

  Scenario: 새 테스트 파일이 의미있는 assertion 포함
    Tool: Bash
    Steps: git diff trunk --name-only -- '*.spec.ts' | xargs grep -l "expect(" | wc -l
    Expected: 새로 추가/수정된 모든 .spec.ts 파일에 expect() assertion 존재
    Evidence: .sisyphus/evidence/f3-test-assertions.txt
  ```

- [ ] F4. Scope Fidelity Check — deep

  **What to do**: 변경 범위가 계획에 명시된 13개 이슈 범위를 벗어나지 않았는지 확인. 불필요한 변경, scope creep, 미완료 항목 식별.
  **Recommended Agent Profile**: Category: `deep`
  **Parallelization**: Can Parallel: YES (F1, F2, F3와 병렬) | Blocked By: T1-T15 전체

  **QA Scenarios**:
  ```
  Scenario: 변경 파일이 계획된 범위 내에 있는지 확인
    Tool: Bash
    Steps:
      1. git diff --stat trunk으로 전체 변경 파일 목록 생성
      2. 계획에 명시된 패키지 목록과 대조: framework-context, framework-logger, protocols-rest, repository-core, dataloader-core, transports-http, audit-core, analytics-posthog, telemetry-sdk-node, integrations-posthog, cache-core, storage-core, storage-cloudflare, billing-polar, tasks-core
      3. 목록 외 패키지에 변경이 있으면 scope creep으로 플래그
    Expected: 변경 파일이 모두 계획된 패키지 내에 있음. 계획 외 변경 0건.
    Evidence: .sisyphus/evidence/f4-scope-check.md

  Scenario: 미완료 태스크 없음 확인
    Tool: Bash
    Steps:
      1. 각 이슈(#493, #478, #477, #492, #327, #476, #495, #494, #486, #485, #481, #480, #487)에 대해 해당 커밋이 존재하는지 git log --oneline trunk..HEAD | grep "#이슈번호"로 확인
      2. #326 클로징 작업 확인
    Expected: 13개 이슈 모두에 대해 최소 1개 커밋 존재, #326은 close 처리됨
    Evidence: .sisyphus/evidence/f4-completeness.md

  Scenario: 불필요한 파일 변경 없음 확인
    Tool: Bash
    Steps: git diff trunk --name-only | grep -v -E "(\.ts$|\.json$)" | head -20
    Expected: .ts/.json 외 파일 변경 0건 (또는 정당한 이유 존재)
    Evidence: .sisyphus/evidence/f4-unexpected-files.txt
  ```

## Commit Strategy
- **Branch**: `refactor/abc-group-issues` (trunk에서 생성)
- **Commit 패턴**: 이슈별 개별 커밋
  - `fix(framework-context): extract ILogger interface (#481 prereq)`
  - `fix(protocols-rest): migrate LoggingInterceptor to ILogger (#481)`
  - `fix(repository-core): remove dataloader-core import in BatchLoad (#480)`
  - `refactor(framework): remove Container.get() defaults (#487)`
  - `fix(telemetry-sdk-node): require OTLP endpoint configuration (#495)`
  - `fix(integrations-posthog): require PostHog host configuration (#494)`
  - `fix(cache-core): add default maxEntries with warning (#486)`
  - `fix(storage-core): extract TTL to configuration (#485)`
  - `fix(dataloader-core): add logging for BatchLoader silent failures (#493)`
  - `fix(audit-core): add logging for Auditable write failures (#478)`
  - `fix(billing-polar): add logging for PolarBillingGateway catch-all (#477)`
  - `fix(storage-cloudflare): add null guard for CloudflareImages result (#492)`
  - `fix(tasks-core): add logging for TaskRunner DI fallback (#327)`
  - `fix(framework-context): replace Error with MiddlewareProblem (#476)`

## Post-Implementation Tasks

- [x] P1. Pull Request 생성 및 CI 검증

  **What to do**: 모든 구현 완료(F4까지) 후 PR을 생성하고 CI가 전부 통과할 때까지 대기. 실패 시 수정.

  **Must NOT do**:
  - CI 실패 시 사용자에게 토스하지 않고 직접 수정
  - force push (CI 재실행은 git push --force-with-lease로만)

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: PR 생성은 단순 커맨드 작업, CI 실패 수정은 맥락에 따라 다름
  - Skills: [] — 내부 CI만으로 충분
  - Omitted: [`code-review`] — 이미 F1-F4에서 리뷰 완료

  **Parallelization**: Can Parallel: NO (모든 구현 완료 후 실행) | Wave 5 | Blocks: — | Blocked By: F1, F2, F3, F4

  **References**:
  - Cheatsheet: `.claude/cheatsheets/github-pr-workflow.md` — PR 생성/CI 워크플로우
  - BranchProtection: `trunk` 브랜치는 직접 커밋 금지, PR 필수

  **Acceptance Criteria**:
  - [ ] PR 생성 완료 (`gh pr create`)
  - [ ] 모든 CI 체크 통과 (green checkmarks)
  - [ ] 변경된 파일이 계획 범위 내에 있음

  **QA Scenarios**:
  ```
  Scenario: PR 생성 및 CI 통과
    Tool: Bash (gh CLI)
    Steps:
      1. git push -u origin refactor/abc-group-issues
      2. gh pr create --title "refactor: resolve 13 GitHub issues (Groups A+B+C)" --body "$(cat <<'EOF'
## Summary
- **Group C (Dependency Architecture)**: ILogger 인터페이스 추출, Container.get() 기본 파라미터 제거
- **Group B (Unsafe Defaults)**: OTLP/PostHog required config, InMemoryCache 기본값, TTL 설정화
- **Group A (Silent Failures)**: BatchLoader, Auditable, PolarBillingGateway, CloudflareImages, TaskRunner, MiddlewareChain 에러 로깅

## Issues Resolved
Closes #493, #478, #477, #492, #327, #476, #495, #494, #486, #485, #481, #480, #487
Closes #326 (duplicate of #478)

## Test Plan
- [ ] pnpm test (all packages)
- [ ] pnpm typecheck
- [ ] pnpm check (Biome lint)
EOF
)"
      3. gh pr checks --watch (CI 완료까지 대기, 최대 10분)
      4. 실패 시: 실패한 체크 로그 확인 → 수정 → git push --force-with-lease → 3번으로
      5. 성공 시: PR URL 출력
    Expected: 모든 CI 체크 ✅ (green), PR URL 반환
    Evidence: .sisyphus/evidence/p1-pr-ci-success.txt

  Scenario: CI 실패 시 수정 및 재시도
    Tool: Bash
    Steps:
      1. gh pr checks로 실패한 체크 확인
      2. gh run view로 실패 로그 분석
      3. 관련 파일 수정
      4. git add && git commit --amend --no-edit && git push --force-with-lease
      5. gh pr checks --watch (최대 10분)
      6. 최대 3회 재시도, 이후 사용자에게 토스
    Expected: 수정 후 모든 CI 체크 ✅ 또는 사용자에게 안내
    Evidence: .sisyphus/evidence/p1-ci-fix-log.txt
  ```

  **Commit**: NO (PR 커밋은 별도)

## Success Criteria
1. `pnpm test` 전체 통과
2. `pnpm typecheck` 전체 통과
3. `pnpm check` 전체 통과
4. 레이어 위반 0건 (grep 검증)
5. Container.get() 기본 파라미터 대상 6곳 모두 제거
6. 13개 이슈 각각에 대해 최소 1개 테스트 존재
7. #326 이슈 closed as duplicate
8. **PR 생성 완료 및 CI 전체 통과 (green checkmarks)**

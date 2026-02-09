# access-core + access-drizzle: ReBAC 패키지 구현

## TL;DR

> **Quick Summary**: Croco 프레임워크에 ReBAC(Relationship-Based Access Control) 패키지 2개(`access-core`, `access-drizzle`)를 신규 추가한다. 기존 RBAC(`auth-core`)과 공존하며, RBAC은 전역 역할, ReBAC은 객체 수준 권한을 담당한다.
>
> **Deliverables**:
> - `@croco/access-core`: AccessProvider 인터페이스, AccessEngine, @Access 데코레이터, AccessGuard, RelationTuple 타입
> - `@croco/access-drizzle`: PostgreSQL native 구현 (relation_tuples 테이블, Recursive CTE 기반 그래프 탐색)
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES — 2 waves
> **Critical Path**: Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6

---

## Context

### Original Request
Croco SaaS 프레임워크에 ReBAC 기반 세밀한 접근 제어 시스템을 추가한다. 기존 RBAC(전역 역할)은 유지하고, 객체 수준 권한을 ReBAC으로 처리한다.

### Interview Summary
**Key Discussions**:
- Provider: PG Native(access-drizzle) 우선, SpiceDB는 별도 플랜
- 공존 전략(옵션 B): auth-core RBAC + access-core ReBAC 병렬 운영
- 네이밍: `access-*` (authz-* 대신 직관성 우선)
- RBAC+ReBAC 판정 규칙: **OR** (하나만 통과하면 허용)
- 장애 시 정책: **Fail-closed** (deny)
- 관계 타입: 자유 문자열 (enum 제한 없음)
- 테스트: TDD (RED-GREEN-REFACTOR)

**Research Findings**:
- 11개 ReBAC 솔루션 비교 → PG Native + SpiceDB 채택
- auth-core RBAC 외부 사용처 0건 → 기존 코드 변경 불필요
- Croco Drizzle 패턴: pgTable, uuid PK, tenantId 필드, RLS 통합, @Transactional
- PostgreSQL Recursive CTE로 관계 그래프 탐색 가능

### Metis Review
**Identified Gaps** (addressed):
- 정책 결합 규칙 미정의 → **OR 규칙** 확정
- Fail-open vs Fail-closed 미정의 → **Fail-closed** 확정
- 관계 타입 제한 여부 → **자유 문자열** 확정
- 재귀 탐색 한도 미정의 → **max depth 10, cycle 감지** 적용
- 테넌트 격리 방식 → **tenantId 필수 인자 + hard filter** 적용
- 중복 튜플 처리 → **idempotent upsert** (ON CONFLICT 무시)
- 동시 grant/revoke race → **unique constraint가 자연스럽게 처리**

---

## Work Objectives

### Core Objective
Croco에 객체 수준 세밀한 접근 제어를 추가하여 "이 사용자가 이 특정 문서를 볼 수 있는가?" 같은 질의를 처리할 수 있게 한다.

### Concrete Deliverables
- `packages/access-core/`: AccessProvider 인터페이스, AccessEngine, @Access 데코레이터, AccessGuard
- `packages/access-drizzle/`: PostgreSQL 구현체 (relation_tuples 스키마, Recursive CTE 쿼리)

### Definition of Done
- [ ] `pnpm --filter=@croco/access-core test` → exit 0
- [ ] `pnpm --filter=@croco/access-drizzle test` → exit 0
- [ ] `pnpm typecheck --filter=@croco/access-core --filter=@croco/access-drizzle` → error 0
- [ ] `pnpm check` → error 0
- [ ] `pnpm build --filter=@croco/access-core --filter=@croco/access-drizzle` → success

### Must Have
- AccessProvider 인터페이스 (check, grant, revoke, list)
- AccessEngine (provider 호출 + fail-closed + tenant 강제)
- @Access 데코레이터 (request param에서 objectId 추출)
- AccessGuard (Guard 체인 통합)
- DrizzleAccessProvider (relation_tuples pgTable + Recursive CTE)
- TDD 테스트 전체
- Tenant 격리 (tenantId 필수, cross-tenant deny)

### Must NOT Have (Guardrails)
- auth-core RBAC 코드 변경 금지
- AuthGuard/PermissionGuard 기존 동작 리팩터링 금지
- SpiceDB, ABAC, 속성 기반 확장 금지 (별도 플랜)
- 관리자 UI / 운영 콘솔 금지
- Redis/외부 캐시 레이어 금지 (이번 스코프)
- 감사 로그 저장소/조회 API 풀세트 금지
- bulk/batch API 금지 (이번 스코프)
- wildcard 관계(`*`) 확장 금지

---

## Verification Strategy

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks in this plan MUST be verifiable WITHOUT any human action.

### Test Decision
- **Infrastructure exists**: YES (Vitest)
- **Automated tests**: TDD (RED-GREEN-REFACTOR)
- **Framework**: Vitest

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: access-core 패키지 초기화 + 타입/인터페이스 정의
└── (단독, 모든 후속 작업의 기반)

Wave 2 (After Task 1):
├── Task 2: AccessEngine 구현 (TDD)
├── Task 3: access-drizzle 패키지 초기화 + 스키마 + DrizzleAccessProvider (TDD)

Wave 3 (After Task 2 + 3):
├── Task 4: @Access 데코레이터 + AccessGuard (TDD)

Wave 4 (After Task 4):
├── Task 5: Guard 체인 통합 테스트 (AuthGuard → PermissionGuard → AccessGuard)

Wave 5 (After Task 5):
└── Task 6: Barrel exports + 빌드 검증 + 최종 lint/typecheck
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 2, 3 | None |
| 2 | 1 | 4 | 3 |
| 3 | 1 | 4 | 2 |
| 4 | 2, 3 | 5 | None |
| 5 | 4 | 6 | None |
| 6 | 5 | None | None |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1 | 1 | task(category="quick", ...) |
| 2 | 2, 3 | dispatch parallel |
| 3 | 4 | task(category="unspecified-high", ...) |
| 4 | 5 | task(category="unspecified-high", ...) |
| 5 | 6 | task(category="quick", ...) |

---

## TODOs

- [x] 1. access-core 패키지 초기화 + 타입/인터페이스 정의

  **What to do**:
  - `packages/access-core/` 디렉토리 생성 (기존 패키지 구조 따름)
  - `package.json` 생성 (`@croco/access-core`, vitest, typescript 설정)
  - `tsconfig.json` 생성 (기존 패키지 패턴 따름)
  - 타입 정의:
    ```typescript
    // src/libs/types.ts
    export type RelationTuple = {
      object: string;        // 'document:doc_123'
      relation: string;      // 'viewer', 'editor', 'owner' 등 자유 문자열
      subject: string;       // 'user:user_456' 또는 'team:team_1#member'
    };

    export type CheckRequest = {
      tenantId: string;
      subject: string;       // 'user:user_456'
      relation: string;      // 'view'
      object: string;        // 'document:doc_123'
    };

    export type CheckResult = {
      allowed: boolean;
    };

    export type GrantRequest = {
      tenantId: string;
      tuple: RelationTuple;
    };

    export type RevokeRequest = {
      tenantId: string;
      tuple: RelationTuple;
    };

    export type ListRequest = {
      tenantId: string;
      object?: string;       // 이 객체에 대한 모든 관계
      subject?: string;      // 이 주체의 모든 관계
      relation?: string;     // 필터링
    };
    ```
  - AccessProvider 인터페이스 정의:
    ```typescript
    // src/libs/interfaces/AccessProvider.ts
    export interface AccessProvider {
      check(request: CheckRequest): Promise<CheckResult>;
      grant(request: GrantRequest): Promise<void>;
      revoke(request: RevokeRequest): Promise<void>;
      list(request: ListRequest): Promise<RelationTuple[]>;
    }
    ```
  - Constants 정의:
    ```typescript
    // src/libs/constants.ts
    export const ACCESS_PROVIDER_TOKEN = Symbol('ACCESS_PROVIDER');
    export const ACCESS_METADATA_KEY = Symbol('access:metadata');
    export const MAX_TRAVERSAL_DEPTH = 10;
    ```

  **Must NOT do**:
  - AccessEngine 구현 (Task 2)
  - Drizzle/SQL 관련 코드
  - 데코레이터/Guard 구현 (Task 4)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 패키지 스캐폴딩 + 타입 정의 — 단순 파일 생성 작업
  - **Skills**: []
    - 스킬 불필요 — 파일 생성과 타입 정의만

  **Parallelization**:
  - **Can Run In Parallel**: NO (모든 후속 작업의 기반)
  - **Parallel Group**: Wave 1 (단독)
  - **Blocks**: Task 2, 3
  - **Blocked By**: None

  **References**:

  **Pattern References** (existing code to follow):
  - `packages/auth-core/package.json` — 패키지 구조, 의존성 설정 패턴
  - `packages/auth-core/tsconfig.json` — TypeScript 설정 패턴
  - `packages/auth-core/src/libs/interfaces/AuthUser.ts` — 인터페이스 정의 패턴 (export type 스타일)
  - `packages/auth-core/src/libs/constants.ts` — 상수 정의 패턴 (Symbol 사용)

  **Documentation References**:
  - `AGENTS.md` — 코드 스타일, 네이밍 컨벤션, 패키지 구조 규칙

  **WHY Each Reference Matters**:
  - `auth-core/package.json` — 의존성 버전, scripts, exports 필드 형식을 동일하게 따라야 모노레포 일관성 유지
  - `auth-core/tsconfig.json` — compilerOptions, paths, references 설정이 동일해야 빌드 체인 호환
  - `AuthUser.ts` — Croco의 타입 정의 스타일(type vs interface 사용 규칙) 파악
  - `constants.ts` — Symbol 기반 DI 토큰 패턴 일관성

  **Acceptance Criteria**:

  - [ ] `packages/access-core/package.json` 존재, name = `@croco/access-core`
  - [ ] `packages/access-core/tsconfig.json` 존재
  - [ ] `packages/access-core/src/libs/types.ts` — RelationTuple, CheckRequest, CheckResult, GrantRequest, RevokeRequest, ListRequest 타입 내보내기
  - [ ] `packages/access-core/src/libs/interfaces/AccessProvider.ts` — check, grant, revoke, list 메서드
  - [ ] `packages/access-core/src/libs/constants.ts` — ACCESS_PROVIDER_TOKEN, ACCESS_METADATA_KEY, MAX_TRAVERSAL_DEPTH
  - [ ] `pnpm typecheck --filter=@croco/access-core` → error 0

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: 타입 체크 통과
    Tool: Bash
    Preconditions: 패키지 생성 완료
    Steps:
      1. pnpm typecheck --filter=@croco/access-core
      2. Assert: exit code 0
      3. Assert: stderr에 error 없음
    Expected Result: 타입 체크 통과
    Evidence: 터미널 출력 캡처
  ```

  **Commit**: YES
  - Message: `feat(access-core): add package scaffold with types and interfaces`
  - Files: `packages/access-core/**`
  - Pre-commit: `pnpm typecheck --filter=@croco/access-core`

---

- [x] 2. AccessEngine 구현 (TDD)

  **What to do**:
  - RED: 테스트 먼저 작성
    ```typescript
    // src/tests/AccessEngine.spec.ts
    describe('AccessEngine', () => {
      // check
      it('should delegate check to provider and return result');
      it('should return deny when provider throws (fail-closed)');
      it('should throw when tenantId is empty');
      it('should throw when subject is empty');
      it('should throw when object is empty');
      
      // grant
      it('should delegate grant to provider');
      it('should throw when tenantId is empty on grant');
      
      // revoke
      it('should delegate revoke to provider');
      
      // list
      it('should delegate list to provider');
      it('should return deny on provider timeout (fail-closed)');
    });
    ```
  - GREEN: AccessEngine 구현
    ```typescript
    // src/libs/AccessEngine.ts
    export class AccessEngine {
      constructor(private readonly provider: AccessProvider) {}
      
      async check(request: CheckRequest): Promise<CheckResult> {
        // 1. 입력 검증 (tenantId, subject, object 필수)
        // 2. provider.check 호출
        // 3. 에러 시 { allowed: false } 반환 (fail-closed)
      }
      
      async grant(request: GrantRequest): Promise<void> {
        // 1. 입력 검증
        // 2. provider.grant 호출
      }
      
      async revoke(request: RevokeRequest): Promise<void> {
        // 1. 입력 검증
        // 2. provider.revoke 호출
      }
      
      async list(request: ListRequest): Promise<RelationTuple[]> {
        // 1. 입력 검증
        // 2. provider.list 호출
      }
    }
    ```
  - REFACTOR: 코드 정리

  **Must NOT do**:
  - Drizzle/SQL 관련 코드 (Task 3)
  - 데코레이터/Guard (Task 4)
  - Provider 구현 — mock으로만 테스트

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: TDD 사이클 + 핵심 엔진 로직 — fail-closed 정책, 입력 검증 등 세밀한 구현
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 3)
  - **Blocks**: Task 4
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `packages/auth-core/src/libs/rbac/RbacEngine.ts` — 엔진 클래스 구조 패턴 (DI 기반)
  - `packages/auth-core/src/tests/RbacEngine.spec.ts` — 테스트 구조 패턴 (describe/it, beforeEach Container.reset)
  - `packages/retry-core/src/libs/RetryTemplate.ts` — 에러 핸들링 패턴 (try-catch wrapping)

  **API/Type References**:
  - `packages/access-core/src/libs/interfaces/AccessProvider.ts` — Task 1에서 정의한 인터페이스 (구현 대상)
  - `packages/access-core/src/libs/types.ts` — CheckRequest, CheckResult 등 타입

  **Test References**:
  - `packages/auth-core/src/tests/RbacEngine.spec.ts` — Vitest 테스트 패턴 (vi.fn(), mock provider)

  **WHY Each Reference Matters**:
  - `RbacEngine.ts` — DI 패턴, constructor injection, 동일한 엔진 클래스 구조
  - `RetryTemplate.ts` — try-catch 에러 핸들링 패턴이 fail-closed 구현에 참고됨
  - `RbacEngine.spec.ts` — mock provider 설정, assertion 패턴

  **Acceptance Criteria**:

  **TDD:**
  - [ ] 테스트 파일: `src/tests/AccessEngine.spec.ts`
  - [ ] 테스트 커버: check 성공/fail-closed/입력검증, grant, revoke, list
  - [ ] `pnpm --filter=@croco/access-core vitest run src/tests/AccessEngine.spec.ts` → PASS (10+ tests, 0 failures)

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: AccessEngine 전체 테스트 통과
    Tool: Bash
    Preconditions: Task 1 완료, access-core 패키지 존재
    Steps:
      1. pnpm --filter=@croco/access-core vitest run src/tests/AccessEngine.spec.ts
      2. Assert: exit code 0
      3. Assert: 모든 테스트 PASS
    Expected Result: 10+ 테스트 통과
    Evidence: 터미널 출력 캡처

  Scenario: Fail-closed 동작 확인
    Tool: Bash
    Preconditions: AccessEngine 테스트 존재
    Steps:
      1. pnpm --filter=@croco/access-core vitest run -t "fail-closed"
      2. Assert: provider throws → allowed: false 반환
    Expected Result: fail-closed 테스트 통과
    Evidence: 터미널 출력 캡처

  Scenario: 입력 검증 동작 확인
    Tool: Bash
    Preconditions: AccessEngine 테스트 존재
    Steps:
      1. pnpm --filter=@croco/access-core vitest run -t "tenantId is empty"
      2. Assert: 빈 tenantId → throw
    Expected Result: 입력 검증 테스트 통과
    Evidence: 터미널 출력 캡처
  ```

  **Commit**: YES
  - Message: `feat(access-core): implement AccessEngine with fail-closed policy`
  - Files: `packages/access-core/src/libs/AccessEngine.ts`, `packages/access-core/src/tests/AccessEngine.spec.ts`
  - Pre-commit: `pnpm --filter=@croco/access-core test`

---

- [x] 3. access-drizzle 패키지 + DrizzleAccessProvider (TDD)

  **What to do**:
  - 패키지 초기화: `packages/access-drizzle/` (package.json, tsconfig.json)
  - RED: 테스트 먼저 작성
    ```typescript
    // src/tests/DrizzleAccessProvider.spec.ts
    describe('DrizzleAccessProvider', () => {
      // grant
      it('should insert a relation tuple');
      it('should be idempotent on duplicate grant (no error)');
      
      // revoke
      it('should delete a relation tuple');
      it('should not error when revoking non-existent tuple');
      
      // check - direct
      it('should return allowed for direct tuple match');
      it('should return denied when no tuple exists');
      it('should deny cross-tenant tuple access');
      
      // check - inherited (Recursive CTE)
      it('should allow via inherited relation (parent→child)');
      it('should handle cycle in graph without infinite loop');
      it('should respect max traversal depth');
      
      // list
      it('should list tuples by object');
      it('should list tuples by subject');
      it('should filter by relation');
    });
    ```
  - GREEN: DrizzleAccessProvider 구현
    - relation_tuples 스키마 (pgTable):
      ```typescript
      // src/libs/schema.ts
      export const relationTuples = pgTable('relation_tuples', {
        id: uuid('id').primaryKey().defaultRandom(),
        tenantId: text('tenant_id').notNull(),
        objectType: text('object_type').notNull(),
        objectId: text('object_id').notNull(),
        relation: text('relation').notNull(),
        subjectType: text('subject_type').notNull(),
        subjectId: text('subject_id').notNull(),
        subjectRelation: text('subject_relation'),
        createdAt: timestamp('created_at').defaultNow().notNull(),
      }, (table) => ({
        uniqueTuple: unique().on(
          table.tenantId, table.objectType, table.objectId,
          table.relation, table.subjectType, table.subjectId
        ),
        objectIdx: index('idx_rt_object').on(table.objectType, table.objectId),
        subjectIdx: index('idx_rt_subject').on(table.subjectType, table.subjectId),
        tenantIdx: index('idx_rt_tenant').on(table.tenantId),
      }));
      ```
    - DrizzleAccessProvider: AccessProvider 구현
      - grant: INSERT ... ON CONFLICT DO NOTHING (idempotent)
      - revoke: DELETE WHERE 조건 일치
      - check: Recursive CTE로 관계 그래프 탐색 (max depth 10, cycle 감지)
      - list: SELECT with optional filters
    - 헬퍼: parseSubjectObject('document:doc_123') → { type: 'document', id: 'doc_123' }
  - REFACTOR: 코드 정리

  **Must NOT do**:
  - SpiceDB 관련 코드
  - 캐시 레이어
  - 마이그레이션 자동 실행 (스키마 정의만)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Recursive CTE 구현 + Drizzle 스키마 설계 + TDD — SQL 복잡도 높음
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 2)
  - **Blocks**: Task 4
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `packages/audit-drizzle/src/libs/schema.ts` — Drizzle pgTable 스키마 패턴 (polymorphic resourceType+resourceId)
  - `packages/audit-drizzle/src/libs/PostgresAuditLogRepository.ts` — Drizzle DB 쿼리 패턴 (db.insert, db.select, db.delete)
  - `packages/onboarding-drizzle/src/libs/schema.ts` — composite PK, tenantId 패턴
  - `packages/tx-drizzle/src/libs/DrizzleTxAdapter.ts` — Drizzle 트랜잭션 패턴
  - `packages/tx-drizzle/src/libs/RlsTxAdapter.ts` — RLS + 트랜잭션 통합 패턴

  **API/Type References**:
  - `packages/access-core/src/libs/interfaces/AccessProvider.ts` — 구현할 인터페이스
  - `packages/access-core/src/libs/types.ts` — 타입 정의
  - `packages/access-core/src/libs/constants.ts` — MAX_TRAVERSAL_DEPTH

  **Test References**:
  - `packages/audit-drizzle/src/tests/` — Drizzle 기반 provider 테스트 패턴

  **WHY Each Reference Matters**:
  - `audit-drizzle/schema.ts` — polymorphic 패턴(resourceType+resourceId)이 relation_tuples의 objectType+objectId와 유사
  - `PostgresAuditLogRepository.ts` — Drizzle CRUD 쿼리 패턴, 에러 핸들링
  - `onboarding-drizzle/schema.ts` — tenantId + composite 인덱스 패턴
  - `DrizzleTxAdapter.ts` — 트랜잭션 경계 내 DB 접근 패턴
  - `RlsTxAdapter.ts` — RLS 컨텍스트 설정 + 트랜잭션 통합 패턴

  **Acceptance Criteria**:

  **TDD:**
  - [ ] 테스트 파일: `src/tests/DrizzleAccessProvider.spec.ts`
  - [ ] 테스트 커버: grant(삽입/idempotent), revoke(삭제/없는 튜플), check(직접/상속/cycle/depth), list(object/subject/relation), cross-tenant deny
  - [ ] `pnpm --filter=@croco/access-drizzle vitest run src/tests/DrizzleAccessProvider.spec.ts` → PASS (13+ tests, 0 failures)

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: DrizzleAccessProvider 전체 테스트 통과
    Tool: Bash
    Preconditions: Task 1 완료, access-drizzle 패키지 생성 완료
    Steps:
      1. pnpm --filter=@croco/access-drizzle vitest run src/tests/DrizzleAccessProvider.spec.ts
      2. Assert: exit code 0
      3. Assert: 모든 테스트 PASS
    Expected Result: 13+ 테스트 통과
    Evidence: 터미널 출력 캡처

  Scenario: Cross-tenant 격리 확인
    Tool: Bash
    Preconditions: DrizzleAccessProvider 테스트 존재
    Steps:
      1. pnpm --filter=@croco/access-drizzle vitest run -t "cross-tenant"
      2. Assert: tenant-A의 튜플로 tenant-B check → denied
    Expected Result: cross-tenant 테스트 통과
    Evidence: 터미널 출력 캡처

  Scenario: Recursive CTE cycle 안전성 확인
    Tool: Bash
    Preconditions: DrizzleAccessProvider 테스트 존재
    Steps:
      1. pnpm --filter=@croco/access-drizzle vitest run -t "cycle"
      2. Assert: A→B→A cycle 그래프에서 무한루프 없이 종료
    Expected Result: cycle 테스트 통과
    Evidence: 터미널 출력 캡처
  ```

  **Commit**: YES
  - Message: `feat(access-drizzle): implement DrizzleAccessProvider with recursive CTE`
  - Files: `packages/access-drizzle/**`
  - Pre-commit: `pnpm --filter=@croco/access-drizzle test`

---

- [ ] 4. @Access 데코레이터 + AccessGuard (TDD)

  **What to do**:
  - RED: 테스트 먼저 작성
    ```typescript
    // src/tests/AccessGuard.spec.ts
    describe('AccessGuard', () => {
      it('should allow when AccessEngine.check returns allowed');
      it('should throw ForbiddenProblem when check returns denied');
      it('should extract objectId from request params');
      it('should use tenantId from RequestContext (AsyncLocalStorage)');
      it('should skip when no @Access metadata on handler');
      it('should deny on provider error (fail-closed)');
    });
    
    // src/tests/Access.spec.ts
    describe('@Access decorator', () => {
      it('should store resource type and relation in metadata');
      it('should support paramName override for objectId extraction');
    });
    ```
  - GREEN: 구현
    - @Access 데코레이터:
      ```typescript
      // src/libs/decorators/Access.ts
      export function Access(
        resourceType: string,
        relation: string,
        options?: { paramName?: string }
      ): MethodDecorator {
        // Reflect.defineMetadata(ACCESS_METADATA_KEY, { resourceType, relation, paramName }, ...)
      }
      ```
    - AccessGuard:
      ```typescript
      // src/libs/guards/AccessGuard.ts
      export class AccessGuard implements Guard<ExecutionContext> {
        constructor(private readonly engine: AccessEngine) {}
        
        async canActivate(context: ExecutionContext): Promise<boolean> {
          // 1. ACCESS_METADATA_KEY 메타데이터 읽기 → 없으면 true (skip)
          // 2. request.params에서 objectId 추출 (paramName 또는 'id' 기본값)
          // 3. request.user에서 subject 추출
          // 4. TenantManager/RequestContext에서 tenantId 추출
          // 5. engine.check({ tenantId, subject: `user:${user.id}`, relation, object: `${resourceType}:${objectId}` })
          // 6. denied → throw ForbiddenProblem
        }
      }
      ```
  - REFACTOR: 코드 정리

  **Must NOT do**:
  - AuthGuard/PermissionGuard 수정
  - Guard 체인 순서 변경 (Task 5에서 통합 테스트)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 데코레이터 + Guard + Reflect.metadata + ExecutionContext 통합 — Croco 프레임워크 패턴 이해 필요
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (단독)
  - **Blocks**: Task 5
  - **Blocked By**: Task 2, 3

  **References**:

  **Pattern References**:
  - `packages/auth-core/src/libs/decorators/RequirePermission.ts` — 데코레이터 패턴 (Reflect.defineMetadata, AUTH_PERMISSIONS_KEY)
  - `packages/auth-core/src/libs/guards/PermissionGuard.ts` — Guard 구현 패턴 (canActivate, context.getRequest, Reflect.getMetadata)
  - `packages/auth-core/src/libs/guards/AuthGuard.ts` — Guard 체인 앞단 패턴 (인증 → request.user 주입)
  - `packages/auth-core/src/libs/decorators/Public.ts` — 메타데이터 기반 skip 패턴

  **API/Type References**:
  - `packages/access-core/src/libs/AccessEngine.ts` — Task 2에서 구현한 엔진
  - `packages/auth-core/src/libs/interfaces/AuthUser.ts` — request.user 타입
  - `packages/auth-core/src/libs/constants.ts` — AUTH_PERMISSIONS_KEY 패턴 참고
  - `packages/auth-core/src/libs/problems/AuthProblems.ts` — ForbiddenProblem 재사용

  **WHY Each Reference Matters**:
  - `RequirePermission.ts` — @Access도 동일한 Reflect.defineMetadata 패턴 사용
  - `PermissionGuard.ts` — AccessGuard와 거의 동일한 구조, context 접근 방식 동일
  - `AuthGuard.ts` — request.user가 어떻게 주입되는지, Guard 체인 순서 이해
  - `AuthProblems.ts` — ForbiddenProblem을 재사용하여 일관된 에러 응답

  **Acceptance Criteria**:

  **TDD:**
  - [ ] 테스트 파일: `src/tests/AccessGuard.spec.ts`, `src/tests/Access.spec.ts`
  - [ ] 테스트 커버: Guard 허용/거부/skip/fail-closed, 데코레이터 메타데이터 저장/paramName
  - [ ] `pnpm --filter=@croco/access-core vitest run src/tests/AccessGuard.spec.ts` → PASS
  - [ ] `pnpm --filter=@croco/access-core vitest run src/tests/Access.spec.ts` → PASS

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: AccessGuard + @Access 데코레이터 테스트 통과
    Tool: Bash
    Preconditions: Task 2 완료
    Steps:
      1. pnpm --filter=@croco/access-core vitest run src/tests/AccessGuard.spec.ts
      2. Assert: exit code 0
      3. pnpm --filter=@croco/access-core vitest run src/tests/Access.spec.ts
      4. Assert: exit code 0
    Expected Result: 모든 Guard/데코레이터 테스트 통과
    Evidence: 터미널 출력 캡처

  Scenario: @Access 없는 핸들러에서 Guard skip 확인
    Tool: Bash
    Preconditions: AccessGuard 테스트 존재
    Steps:
      1. pnpm --filter=@croco/access-core vitest run -t "skip when no @Access"
      2. Assert: @Access 없으면 canActivate → true
    Expected Result: skip 테스트 통과
    Evidence: 터미널 출력 캡처
  ```

  **Commit**: YES
  - Message: `feat(access-core): add @Access decorator and AccessGuard`
  - Files: `packages/access-core/src/libs/decorators/Access.ts`, `packages/access-core/src/libs/guards/AccessGuard.ts`, `packages/access-core/src/tests/AccessGuard.spec.ts`, `packages/access-core/src/tests/Access.spec.ts`
  - Pre-commit: `pnpm --filter=@croco/access-core test`

---

- [ ] 5. Guard 체인 통합 테스트

  **What to do**:
  - 통합 테스트 작성 — AuthGuard → PermissionGuard → AccessGuard 체인이 올바르게 동작하는지 검증
    ```typescript
    // src/tests/GuardChain.spec.ts
    describe('Guard Chain Integration', () => {
      // RBAC OR ReBAC
      it('should allow when RBAC passes (even if ReBAC would deny)');
      it('should allow when ReBAC passes (even if RBAC would deny)');
      it('should deny when both RBAC and ReBAC deny');
      
      // 체인 순서
      it('should not run AccessGuard when AuthGuard fails');
      it('should run AccessGuard independently of PermissionGuard result');
      
      // 정책 조합 truth table
      it('RBAC=allow, ReBAC=allow → allow');
      it('RBAC=allow, ReBAC=deny → allow (OR)');
      it('RBAC=deny, ReBAC=allow → allow (OR)');
      it('RBAC=deny, ReBAC=deny → deny');
      it('RBAC=allow, ReBAC=not-applicable → allow');
      it('RBAC=not-applicable, ReBAC=allow → allow');
      
      // Edge cases
      it('should deny when AccessEngine provider throws (fail-closed)');
    });
    ```
  - OR 판정 로직 구현:
    - PermissionGuard 또는 AccessGuard 중 하나만 통과하면 허용
    - 구현 방식: 두 Guard를 감싸는 `CombinedAuthzGuard` 또는 Guard 체인 설정에서 OR 로직 처리
    - **중요**: 기존 AuthGuard/PermissionGuard 코드 수정 없이, 새로운 Guard 조합 로직으로 처리

  **Must NOT do**:
  - AuthGuard, PermissionGuard 기존 코드 수정
  - 실제 DB 연결 (mock provider 사용)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Guard 체인 OR 로직 구현 + 통합 테스트 — 프레임워크 내부 이해 필요
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (단독)
  - **Blocks**: Task 6
  - **Blocked By**: Task 4

  **References**:

  **Pattern References**:
  - `packages/auth-core/src/libs/guards/AuthGuard.ts` — Guard 체인 첫 단계
  - `packages/auth-core/src/libs/guards/PermissionGuard.ts` — Guard 체인 두 번째 단계
  - `packages/auth-core/src/tests/` — 기존 Guard 테스트 패턴

  **API/Type References**:
  - `packages/access-core/src/libs/guards/AccessGuard.ts` — Task 4에서 구현한 Guard
  - `packages/protocols-rest/` — ExecutionContext, Guard 인터페이스 정의 (Guard 체인 동작 이해)

  **WHY Each Reference Matters**:
  - `AuthGuard.ts` — canActivate 패턴, request.user 주입 방식
  - `PermissionGuard.ts` — RBAC 판단 로직, ForbiddenProblem 사용
  - `protocols-rest/` — Guard 체인이 어떻게 실행되는지 (순차? 병렬?) 이해 필수

  **Acceptance Criteria**:

  **TDD:**
  - [ ] 테스트 파일: `src/tests/GuardChain.spec.ts`
  - [ ] 테스트 커버: OR 판정 truth table 6 케이스 + 체인 순서 + fail-closed
  - [ ] `pnpm --filter=@croco/access-core vitest run src/tests/GuardChain.spec.ts` → PASS (10+ tests, 0 failures)

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: OR 판정 truth table 전체 통과
    Tool: Bash
    Preconditions: Task 4 완료
    Steps:
      1. pnpm --filter=@croco/access-core vitest run src/tests/GuardChain.spec.ts
      2. Assert: exit code 0
      3. Assert: RBAC=allow,ReBAC=deny → allow
      4. Assert: RBAC=deny,ReBAC=allow → allow
      5. Assert: RBAC=deny,ReBAC=deny → deny
    Expected Result: 모든 truth table 케이스 통과
    Evidence: 터미널 출력 캡처

  Scenario: AuthGuard 실패 시 AccessGuard 미실행
    Tool: Bash
    Preconditions: GuardChain 테스트 존재
    Steps:
      1. pnpm --filter=@croco/access-core vitest run -t "AuthGuard fails"
      2. Assert: AccessGuard.canActivate 호출되지 않음
    Expected Result: 체인 순서 테스트 통과
    Evidence: 터미널 출력 캡처
  ```

  **Commit**: YES
  - Message: `feat(access-core): add guard chain integration with OR policy`
  - Files: `packages/access-core/src/tests/GuardChain.spec.ts`, 관련 구현 파일
  - Pre-commit: `pnpm --filter=@croco/access-core test`

---

- [ ] 6. Barrel exports + 빌드 검증 + 최종 lint/typecheck

  **What to do**:
  - access-core `index.ts` 작성:
    ```typescript
    // Barrel exports - 카테고리별 그룹화, types 마지막
    export { AccessEngine } from './libs/AccessEngine';
    export { AccessGuard } from './libs/guards/AccessGuard';
    export { Access } from './libs/decorators/Access';
    export { ACCESS_PROVIDER_TOKEN, ACCESS_METADATA_KEY, MAX_TRAVERSAL_DEPTH } from './libs/constants';
    export type { AccessProvider } from './libs/interfaces/AccessProvider';
    export type { RelationTuple, CheckRequest, CheckResult, GrantRequest, RevokeRequest, ListRequest } from './libs/types';
    ```
  - access-drizzle `index.ts` 작성:
    ```typescript
    export { DrizzleAccessProvider } from './libs/DrizzleAccessProvider';
    export { relationTuples } from './libs/schema';
    ```
  - 전체 빌드 + lint + typecheck 실행
  - Biome check --write 실행

  **Must NOT do**:
  - 새로운 기능 추가
  - 다른 패키지 수정

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 단순 파일 생성 + 검증 명령 실행
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 5 (최종)
  - **Blocks**: None
  - **Blocked By**: Task 5

  **References**:

  **Pattern References**:
  - `packages/auth-core/src/index.ts` — barrel export 패턴 (카테고리별 그룹화, type import 분리)
  - `packages/audit-drizzle/src/index.ts` — drizzle 패키지 barrel export 패턴

  **WHY Each Reference Matters**:
  - `auth-core/index.ts` — export 순서 규칙(구현→상수→타입), `export type` 사용법

  **Acceptance Criteria**:

  - [ ] `packages/access-core/src/index.ts` — 모든 public API 내보내기
  - [ ] `packages/access-drizzle/src/index.ts` — DrizzleAccessProvider, relationTuples 내보내기
  - [ ] `pnpm build --filter=@croco/access-core --filter=@croco/access-drizzle` → success
  - [ ] `pnpm typecheck --filter=@croco/access-core --filter=@croco/access-drizzle` → error 0
  - [ ] `pnpm check` → error 0
  - [ ] `pnpm --filter=@croco/access-core test` → PASS
  - [ ] `pnpm --filter=@croco/access-drizzle test` → PASS

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: 전체 빌드 + 린트 + 타입체크
    Tool: Bash
    Preconditions: Task 5 완료
    Steps:
      1. pnpm build --filter=@croco/access-core --filter=@croco/access-drizzle
      2. Assert: exit code 0
      3. pnpm typecheck --filter=@croco/access-core --filter=@croco/access-drizzle
      4. Assert: exit code 0, error 0건
      5. pnpm check
      6. Assert: exit code 0
    Expected Result: 빌드/타입/린트 모두 통과
    Evidence: 터미널 출력 캡처

  Scenario: 전체 테스트 스위트
    Tool: Bash
    Preconditions: 모든 구현 완료
    Steps:
      1. pnpm --filter=@croco/access-core test
      2. Assert: exit code 0
      3. pnpm --filter=@croco/access-drizzle test
      4. Assert: exit code 0
    Expected Result: 모든 패키지 테스트 통과
    Evidence: 터미널 출력 캡처
  ```

  **Commit**: YES
  - Message: `feat(access): finalize barrel exports and verify build`
  - Files: `packages/access-core/src/index.ts`, `packages/access-drizzle/src/index.ts`
  - Pre-commit: `pnpm build --filter=@croco/access-core --filter=@croco/access-drizzle && pnpm check`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(access-core): add package scaffold with types and interfaces` | packages/access-core/** | typecheck |
| 2 | `feat(access-core): implement AccessEngine with fail-closed policy` | AccessEngine.ts, spec | test |
| 3 | `feat(access-drizzle): implement DrizzleAccessProvider with recursive CTE` | packages/access-drizzle/** | test |
| 4 | `feat(access-core): add @Access decorator and AccessGuard` | decorators, guards, specs | test |
| 5 | `feat(access-core): add guard chain integration with OR policy` | GuardChain.spec, impl | test |
| 6 | `feat(access): finalize barrel exports and verify build` | index.ts files | build+check |

---

## Success Criteria

### Verification Commands
```bash
pnpm --filter=@croco/access-core test                    # Expected: all tests pass
pnpm --filter=@croco/access-drizzle test                  # Expected: all tests pass
pnpm typecheck --filter=@croco/access-core --filter=@croco/access-drizzle  # Expected: 0 errors
pnpm check                                                # Expected: 0 errors
pnpm build --filter=@croco/access-core --filter=@croco/access-drizzle      # Expected: success
```

### Final Checklist
- [ ] access-core: AccessProvider 인터페이스 정의
- [ ] access-core: AccessEngine (fail-closed, 입력 검증)
- [ ] access-core: @Access 데코레이터
- [ ] access-core: AccessGuard
- [ ] access-core: Guard 체인 OR 정책 통합
- [ ] access-drizzle: relation_tuples 스키마
- [ ] access-drizzle: DrizzleAccessProvider (Recursive CTE)
- [ ] access-drizzle: Cross-tenant 격리 검증
- [ ] access-drizzle: Cycle/depth 안전성 검증
- [ ] 전체 빌드/타입/린트 통과
- [ ] auth-core RBAC 코드 변경 없음 확인

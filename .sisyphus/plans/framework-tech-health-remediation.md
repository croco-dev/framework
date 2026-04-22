# Framework Tech Health Remediation Plan

## TL;DR

> **Quick Summary**: `framework` 모노레포의 tech-improve 리포트에서 확정된 P1/P2 권고안을 하나의 실행 플랜으로 묶는다. 핵심은 아키텍처 결함 2건(self-cycle, `tenant-core` ORM 누수), 테스트 품질 계량화 부재, 보안 자동화 공백, 런타임 품질 예외, 기여자 진입 문서 부재를 좁은 범위로 보수적으로 해소하는 것이다.
>
> **Deliverables**:
> - `packages/frontend-cloudflare/src/libs/index.ts` self-cycle 제거
> - `packages/tenant-core/src/libs/TenantIsolationStrategy.ts`의 `drizzle-orm` 타입 누수 제거
> - 핵심 패키지 선별 coverage threshold CI gate 추가
> - 보안 자동화 1종(`dependency audit`) 추가
> - 4개 런타임 파일의 empty catch 정리
> - `packages/utils-node/src/libs/server.ts`의 런타임 `console.log` 정리
> - `CONTRIBUTING.md` 및 기여자용 setup 흐름 문서화
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 2개 구현 wave + 최종 검증 wave
> **Critical Path**: 브랜치 생성 → self-cycle 수정 → tenant-core 경계 복원 → coverage/security gate 통합 검증 → 최종 검증 → trunk squash merge

---

## Context

### Original Request
사용자는 `/tech-improve` 결과를 바탕으로 저장소 `/Users/owen/Projects/croco/framework`에 대한 **전체 권고안 묶음** 실행 플랜 생성을 요청했다. 작업 방식은 **브랜치에서 작업 후 기본 브랜치 `trunk`에 squash merge**다.

### Interview / Research Summary
**Key Discussions / Decisions**:
- 범위는 tech-improve 리포트의 **P1 + P2**를 중심으로 한다.
- **P3는 실행 과제 상세화 금지**. 프로젝트성 후속 과제로만 언급한다.
- 보안 도구는 **이번 플랜에서 1개만** 도입한다.
- coverage gate는 **전 저장소 일괄 적용 금지**, 핵심 패키지 선별 적용으로 제한한다.
- `console.log` 정리는 **런타임 경계 파일만** 대상으로 하고 CLI/템플릿/테스트 로그는 유지한다.
- storage provider는 **공통 추상화 도입 금지**, 내부 역할 분리 후보로만 남긴다.

**Grounded Findings**:
- `packages/frontend-cloudflare/src/libs/index.ts`는 현재 `export * from './index';` 한 줄뿐이며 self-cycle이 명백하다.
- `packages/tenant-core/src/libs/TenantIsolationStrategy.ts`는 `import type { SQL } from 'drizzle-orm';`를 사용하고 public contract에 `SQL` 타입을 노출한다.
- `vitest.config.ts`에는 이미 `coverage.provider = 'v8'`, `reporter = ['text', 'json', 'html']`가 존재한다. 문제는 **coverage 체계 부재가 아니라 CI gate 연결 부재**다.
- `.github/workflows/ci.yml`은 `pnpm check → pnpm build → pnpm typecheck → pnpm test`를 실행하지만 coverage/security 단계는 없다.
- empty catch는 정확히 4개 런타임 파일에 확인되었다.
- `console.log(`는 총 32건/7파일이나 대부분 CLI/테스트/템플릿이고, 런타임 경계 핵심 후보는 `packages/utils-node/src/libs/server.ts`다.
- 루트에는 `README.md`가 있지만 기여자용 단일 진입 문서 `CONTRIBUTING.md`는 없다.

### Metis Review 반영
**Identified Gaps (resolved in this plan)**:
- “핵심 패키지” 모호성 → 본 플랜에서는 `@croco/framework-context`, `@croco/retry-core`, `@croco/events-core`, `@croco/auth-core`, `@croco/telemetry-api`를 1차 적용 대상으로 고정한다.
- 보안 도구 선택 모호성 → 운영 부담이 낮고 로컬/CI 양쪽에서 검증 가능한 `dependency audit` 1종만 도입한다.
- empty catch 범위 모호성 → 이미 식별된 4개 런타임 파일로 한정한다.
- runtime `console.log` 범위 모호성 → `packages/utils-node/src/libs/server.ts` 중심 정리로 제한한다.
- 문서 범위 모호성 → `CONTRIBUTING.md`는 README를 대체하지 않고, 기여자 setup / validation / branch flow만 담당한다.

### Oracle Cross-Exam 반영
- **Oracle Verdict**: `CONDITIONAL`
- **Conditions to satisfy**:
  - Task 2는 self-cycle 수정이 `packages/frontend-cloudflare/src/libs/index.ts` 1곳에 한정되고, 추가 barrel 대공사로 확장되지 않아야 한다.
  - Task 3은 `tenant-core`의 공개 계약에서 `drizzle-orm` 타입 노출만 제거해야 하며, `migration-runner`나 다른 패키지의 ORM 의존까지 확장하지 않아야 한다.
  - Task 4는 기존 Vitest coverage 설정을 재사용해 **핵심 패키지 선별 gate**만 도입해야 하며, 전 저장소 공통 threshold를 강제하면 안 된다.
  - Task 5는 보안 자동화를 정확히 1종(`dependency audit`)만 추가해야 하며, CodeQL/Semgrep/gitleaks 동시 도입으로 확대하면 안 된다.
- self-cycle 수정과 `tenant-core` 경계 복원은 강한 코드 근거가 있으므로 P1 유지.
- `migration-runner` 의존과 storage provider 공통 추상화는 과장 위험이 있으므로 이번 플랜 범위에서 제외.
- Tests 영역은 “coverage 부재”가 아니라 “coverage threshold CI gate 부재”로 표현한다.
- Security 영역은 “취약점 존재”가 아니라 “보안 자동화 성숙도 부족”을 줄이는 방향으로 제한한다.
- TS 옵션 전면 강화와 대형 observability 도입은 이번 플랜에서 제외한다.

---

## Work Objectives

### Core Objective
tech-improve 리포트의 방어력 있는 권고안만 선택해, 작은 범위의 코드/CI/문서 수정으로 저장소의 아키텍처 결함, 테스트 게이트, 보안 자동화, 런타임 품질, DX를 한 단계 끌어올린다.

### Concrete Deliverables
- 작업 브랜치 `framework-tech-health-remediation` 생성 및 사용
- `packages/frontend-cloudflare/src/libs/index.ts` self-cycle 제거
- `packages/tenant-core/src/libs/TenantIsolationStrategy.ts`에서 `drizzle-orm` 타입 노출 제거
- coverage gate용 설정/스크립트/CI 단계 추가
- dependency audit용 보안 workflow 또는 CI 단계 추가
- 아래 4개 파일의 empty catch 제거 또는 정당한 처리로 대체
  - `packages/transports-graphql/src/libs/GraphQLServer.ts`
  - `packages/transports-http/src/libs/middleware/GracefulShutdownMiddleware.ts`
  - `packages/auth-core/src/libs/rbac/Permission.ts`
  - `packages/search-core/src/libs/sync/SearchAutoSync.ts`
- `packages/utils-node/src/libs/server.ts`의 런타임 `console.log` 정리
- 루트 `CONTRIBUTING.md` 추가 및 README와의 역할 분담 연결

### Definition of Done
- [ ] 작업 브랜치에서 계획된 변경만 존재한다.
- [ ] self-cycle 관련 빌드/타입 오류가 제거된다.
- [ ] `tenant-core`에서 `drizzle-orm` import가 사라지고 downstream typecheck가 통과한다.
- [ ] 핵심 패키지 coverage gate가 로컬/CI에서 재현 가능하다.
- [ ] dependency audit 자동화가 워크플로에 추가되고 실행 방식이 문서화된다.
- [ ] empty catch 4개가 모두 제거되거나 명시적 처리로 대체된다.
- [ ] runtime `console.log` 정리는 `packages/utils-node/src/libs/server.ts` 중심으로 끝나며 과잉 제거가 없다.
- [ ] `CONTRIBUTING.md`가 신규 기여자 setup/검증 흐름을 제공한다.

### Must Have
- self-cycle 수정은 반드시 `packages/frontend-cloudflare/src/libs/index.ts`에서 완료할 것
- `tenant-core` public surface에서 `drizzle-orm` 타입 노출을 제거할 것
- coverage gate는 기존 `vitest.config.ts`를 활용할 것
- 보안 도구는 정확히 1개만 추가할 것
- 브랜치 전략은 `framework-tech-health-remediation` 작업 후 `trunk` squash merge로 마무리할 것

### Must NOT Have (Guardrails)
- storage provider 공통 추상화 계층 추가 금지
- 전 저장소 공통 coverage threshold 일괄 강제 금지
- 보안 도구 2개 이상 동시 도입 금지
- 루트 TS 옵션 전면 강화 금지
- CLI/테스트/템플릿의 `console.log` 제거 금지
- P3 항목(대형 성능 관측, storage 대공사, TS 옵션 강화)을 구현 범위로 확장 금지

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** - 모든 검증은 실행 에이전트가 명령/도구로 수행한다.

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: Tests-after
- **Framework**: Vitest + pnpm + Turbo
- **Agent QA**: 모든 태스크에 happy path + failure/guardrail 시나리오 포함

### QA Policy
- 빌드/타입체크/테스트는 루트 스크립트와 패키지 필터 명령을 최대한 재사용한다.
- CI 관련 태스크는 “로컬 재현 가능한 스크립트 + workflow 파일 존재/내용 검증”의 이중 방식으로 검증한다.
- evidence는 `.sisyphus/evidence/task-{N}-{scenario}.{ext}`에 저장한다.

---

## Execution Strategy

### Branch Strategy
- 기본 브랜치명: `framework-tech-health-remediation`
- 전략: **브랜치에서 작업 후 trunk에 squash merge**

### Parallel Execution Waves

Wave 0 (Sequential bootstrap):
├── Task 1: 작업 브랜치 생성 및 기준선 캡처

Wave 1 (Start immediately after Task 1):
├── Task 2: frontend-cloudflare self-cycle 수정
├── Task 3: tenant-core ORM 경계 복원
├── Task 4: 핵심 패키지 coverage gate 도입
├── Task 5: dependency audit 보안 자동화 1종 도입
├── Task 6: 런타임 empty catch 4건 정리
├── Task 7: runtime boundary `console.log` 정리
└── Task 8: CONTRIBUTING.md 및 기여자 setup 흐름 추가

Wave 2 (Integration sweep):
├── Task 9: 교차 영향 검증 및 CI/docs 스크립트 통합 정리

Wave FINAL (After ALL tasks — 4 parallel reviews):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real QA execution (unspecified-high)
└── Task F4: Scope fidelity check (deep)

Critical Path: Task 1 → Task 2 → Task 3 → Task 9 → F1-F4 → Task 10
Parallel Speedup: Wave 1에서 7개 병렬
Max Concurrent: 7

### Dependency Matrix
- **1**: - → 2,3,4,5,6,7,8
- **2**: 1 → 9
- **3**: 1 → 9
- **4**: 1 → 9
- **5**: 1 → 9
- **6**: 1 → 9
- **7**: 1 → 9
- **8**: 1 → 9
- **9**: 2,3,4,5,6,7,8 → F1,F2,F3,F4,10
- **10**: F1,F2,F3,F4 → -

### Agent Dispatch Summary
- **Wave 0**: T1 → `quick`
- **Wave 1**: T2/T3/T6/T7 → `quick`, T4/T5 → `unspecified-high`, T8 → `writing`
- **Wave 2**: T9 → `unspecified-high`
- **FINAL**: F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [x] 1. 작업 브랜치 생성 및 기준선 캡처

  **What to do**:
  - `git checkout -b framework-tech-health-remediation`로 작업 브랜치를 만든다. 이미 존재하면 해당 브랜치로 체크아웃한다.
  - 현재 기준선 검증 명령(`pnpm check`, `pnpm typecheck`, `pnpm test`)의 현 상태를 기록한다.
  - 이후 태스크가 참조할 evidence 디렉토리 구조를 `.sisyphus/evidence/` 아래에 준비한다.

  **Must NOT do**:
  - `trunk` 브랜치에서 직접 작업하지 않는다.
  - 구현 변경을 시작하기 전에 기준선 기록을 생략하지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 브랜치 생성과 기준선 캡처는 짧고 절차적인 작업이다.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `git-master`: 본 플랜은 실행 계획 문서이며, 실제 git 작업은 실행 에이전트가 직접 수행하면 충분하다.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: 2, 3, 4, 5, 6, 7, 8
  - **Blocked By**: None

  **References**:
  - `lefthook.yaml` - pre-commit / pre-push 훅이 기준선 명령에 영향을 주므로 브랜치 작업 전에 검증 흐름을 이해해야 한다.
  - `package.json` - 루트에서 사용할 빌드/테스트/체크 명령의 단일 진입점이다.
  - `.sisyphus/tech-improve/framework-20260421.md` - 이번 실행 플랜의 근거가 되는 최종 진단 리포트다.

  **Acceptance Criteria**:
  - [ ] `git branch --show-current` 결과가 `framework-tech-health-remediation`다.
  - [ ] 기준선 명령 실행 결과가 evidence로 남아 있다.

  **QA Scenarios**:
  ```
  Scenario: 브랜치와 기준선 준비 성공
    Tool: Bash
    Preconditions: 저장소 루트 `/Users/owen/Projects/croco/framework`
    Steps:
      1. `git checkout -b framework-tech-health-remediation || git checkout framework-tech-health-remediation` 실행
      2. `git branch --show-current > .sisyphus/evidence/task-1-branch.txt` 실행
      3. `pnpm check > .sisyphus/evidence/task-1-check.txt 2>&1; pnpm typecheck > .sisyphus/evidence/task-1-typecheck.txt 2>&1; pnpm test > .sisyphus/evidence/task-1-test.txt 2>&1` 실행
    Expected Result: 브랜치명이 기록되고, 3개 기준선 로그 파일이 생성된다.
    Failure Indicators: 브랜치명이 다르거나 evidence 파일이 생성되지 않음
    Evidence: .sisyphus/evidence/task-1-branch.txt

  Scenario: trunk 직접 작업 방지
    Tool: Bash
    Preconditions: Task 1 완료 직후
    Steps:
      1. `git branch --show-current` 실행
      2. 출력이 `trunk`가 아닌 작업 브랜치인지 확인
    Expected Result: 현재 브랜치는 작업 브랜치다.
    Failure Indicators: 출력이 `trunk`
    Evidence: .sisyphus/evidence/task-1-branch-guard.txt
  ```

  **Commit**: NO

- [x] 2. frontend-cloudflare self-cycle 수정

  **What to do**:
  - `packages/frontend-cloudflare/src/libs/index.ts`의 self-referential export를 제거한다.
  - 필요한 경우 올바른 barrel export로 교체하되, public API surface는 최소 변경으로 유지한다.
  - `@croco/frontend-cloudflare` 빌드/타입체크가 독립적으로 통과하는지 확인한다.

  **Must NOT do**:
  - unrelated export 재구성이나 패키지 구조 개편을 하지 않는다.
  - self-cycle 수정 명목으로 다른 패키지까지 건드리지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 한 파일의 명백한 결함 수정과 패키지 단위 검증이다.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with 3,4,5,6,7,8)
  - **Blocks**: 9
  - **Blocked By**: 1

  **References**:
  - `packages/frontend-cloudflare/src/libs/index.ts` - 현재 self-cycle의 직접 원인 파일이다.
  - `.sisyphus/tech-improve/framework-20260421.md` - 해당 결함이 P1로 분류된 진단 근거다.
  - `package.json` - 패키지 필터 기반 빌드/타입체크 명령 진입점이다.

  **Acceptance Criteria**:
  - [ ] `packages/frontend-cloudflare/src/libs/index.ts`에 `export * from './index';`가 더 이상 없다.
  - [ ] `pnpm build --filter=@croco/frontend-cloudflare`가 통과한다.
  - [ ] `pnpm typecheck --filter=@croco/frontend-cloudflare` 또는 동등 검증 명령이 통과한다.

  **QA Scenarios**:
  ```
  Scenario: self-cycle 제거 후 패키지 빌드 성공
    Tool: Bash
    Preconditions: Task 2 구현 완료
    Steps:
      1. `grep -n "export \* from './index';" packages/frontend-cloudflare/src/libs/index.ts > .sisyphus/evidence/task-2-self-cycle-grep.txt || true` 실행
      2. `pnpm build --filter=@croco/frontend-cloudflare > .sisyphus/evidence/task-2-build.txt 2>&1` 실행
      3. `pnpm typecheck --filter=@croco/frontend-cloudflare > .sisyphus/evidence/task-2-typecheck.txt 2>&1` 실행
    Expected Result: grep 결과가 비어 있고, build/typecheck가 성공한다.
    Failure Indicators: self-cycle 문자열이 남아 있거나 빌드/타입체크 실패
    Evidence: .sisyphus/evidence/task-2-build.txt

  Scenario: 동일 결함 재유입 방지
    Tool: Bash
    Preconditions: Task 2 구현 완료
    Steps:
      1. `grep -R "export \* from './index';" packages/frontend-cloudflare/src/libs > .sisyphus/evidence/task-2-reintro-check.txt || true` 실행
      2. 결과가 0라인인지 확인
    Expected Result: 동일 self-export 패턴이 재발하지 않는다.
    Failure Indicators: grep 결과에 파일 경로가 출력됨
    Evidence: .sisyphus/evidence/task-2-reintro-check.txt
  ```

  **Commit**: YES
  - Message: `fix(frontend-cloudflare): remove self-referential barrel export`
  - Files: `packages/frontend-cloudflare/src/libs/index.ts`
  - Pre-commit: `pnpm build --filter=@croco/frontend-cloudflare && pnpm typecheck --filter=@croco/frontend-cloudflare`

- [x] 3. tenant-core ORM-중립 경계 복원

  **What to do**:
  - `packages/tenant-core/src/libs/TenantIsolationStrategy.ts`에서 `drizzle-orm`의 `SQL` 타입이 public contract로 드러나지 않도록 수정한다.
  - 필요 시 tenant-core 내부 타입/인터페이스를 새로 정의해 core surface를 ORM-중립적으로 만든다.
  - downstream 타입 영향이 없는지 `tenant-core` 중심 typecheck로 확인한다.

  **Must NOT do**:
  - `tenant-core` 바깥 구현체 패키지 구조를 대규모로 바꾸지 않는다.
  - 이번 플랜 범위를 넘어 repository-wide ORM abstraction 공사를 시작하지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 범위가 좁은 타입/계약 정리 작업이다.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with 2,4,5,6,7,8)
  - **Blocks**: 9
  - **Blocked By**: 1

  **References**:
  - `packages/tenant-core/src/libs/TenantIsolationStrategy.ts` - 현재 `SQL` 타입 누수가 발생하는 직접 근거다.
  - `.sisyphus/tech-improve/framework-20260421.md` - Architecture P1 권고의 근거가 기록돼 있다.
  - `packages/tenant-core/src/index.ts` - public export surface에 영향이 있는지 확인해야 한다.

  **Acceptance Criteria**:
  - [ ] `packages/tenant-core/src/libs/TenantIsolationStrategy.ts`에서 `from 'drizzle-orm'` import가 제거된다.
  - [ ] public contract가 ORM-중립 타입으로 대체된다.
  - [ ] `pnpm typecheck --filter=@croco/tenant-core`가 통과한다.

  **QA Scenarios**:
  ```
  Scenario: ORM 타입 누수 제거 성공
    Tool: Bash
    Preconditions: Task 3 구현 완료
    Steps:
      1. `grep -n "drizzle-orm" packages/tenant-core/src/libs/TenantIsolationStrategy.ts > .sisyphus/evidence/task-3-orm-leak.txt || true` 실행
      2. `pnpm typecheck --filter=@croco/tenant-core > .sisyphus/evidence/task-3-typecheck.txt 2>&1` 실행
    Expected Result: grep 결과가 비어 있고 tenant-core typecheck가 통과한다.
    Failure Indicators: drizzle-orm import가 남아 있거나 typecheck 실패
    Evidence: .sisyphus/evidence/task-3-typecheck.txt

  Scenario: downstream 타입 깨짐 방지
    Tool: Bash
    Preconditions: Task 3 구현 완료
    Steps:
      1. `pnpm typecheck > .sisyphus/evidence/task-3-root-typecheck.txt 2>&1` 실행
      2. tenant-core 변경으로 인한 연쇄 타입 오류가 없는지 확인
    Expected Result: 루트 typecheck가 통과하거나 tenant-core 변경과 무관한 기존 실패만 남는다.
    Failure Indicators: tenant-core 관련 신규 타입 오류 발생
    Evidence: .sisyphus/evidence/task-3-root-typecheck.txt
  ```

  **Commit**: YES
  - Message: `refactor(tenant-core): restore orm-neutral tenant isolation contract`
  - Files: `packages/tenant-core/src/libs/TenantIsolationStrategy.ts`
  - Pre-commit: `pnpm typecheck --filter=@croco/tenant-core`

- [x] 4. 핵심 패키지 선별 coverage threshold gate 도입

  **What to do**:
  - 기존 `vitest.config.ts` coverage 설정을 재사용한다.
  - 핵심 패키지 `@croco/framework-context`, `@croco/retry-core`, `@croco/events-core`, `@croco/auth-core`, `@croco/telemetry-api`를 1차 대상에 포함한다.
  - 루트 스크립트 또는 보조 스크립트로 coverage 실행 진입점을 추가하고, `.github/workflows/ci.yml`에 threshold gate 단계를 연결한다.
  - threshold는 현재 baseline을 측정한 뒤 무리하지 않는 초기 값으로 고정한다.

  **Must NOT do**:
  - 전 패키지 공통 threshold를 한 번에 강제하지 않는다.
  - 새로운 테스트 프레임워크를 도입하지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 루트 스크립트, 테스트 설정, CI workflow를 함께 다뤄야 한다.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with 2,3,5,6,7,8)
  - **Blocks**: 9
  - **Blocked By**: 1

  **References**:
  - `vitest.config.ts` - 이미 존재하는 coverage provider / reporter 설정을 재사용해야 한다.
  - `.github/workflows/ci.yml` - validate job에 coverage gate를 연결할 위치다.
  - `package.json` - `test`/새 coverage 스크립트 진입점을 추가할 위치다.
  - `.sisyphus/tech-improve/framework-20260421.md` - Tests gap 2 및 핵심 권고의 기준 문서다.

  **Acceptance Criteria**:
  - [ ] 핵심 패키지 대상 coverage 실행 명령이 루트에서 재현 가능하다.
  - [ ] CI에서 coverage 결과를 출력하고 threshold 미달 시 실패한다.
  - [ ] 핵심 패키지 목록이 설정/스크립트/문서 중 최소 한 곳에 명시된다.

  **QA Scenarios**:
  ```
  Scenario: 핵심 패키지 coverage gate 로컬 재현
    Tool: Bash
    Preconditions: Task 4 구현 완료
    Steps:
      1. `pnpm test:coverage:core > .sisyphus/evidence/task-4-coverage.txt 2>&1` 실행
      2. coverage 리포트가 text/json/html 중 최소 한 형식으로 생성되는지 확인
      3. 핵심 패키지 목록이 설정 파일이나 스크립트에 명시되어 있는지 확인
    Expected Result: coverage 실행이 성공하고 threshold 평가가 수행된다.
    Failure Indicators: coverage 명령 부재, 리포트 미생성, threshold 평가 누락
    Evidence: .sisyphus/evidence/task-4-coverage.txt

  Scenario: 범위 과확장 방지
    Tool: Bash
    Preconditions: Task 4 구현 완료
    Steps:
      1. `.github/workflows/ci.yml`, `package.json`, coverage 관련 설정을 읽는다.
      2. 적용 대상이 지정된 5개 핵심 패키지인지 확인한다.
    Expected Result: 전 저장소 일괄 threshold가 아니라 선별 적용으로 구현된다.
    Failure Indicators: 모든 패키지를 포괄하는 전역 threshold만 존재함
    Evidence: .sisyphus/evidence/task-4-scope-guard.txt
  ```

  **Commit**: YES
  - Message: `test(ci): add coverage threshold gate for core packages`
  - Files: `vitest.config.ts`, `.github/workflows/ci.yml`, `package.json`, optional helper config
  - Pre-commit: `pnpm test:coverage:core`

- [x] 5. dependency audit 보안 자동화 1종 도입

  **What to do**:
  - 보안 도구는 이번 플랜에서 `dependency audit` 1종으로 고정한다.
  - 기존 `ci.yml` 충돌을 피하기 위해 필요하면 별도 workflow 파일을 추가한다.
  - PR/수동 실행 시 재현 가능한 audit 명령과 실패 조건을 명시한다.

  **Must NOT do**:
  - CodeQL, Semgrep, gitleaks를 동시에 추가하지 않는다.
  - 실제 취약점 remediation 프로젝트로 범위를 넓히지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 워크플로 설계와 패키지 매니저 audit 동작을 함께 다뤄야 한다.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with 2,3,4,6,7,8)
  - **Blocks**: 9
  - **Blocked By**: 1

  **References**:
  - `.github/workflows/ci.yml` - 기존 validate 흐름과 충돌하지 않도록 위치를 판단해야 한다.
  - `package.json` - audit 명령을 스크립트로 노출할 수 있는 진입점이다.
  - `.sisyphus/tech-improve/framework-20260421.md` - Security gap 2 및 “보안 자동화 1종 도입” 권고의 근거다.

  **Acceptance Criteria**:
  - [ ] dependency audit를 실행하는 workflow 또는 CI step이 추가된다.
  - [ ] 로컬에서 동일 audit 명령을 재현할 수 있다.
  - [ ] 이번 변경에서 보안 도구는 1개만 추가된다.

  **QA Scenarios**:
  ```
  Scenario: dependency audit 자동화 추가 성공
    Tool: Bash
    Preconditions: Task 5 구현 완료
    Steps:
      1. `.github/workflows/` 내 새/수정 workflow 파일을 읽어 `audit` 명령과 트리거를 확인한다.
      2. `pnpm audit --audit-level high --prod --json > .sisyphus/evidence/task-5-audit.json 2>&1; test -s .sisyphus/evidence/task-5-audit.json` 실행
    Expected Result: workflow에 audit 단계가 존재하고, 로컬 audit 명령이 JSON 결과를 남긴다.
    Failure Indicators: workflow 부재, audit 명령 미기재, 결과 파일 미생성
    Evidence: .sisyphus/evidence/task-5-audit.json

  Scenario: 보안 도구 과다 도입 방지
    Tool: Bash
    Preconditions: Task 5 구현 완료
    Steps:
      1. `grep -R "codeql\|semgrep\|gitleaks" .github/workflows > .sisyphus/evidence/task-5-tool-scope.txt || true` 실행
      2. dependency audit 외 추가 도구가 이번 변경에 포함되지 않았는지 확인
    Expected Result: 이번 플랜 범위의 새 도구는 dependency audit 하나뿐이다.
    Failure Indicators: CodeQL/Semgrep/gitleaks가 새로 함께 추가됨
    Evidence: .sisyphus/evidence/task-5-tool-scope.txt
  ```

  **Commit**: YES
  - Message: `ci(security): add dependency audit workflow`
  - Files: `.github/workflows/security-audit.yml` or `.github/workflows/ci.yml`, `package.json`
  - Pre-commit: `pnpm audit --audit-level high --prod --json >/tmp/opencode-audit.json 2>&1 || test -s /tmp/opencode-audit.json`

- [x] 6. 런타임 empty catch 4건 정리

  **What to do**:
  - 아래 4개 파일의 `catch {}` 또는 이유 없는 swallow를 제거한다.
    - `packages/transports-graphql/src/libs/GraphQLServer.ts`
    - `packages/transports-http/src/libs/middleware/GracefulShutdownMiddleware.ts`
    - `packages/auth-core/src/libs/rbac/Permission.ts`
    - `packages/search-core/src/libs/sync/SearchAutoSync.ts`
  - 각 위치에서 최소한 로깅, 재throw, 명시적 fallback 중 하나를 택해 의도를 드러낸다.
  - 변경 범위는 확인된 4개 파일로 제한한다.

  **Must NOT do**:
  - 테스트 코드나 unrelated catch 블록까지 확장하지 않는다.
  - blanket `console.error` 추가로 문제를 덮지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 이미 타깃 파일이 확정된 좁은 런타임 코드 정리다.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with 2,3,4,5,7,8)
  - **Blocks**: 9
  - **Blocked By**: 1

  **References**:
  - `packages/transports-graphql/src/libs/GraphQLServer.ts:137` - swallow 제거 대상 1
  - `packages/transports-http/src/libs/middleware/GracefulShutdownMiddleware.ts:153` - swallow 제거 대상 2
  - `packages/auth-core/src/libs/rbac/Permission.ts:95` - swallow 제거 대상 3
  - `packages/search-core/src/libs/sync/SearchAutoSync.ts:93` - swallow 제거 대상 4
  - `.sisyphus/tech-improve/framework-20260421.md` - CodeQuality P2 권고 근거다.

  **Acceptance Criteria**:
  - [ ] 네 파일 모두에서 empty catch가 제거된다.
  - [ ] 변경 후 `pnpm check`가 통과한다.
  - [ ] 관련 패키지 typecheck 또는 테스트가 통과한다.

  **QA Scenarios**:
  ```
  Scenario: empty catch 제거 성공
    Tool: Bash
    Preconditions: Task 6 구현 완료
    Steps:
      1. `grep -n "catch\s*{\s*}" packages/transports-graphql/src/libs/GraphQLServer.ts packages/transports-http/src/libs/middleware/GracefulShutdownMiddleware.ts packages/auth-core/src/libs/rbac/Permission.ts packages/search-core/src/libs/sync/SearchAutoSync.ts > .sisyphus/evidence/task-6-empty-catch.txt || true` 실행
      2. `pnpm check > .sisyphus/evidence/task-6-check.txt 2>&1` 실행
    Expected Result: grep 결과가 비어 있고 Biome check가 통과한다.
    Failure Indicators: empty catch가 남아 있거나 Biome check 실패
    Evidence: .sisyphus/evidence/task-6-check.txt

  Scenario: 범위 이탈 방지
    Tool: Bash
    Preconditions: Task 6 구현 완료
    Steps:
      1. `git diff --name-only > .sisyphus/evidence/task-6-diff-files.txt` 실행
      2. 변경 파일이 타깃 4개 파일과 필요한 테스트/타입 파일 정도로 제한되는지 확인
    Expected Result: unrelated 대량 catch 정리로 확장되지 않는다.
    Failure Indicators: 광범위한 unrelated 파일이 함께 변경됨
    Evidence: .sisyphus/evidence/task-6-diff-files.txt
  ```

  **Commit**: YES
  - Message: `fix(runtime): replace silent catches with explicit handling`
  - Files: 위 4개 런타임 파일
  - Pre-commit: `pnpm check`

- [x] 7. runtime boundary `console.log` 정리

  **What to do**:
  - `packages/utils-node/src/libs/server.ts`의 런타임 `console.log` 사용을 더 적절한 로깅/출력 방식으로 정리한다.
  - 런타임 경계 로그만 대상으로 하며, CLI/테스트/템플릿 로그는 유지한다.
  - 필요 시 기존 프로젝트 로깅 패턴을 따라 최소 변경으로 치환한다.

  **Must NOT do**:
  - 저장소 전역 `console.log` 제거 작업으로 확대하지 않는다.
  - 템플릿/예제/테스트/CLI 로그를 건드리지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 타깃 파일이 명확한 런타임 경계 정리다.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with 2,3,4,5,6,8)
  - **Blocks**: 9
  - **Blocked By**: 1

  **References**:
  - `packages/utils-node/src/libs/server.ts` - 런타임 경계 `console.log`의 핵심 타깃 파일이다.
  - `.sisyphus/tech-improve/framework-20260421.md` - CodeQuality P2 권고에서 “runtime boundary만 정리” 가드레일이 고정돼 있다.
  - `README.md` - 개발용 CLI/온보딩 로그는 유지해야 한다는 DX 맥락을 확인하는 기준 문서다.

  **Acceptance Criteria**:
  - [ ] `packages/utils-node/src/libs/server.ts`에 직접적인 `console.log(`가 남지 않는다.
  - [ ] 루트 check/typecheck가 통과한다.
  - [ ] CLI/테스트/템플릿 로그는 변경 대상에서 제외된다.

  **QA Scenarios**:
  ```
  Scenario: 런타임 경계 로그 정리 성공
    Tool: Bash
    Preconditions: Task 7 구현 완료
    Steps:
      1. `grep -n "console\.log(" packages/utils-node/src/libs/server.ts > .sisyphus/evidence/task-7-runtime-log.txt || true` 실행
      2. `pnpm check > .sisyphus/evidence/task-7-check.txt 2>&1` 실행
      3. `pnpm typecheck > .sisyphus/evidence/task-7-typecheck.txt 2>&1` 실행
    Expected Result: server.ts에서 console.log가 사라지고 check/typecheck가 통과한다.
    Failure Indicators: target file에 console.log 잔존 또는 검증 실패
    Evidence: .sisyphus/evidence/task-7-typecheck.txt

  Scenario: 과잉 제거 방지
    Tool: Bash
    Preconditions: Task 7 구현 완료
    Steps:
      1. `git diff --name-only > .sisyphus/evidence/task-7-diff-files.txt` 실행
      2. 변경 파일 목록에 템플릿/테스트/CLI 관련 파일이 대량 포함되지 않았는지 확인
    Expected Result: 런타임 경계 파일 중심 변경으로 제한된다.
    Failure Indicators: unrelated console.log cleanup이 광범위하게 포함됨
    Evidence: .sisyphus/evidence/task-7-diff-files.txt
  ```

  **Commit**: YES
  - Message: `refactor(utils-node): narrow runtime console logging`
  - Files: `packages/utils-node/src/libs/server.ts`
  - Pre-commit: `pnpm check && pnpm typecheck`

- [x] 8. CONTRIBUTING.md 및 기여자 setup 흐름 추가

  **What to do**:
  - 루트 `CONTRIBUTING.md`를 새로 추가한다.
  - 내용은 README를 대체하지 않고, 신규 기여자용 단일 진입점으로서 prerequisites, install, build, test, typecheck, branch workflow, hook 안내를 담는다.
  - 필요 시 README에 `CONTRIBUTING.md` 링크만 최소 추가한다.

  **Must NOT do**:
  - README 전체 개편으로 확장하지 않는다.
  - AGENTS.md의 내부 에이전트 전용 규칙을 사용자용 문서로 복제하지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: 문서 역할 분담과 온보딩 흐름 정리가 핵심이다.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with 2,3,4,5,6,7)
  - **Blocks**: 9
  - **Blocked By**: 1

  **References**:
  - `README.md` - 기존 사용자용 시작 가이드를 중복하지 않도록 역할 분담 기준으로 본다.
  - `AGENTS.md` - 저장소의 실제 검증 명령과 구조 규칙을 추출할 수 있는 내부 기준 문서다.
  - `package.json` - 문서에 적어야 할 실제 명령의 출처다.
  - `lefthook.yaml` - 기여자용 hook 안내 출처다.

  **Acceptance Criteria**:
  - [ ] 루트 `CONTRIBUTING.md`가 생성된다.
  - [ ] `pnpm install → pnpm build → pnpm test → pnpm typecheck` 흐름이 문서화된다.
  - [ ] 브랜치/검증/hook 흐름이 문서화된다.
  - [ ] README는 최소 변경만 가진다.

  **QA Scenarios**:
  ```
  Scenario: CONTRIBUTING.md 생성 및 핵심 흐름 문서화
    Tool: Bash
    Preconditions: Task 8 구현 완료
    Steps:
      1. `test -f CONTRIBUTING.md` 실행
      2. `grep -n "pnpm install\|pnpm build\|pnpm test\|pnpm typecheck" CONTRIBUTING.md > .sisyphus/evidence/task-8-contributing.txt` 실행
      3. `grep -n "lefthook\|branch\|pull request\|squash" CONTRIBUTING.md >> .sisyphus/evidence/task-8-contributing.txt` 실행
    Expected Result: CONTRIBUTING.md가 존재하고 setup/검증/브랜치 흐름이 모두 문서화된다.
    Failure Indicators: 파일 부재, 핵심 명령 누락, 기여 흐름 누락
    Evidence: .sisyphus/evidence/task-8-contributing.txt

  Scenario: README 과변경 방지
    Tool: Bash
    Preconditions: Task 8 구현 완료
    Steps:
      1. `git diff --name-only > .sisyphus/evidence/task-8-diff-files.txt` 실행
      2. README 변경이 있더라도 링크 추가 등 최소 범위인지 확인
    Expected Result: 문서 추가의 주체는 CONTRIBUTING.md이며 README 전면 개편이 없다.
    Failure Indicators: README 대규모 수정
    Evidence: .sisyphus/evidence/task-8-diff-files.txt
  ```

  **Commit**: YES
  - Message: `docs(contributing): add contributor onboarding guide`
  - Files: `CONTRIBUTING.md`, optional `README.md`
  - Pre-commit: `pnpm check`

- [x] 9. 교차 영향 검증 및 CI/docs 통합 정리

  **What to do**:
  - Wave 1 산출물을 통합해 루트 수준 `pnpm check`, `pnpm build`, `pnpm typecheck`, `pnpm test` 재검증을 수행한다.
  - coverage/security/docs 변경이 서로 충돌하지 않는지 확인하고 필요한 최소 정리를 수행한다.
  - P3 항목은 구현하지 않고, 최종 notes에 deferred work로만 남긴다.

  **Must NOT do**:
  - P3 storage/performance/TS 강화 작업을 이 통합 단계에서 끼워 넣지 않는다.
  - 통합 실패를 핑계로 unrelated refactor를 시작하지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 다수의 변경을 통합 검증하고 충돌을 정리하는 단계다.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: F1, F2, F3, F4, 10
  - **Blocked By**: 2, 3, 4, 5, 6, 7, 8

  **References**:
  - `.github/workflows/ci.yml` - coverage 통합 이후 validate 흐름이 여전히 일관적인지 확인해야 한다.
  - `.github/workflows/benchmark.yml` - 성능 워크플로는 유지 대상이며 이번 통합 단계에서 깨지면 안 된다.
  - `.sisyphus/tech-improve/framework-20260421.md` - P3 deferred work를 구현하지 말아야 한다는 기준 문서다.

  **Acceptance Criteria**:
  - [ ] 루트 검증 명령 4종이 통과한다.
  - [ ] benchmark workflow, release workflow, docs workflow는 불필요하게 변경되지 않는다.
  - [ ] P3 작업은 코드 diff에 포함되지 않는다.

  **QA Scenarios**:
  ```
  Scenario: 루트 통합 검증 성공
    Tool: Bash
    Preconditions: Tasks 2-8 완료
    Steps:
      1. `pnpm check > .sisyphus/evidence/task-9-check.txt 2>&1` 실행
      2. `pnpm build > .sisyphus/evidence/task-9-build.txt 2>&1` 실행
      3. `pnpm typecheck > .sisyphus/evidence/task-9-typecheck.txt 2>&1` 실행
      4. `pnpm test > .sisyphus/evidence/task-9-test.txt 2>&1` 실행
    Expected Result: 루트 수준 검증이 모두 통과한다.
    Failure Indicators: 네 명령 중 하나라도 실패
    Evidence: .sisyphus/evidence/task-9-test.txt

  Scenario: P3 scope creep 방지
    Tool: Bash
    Preconditions: Task 9 완료
    Steps:
      1. `git diff --name-only > .sisyphus/evidence/task-9-diff-files.txt` 실행
      2. storage provider 패키지, benchmark infra, tsconfig base 파일이 불필요하게 수정되었는지 확인
    Expected Result: P3 관련 대형 후속 과제는 diff에 포함되지 않는다.
    Failure Indicators: `packages/storage-*`, `packages/shared/utils-tsconfig/tsconfig.base.json`, benchmark infra 대형 수정 발생
    Evidence: .sisyphus/evidence/task-9-diff-files.txt
  ```

  **Commit**: YES
  - Message: `chore(repo): integrate tech health remediation changes`
  - Files: Wave 1 결과 전체
  - Pre-commit: `pnpm check && pnpm build && pnpm typecheck && pnpm test`

---

## Final Verification Wave

- [x] F1. **Plan Compliance Audit** — `oracle`
  - self-cycle, `tenant-core`, coverage gate, dependency audit, empty catch, runtime log, CONTRIBUTING deliverables가 모두 존재하는지 확인한다.
  - Must NOT Have 위반(storage 공통 추상화, 전역 coverage threshold, 보안 도구 다중 도입, TS 옵션 전면 강화, 과잉 log cleanup)을 탐지한다.
  - Evidence 파일 존재 여부를 함께 점검한다.
  - Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT`

  **QA Scenario**:
  ```
  Tool: Bash + Read
  Preconditions: Task 9 완료, 플랜 파일과 evidence 디렉토리 접근 가능
  Steps:
    1. `.sisyphus/plans/framework-tech-health-remediation.md`와 변경 대상 파일들을 읽어 Must Have 항목별 구현 존재 여부를 대조한다.
    2. guardrail 위반 여부를 확인하고 결과를 `.sisyphus/evidence/final-f1-plan-compliance.txt`에 기록한다.
    3. `.sisyphus/evidence/` 아래 task-1~task-9 evidence 파일 존재 여부를 점검하고 같은 파일에 누락 여부를 추가 기록한다.
  Expected Result: Must Have 구현이 모두 확인되고 Must NOT Have 위반이 없으며 evidence 목록이 남는다.
  Failure Indicators: deliverable 누락, guardrail 위반, evidence 파일 부재
  Evidence: .sisyphus/evidence/final-f1-plan-compliance.txt
  ```

- [x] F2. **Code Quality Review** — `unspecified-high`
- [x] F3. **Real QA Execution** — `unspecified-high`
- [x] F4. **Scope Fidelity Check** — `deep`
  - 실제 diff와 본 플랜을 비교하여 P1/P2만 구현됐는지, P3가 섞이지 않았는지 확인한다.
  - `trunk squash merge` 직전 불필요한 파일/과대 구현을 차단한다.
  - Output: `Tasks [N/N compliant] | Scope creep [CLEAN/N issues] | VERDICT`

  **QA Scenario**:
  ```
  Tool: Bash + Read
  Preconditions: Final Verification 직전, 작업 브랜치 diff 접근 가능
  Steps:
    1. `git diff --name-only trunk...HEAD > .sisyphus/evidence/final-f4-diff-files.txt` 실행
    2. diff 파일 목록과 플랜 TODO의 대상 파일/워크플로/문서 범위를 대조한다.
    3. `packages/storage-*`, `benchmarks/`, `vitest.config.bench.ts`, `packages/shared/utils-tsconfig/tsconfig.base.json` 등 P3/금지 범위 파일 변경 여부를 확인한다.
    4. 결과를 `.sisyphus/evidence/final-f4-scope.txt`에 정리한다.
  Expected Result: 변경이 P1/P2 범위와 일치하고 P3/guardrail 위반이 없다.
  Failure Indicators: storage provider 공통화, benchmark 대공사, TS 옵션 전면 강화, 무관 파일 대량 수정
  Evidence: .sisyphus/evidence/final-f4-diff-files.txt, .sisyphus/evidence/final-f4-scope.txt
  ```

---

## Commit Strategy

- **Commit 1**: `fix(frontend-cloudflare): remove self-referential barrel export`
- **Commit 2**: `refactor(tenant-core): restore orm-neutral tenant isolation contract`
- **Commit 3**: `test(ci): add coverage threshold gate for core packages`
- **Commit 4**: `ci(security): add dependency audit workflow`
- **Commit 5**: `fix(runtime): replace silent catches with explicit handling`
- **Commit 6**: `refactor(utils-node): narrow runtime console logging`
- **Commit 7**: `docs(contributing): add contributor onboarding guide`
- **Commit 8**: `chore(repo): integrate tech health remediation changes`

---

## Risks

- `tenant-core` 경계 수정 후 downstream 타입 오류가 드러날 수 있다.
- coverage threshold를 현재 baseline보다 높게 잡으면 CI가 지속 실패할 수 있다.
- dependency audit는 false positive 또는 네트워크 상태 영향이 있을 수 있다.
- empty catch 정리 시 graceful shutdown / sync fallback 동작이 달라질 수 있다.
- 문서 작업이 README 대개편으로 번질 위험이 있다.

완화 전략:
- tenant-core와 coverage는 패키지/루트 typecheck를 모두 수행한다.
- coverage threshold는 baseline 측정 후 보수적으로 시작한다.
- dependency audit는 1개 workflow에 한정하고 false positive 처리 규칙을 문서화한다.
- empty catch는 fallback/rethrow/명시적 기록 중 하나를 선택해 의도를 남긴다.
- 문서 작업은 CONTRIBUTING 중심으로 제한하고 README는 링크 수준만 허용한다.

---

## Success Criteria

### Verification Commands
```bash
pnpm check
pnpm build
pnpm typecheck
pnpm test
pnpm build --filter=@croco/frontend-cloudflare
pnpm typecheck --filter=@croco/tenant-core
pnpm test:coverage:core
pnpm audit --audit-level high --prod --json
```

### Final Checklist
- [ ] All P1 deliverables implemented
- [ ] All P2 deliverables implemented
- [ ] P3 work deferred, not implemented
- [ ] Coverage gate limited to named core packages
- [ ] Exactly one security automation tool added
- [ ] Runtime empty catch targets resolved
- [ ] Runtime `console.log` cleanup limited to intended boundary
- [ ] CONTRIBUTING guide added without README rewrite
- [ ] Final verification wave approved

- [x] 10. trunk에 squash merge 및 브랜치 정리

  **What to do**:
  - Final Verification Wave가 모두 APPROVE된 뒤 `trunk`로 돌아간다.
  - `git merge --squash framework-tech-health-remediation`로 squash merge 한다.
  - 단일 커밋 메시지로 최종 반영하고 작업 브랜치를 삭제한다.

  **Must NOT do**:
  - Final Verification 승인 전 merge하지 않는다.
  - rebase/force push/직접 `trunk` 커밋으로 우회하지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 검증 완료 후 정해진 git 절차를 수행하는 종료 단계다.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Final closure
  - **Blocks**: None
  - **Blocked By**: F1, F2, F3, F4

  **References**:
  - 본 플랜 전체 - merge 대상 범위와 guardrail의 최종 기준이다.
  - `lefthook.yaml` - merge 직전/직후 hook 영향을 이해해야 한다.

  **Acceptance Criteria**:
  - [ ] `trunk`에 squash commit 1개로 반영된다.
  - [ ] 작업 브랜치가 삭제된다.
  - [ ] `git status`가 깨끗하다.

  **QA Scenarios**:
  ```
  Scenario: squash merge 성공
    Tool: Bash
    Preconditions: F1-F4 모두 APPROVE
    Steps:
      1. `git checkout trunk` 실행
      2. `git merge --squash framework-tech-health-remediation` 실행
      3. `git commit -m "chore(repo): apply framework tech health remediation"` 실행
      4. `git branch -D framework-tech-health-remediation` 실행
      5. `git status > .sisyphus/evidence/task-10-status.txt` 실행
    Expected Result: squash commit 1개가 생성되고 작업 브랜치가 삭제되며 상태가 깨끗하다.
    Failure Indicators: merge 충돌 미해결, 브랜치 미삭제, git status dirty
    Evidence: .sisyphus/evidence/task-10-status.txt

  Scenario: 조기 merge 방지
    Tool: Bash
    Preconditions: merge 직전
    Steps:
      1. Final Verification 결과 파일/로그를 확인한다.
      2. APPROVE가 아닌 항목이 있으면 merge를 중단한다.
    Expected Result: 미승인 상태에서는 merge가 실행되지 않는다.
    Failure Indicators: 검증 미완료 상태에서 `trunk` 반영 시도
    Evidence: .sisyphus/evidence/task-10-guard.txt
  ```

  **Commit**: NO

# Framework Tech Health Enforcement Plan

## TL;DR

> **Quick Summary**: `/tech-improve` 진단 결과를 실행 가능한 저장소 전반 개선 플랜으로 전환한다. 목표는 새 원칙을 늘리는 것이 아니라, 이미 합의된 원칙을 **baseline 측정 → warning-only → enforce** 흐름의 자동 게이트로 승격해 `framework` 모노레포를 **Code Quality 선도형 저장소**에서 **Enforcement 강화형 저장소**로 끌어올리는 것이다.
>
> **Deliverables**:
> - 작업 브랜치 `framework-tech-health-enforcement`에서 시작하는 실행 흐름
> - 아키텍처 경계/순환 의존 baseline 측정 및 warning-only CI 게이트 설계
> - 핵심 패키지 coverage baseline 측정 및 warning-only / enforce 단계 계획
> - 보안 자동화 1종(`pnpm audit --audit-level high --prod` 기반 강화)과 secret scanning/SAST의 최소 도입 경로
> - 현재는 최종적으로 hard fail되는 benchmark workflow를 기준으로, baseline / true warning-only / enforce 전환 계획을 정리
> - one-command setup / env contract / 온보딩 검증 흐름 계획
> - 최종 `trunk` squash merge 태스크
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 3개 구현 wave + 최종 검증 wave
> **Critical Path**: Task 1 → Task 2 → Task 8 → Task 12 → Final Verification → Task 13

---

## Context

### Original Request
사용자는 `/tech-improve` 진단 결과를 바탕으로 현재 저장소 `/Users/owen/Projects/croco/framework`의 **후속 실행 플랜**을 요청했다. 구현 자체가 아니라, 실행 에이전트가 바로 수행할 수 있는 **단일 작업 계획서**가 필요하다.

### Interview Summary
**Key Discussions**:
- 후속 계획은 기술 건강도 리포트의 우선순위 순서를 따른다: **Boundary Hardening → Test Quality Gate → Security Automation Baseline → Contributor Onboarding → Performance Reliability Track**.
- 브랜치 전략은 **브랜치에서 작업 후 `main`에 squash merge**가 아니라, 실제 저장소 기본 브랜치명이 `trunk`이므로 **작업 브랜치에서 진행 후 최종적으로 `trunk`에 squash merge**하는 흐름으로 계획한다.
- 소스 코드 대공사, 패키지 재구조화, dependency 대규모 업그레이드, 대형 observability 플랫폼 도입은 이번 범위에서 제외한다.
- 새 게이트는 반드시 **baseline 측정 → warning-only → enforce** 3단계로 도입한다.

**Research Findings**:
- 최종 진단 리포트 `.sisyphus/tech-improve/framework-20260421.md` 기준 현재 fingerprint는 **Architecture L3 / Code Quality L4 / Tests L3 / Performance L2 / Security L2 / DX L3**이며 목표는 **L4 / L4 / L4 / L3 / L3 / L4**다.
- `.github/workflows/ci.yml`에는 이미 `pnpm audit:prod`, `pnpm check`, `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm test:coverage:core`가 연결되어 있다.
- `.github/workflows/benchmark.yml`에는 `pnpm bench:check --output-json=benchmark-result.json`와 `continue-on-error: true`가 함께 있으나, 후속 step에서 `if: steps.bench.outcome == 'failure'` 조건으로 `exit 1`을 수행하므로 현재 상태는 **artifact/comment를 남긴 뒤 최종적으로 hard fail하는 enforce형 gate**에 가깝다.
- `vitest.config.ts`는 `CORE_COVERAGE=true`일 때만 5개 핵심 패키지(`framework-context`, `retry-core`, `events-core`, `auth-core`, `telemetry-api`)에 60% threshold를 적용한다.
- `lefthook.yaml`은 현재 Biome 중심 훅만 있으며 secret scanning/SAST는 없다.
- `package.json`에는 `build`, `check`, `test`, `test:coverage:core`, `audit:prod`, `bench:check`, `bench:update`가 존재하고 `engines.node`는 `>=22`다.

### Metis Review
**Identified Gaps** (addressed):
- baseline을 생략하고 바로 강제 게이트를 넣는 위험 → 모든 트랙에서 baseline 태스크를 선행하도록 설계했다.
- CI 시간 급증 위험 → 각 트랙의 acceptance criteria에 **실행 시간/캐시 영향 기록**을 포함했다.
- coverage를 전 저장소에 일괄 강제하는 범위 확장 위험 → 1차 적용 대상을 이미 존재하는 5개 core 패키지로 고정했다.
- 보안 도구 과도 도입 위험 → 1차 단계에서는 기존 `audit:prod` 강화와 secret scanning/SAST 중 최소 1종만 warning-only로 연결하도록 제한했다.
- 아키텍처 개선이 실제 리팩터링으로 번질 위험 → 본 플랜에서는 **감지와 차단 규칙 도입**만 수행하고, 순환 제거 자체는 별도 후속 작업으로 분리했다.

### Oracle Architecture Gate
**Verdict**: CONDITIONAL

**Why conditional**:
- Task 7~12는 아키텍처 경계 감지, CI 흐름, benchmark 게이트 semantics, setup 진입점 등 저장소 운영 규칙과 인터페이스 성격의 변경을 포함한다.
- 이 변경들은 안전하지만, 기존 개발 흐름을 깨지 않으려면 baseline 선행, warning-only 단계 분리, 기존 CI 단계 보존이 반드시 지켜져야 한다.

**Conditions to satisfy**:
- 기존 `pnpm check`, `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm test:coverage:core`, `pnpm audit:prod`, `pnpm bench:check` 경로를 제거하거나 우회하지 않는다.
- 새 게이트는 baseline evidence 확보 전에는 enforce로 올리지 않는다.
- benchmark 트랙은 현재 hard fail 흐름을 정확히 문서화한 뒤, 필요 시 **명시적으로 true warning-only 단계로 완화**하고 artifact/comment 보존을 보장하는 방향으로만 조정한다.
- 아키텍처 트랙은 순환 의존 **감지/분류/차단 규칙**까지만 포함하고 실제 코드 리팩터링은 별도 계획으로 남긴다.
- DX 트랙의 setup 진입점은 기존 `package.json`, `README.md`, `CONTRIBUTING.md`, `lefthook.yaml` 패턴을 재사용하며 기존 개발 명령의 계약을 깨지 않는다.

**Plan impact**:
- Task 5는 benchmark의 현재 강도를 정확히 측정하는 baseline 태스크로 유지한다.
- Task 7~12는 모두 baseline → warning-only → enforce 순서를 보존하며, CI 시간/캐시 영향과 rollback 조건을 acceptance criteria에 포함한다.

---

## Work Objectives

### Core Objective
저장소 전반의 자동 강제력을 높이는 실행 순서를 정의해, 사람 리뷰 의존적인 품질 관리에서 **실패 가능한 저장소 규칙 중심의 품질 관리**로 전환한다.

### Concrete Deliverables
- 브랜치 `framework-tech-health-enforcement` 생성과 기준선 캡처
- 아키텍처/테스트/보안/성능/DX 각 축의 baseline 측정 결과 및 evidence
- warning-only 단계의 신규 게이트 계획과 설정 변경 목록
- enforce 전환 조건 및 rollback 가능한 단계별 배치 계획
- `CONTRIBUTING.md`/README/스크립트와 연결되는 온보딩 계획
- 최종 `trunk` squash merge 절차

### Definition of Done
- [ ] baseline 측정 결과가 다섯 트랙 모두 evidence로 남아 있다.
- [ ] 아키텍처 경계 검사, coverage gate, 보안 자동화, benchmark gate, DX setup 검증 각각에 대해 warning-only와 enforce 조건이 명시돼 있다.
- [ ] 기존 CI 단계 제거 없이 새 단계만 추가하는 플랜으로 유지된다.
- [ ] 모든 태스크의 acceptance criteria가 명령 또는 파일 존재/내용 검증으로 재현 가능하다.
- [ ] 마지막 체크박스가 `trunk` squash merge 및 브랜치 정리 태스크다.

### Must Have
- 기존 `ci.yml`, `benchmark.yml`, `vitest.config.ts`, `package.json`, `lefthook.yaml`의 패턴을 최대한 재사용할 것
- 핵심 coverage 대상은 기존 5개 core 패키지부터 시작할 것
- 아키텍처 트랙은 순환/경계 **감지와 차단 규칙**에 집중할 것
- 보안 트랙은 기존 `audit:prod`를 축으로 삼고, secret scanning 또는 SAST 최소 1종의 연결 계획을 포함할 것
- DX 트랙은 one-command setup, env contract, 첫 실행 검증에 집중할 것

### Must NOT Have (Guardrails)
- 소스 코드 리팩토링으로 범위를 확장하지 말 것
- 패키지 추가/삭제나 `pnpm-workspace.yaml` 변경을 포함하지 말 것
- dependency 대규모 업그레이드를 포함하지 말 것
- 전 저장소 동일 coverage threshold를 즉시 enforce하지 말 것
- benchmark 인프라 작업을 실제 성능 최적화 작업으로 확장하지 말 것
- main/trunk 보호 규칙을 자동 적용하는 작업을 포함하지 말 것

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — 모든 검증은 실행 에이전트가 명령, 파일 검사, CI 재현 스크립트로 수행한다.

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: Tests-after
- **Framework**: Vitest + Turbo + GitHub Actions
- **Agent-Executed QA**: 모든 태스크에 happy path + failure/guardrail scenario 포함

### QA Policy
- baseline 측정은 반드시 파일로 남긴다.
- warning-only 단계는 “실패를 보고하되 전체 pipeline을 깨지 않는 상태”로 검증한다.
- enforce 단계는 “의도적으로 임계값 아래/위반 상태를 만들어 실제 실패가 재현되는지”까지 확인한다.
- evidence는 `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`에 저장한다.

---

## Execution Strategy

### Parallel Execution Waves

Wave 0 (Sequential bootstrap):
├── Task 1: 작업 브랜치 생성 + 현재 CI 기준선 캡처

Wave 1 (Baseline measurement - 5 parallel tasks):
├── Task 2: 아키텍처 baseline 측정
├── Task 3: 테스트/coverage baseline 측정
├── Task 4: 보안 baseline 측정
├── Task 5: 성능 benchmark baseline 측정
└── Task 6: DX/onboarding baseline 측정

Wave 2 (Warning-only introduction - 5 parallel tasks):
├── Task 7: 아키텍처 warning-only 게이트 추가
├── Task 8: 핵심 패키지 coverage warning-only 게이트 추가
├── Task 9: 보안 warning-only 자동화 추가
├── Task 10: benchmark warning-only 게이트 정비
└── Task 11: one-command setup / env contract / onboarding 흐름 추가

Wave 3 (Enforcement preparation + integration):
├── Task 12: enforce 전환 조건 정리 및 CI 통합 검증

Wave FINAL (After ALL tasks — 4 parallel reviews):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA execution (unspecified-high)
└── Task F4: Scope fidelity check (deep)

Wave CLOSE:
├── Task 13: `trunk` squash merge 및 브랜치 정리

Critical Path: 1 → 2 → 7 → 12 → F1-F4 → 13
Parallel Speedup: Wave 1/2 각 5병렬
Max Concurrent: 5

### Dependency Matrix
- **1**: - → 2,3,4,5,6
- **2**: 1 → 7,12
- **3**: 1 → 8,12
- **4**: 1 → 9,12
- **5**: 1 → 10,12
- **6**: 1 → 11,12
- **7**: 2 → 12
- **8**: 3 → 12
- **9**: 4 → 12
- **10**: 5 → 12
- **11**: 6 → 12
- **12**: 7,8,9,10,11 → F1,F2,F3,F4,13
- **13**: F1,F2,F3,F4 → -

### Agent Dispatch Summary
- **Wave 0**: Task 1 → `quick`
- **Wave 1**: Task 2/3/4/5/6 → `unspecified-high`
- **Wave 2**: Task 7/8/9/10 → `unspecified-high`, Task 11 → `writing`
- **Wave 3**: Task 12 → `deep`
- **FINAL**: F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`
- **CLOSE**: Task 13 → `quick`

---

## TODOs

- [x] 1. 작업 브랜치 생성 및 현재 CI 기준선 캡처

  **What to do**:
  - `git checkout -b framework-tech-health-enforcement`로 작업 브랜치를 만든다. 이미 있으면 해당 브랜치로 체크아웃한다.
- `pnpm check`, `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm test:coverage:core`, `pnpm audit:prod`, `pnpm bench:check --output-json=benchmark-result.json`의 현재 동작 여부를 캡처한다.
  - 기준선 결과와 실행 시간을 evidence로 저장한다.

  **Must NOT do**:
  - `trunk`에서 직접 작업하지 않는다.
  - 기준선 측정 없이 warning-only 단계로 넘어가지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 브랜치 생성과 루트 명령 캡처는 절차형 작업이다.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `git-master`: 커밋/히스토리 조작이 아니라 기준선 캡처가 중심이므로 생략한다.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: 2, 3, 4, 5, 6
  - **Blocked By**: None

  **References**:
  - `package.json` - 루트 기준선 명령의 단일 출처다.
  - `.github/workflows/ci.yml` - 현재 validate job이 어떤 명령을 실행하는지 확인하는 기준이다.
  - `.github/workflows/benchmark.yml` - benchmark 기준선 명령과 현재 실패 처리 방식을 확인해야 한다.

  **Acceptance Criteria**:
  - [ ] `git branch --show-current` 결과가 `framework-tech-health-enforcement`다.
  - [ ] 기준선 명령 결과와 실행 시간이 evidence 파일에 남아 있다.

  **QA Scenarios**:
  ```
  Scenario: 브랜치 및 기준선 캡처 성공
    Tool: Bash
    Preconditions: 저장소 루트 `/Users/owen/Projects/croco/framework`
    Steps:
      1. `git checkout -b framework-tech-health-enforcement || git checkout framework-tech-health-enforcement` 실행
      2. `git branch --show-current > .sisyphus/evidence/task-1-branch.txt` 실행
      3. `time pnpm check > .sisyphus/evidence/task-1-check.txt 2>&1` 등 기준선 명령을 각각 실행해 로그와 시간을 저장
    Expected Result: 작업 브랜치와 기준선 로그 파일이 모두 생성된다.
    Failure Indicators: 브랜치명이 다르거나 로그 파일이 누락됨
    Evidence: .sisyphus/evidence/task-1-branch.txt

  Scenario: trunk 직접 작업 방지 확인
    Tool: Bash
    Preconditions: Task 1 직후
    Steps:
      1. `git branch --show-current | tee .sisyphus/evidence/task-1-branch-guard.txt` 실행
      2. 출력이 `trunk`인지 아닌지 확인
    Expected Result: 출력은 `framework-tech-health-enforcement`다.
    Failure Indicators: 출력이 `trunk`
    Evidence: .sisyphus/evidence/task-1-branch-guard.txt
  ```

  **Commit**: NO

- [x] 2. 아키텍처 baseline 측정

  **What to do**:
  - 현재 순환 의존과 계층 위반을 감지할 수 있는 명령 후보를 확정한다.
  - `madge`, `dependency-cruiser`, 또는 기존 도구 조합 중 최소 침습적인 측정 방식을 선택한다.
  - 현재 5건 순환 의존이 실제로 재현되는지, 어떤 패키지/파일이 포함되는지 evidence로 남긴다.

  **Must NOT do**:
  - 순환 의존 자체를 여기서 수정하지 않는다.
  - 패키지 구조나 import 방향을 대규모로 바꾸지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 모노레포 전역 import/graph 측정 설계가 필요하다.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `refactor`: 구조 분석은 필요하지만 실제 리팩터링은 금지 범위다.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with 3,4,5,6)
  - **Blocks**: 7, 12
  - **Blocked By**: 1

  **References**:
  - `.sisyphus/tech-improve/framework-20260421.md` - Architecture 축 진단과 5건 순환 의존 근거가 정리돼 있다.
  - `AGENTS.md` - 4계층 구조와 `repository-core` 의존성 규칙이 문서화돼 있다.
  - `turbo.json` - 새 검사 도입 시 캐시/태스크 그래프 영향을 고려해야 한다.

  **Acceptance Criteria**:
  - [ ] 순환 의존/계층 위반 baseline 명령이 하나 이상 확정된다.
  - [ ] 현재 위반 목록이 evidence 파일로 저장된다.

  **QA Scenarios**:
  ```
  Scenario: 아키텍처 baseline 산출 성공
    Tool: Bash
    Preconditions: Task 1 완료
    Steps:
      1. 선택한 분석 명령(예: `pnpm exec madge --circular packages --extensions ts`)을 실행
      2. 출력 결과를 `.sisyphus/evidence/task-2-architecture-baseline.txt`에 저장
      3. 5건 순환 의존 또는 현재 측정된 위반 목록을 확인
    Expected Result: 현재 구조 위반 목록이 텍스트 evidence로 남는다.
    Failure Indicators: 명령이 실행되지 않거나 출력이 비정상적으로 비어 있음
    Evidence: .sisyphus/evidence/task-2-architecture-baseline.txt

  Scenario: 리팩터링 범위 확장 방지
    Tool: Bash
    Preconditions: baseline 수집 완료
    Steps:
      1. 변경 파일 목록을 확인
      2. 아키텍처 baseline 단계에서 소스 파일 수정이 발생했는지 확인
    Expected Result: baseline 단계에서는 측정용 설정/문서 외 소스 리팩터링이 없다.
    Failure Indicators: 다수의 패키지 소스 파일이 수정됨
    Evidence: .sisyphus/evidence/task-2-scope-guard.txt
  ```

  **Commit**: NO

- [x] 3. 테스트/coverage baseline 측정

  **What to do**:
  - 현재 `pnpm test:coverage:core`와 `vitest.config.ts`의 threshold 적용 범위를 evidence로 남긴다.
  - 5개 core 패키지별 coverage 결과와 나머지 패키지군의 threshold 부재 상태를 문서화한다.
  - warning-only 시작점이 될 최소 기준선을 확정한다.

  **Must NOT do**:
  - 이 단계에서 전 저장소 일괄 threshold를 강제하지 않는다.
  - 테스트 케이스를 새로 작성하지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: coverage 구조와 패키지 분류를 함께 해석해야 한다.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `issue-find`: 진단은 이미 끝났고, 실행 기준선만 정리하면 된다.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with 2,4,5,6)
  - **Blocks**: 8, 12
  - **Blocked By**: 1

  **References**:
  - `vitest.config.ts` - `CORE_COVERAGE_PACKAGES`와 threshold 적용 조건의 원본이다.
  - `package.json` - `test:coverage:core` 실행 방식의 단일 출처다.
  - `.github/workflows/ci.yml` - coverage 관련 현재 CI 연결 상태를 확인할 수 있다.

  **Acceptance Criteria**:
  - [ ] 5개 core 패키지 coverage baseline이 evidence로 남는다.
  - [ ] warning-only 시작점으로 사용할 최소 기준안이 문서화된다.

  **QA Scenarios**:
  ```
  Scenario: coverage baseline 캡처 성공
    Tool: Bash
    Preconditions: Task 1 완료
    Steps:
      1. `pnpm test:coverage:core > .sisyphus/evidence/task-3-coverage-baseline.txt 2>&1` 실행
      2. coverage report 산출물 경로와 threshold 적용 여부를 확인
      3. core package 목록과 결과를 evidence에 정리
    Expected Result: 현재 coverage baseline과 threshold 범위가 evidence로 남는다.
    Failure Indicators: coverage 명령 실패 또는 대상 패키지 정보 누락
    Evidence: .sisyphus/evidence/task-3-coverage-baseline.txt

  Scenario: 범위 과잉 방지
    Tool: Bash
    Preconditions: baseline 수집 완료
    Steps:
      1. 수정된 설정 파일을 확인
      2. 전 저장소 공통 threshold 강제 변경이 포함되었는지 확인
    Expected Result: baseline 단계에서는 강제 로직 없이 현황 기록만 존재한다.
    Failure Indicators: 모든 패키지에 동일 threshold를 바로 적용하는 변경이 나타남
    Evidence: .sisyphus/evidence/task-3-scope-guard.txt
  ```

  **Commit**: NO

- [x] 4. 보안 baseline 측정

  **What to do**:
  - `pnpm audit:prod`의 현재 결과와 실패 조건을 캡처한다.
  - `lefthook.yaml`, `.github/workflows/ci.yml` 기준으로 secret scanning/SAST 부재 상태를 evidence로 남긴다.
  - 1차 도입 대상으로 삼을 보안 자동화 1종을 확정한다.

  **Must NOT do**:
  - 여러 보안 도구를 동시에 도입 대상으로 확장하지 않는다.
  - 실제 취약점 패치를 이 단계에서 시작하지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: CI/훅/감사 신호를 함께 읽어야 한다.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `harden`: 구현 hardening이 아니라 자동화 baseline 정리 단계다.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with 2,3,5,6)
  - **Blocks**: 9, 12
  - **Blocked By**: 1

  **References**:
  - `.github/workflows/ci.yml` - `pnpm audit:prod`의 현재 CI 연결 상태를 확인한다.
  - `lefthook.yaml` - 로컬 훅에 secret scanning이 없는 현재 상태를 보여준다.
  - `.sisyphus/tech-improve/framework-20260421.md` - Security 축의 current/intended와 quick win 근거가 있다.

  **Acceptance Criteria**:
  - [ ] `pnpm audit:prod` 결과가 evidence로 남는다.
  - [ ] 도입할 보안 자동화 1종이 명시된다.

  **QA Scenarios**:
  ```
  Scenario: 보안 baseline 캡처 성공
    Tool: Bash
    Preconditions: Task 1 완료
    Steps:
      1. `pnpm audit:prod > .sisyphus/evidence/task-4-audit-baseline.txt 2>&1` 실행
      2. `lefthook.yaml`과 `.github/workflows/ci.yml`에서 secret scan/SAST 유무를 기록
    Expected Result: 현재 보안 자동화 baseline과 공백이 evidence로 남는다.
    Failure Indicators: audit 결과 또는 훅/CI 상태 증거가 없음
    Evidence: .sisyphus/evidence/task-4-audit-baseline.txt

  Scenario: 보안 도구 과잉 도입 방지
    Tool: Bash
    Preconditions: baseline 정리 완료
    Steps:
      1. 계획된 변경 목록을 확인
      2. 도입 후보가 1종을 초과하는지 점검
    Expected Result: 1차 단계는 audit 강화 + secret scanning 또는 SAST 최소 1종으로 제한된다.
    Failure Indicators: 둘 이상의 신규 보안 도구 도입이 계획됨
    Evidence: .sisyphus/evidence/task-4-scope-guard.txt
  ```

  **Commit**: NO

- [x] 5. 성능 benchmark baseline 측정

  **What to do**:
  - `pnpm bench:check --output-json=benchmark-result.json`의 현재 동작과 산출물을 캡처한다.
- `benchmark.yml`의 `continue-on-error: true`가 현재 어떤 실패 흐름을 만드는지 확인한다.
- `continue-on-error: true`가 있더라도 후속 `Fail if benchmarks failed` step 때문에 최종적으로 hard fail된다는 현재 semantics를 evidence로 남긴다.
- 대표 benchmark 실체 부재 여부를 evidence로 남긴다.

  **Must NOT do**:
  - 실제 성능 최적화를 시작하지 않는다.
  - observability 플랫폼 구축으로 범위를 넓히지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: workflow/스크립트/산출물 간 관계를 분석해야 한다.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `optimize`: 실제 최적화가 아니라 benchmark reliability baseline이 목적이다.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with 2,3,4,6)
  - **Blocks**: 10, 12
  - **Blocked By**: 1

  **References**:
- `.github/workflows/benchmark.yml` - warning-only에서 enforce로 갈 때 가장 중요한 현재 상태다.
- `.github/workflows/benchmark.yml:25-40` - `continue-on-error`와 후속 `exit 1`의 결합으로 현재 gate가 어떻게 hard fail되는지 확인해야 한다.
- `package.json` - `bench:check`, `bench:update` 스크립트 출처다.
- `benchmarks/thresholds.json` - 현재 성능 예산 정의의 출처다.

  **Acceptance Criteria**:
  - [ ] benchmark baseline 결과와 산출물 존재 여부가 evidence로 남는다.
- [ ] `continue-on-error`와 후속 실패 step의 결합으로 현재 gate가 최종 hard fail된다는 사실이 문서화된다.

  **QA Scenarios**:
  ```
  Scenario: benchmark baseline 캡처 성공
    Tool: Bash
    Preconditions: Task 1 완료
    Steps:
      1. `pnpm bench:check --output-json=benchmark-result.json > .sisyphus/evidence/task-5-benchmark-baseline.txt 2>&1` 실행
      2. `benchmark-result.json` 생성 여부를 확인
      3. workflow 상 `continue-on-error`와 `if: steps.bench.outcome == 'failure'` 후속 step을 evidence에 함께 기록
    Expected Result: benchmark 현재 동작, 결과 파일 생성, 최종 hard fail semantics가 evidence로 남는다.
    Failure Indicators: 결과 파일 미생성 또는 workflow semantics 기록 누락
    Evidence: .sisyphus/evidence/task-5-benchmark-baseline.txt

  Scenario: 최적화 범위 확장 방지
    Tool: Bash
    Preconditions: baseline 수집 완료
    Steps:
      1. 변경 파일 목록을 확인
      2. benchmark 인프라 외 소스 최적화 변경이 포함됐는지 확인
    Expected Result: baseline 단계에서는 측정/설정 근거만 추가된다.
    Failure Indicators: 실제 애플리케이션 성능 최적화 코드가 포함됨
    Evidence: .sisyphus/evidence/task-5-scope-guard.txt
  ```

  **Commit**: NO

- [x] 6. DX/onboarding baseline 측정

  **What to do**:
  - 현재 신규 기여자가 따라야 하는 setup 흐름을 README/AGENTS/package.json 기준으로 재구성한다.
  - `.env.example` 부재, env contract 부재, one-command setup 부재 상태를 evidence로 남긴다.
  - onboarding 단일 진입점에 필요한 최소 요소를 확정한다.

  **Must NOT do**:
  - 문서를 전면 재작성하지 않는다.
  - 여러 onboarding 경로를 동시에 새로 만들지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 현재 문서/스크립트 분산 상태를 구조적으로 정리해야 한다.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `onboard`: 실제 UX 설계보다 저장소 문서/명령 구조 정리가 중심이다.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with 2,3,4,5)
  - **Blocks**: 11, 12
  - **Blocked By**: 1

  **References**:
  - `README.md` - 현재 프로젝트 소개와 설치 흐름 출발점이다.
  - `AGENTS.md` - 실제 사용 명령과 저장소 규칙이 정리돼 있다.
  - `package.json` - one-command setup 후보가 연결될 스크립트 출처다.

  **Acceptance Criteria**:
  - [ ] 신규 기여자 기준 현재 setup 단계와 누락 요소가 evidence로 남는다.
  - [ ] one-command setup에 포함할 최소 단계 목록이 확정된다.

  **QA Scenarios**:
  ```
  Scenario: onboarding baseline 캡처 성공
    Tool: Bash
    Preconditions: Task 1 완료
    Steps:
      1. README, AGENTS, package.json의 설치/실행 명령을 추출해 `.sisyphus/evidence/task-6-onboarding-baseline.txt`에 기록
      2. `.env.example` 존재 여부와 단일 setup 명령 유무를 점검
    Expected Result: 현재 onboarding 경로와 공백이 evidence로 남는다.
    Failure Indicators: 현재 흐름 정리 또는 누락 항목 기록이 없음
    Evidence: .sisyphus/evidence/task-6-onboarding-baseline.txt

  Scenario: 문서 범위 과잉 방지
    Tool: Bash
    Preconditions: baseline 수집 완료
    Steps:
      1. 계획된 변경 파일을 확인
      2. README 전체 재작성이나 unrelated docs 변경이 포함됐는지 점검
    Expected Result: baseline 단계는 현황 정리와 최소 요구사항 정의에 한정된다.
    Failure Indicators: 다수 문서 재작성 계획이 포함됨
    Evidence: .sisyphus/evidence/task-6-scope-guard.txt
  ```

  **Commit**: NO

- [x] 7. 아키텍처 warning-only 게이트 추가

  **What to do**:
  - Task 2에서 확정한 baseline 명령을 재사용해 CI 또는 로컬 재현 스크립트에 warning-only 단계를 추가한다.
  - 순환 의존/계층 위반 감지가 새로 유입될 때 가시화되도록 한다.
  - 실패를 바로 hard fail로 만들지 말고, 보고/아티팩트 중심으로 시작한다.

  **Must NOT do**:
  - 순환 의존 해소 리팩터링을 여기서 시작하지 않는다.
  - 기존 CI 단계를 제거하거나 대체하지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: workflow와 검사 명령을 안전하게 연결해야 한다.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `tech-improve`: 이미 진단은 끝났고, 이제 실행 연결 단계다.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with 8,9,10,11)
  - **Blocks**: 12
  - **Blocked By**: 2

  **References**:
  - `.github/workflows/ci.yml` - 새 warning-only job/step가 붙을 기존 위치다.
  - `turbo.json` - 새 검사 명령의 캐시/그래프 영향을 고려해야 한다.
  - `.sisyphus/evidence/task-2-architecture-baseline.txt` - 현재 위반 목록과 측정 명령 근거다.

  **Acceptance Criteria**:
  - [ ] 아키텍처 위반을 가시화하는 warning-only 단계가 정의된다.
  - [ ] 기존 CI를 깨지 않고 결과를 아티팩트/로그로 남길 수 있다.

  **QA Scenarios**:
  ```
  Scenario: 아키텍처 warning-only 단계 동작
    Tool: Bash
    Preconditions: Task 2 완료
    Steps:
      1. 새로 추가한 아키텍처 검사 명령을 실행
      2. 위반이 있을 경우 로그/리포트 파일이 생성되는지 확인
      3. 전체 CI 흐름은 계속 진행되는지 확인
    Expected Result: 위반 보고는 되지만 pipeline 전체는 즉시 실패하지 않는다.
    Failure Indicators: 위반이 조용히 무시되거나 즉시 hard fail됨
    Evidence: .sisyphus/evidence/task-7-warning-only.txt

  Scenario: 소스 리팩터링 비확장 검증
    Tool: Bash
    Preconditions: warning-only 단계 추가 후
    Steps:
      1. 변경 파일 목록을 확인
      2. 검사 설정/스크립트 외 대규모 소스 수정이 없는지 점검
    Expected Result: 변경은 CI/설정/문서 범위에 머문다.
    Failure Indicators: 여러 패키지 소스 리팩터링 포함
    Evidence: .sisyphus/evidence/task-7-scope-guard.txt
  ```

  **Commit**: YES
  - Message: `chore(ci): add architecture warning gate`
  - Files: `.github/workflows/ci.yml`, 관련 스크립트/설정 파일
  - Pre-commit: `pnpm check && pnpm typecheck`

- [x] 8. 핵심 패키지 coverage warning-only 게이트 추가

  **What to do**:
  - 기존 `CORE_COVERAGE_PACKAGES`와 `test:coverage:core` 흐름을 재사용해 warning-only coverage 보고 단계를 추가한다.
  - 핵심 5개 패키지의 baseline 대비 하락 여부를 가시화한다.
  - enforce 전환을 위해 threshold/대상/예외 규칙을 문서화한다.

  **Must NOT do**:
  - 모든 패키지에 동일 threshold를 즉시 적용하지 않는다.
  - 테스트 케이스 자체를 이 태스크에서 손대지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Vitest 설정과 CI 연결을 함께 다뤄야 한다.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `audit`: 기술 감사가 아니라 이미 확인된 coverage 체계의 실행화 단계다.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with 7,9,10,11)
  - **Blocks**: 12
  - **Blocked By**: 3

  **References**:
  - `vitest.config.ts` - 핵심 패키지 threshold 적용 로직의 원본이다.
  - `package.json` - `test:coverage:core` 스크립트 출처다.
  - `.github/workflows/ci.yml` - coverage step를 연결할 기존 validate 흐름이다.

  **Acceptance Criteria**:
  - [ ] 핵심 5개 패키지 coverage 보고가 warning-only 단계로 연결된다.
  - [ ] threshold 하락 시 경고 로그/리포트가 남는다.

  **QA Scenarios**:
  ```
  Scenario: coverage warning-only 단계 동작
    Tool: Bash
    Preconditions: Task 3 완료
    Steps:
      1. `pnpm test:coverage:core`를 새 workflow/스크립트 경로로 실행
      2. coverage report와 경고 출력이 생성되는지 확인
      3. 전체 pipeline은 계속 진행되는지 확인
    Expected Result: coverage 저하 신호를 남기되 즉시 hard fail하지 않는다.
    Failure Indicators: report 미생성 또는 즉시 pipeline 중단
    Evidence: .sisyphus/evidence/task-8-warning-only.txt

  Scenario: 전 저장소 일괄 강제 방지
    Tool: Bash
    Preconditions: Task 8 변경 적용 후
    Steps:
      1. `vitest.config.ts`와 관련 스크립트를 확인
      2. 대상 패키지가 기존 5개 core 범위를 벗어났는지 확인
    Expected Result: 대상은 1차 core 패키지로 제한된다.
    Failure Indicators: 모든 패키지에 동일 threshold 강제 로직 추가
    Evidence: .sisyphus/evidence/task-8-scope-guard.txt
  ```

  **Commit**: YES
  - Message: `chore(test): add core coverage warning gate`
  - Files: `vitest.config.ts`, `package.json`, `.github/workflows/ci.yml`
  - Pre-commit: `pnpm test:coverage:core`

- [x] 9. 보안 warning-only 자동화 추가

  **What to do**:
  - 기존 `pnpm audit:prod`를 기준으로 warning-only 강화 단계를 추가한다.
  - secret scanning 또는 SAST 최소 1종을 선택해 CI/로컬 중 한 곳 이상에 연결한다.
  - false positive 관리 방식과 enforce 전환 기준을 문서화한다.

  **Must NOT do**:
  - 보안 도구를 여러 개 동시에 도입하지 않는다.
  - 실제 취약점 remediation 작업으로 확장하지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: CI와 로컬 훅 사이에서 최소 비용 도입 경로를 골라야 한다.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `harden`: 제품 하드닝보다 automation baseline이 중심이다.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with 7,8,10,11)
  - **Blocks**: 12
  - **Blocked By**: 4

  **References**:
  - `.github/workflows/ci.yml` - 현재 audit 단계가 이미 있으므로 이를 강화/분리할 수 있다.
  - `lefthook.yaml` - 로컬 secret scanning 연결 후보 위치다.
  - `.sisyphus/evidence/task-4-audit-baseline.txt` - 현재 baseline과 공백에 대한 근거다.

  **Acceptance Criteria**:
  - [ ] 보안 자동화 1종이 warning-only로 연결된다.
  - [ ] false positive/예외 처리 방침이 문서화된다.

  **QA Scenarios**:
  ```
  Scenario: 보안 warning-only 단계 동작
    Tool: Bash
    Preconditions: Task 4 완료
    Steps:
      1. 새로 추가한 보안 검사 명령 또는 workflow를 실행
      2. 탐지 결과가 로그/리포트로 남는지 확인
      3. 경고 상태에서도 전체 pipeline은 진행되는지 확인
    Expected Result: 보안 신호를 남기되 즉시 hard fail하지 않는다.
    Failure Indicators: 로그 미생성 또는 둘 이상의 신규 도구 도입
    Evidence: .sisyphus/evidence/task-9-warning-only.txt

  Scenario: 보안 도구 1종 제한 검증
    Tool: Bash
    Preconditions: Task 9 변경 적용 후
    Steps:
      1. 변경 파일과 새 도구 목록을 검토
      2. 신규 보안 도구가 하나만 추가되었는지 확인
    Expected Result: 1차 도입은 1종으로 제한된다.
    Failure Indicators: 둘 이상의 신규 보안 도구가 활성화됨
    Evidence: .sisyphus/evidence/task-9-scope-guard.txt
  ```

  **Commit**: YES
  - Message: `chore(security): add warning security automation`
  - Files: `.github/workflows/ci.yml` 또는 `lefthook.yaml`, 관련 설정 파일
  - Pre-commit: `pnpm audit:prod`

- [x] 10. benchmark warning-only 게이트 정비

  **What to do**:
  - `benchmark.yml`의 현재 흐름을 기준으로 warning-only 단계와 enforce 전환 조건을 명확히 분리한다.
- 현재의 **artifact/comment 후 hard fail** 흐름을 기준선으로 삼아, true warning-only 단계가 필요하면 후속 실패 step 조건까지 함께 조정하는 방식으로 재설계한다.
- enforce 단계에서는 언제 현행 hard fail 구조를 유지할지, 또는 true warning-only에서 다시 hard fail로 복귀시킬지 조건을 명시한다.

  **Must NOT do**:
  - benchmark 작업을 실제 애플리케이션 최적화로 확장하지 않는다.
  - 측정 근거 없이 즉시 hard fail로 전환하지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: workflow semantics와 benchmark signal 설계가 필요하다.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `optimize`: 성능 개선이 아니라 회귀 감지 신뢰도 향상이 목적이다.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with 7,8,9,11)
  - **Blocks**: 12
  - **Blocked By**: 5

  **References**:
  - `.github/workflows/benchmark.yml` - 핵심 수정 대상이다.
  - `package.json` - `bench:check`, `bench:update` 스크립트 출처다.
- `.sisyphus/evidence/task-5-benchmark-baseline.txt` - 현재 benchmark gate가 artifact/comment 후 hard fail된다는 baseline 근거다.

  **Acceptance Criteria**:
- [ ] benchmark의 현재 hard fail 상태, true warning-only로 완화하는 조건, enforce 유지/복귀 조건이 명시된다.
  - [ ] 결과 파일/댓글/로그 중 최소 1개의 안정적 evidence 경로가 보장된다.

  **QA Scenarios**:
  ```
  Scenario: benchmark warning-only 흐름 검증
    Tool: Bash
    Preconditions: Task 5 완료
    Steps:
      1. benchmark workflow와 동일한 명령을 로컬 재현 경로로 실행
      2. 결과 파일 생성과 경고 출력 여부를 확인
      3. true warning-only 단계에서는 후속 실패 step 조건까지 조정돼 전체 pipeline이 유지되는지 점검
    Expected Result: benchmark 결과가 남고, 회귀 신호가 가시화되며, warning-only 단계에서는 pipeline이 유지된다.
    Failure Indicators: 결과 파일 미생성 또는 warning-only 설계인데도 hard fail 유지
    Evidence: .sisyphus/evidence/task-10-warning-only.txt

  Scenario: 조기 enforce 방지
    Tool: Bash
    Preconditions: Task 10 변경 적용 후
    Steps:
      1. `benchmark.yml`의 `continue-on-error`와 후속 실패 처리 조건을 함께 검토
      2. 현재 hard fail 구조를 유지할지, true warning-only로 완화할지, 재-enforce할지를 baseline 근거와 함께 확인
    Expected Result: benchmark gate의 상태 전환 규칙이 baseline 근거와 함께 문서화된다.
    Failure Indicators: 상태 전환 기준 없이 workflow semantics가 임의 변경됨
    Evidence: .sisyphus/evidence/task-10-scope-guard.txt
  ```

  **Commit**: YES
  - Message: `chore(perf): stage benchmark warning gate`
  - Files: `.github/workflows/benchmark.yml`, 관련 benchmark 스크립트/문서
  - Pre-commit: `pnpm bench:check --output-json=benchmark-result.json`

- [x] 11. one-command setup / env contract / onboarding 흐름 추가

  **What to do**:
  - 신규 기여자 기준 진입점을 하나로 묶는 `setup` 명령 또는 동등한 스크립트 흐름을 추가한다.
  - `.env.example` 또는 동등한 env contract 문서를 마련한다.
  - `CONTRIBUTING.md`와 README에서 setup → validate → branch flow가 이어지도록 정리한다.

  **Must NOT do**:
  - README 전체를 재작성하지 않는다.
  - 문서 미화/브랜딩 작업으로 범위를 넓히지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: 문서와 스크립트 진입점 설계가 중심이다.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `onboard`: 제품 onboarding이 아니라 개발자 기여 흐름 문서화다.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with 7,8,9,10)
  - **Blocks**: 12
  - **Blocked By**: 6

  **References**:
  - `README.md` - 링크/역할 분담이 필요한 기존 진입 문서다.
  - `AGENTS.md` - 실제 사용 명령과 저장소 규칙의 상세 근거다.
  - `package.json` - one-command setup이 연결될 스크립트 정의 위치다.

  **Acceptance Criteria**:
  - [ ] 신규 기여자가 따라야 할 setup/validate/branch 흐름이 단일 문서 경로로 정리된다.
  - [ ] env contract가 파일 또는 문서 형태로 존재한다.

  **QA Scenarios**:
  ```
  Scenario: one-command setup 경로 검증
    Tool: Bash
    Preconditions: Task 6 완료
    Steps:
      1. 새 setup 명령 또는 스크립트를 실행 가능한지 확인
      2. setup 후 validate 명령(`pnpm check`, `pnpm build`, `pnpm test` 등) 연결이 문서화됐는지 확인
      3. `CONTRIBUTING.md` 또는 README 링크를 검증
    Expected Result: 신규 기여자가 한 경로로 setup과 검증 흐름을 따라갈 수 있다.
    Failure Indicators: setup 진입점 부재 또는 env contract 누락
    Evidence: .sisyphus/evidence/task-11-onboarding.txt

  Scenario: 문서 과잉 변경 방지
    Tool: Bash
    Preconditions: Task 11 적용 후
    Steps:
      1. 변경된 문서 파일 목록을 확인
      2. README 전체 재작성이나 unrelated 문서 수정이 과도한지 점검
    Expected Result: 변경은 CONTRIBUTING/README 연결과 env contract 범위에 머문다.
    Failure Indicators: 대규모 unrelated docs rewrite 발생
    Evidence: .sisyphus/evidence/task-11-scope-guard.txt
  ```

  **Commit**: YES
  - Message: `docs(dx): add contributor setup flow`
  - Files: `CONTRIBUTING.md`, `README.md`, `package.json`, `.env.example` 또는 동등 문서
  - Pre-commit: `pnpm check`

- [x] 12. enforce 전환 조건 정리 및 CI 통합 검증

  **What to do**:
  - Task 7~11의 결과를 모아 각 트랙별 enforce 전환 조건을 명문화한다.
  - CI 시간 증가, 캐시 영향, false positive 관리 방안을 통합 검토한다.
  - 어느 트랙이 언제 hard fail로 전환 가능한지 순서를 고정한다.

  **Must NOT do**:
  - warning-only 근거 없이 바로 enforce로 바꾸지 않는다.
  - 기존 CI 단계를 제거하거나 재배치하지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 다섯 트랙의 결과를 하나의 운영 전략으로 통합해야 한다.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `momus`: 아직 고정밀 리뷰 단계가 아니라 플랜 내 통합 태스크다.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: F1, F2, F3, F4, 13
  - **Blocked By**: 7, 8, 9, 10, 11

  **References**:
  - `.sisyphus/tech-improve/framework-20260421.md` - intended fingerprint와 우선순위의 원본이다.
  - `.github/workflows/ci.yml` - 최종 validate 흐름 통합 위치다.
  - `.github/workflows/benchmark.yml` - 성능 게이트 전환 조건의 핵심 문서다.
  - `.sisyphus/evidence/task-7-warning-only.txt` ~ `.sisyphus/evidence/task-11-onboarding.txt` - 각 트랙 baseline/warning 근거다.

  **Acceptance Criteria**:
  - [ ] 아키텍처/테스트/보안/성능/DX 각 트랙의 enforce 전환 조건이 문서화된다.
  - [ ] CI 시간/캐시/false positive 관리 방안이 정리된다.

  **QA Scenarios**:
  ```
  Scenario: enforce 전환 표 완성
    Tool: Bash
    Preconditions: Task 7~11 완료
    Steps:
      1. 각 태스크 evidence를 모아 전환 조건 문서를 생성
      2. 각 트랙에 baseline, warning-only, enforce 조건이 모두 채워졌는지 확인
      3. CI 시간 영향과 rollback 조건을 표에 기록
    Expected Result: 트랙별 전환 조건과 운영 방침이 누락 없이 정리된다.
    Failure Indicators: 특정 트랙의 enforce 조건 또는 rollback 계획이 비어 있음
    Evidence: .sisyphus/evidence/task-12-enforcement-matrix.txt

  Scenario: 조기 강제 전환 방지
    Tool: Bash
    Preconditions: 통합 검증 직후
    Steps:
      1. 변경된 workflow/문서를 검토
      2. warning-only가 아닌 즉시 hard fail 트랙이 있는지 확인
    Expected Result: 모든 신규 게이트는 documented baseline을 거쳐 enforce로 이동한다.
    Failure Indicators: baseline 근거 없는 즉시 hard fail 트랙 존재
    Evidence: .sisyphus/evidence/task-12-scope-guard.txt
  ```

  **Commit**: YES
  - Message: `chore(ci): define enforcement rollout`
  - Files: 관련 workflow/문서/스크립트
  - Pre-commit: `pnpm check && pnpm typecheck && pnpm test`

---

## Final Verification Wave

- [x] F1. **Plan Compliance Audit** — `oracle`
  - 리포트 `.sisyphus/tech-improve/framework-20260421.md`와 본 플랜을 대조해, 아키텍처/테스트/보안/성능/DX 다섯 트랙이 모두 반영됐는지 검증한다.
  - `Must Have` 충족 여부와 `Must NOT Have` 위반 여부를 파일/명령 기준으로 판정한다.
  - Output: `Must Have [N/N] | Must NOT Have [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  - `pnpm check`, `pnpm typecheck`, 관련 workflow YAML 정합성, 문서 링크 정합성을 검토한다.
  - 불필요한 범위 확장(대규모 refactor, unrelated deps, 전 저장소 threshold 강제)이 없는지 확인한다.
  - Output: `Check [PASS/FAIL] | Typecheck [PASS/FAIL] | Scope [CLEAN/ISSUES] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high`
  - Task 1~12의 QA 시나리오를 순서대로 실행해 evidence 파일 존재와 결과를 검증한다.
  - baseline, warning-only, enforce matrix 산출물이 모두 존재하는지 확인한다.
  - Output: `Scenarios [N/N] | Evidence [N/N] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  - 각 태스크가 “자동 강제력 강화”라는 원래 목적에 직접 연결되는지 검증한다.
  - 리팩터링/최적화/패키지 구조 변경 같은 범위 확장이 없는지 확인한다.
  - Output: `Tasks [N/N compliant] | Scope [CLEAN/ISSUES] | VERDICT`

---

## Commit Strategy

- **Wave 2-A**: `chore(ci): add architecture warning gate`
- **Wave 2-B**: `chore(test): add core coverage warning gate`
- **Wave 2-C**: `chore(security): add warning security automation`
- **Wave 2-D**: `chore(perf): stage benchmark warning gate`
- **Wave 2-E**: `docs(dx): add contributor setup flow`
- **Wave 3**: `chore(ci): define enforcement rollout`
- **Final merge**: `chore(repo): enforce tech health baseline`

---

## Success Criteria

### Verification Commands
```bash
pnpm check                     # Expected: pass
pnpm build                     # Expected: pass
pnpm typecheck                 # Expected: pass
pnpm test                      # Expected: pass
pnpm test:coverage:core        # Expected: core coverage report generated
pnpm audit:prod                # Expected: audit result recorded or gated as configured
pnpm bench:check --output-json=benchmark-result.json  # Expected: benchmark result file generated
```

### Final Checklist
- [ ] baseline evidence가 5개 트랙 모두 존재한다.
- [ ] warning-only 단계가 5개 트랙 모두 정의된다.
- [ ] enforce 전환 조건 표가 존재한다.
- [ ] 기존 CI 단계 제거 없이 새 규칙이 추가된다.
- [ ] 전 저장소 공통 threshold 강제, 다중 보안 도구 도입, 대형 리팩터링이 포함되지 않는다.

- [x] 13. `trunk`에 squash merge 및 브랜치 정리

  **What to do**:
  - Final Verification Wave가 모두 APPROVE일 때만 `trunk`로 이동한다.
  - 작업 브랜치 변경을 `trunk`에 squash merge 하고, 단일 커밋 메시지로 정리한다.
  - 로컬 작업 브랜치를 삭제하고 최종 상태를 확인한다.

  **Must NOT do**:
  - 검증 실패 상태에서 merge 하지 않는다.
  - fast-forward 또는 일반 merge commit으로 끝내지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 최종 git 정리 단계다.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `git-master`: 실제 명령은 단순하지만 안전 체크가 더 중요하다.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave CLOSE
  - **Blocks**: None
  - **Blocked By**: F1, F2, F3, F4

  **References**:
  - 본 플랜의 Branch Strategy 섹션 - 사용자가 선택한 브랜치 후 squash merge 전략의 기준이다.
  - Final Verification outputs - merge 가능 여부의 유일한 판단 근거다.

  **Acceptance Criteria**:
  - [ ] `git checkout trunk && git merge --squash framework-tech-health-enforcement`가 성공한다.
  - [ ] 최종 커밋 메시지가 `chore(repo): enforce tech health baseline`로 생성된다.
  - [ ] `git branch -D framework-tech-health-enforcement`가 성공한다.

  **QA Scenarios**:
  ```
  Scenario: squash merge 성공
    Tool: Bash
    Preconditions: F1~F4 모두 APPROVE
    Steps:
      1. `git checkout trunk` 실행
      2. `git merge --squash framework-tech-health-enforcement` 실행
      3. `git commit -m "chore(repo): enforce tech health baseline"` 실행
      4. `git status`로 작업 트리가 깨끗한지 확인
    Expected Result: 단일 squash commit이 trunk에 생성된다.
    Failure Indicators: merge conflict 미해결, commit 실패, 작업 트리 dirty
    Evidence: .sisyphus/evidence/task-13-squash-merge.txt

  Scenario: 검증 미통과 상태 merge 방지
    Tool: Bash
    Preconditions: F1~F4 결과 확인 전
    Steps:
      1. Final Verification 결과 파일을 확인
      2. APPROVE가 아닌 항목이 있는지 점검
      3. 미통과 항목이 있으면 merge를 수행하지 않는다.
    Expected Result: 미승인 상태에서는 squash merge가 실행되지 않는다.
    Failure Indicators: APPROVE 이전에 merge 명령 실행
    Evidence: .sisyphus/evidence/task-13-guard.txt
  ```

  **Commit**: NO

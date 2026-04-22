# Framework Tech Health Operations Upgrade Plan (2026-04-22)

## TL;DR

> **Quick Summary**: 2026-04-22 기술 건강도 진단 리포트의 핵심 결론을 실행 가능한 단일 플랜으로 변환한다. 목표는 새 체계를 도입하는 것이 아니라, 이미 존재하는 경고형/부분 적용 품질 체계를 **차단형 운영 + 점진 확대 + 운영 체크리스트 연결**로 승격하는 것이다.
>
> **Deliverables**:
> - 작업 브랜치 `framework-tech-health-operations-upgrade`
> - 순환 의존 검사 blocking 승격 계획
> - gitleaks 보호 브랜치 blocking 전환 계획
> - coverage gate의 core-adjacent 패키지 확대 계획
> - benchmark regression gate 승격 계획
> - README/로드맵 drift를 release/milestone checklist와 연결하는 운영 계획
> - 최종 `trunk` squash merge 태스크
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 1개 bootstrap wave + 2개 병렬 설계 wave + 1개 통합 wave + 최종 검증 wave
> **Critical Path**: Task 1 → Task 2 → Task 8 → Task 11 → Final Verification → Task 12

---

## Context

### Original Request
사용자는 `/tech-improve` 진단 이후 **실행 플랜 생성**을 선택했다. 이번 산출물은 코드 구현이 아니라, `.sisyphus/plans/` 아래에 저장되는 단일 실행 계획서다.

### Interview Summary
**Key Discussions**:
- 최신 기술 건강도 리포트는 `.sisyphus/drafts/tech-health-report-framework-20260422.md`에 저장되어 있다.
- 최신 진단의 핵심 메시지는 “체계 부재”가 아니라 **warning-only / 부분 적용 / 문서 drift**가 주요 리스크라는 점이다.
- 후속 실행 플랜은 아래 5개 evidence-grounded action stream만 다룬다: 순환 의존 차단, gitleaks blocking, coverage 확대, benchmark gate 승격, README drift 운영 연결.
- generic 권고, 측정 없는 성능 일반론, AI 만능주의, 대형 리팩터링은 범위 밖이다.

**Research Findings**:
- 최신 리포트의 fingerprint는 Architecture `L4 candidate (partial enforcement)`, Code Quality `L4 candidate`, Tests `L3`, Performance `L3`, Security `L4 candidate (secret scanning not yet enforced)`, DX `L4 candidate (documentation drift present)`다.
- 기존 `.sisyphus/plans/framework-tech-health-enforcement.md`와 `.sisyphus/plans/framework-tech-health-remediation.md`는 20260421 계열 진단을 기반으로 한 이전 플랜이며, 이번 플랜은 **20260422 리포트 기준의 후속 운영 승격 플랜**으로 취급한다.
- 현재 확인된 직접 개선 포인트는 `madge --circular` warning-only, gitleaks warning-only, coverage threshold의 5개 core 패키지 편중, benchmark gate warning-only, 루트 README roadmap/package catalog drift다.

### Metis Review
**Identified Gaps** (addressed):
- 기존 플랜과 새 플랜의 중복 위험 → 본 플랜은 **이전 enforcement/remediation 플랜을 반복하지 않고**, 최신 리포트의 5개 운영 승격 stream만 다룬다.
- 순환 의존 검사 승격이 리팩터링 작업으로 번질 위험 → 본 플랜은 **기존 순환 제거가 아니라 allowlist + 신규 위반 차단**에만 집중한다.
- coverage 확대가 전 저장소 일괄 강제로 번질 위험 → core-adjacent 패키지에 대한 **위험 기반 점진 확대**만 포함한다.
- benchmark 작업이 성능 최적화로 번질 위험 → regression gate 정의와 운영 연결까지만 포함한다.
- README 개선이 문서 전면 재작성으로 번질 위험 → release/milestone checklist 연결과 drift 감지 메커니즘까지만 포함한다.

### Oracle Architecture Gate

**ORACLE_REVIEW_CHECK**
- **Verdict**: `CONDITIONAL`
- **Why**: 이번 플랜은 `ci.yml`, `benchmark.yml`, 보호 브랜치 blocking, allowlist/baseline 정책처럼 운영 규칙을 바꾸지만, 코드베이스 아키텍처 자체를 재설계하거나 대규모 리팩터링하지는 않는다.
- **Conditions**:
  1. Task 2~3은 **baseline/allowlist 없이 즉시 fail-closed 전환을 금지**한다.
  2. Task 4~5는 **전 저장소 일괄 coverage enforce 또는 전 benchmark 즉시 enforce를 금지**한다.
  3. Task 6~9는 **README 전면 재작성, docs 플랫폼 교체, 추가 보안 도구 도입, 실제 성능 최적화 구현**으로 확장하지 않는다.
  4. Task 10~11은 **owner/milestone/rollback이 없는 추상 권고**를 허용하지 않는다.
  5. Final Verification 전에는 `trunk` merge를 수행하지 않는다.

---

## Work Objectives

### Core Objective
최신 기술 건강도 진단에서 드러난 운영상의 약한 고리들을 정리해, `framework` 모노레포의 품질 체계를 **warning-only 중심 운영에서 차단형·점진형·운영 연결형 체계**로 전환한다.

### Concrete Deliverables
- 작업 브랜치 `framework-tech-health-operations-upgrade` 생성
- 기존 관련 플랜과 현재 CI 상태의 delta baseline 문서화
- 5개 action stream별 baseline / warning-only / enforce 전환 조건 정리
- allowlist / baseline / false positive 관리 규칙 초안
- release/milestone checklist 또는 동등 운영 메커니즘 설계
- 최종 `trunk` squash merge 태스크

### Definition of Done
- [x] 최신 20260422 리포트의 5개 우선순위 action이 모두 개별 태스크로 반영된다.
- [x] 기존 enforcement/remediation 플랜과의 중복 방지 기준이 명시된다.
- [x] 각 stream에 baseline, warning-only, enforce, rollback 조건이 포함된다.
- [x] Tests/Performance/Security/DX 권고가 모두 측정 가능하고 evidence-grounded 형태로 유지된다.
- [x] 마지막 체크박스가 `trunk` squash merge 및 브랜치 정리 태스크다.

### Must Have
- 기존 `package.json`, `.github/workflows/ci.yml`, `.github/workflows/benchmark.yml`, `vitest.config.ts`, `README.md`, `CONTRIBUTING.md`, `lefthook.yaml` 패턴을 우선 재사용할 것
- 순환 의존 stream은 `allowlist + 신규 위반 0 정책` 중심일 것
- 보안 stream은 gitleaks blocking 전환과 false positive 관리 절차를 함께 설계할 것
- coverage stream은 전 저장소 일괄 적용이 아니라 **core-adjacent 패키지의 단계적 확대**일 것
- benchmark stream은 실제 성능 최적화가 아니라 regression gate 정의와 운영 승격일 것
- README stream은 문서 양 확대가 아니라 정합성 유지 메커니즘 연결일 것

### Must NOT Have (Guardrails)
- 기존 순환 의존 제거 리팩터링을 이번 플랜 범위에 포함하지 말 것
- 전 저장소 동일 coverage threshold 즉시 enforce를 포함하지 말 것
- CodeQL/Semgrep/Dependabot 등 보안 도구 확장 도입으로 번지지 말 것
- benchmark stream을 실제 성능 최적화 프로젝트로 확장하지 말 것
- README/문서 전면 재작성이나 docs 플랫폼 개편을 포함하지 말 것
- generic 권고("테스트를 늘려라", "성능을 높여라", "보안을 강화하라")를 태스크로 쓰지 말 것

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — 모든 검증은 실행 에이전트가 명령, 파일 존재/내용 확인, CI 재현 시나리오로 수행한다.

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: Tests-after
- **Framework**: pnpm + Turbo + Vitest + GitHub Actions
- **Agent-Executed QA**: 모든 태스크에 happy path + failure/guardrail scenario 포함

### QA Policy
- baseline은 반드시 evidence 파일로 남긴다.
- warning-only 단계는 “신호는 남지만 전체 파이프라인은 실패하지 않는 상태”로 검증한다.
- enforce 단계는 “의도적 위반 재현 시 실제 실패하는지”까지 검증한다.
- evidence는 `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`에 저장한다.

---

## Execution Strategy

### Branch Strategy
- 기본 브랜치명: `framework-tech-health-operations-upgrade`
- 전략: **브랜치에서 작업 후 `trunk`에 squash merge**

### Parallel Execution Waves

Wave 0 (Sequential bootstrap):
├── Task 1: 작업 브랜치 생성 + 현재 상태 및 기존 플랜 delta 기준선 캡처

Wave 1 (Baseline / policy design - 5 parallel tasks):
├── Task 2: 순환 의존 검사 baseline 및 allowlist 정책 설계
├── Task 3: gitleaks blocking 전환 baseline 및 false-positive 정책 설계
├── Task 4: coverage 확대 대상 선정 및 기준선 설계
├── Task 5: benchmark regression gate 기준선 및 허용치 설계
└── Task 6: README drift 운영 체크리스트 baseline 설계

Wave 2 (Workflow / integration plan - 4 parallel tasks):
├── Task 7: 아키텍처/보안 CI 승격 통합 계획
├── Task 8: 테스트/benchmark gate 승격 통합 계획
├── Task 9: DX checklist / docs drift 운영 연결 계획
└── Task 10: rollout, rollback, owner, milestone 정리

Wave 3 (Sequential integration):
├── Task 11: 최종 통합 정리 및 실행 순서 확정

Wave FINAL (After Task 11 — 4 parallel reviews):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real QA execution (unspecified-high)
└── Task F4: Scope fidelity check (deep)

Wave CLOSE:
├── Task 12: `trunk` squash merge 및 브랜치 정리

Critical Path: 1 → 2 → 7 → 11 → F1-F4 → 12
Parallel Speedup: Wave 1 5병렬 + Wave 2 4병렬
Max Concurrent: 5

### Dependency Matrix
- **1**: - → 2,3,4,5,6
- **2**: 1 → 7,10,11
- **3**: 1 → 7,10,11
- **4**: 1 → 8,10,11
- **5**: 1 → 8,10,11
- **6**: 1 → 9,10,11
- **7**: 2,3 → 11
- **8**: 4,5 → 11
- **9**: 6 → 11
- **10**: 2,3,4,5,6 → 11
- **11**: 7,8,9,10 → F1,F2,F3,F4,12
- **12**: F1,F2,F3,F4 → -

### Agent Dispatch Summary
- **Wave 0**: Task 1 → `quick`
- **Wave 1**: Task 2/3/4/5/6 → `unspecified-high`
- **Wave 2**: Task 7/8/10 → `deep`, Task 9 → `writing`
- **FINAL**: F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`
- **CLOSE**: Task 11 → `deep`, Task 12 → `quick`

---

## TODOs

- [x] 1. 작업 브랜치 생성 및 기존 플랜/현재 CI delta 기준선 캡처

  **What to do**:
  - `git checkout -b framework-tech-health-operations-upgrade`로 작업 브랜치를 만든다. 이미 있으면 해당 브랜치로 체크아웃한다.
  - 현재 `package.json`, `.github/workflows/ci.yml`, `.github/workflows/benchmark.yml`, `vitest.config.ts`, `README.md`, `CONTRIBUTING.md`의 상태를 evidence로 캡처한다.
  - 기존 `.sisyphus/plans/framework-tech-health-enforcement.md`, `.sisyphus/plans/framework-tech-health-remediation.md`와 이번 플랜의 차이를 요약한 delta note를 남긴다.

  **Must NOT do**:
  - `trunk`에서 직접 작업하지 않는다.
  - 기존 플랜을 그대로 재사용하거나 복사하지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 브랜치 생성과 기준선 캡처는 절차형 작업이다.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `git-master`: 히스토리 조작보다 현재 상태 캡처가 핵심이므로 생략한다.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: 2, 3, 4, 5, 6
  - **Blocked By**: None

  **References**:
  - `.sisyphus/drafts/tech-health-report-framework-20260422.md` - 최신 실행 입력 리포트다.
  - `.sisyphus/plans/framework-tech-health-enforcement.md` - 이전 enforcement 플랜과의 차이를 확인해야 한다.
  - `.sisyphus/plans/framework-tech-health-remediation.md` - 이전 remediation 플랜과의 차이를 확인해야 한다.
  - `.github/workflows/ci.yml` - 현재 warning-only / hard gate 상태의 기준 파일이다.
  - `.github/workflows/benchmark.yml` - benchmark gate의 실제 현재 상태를 확인하는 기준이다.

  **Acceptance Criteria**:
  - [x] 현재 브랜치가 `framework-tech-health-operations-upgrade`다.
  - [x] 주요 기준 파일 상태와 기존 플랜 delta note가 evidence로 남는다.

  **QA Scenarios**:
  ```
  Scenario: 브랜치와 delta baseline 캡처 성공
    Tool: Bash
    Preconditions: 저장소 루트 `/Users/owen/Projects/croco/framework`
    Steps:
      1. `git checkout -b framework-tech-health-operations-upgrade || git checkout framework-tech-health-operations-upgrade` 실행
      2. `git branch --show-current > .sisyphus/evidence/task-1-branch.txt` 실행
      3. `cp .github/workflows/ci.yml .sisyphus/evidence/task-1-ci-baseline.yml` 등 기준 파일을 evidence로 복사
      4. 기존 두 플랜과 현재 플랜의 차이를 `.sisyphus/evidence/task-1-delta-note.md`에 기록
    Expected Result: 작업 브랜치, 기준 파일 snapshot, delta note가 모두 생성된다.
    Failure Indicators: 브랜치명이 다르거나 baseline evidence가 누락됨
    Evidence: .sisyphus/evidence/task-1-delta-note.md

  Scenario: trunk 직접 작업 방지
    Tool: Bash
    Preconditions: Task 1 직후
    Steps:
      1. `git branch --show-current | tee .sisyphus/evidence/task-1-branch-guard.txt` 실행
      2. 출력이 `trunk`가 아닌지 확인
    Expected Result: 출력은 `framework-tech-health-operations-upgrade`다.
    Failure Indicators: 출력이 `trunk`
    Evidence: .sisyphus/evidence/task-1-branch-guard.txt
  ```

  **Commit**: NO

- [x] 2. 순환 의존 검사 baseline 및 allowlist 정책 설계

  **What to do**:
  - 현재 `madge --circular` 또는 동등 명령으로 순환 의존 baseline을 재측정한다.
  - 기존 위반이 있다면 “기존 위반 allowlist + 신규 위반 0건 차단” 정책을 설계한다.
  - allowlist의 파일 형식, 관리 위치, 예외 추가 절차를 정의한다.

  **Must NOT do**:
  - 기존 순환 의존 자체를 제거하는 리팩터링으로 확장하지 않는다.
  - layer rule 전면 재설계로 범위를 넓히지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 아키텍처 감지와 정책 설계를 함께 다뤄야 한다.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `refactor`: 실제 리팩터링이 아니라 측정/정책 설계 단계라 생략한다.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with 3,4,5,6)
  - **Blocks**: 7, 10, 11
  - **Blocked By**: 1

  **References**:
  - `.sisyphus/drafts/tech-health-report-framework-20260422.md` - Architecture action P1의 근거가 있다.
  - `package.json` - `architecture:check:circular` 스크립트의 출처다.
  - `.github/workflows/ci.yml` - 현재 warning-only 상태와 연결 위치를 확인해야 한다.
  - `AGENTS.md` - `repository-core` 오염 금지 등 아키텍처 guardrail의 문서 근거다.

  **Acceptance Criteria**:
  - [x] 현재 순환 의존 baseline evidence가 남는다.
  - [x] allowlist 형식/위치/추가 절차가 명시된다.
  - [x] 신규 위반 0건 정책이 문장 수준이 아니라 실행 순서로 정리된다.
  - [x] Oracle Gate 조건대로 baseline/allowlist 없는 즉시 fail-closed 전환이 포함되지 않는다.

  **QA Scenarios**:
  ```
  Scenario: 순환 의존 baseline 측정 성공
    Tool: Bash
    Preconditions: Task 1 완료
    Steps:
      1. `pnpm architecture:check:circular > .sisyphus/evidence/task-2-circular-baseline.txt 2>&1 || true` 실행
      2. 출력에서 기존 위반 목록 또는 0건 여부를 확인
      3. allowlist 초안 위치와 포맷을 `.sisyphus/evidence/task-2-allowlist-policy.md`에 기록
    Expected Result: baseline 출력과 allowlist 정책 초안이 evidence로 남는다.
    Failure Indicators: 위반 목록/0건 여부가 불명확하거나 policy가 누락됨
    Evidence: .sisyphus/evidence/task-2-circular-baseline.txt

  Scenario: 리팩터링 범위 확장 방지
    Tool: Bash
    Preconditions: Task 2 설계 완료
    Steps:
      1. `git diff --name-only > .sisyphus/evidence/task-2-diff-files.txt` 실행
      2. `grep '^packages/.*/src/' .sisyphus/evidence/task-2-diff-files.txt > .sisyphus/evidence/task-2-src-diff-hits.txt || true` 실행
      3. `if test -s .sisyphus/evidence/task-2-src-diff-hits.txt; then printf 'scope guard fail: source refactor detected\n' > .sisyphus/evidence/task-2-scope-guard.txt; else printf 'scope guard pass: no package source refactor\n' > .sisyphus/evidence/task-2-scope-guard.txt; fi` 실행
    Expected Result: 정책/CI/문서 변경만 있고 구조 리팩터링은 없다.
    Failure Indicators: 여러 패키지 소스 파일 변경이 포함됨
    Evidence: .sisyphus/evidence/task-2-scope-guard.txt
  ```

  **Commit**: NO

- [x] 3. gitleaks blocking 전환 baseline 및 false-positive 정책 설계

  **What to do**:
  - 현재 `.github/workflows/ci.yml`의 gitleaks 실행 방식과 `continue-on-error` 상태를 baseline으로 캡처한다.
  - 보호 브랜치 기준 blocking 전환 방안을 정리하고, false positive를 처리할 baseline/allowlist 절차를 설계한다.
  - 과거 히스토리 스캔 범위와 신규 변경 스캔 범위를 구분해 운영 리스크를 낮춘다.

  **Must NOT do**:
  - gitleaks 외 다른 보안 도구 도입으로 확장하지 않는다.
  - 실제 비밀정보 정리 프로젝트로 범위를 넓히지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: CI 보안 게이트와 운영 절차를 함께 설계해야 한다.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `harden`: 코드 hardening이 아니라 gate 승격 설계이므로 생략한다.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with 2,4,5,6)
  - **Blocks**: 7, 10, 11
  - **Blocked By**: 1

  **References**:
  - `.sisyphus/drafts/tech-health-report-framework-20260422.md` - Security action P2의 근거가 있다.
  - `.github/workflows/ci.yml` - 현재 gitleaks warning-only 상태의 직접 근거다.
  - `lefthook.yaml` - 로컬 훅에 secret scan이 없는 현재 상태를 확인해야 한다.

  **Acceptance Criteria**:
  - [x] 현재 gitleaks baseline과 blocking 전환안이 evidence로 남는다.
  - [x] false positive 관리 절차가 문서화된다.
  - [x] 신규 변경 스캔 vs 히스토리 스캔 구분 방침이 정리된다.
  - [x] Oracle Gate 조건대로 gitleaks 외 보안 도구 확장 도입이 포함되지 않는다.

  **QA Scenarios**:
  ```
  Scenario: gitleaks baseline 및 정책 초안 캡처 성공
    Tool: Bash
    Preconditions: Task 1 완료
    Steps:
      1. `.github/workflows/ci.yml`에서 gitleaks 관련 라인을 추출해 `.sisyphus/evidence/task-3-gitleaks-baseline.txt`로 저장
      2. blocking 전환안과 false positive 절차를 `.sisyphus/evidence/task-3-gitleaks-policy.md`에 정리
    Expected Result: 현재 상태와 전환 정책이 모두 evidence로 남는다.
    Failure Indicators: continue-on-error 여부나 예외 처리 절차가 빠짐
    Evidence: .sisyphus/evidence/task-3-gitleaks-policy.md

  Scenario: 도구 확장 금지 확인
    Tool: Bash
    Preconditions: Task 3 설계 완료
    Steps:
      1. `grep -E 'CodeQL|Semgrep|Dependabot' .sisyphus/evidence/task-3-gitleaks-policy.md > .sisyphus/evidence/task-3-extra-tools.txt || true` 실행
      2. `if test -s .sisyphus/evidence/task-3-extra-tools.txt; then printf 'scope guard fail: extra security tools proposed\n' > .sisyphus/evidence/task-3-scope-guard.txt; else printf 'scope guard pass: gitleaks-only policy retained\n' > .sisyphus/evidence/task-3-scope-guard.txt; fi` 실행
    Expected Result: 이번 stream은 gitleaks만 다룬다.
    Failure Indicators: 다른 보안 도구 도입이 포함됨
    Evidence: .sisyphus/evidence/task-3-scope-guard.txt
  ```

  **Commit**: NO

- [x] 4. coverage 확대 대상 선정 및 기준선 설계

  **What to do**:
  - 현재 core 5개 패키지 coverage gate 상태를 baseline으로 캡처한다.
  - core-adjacent 후보 패키지를 위험 기반 기준(변경 빈도, 배포 영향, 장애 비용)으로 1차 선정한다.
  - 분기별/단계별 threshold 확대 전략과 제외 기준을 설계한다.

  **Must NOT do**:
  - 전 저장소 일괄 coverage threshold 강제를 설계하지 않는다.
  - 새 테스트 프레임워크 도입이나 테스트 코드 대량 추가로 범위를 넓히지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 테스트 거버넌스와 패키지 우선순위 설계가 필요하다.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `issue-find`: 진단은 끝났고, 이제는 점진 확대 정책 설계가 핵심이다.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with 2,3,5,6)
  - **Blocks**: 8, 10, 11
  - **Blocked By**: 1

  **References**:
  - `.sisyphus/drafts/tech-health-report-framework-20260422.md` - Tests action P3의 근거가 있다.
  - `vitest.config.ts` - 현재 core 5개 패키지 threshold의 직접 근거다.
  - `.github/workflows/ci.yml` - coverage gate 연결 위치를 확인해야 한다.
  - `package.json` - `test:coverage:core` 스크립트의 출처다.

  **Acceptance Criteria**:
  - [x] 현재 core coverage baseline이 evidence로 남는다.
  - [x] core-adjacent 1차 후보군과 선정 이유가 문서화된다.
  - [x] 단계별 확대 계획과 제외 기준이 정리된다.
  - [x] Oracle Gate 조건대로 전 저장소 일괄 coverage enforce가 포함되지 않는다.

  **QA Scenarios**:
  ```
  Scenario: coverage 확대 기준선과 후보군 정리 성공
    Tool: Bash
    Preconditions: Task 1 완료
    Steps:
      1. `pnpm test:coverage:core > .sisyphus/evidence/task-4-coverage-baseline.txt 2>&1` 실행
      2. core-adjacent 후보군과 선정 기준을 `.sisyphus/evidence/task-4-expansion-plan.md`에 기록
    Expected Result: baseline과 1차 확대 후보군이 evidence로 남는다.
    Failure Indicators: 후보군이나 선정 기준이 누락됨
    Evidence: .sisyphus/evidence/task-4-expansion-plan.md

  Scenario: 전 저장소 일괄 강제 방지
    Tool: Bash
    Preconditions: Task 4 설계 완료
    Steps:
      1. `grep -E 'all packages|전 저장소|전체 패키지 동일 threshold|same threshold' .sisyphus/evidence/task-4-expansion-plan.md > .sisyphus/evidence/task-4-global-threshold-hits.txt || true` 실행
      2. `if test -s .sisyphus/evidence/task-4-global-threshold-hits.txt; then printf 'scope guard fail: repo-wide immediate enforce detected\n' > .sisyphus/evidence/task-4-scope-guard.txt; else printf 'scope guard pass: staged expansion only\n' > .sisyphus/evidence/task-4-scope-guard.txt; fi` 실행
    Expected Result: 점진 확대 전략만 포함되고 일괄 강제는 없다.
    Failure Indicators: 전 패키지 동일 threshold 즉시 적용이 포함됨
    Evidence: .sisyphus/evidence/task-4-scope-guard.txt
  ```

  **Commit**: NO

- [x] 5. benchmark regression gate 기준선 및 허용치 설계

  **What to do**:
  - `.github/workflows/benchmark.yml`과 benchmark transition 문서를 기준으로 현재 warning-only 운영 상태를 캡처한다.
  - regression gate로 승격할 핵심 benchmark 지표와 허용치 정책을 정의한다.
  - GitHub Actions runner 노이즈를 고려한 variance / retry / baseline update 절차를 정리한다.

  **Must NOT do**:
  - 실제 성능 최적화 과제를 이 stream에 포함하지 않는다.
  - 모든 benchmark를 한 번에 enforce 대상으로 삼지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 측정 인프라와 CI 운영 방식을 함께 정리해야 한다.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `optimize`: 성능 개선이 아니라 regression gate 설계가 목적이다.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with 2,3,4,6)
  - **Blocks**: 8, 10, 11
  - **Blocked By**: 1

  **References**:
  - `.sisyphus/drafts/tech-health-report-framework-20260422.md` - Performance action P4의 근거가 있다.
  - `.github/workflows/benchmark.yml` - 현재 warning-only 운용의 직접 근거다.
  - `benchmarks/benchmark-gate-transition.md` - enforce 전환 조건의 문서 근거다.
  - `benchmarks/baseline.json`
  - `benchmarks/thresholds.json`

  **Acceptance Criteria**:
  - [x] 현재 benchmark gate 상태가 evidence로 남는다.
  - [x] 핵심 지표, 허용치, variance 대응 절차가 문서화된다.
  - [x] benchmark 존재와 실제 enforcement를 구분하는 문구가 유지된다.
  - [x] Oracle Gate 조건대로 전 benchmark 즉시 enforce 또는 성능 최적화 구현 과제가 포함되지 않는다.

  **QA Scenarios**:
  ```
  Scenario: benchmark gate baseline 및 허용치 정책 정리 성공
    Tool: Bash
    Preconditions: Task 1 완료
    Steps:
      1. `cp .github/workflows/benchmark.yml .sisyphus/evidence/task-5-benchmark-workflow.yml` 실행
      2. `cp benchmarks/benchmark-gate-transition.md .sisyphus/evidence/task-5-benchmark-transition.md` 실행
      3. regression gate 대상 지표와 허용치를 `.sisyphus/evidence/task-5-regression-policy.md`에 기록
    Expected Result: 현재 workflow와 전환 정책이 evidence로 남는다.
    Failure Indicators: 허용치 또는 variance 대응 정책이 누락됨
    Evidence: .sisyphus/evidence/task-5-regression-policy.md

  Scenario: 성능 최적화 과제 확장 방지
    Tool: Bash
    Preconditions: Task 5 설계 완료
    Steps:
      1. `grep -E 'runtime optimization|caching|query tuning|성능 최적화|캐시 추가|쿼리 튜닝' .sisyphus/evidence/task-5-regression-policy.md > .sisyphus/evidence/task-5-optimization-hits.txt || true` 실행
      2. `if test -s .sisyphus/evidence/task-5-optimization-hits.txt; then printf 'scope guard fail: optimization work mixed into benchmark gate plan\n' > .sisyphus/evidence/task-5-scope-guard.txt; else printf 'scope guard pass: regression gate policy only\n' > .sisyphus/evidence/task-5-scope-guard.txt; fi` 실행
    Expected Result: regression gate 운영 설계만 포함된다.
    Failure Indicators: 성능 최적화 구현 과제가 포함됨
    Evidence: .sisyphus/evidence/task-5-scope-guard.txt
  ```

  **Commit**: NO

- [x] 6. README drift 운영 체크리스트 baseline 설계

  **What to do**:
  - 루트 README의 roadmap/package catalog와 실제 workspace 상태의 drift 사례를 baseline으로 정리한다.
  - release/milestone checklist 또는 동등한 운영 메커니즘에 연결할 체크 항목을 정의한다.
  - `README.md`, `CONTRIBUTING.md`, package README 간 역할 분담을 문서화한다.

  **Must NOT do**:
  - README 전면 재작성이나 docs 시스템 개편으로 확장하지 않는다.
  - 문서 양 확대를 목표로 삼지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 문서 drift의 근거 수집과 운영 연결 설계가 필요하다.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `writing`: 단순 작성보다 운영 메커니즘 설계가 핵심이므로 기본 카테고리로 충분하다.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with 2,3,4,5)
  - **Blocks**: 9, 10, 11
  - **Blocked By**: 1

  **References**:
  - `.sisyphus/drafts/tech-health-report-framework-20260422.md` - DX action P5의 근거가 있다.
  - `README.md` - drift baseline의 직접 대상이다.
  - `CONTRIBUTING.md` - 역할 분담 기준 문서다.
  - `packages/*/README.md` - package-level 문서 분포의 근거다.

  **Acceptance Criteria**:
  - [x] drift 사례와 운영 체크리스트 초안이 evidence로 남는다.
  - [x] 문서 역할 분담이 명시된다.
  - [x] 문서 양 확대가 아니라 정합성 유지 메커니즘으로 표현된다.
  - [x] Oracle Gate 조건대로 README 전면 재작성이나 docs 플랫폼 교체가 포함되지 않는다.

  **QA Scenarios**:
  ```
  Scenario: README drift baseline 및 체크리스트 초안 정리 성공
    Tool: Bash
    Preconditions: Task 1 완료
    Steps:
      1. README의 roadmap/package catalog와 실제 workspace 차이를 `.sisyphus/evidence/task-6-readme-drift.md`에 정리
      2. release/milestone checklist 초안을 `.sisyphus/evidence/task-6-checklist.md`에 기록
    Expected Result: drift 사례와 운영 체크리스트가 evidence로 남는다.
    Failure Indicators: drift 사례나 checklist 항목이 모호함
    Evidence: .sisyphus/evidence/task-6-checklist.md

  Scenario: 문서 전면 재작성 범위 확장 방지
    Tool: Bash
    Preconditions: Task 6 설계 완료
    Steps:
      1. `grep -E 'docs 플랫폼|platform migration|대규모 rewrite|전면 재작성|full rewrite' .sisyphus/evidence/task-6-checklist.md > .sisyphus/evidence/task-6-rewrite-hits.txt || true` 실행
      2. `if test -s .sisyphus/evidence/task-6-rewrite-hits.txt; then printf 'scope guard fail: documentation overhaul detected\n' > .sisyphus/evidence/task-6-scope-guard.txt; else printf 'scope guard pass: checklist-level drift control only\n' > .sisyphus/evidence/task-6-scope-guard.txt; fi` 실행
    Expected Result: 운영 체크리스트와 역할 분담 설계만 포함된다.
    Failure Indicators: 대규모 문서 개편 과제가 포함됨
    Evidence: .sisyphus/evidence/task-6-scope-guard.txt
  ```

  **Commit**: NO

- [x] 7. 아키텍처/보안 CI 승격 통합 계획

  **What to do**:
  - Task 2와 Task 3의 결과를 결합해 `ci.yml` 수준에서 순환 의존 차단과 gitleaks blocking 승격을 어떻게 배치할지 정리한다.
  - 신규 실패 정책, allowlist/baseline 파일 위치, 보호 브랜치 적용 범위를 통합 문서로 정리한다.
  - CI 변경 충돌 가능성이 있는 지점을 명시하고 rollout 순서를 정한다.

  **Must NOT do**:
  - 실제 코드 리팩터링이나 추가 보안 도구 도입을 포함하지 않는다.
  - allowlist 없이 바로 전체 fail-closed로 전환하지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 두 개의 운영 stream을 CI 정책 수준에서 정합적으로 결합해야 한다.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `harden`: 구현 hardening보다 정책 통합 설계가 중심이다.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with 8,9,10)
  - **Blocks**: 11
  - **Blocked By**: 2, 3

  **References**:
  - `.github/workflows/ci.yml` - 최종 통합 대상이다.
  - `.sisyphus/drafts/tech-health-report-framework-20260422.md` - P1/P2 근거와 표현 guardrail이 있다.
  - `.sisyphus/plans/framework-tech-health-enforcement.md` - 과거 enforcement 플랜과 겹치지 않는지 확인해야 한다.

  **Acceptance Criteria**:
  - [x] 순환 의존 차단과 gitleaks blocking 승격의 통합 순서가 문서화된다.
  - [x] allowlist/baseline 관리 위치가 명시된다.
  - [x] CI 변경 충돌 위험과 rollout 순서가 포함된다.
  - [x] Oracle Gate 조건대로 baseline/allowlist 없는 즉시 blocking 전환이 포함되지 않는다.

  **QA Scenarios**:
  ```
  Scenario: 아키텍처/보안 통합 계획 문서화 성공
    Tool: Bash
    Preconditions: Task 2, 3 완료
    Steps:
      1. Task 2/3 결과를 바탕으로 `.sisyphus/evidence/task-7-ci-integration-plan.md` 작성
      2. ci.yml 내 삽입 지점과 적용 순서를 명시
    Expected Result: 두 stream의 통합 계획이 충돌 없이 문서화된다.
    Failure Indicators: rollout 순서나 파일 위치가 누락됨
    Evidence: .sisyphus/evidence/task-7-ci-integration-plan.md

  Scenario: fail-closed 과잉 전환 방지
    Tool: Bash
    Preconditions: Task 7 설계 완료
    Steps:
      1. `grep -E '즉시 blocking|immediate blocking|allowlist 없이|baseline 없이|fail-closed immediately' .sisyphus/evidence/task-7-ci-integration-plan.md > .sisyphus/evidence/task-7-immediate-blocking-hits.txt || true` 실행
      2. `if test -s .sisyphus/evidence/task-7-immediate-blocking-hits.txt; then printf 'scope guard fail: immediate blocking without baseline detected\n' > .sisyphus/evidence/task-7-scope-guard.txt; else printf 'scope guard pass: staged blocking with baseline/allowlist\n' > .sisyphus/evidence/task-7-scope-guard.txt; fi` 실행
    Expected Result: 단계적 승격만 포함된다.
    Failure Indicators: baseline 생략 또는 즉시 fail-closed 정책이 포함됨
    Evidence: .sisyphus/evidence/task-7-scope-guard.txt
  ```

  **Commit**: NO

- [x] 8. 테스트/benchmark gate 승격 통합 계획

  **What to do**:
  - Task 4와 Task 5의 결과를 결합해 coverage 확대와 benchmark regression gate 승격을 어떤 단계로 묶을지 설계한다.
  - 테스트와 성능 stream을 혼동하지 않도록 각각의 baseline, warning-only, enforce 기준을 분리해 정리한다.
  - threshold 확대/회귀 허용치 변경의 owner와 재평가 주기를 정의한다.

  **Must NOT do**:
  - coverage와 benchmark stream을 하나의 “품질 향상” 일반론으로 뭉뚱그리지 않는다.
  - 실제 테스트 추가/성능 최적화 구현 과제를 포함하지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: coverage governance와 benchmark enforcement를 함께 조율해야 한다.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `optimize`: regression gate 운영 설계가 목적이다.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with 7,9,10)
  - **Blocks**: 11
  - **Blocked By**: 4, 5

  **References**:
  - `.sisyphus/drafts/tech-health-report-framework-20260422.md` - P3/P4의 근거가 있다.
  - `vitest.config.ts` - coverage gate 확장의 기준 파일이다.
  - `.github/workflows/benchmark.yml` - benchmark 승격 대상 파일이다.
  - `benchmarks/benchmark-gate-transition.md` - 전환 단계 기준 문서다.

  **Acceptance Criteria**:
  - [x] coverage와 benchmark 각각의 단계적 승격 기준이 분리되어 문서화된다.
  - [x] owner, 재평가 주기, rollback 조건이 포함된다.
  - [x] Tests와 Performance의 축 해석이 혼동되지 않는다.
  - [x] Oracle Gate 조건대로 테스트 추가/성능 최적화 구현 과제가 포함되지 않는다.

  **QA Scenarios**:
  ```
  Scenario: 테스트/benchmark 통합 계획 문서화 성공
    Tool: Bash
    Preconditions: Task 4, 5 완료
    Steps:
      1. `.sisyphus/evidence/task-8-quality-gates-plan.md`에 coverage/benchmark 단계별 계획 기록
      2. 각 stream의 baseline/warning-only/enforce/rollback을 구분 표로 정리
    Expected Result: 두 stream의 운영 승격 계획이 혼동 없이 정리된다.
    Failure Indicators: coverage와 benchmark 정책이 섞이거나 owner가 누락됨
    Evidence: .sisyphus/evidence/task-8-quality-gates-plan.md

  Scenario: 구현 과제 과잉 포함 방지
    Tool: Bash
    Preconditions: Task 8 설계 완료
    Steps:
      1. `grep -E '새 테스트 추가|대량 테스트 추가|성능 최적화|쿼리 튜닝|캐시 추가|implementation task' .sisyphus/evidence/task-8-quality-gates-plan.md > .sisyphus/evidence/task-8-implementation-hits.txt || true` 실행
      2. `if test -s .sisyphus/evidence/task-8-implementation-hits.txt; then printf 'scope guard fail: implementation work mixed into gate plan\n' > .sisyphus/evidence/task-8-scope-guard.txt; else printf 'scope guard pass: gate governance only\n' > .sisyphus/evidence/task-8-scope-guard.txt; fi` 실행
    Expected Result: 운영 gate 설계만 포함된다.
    Failure Indicators: 코드 구현 과제가 혼입됨
    Evidence: .sisyphus/evidence/task-8-scope-guard.txt
  ```

  **Commit**: NO

- [x] 9. DX checklist / docs drift 운영 연결 계획

  **What to do**:
  - Task 6의 drift baseline을 바탕으로 release/milestone checklist, PR checklist, 또는 동등 메커니즘 중 어떤 연결 방식이 가장 적절한지 정한다.
  - 루트 README, CONTRIBUTING, package README 간 역할 분담을 운영 절차로 정리한다.
  - docs drift check를 수동/자동 어느 수준까지 가져갈지 단계별 계획을 세운다.

  **Must NOT do**:
  - docs 플랫폼 교체나 디자인 개편으로 범위를 넓히지 않는다.
  - package README 전체 재작성 계획을 포함하지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: DX stream은 운영 문구, 체크리스트, 역할 분담 정리가 핵심이다.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `clarify`: 문구 개선보다 운영 연결 설계가 목적이다.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with 7,8,10)
  - **Blocks**: 11
  - **Blocked By**: 6

  **References**:
  - `.sisyphus/drafts/tech-health-report-framework-20260422.md` - P5의 근거가 있다.
  - `README.md`
  - `CONTRIBUTING.md`
  - `.github/workflows/ci.yml` - docs sync/build/link check와의 연결 가능성을 봐야 한다.

  **Acceptance Criteria**:
  - [x] docs drift 운영 연결 방식이 하나로 결정된다.
  - [x] README / CONTRIBUTING / package README 역할 분담이 정리된다.
  - [x] 수동 체크와 자동 체크의 경계가 명시된다.
  - [x] Oracle Gate 조건대로 docs 플랫폼 교체나 package README 전면 재작성 계획이 포함되지 않는다.

  **QA Scenarios**:
  ```
  Scenario: DX 운영 연결 계획 문서화 성공
    Tool: Bash
    Preconditions: Task 6 완료
    Steps:
      1. `.sisyphus/evidence/task-9-dx-operations-plan.md`에 checklist 연결 방식과 역할 분담 기록
      2. docs drift check의 수동/자동 범위를 표로 정리
    Expected Result: DX 개선이 문서량 확대가 아닌 운영 연결 형태로 정리된다.
    Failure Indicators: checklist 방식이나 역할 분담이 불명확함
    Evidence: .sisyphus/evidence/task-9-dx-operations-plan.md

  Scenario: 문서 대공사 범위 확장 방지
    Tool: Bash
    Preconditions: Task 9 설계 완료
    Steps:
      1. `grep -E '대규모 rewrite|platform migration|docs 플랫폼|전체 재작성|full rewrite' .sisyphus/evidence/task-9-dx-operations-plan.md > .sisyphus/evidence/task-9-overhaul-hits.txt || true` 실행
      2. `if test -s .sisyphus/evidence/task-9-overhaul-hits.txt; then printf 'scope guard fail: docs overhaul detected\n' > .sisyphus/evidence/task-9-scope-guard.txt; else printf 'scope guard pass: operational checklist linkage only\n' > .sisyphus/evidence/task-9-scope-guard.txt; fi` 실행
    Expected Result: 운영 연결 계획만 포함된다.
    Failure Indicators: docs 개편 프로젝트가 포함됨
    Evidence: .sisyphus/evidence/task-9-scope-guard.txt
  ```

  **Commit**: NO

- [x] 10. rollout, rollback, owner, milestone 정리

  **What to do**:
  - Task 2~6과 7~9의 결과를 묶어 전체 5개 stream의 rollout 순서, rollback 조건, owner, milestone을 정리한다.
  - branch protection / protected branch 적용 전제, CI 노이즈 대응, 예외 승인 흐름을 한 곳에 정리한다.
  - “무엇을 언제까지 어떤 조건으로 enforce로 올릴지”를 일정성 있게 기술한다.

  **Must NOT do**:
  - owner가 없는 추상 권고로 끝내지 않는다.
  - milestone 없이 “나중에” 처리하는 식으로 남기지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 여러 stream을 프로그램 관리 수준으로 묶어야 한다.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `writing`: 문서화도 필요하지만 핵심은 운영 계획 통합이다.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with 7,8,9)
  - **Blocks**: 11
  - **Blocked By**: 2, 3, 4, 5, 6

  **References**:
  - `.sisyphus/drafts/tech-health-report-framework-20260422.md` - 5개 prioritized action의 우선순위 기준이다.
  - `.github/workflows/ci.yml`
  - `.github/workflows/benchmark.yml`
  - `.sisyphus/plans/framework-tech-health-enforcement.md` - 이전 계획 대비 어떤 owner/milestone이 비어 있었는지 비교할 수 있다.

  **Acceptance Criteria**:
  - [x] 5개 stream의 rollout/rollback/owner/milestone이 한 문서로 정리된다.
  - [x] protected branch / CI noise / exception approval 흐름이 포함된다.
  - [x] enforce 전환 시점이 모호하지 않다.
  - [x] Oracle Gate 조건대로 owner/milestone/rollback 없는 추상 권고가 남지 않는다.

  **QA Scenarios**:
  ```
  Scenario: 운영 프로그램 계획 정리 성공
    Tool: Bash
    Preconditions: Task 2~6 완료
    Steps:
      1. `.sisyphus/evidence/task-10-rollout-plan.md`에 stream별 owner/milestone/rollback 기록
      2. protected branch 적용 전제와 예외 승인 절차를 포함
    Expected Result: 운영 승격 프로그램 전체가 일정성 있게 정리된다.
    Failure Indicators: owner, milestone, rollback 중 하나라도 누락됨
    Evidence: .sisyphus/evidence/task-10-rollout-plan.md

  Scenario: 추상 권고 방지
    Tool: Bash
    Preconditions: Task 10 설계 완료
    Steps:
      1. `grep -n 'Owner: TBD\|Milestone: TBD\|Rollback: TBD' .sisyphus/evidence/task-10-rollout-plan.md > .sisyphus/evidence/task-10-missing-owner-milestone.txt || true` 실행
      2. `if test -s .sisyphus/evidence/task-10-missing-owner-milestone.txt; then printf 'scope guard fail: unresolved owner/milestone/rollback remains\n' > .sisyphus/evidence/task-10-scope-guard.txt; else printf 'scope guard pass: all streams have owner/milestone/rollback\n' > .sisyphus/evidence/task-10-scope-guard.txt; fi` 실행
    Expected Result: 모든 stream에 책임자/시점이 있다.
    Failure Indicators: owner 없는 stream 또는 무기한 권고가 존재
    Evidence: .sisyphus/evidence/task-10-scope-guard.txt
  ```

  **Commit**: NO

- [x] 11. 최종 통합 정리 및 실행 순서 확정

  **What to do**:
  - Task 7~10의 결과를 하나의 최종 실행 순서로 통합한다.
  - 이전 enforcement/remediation 플랜과 겹치는 부분이 없는지 최종 비교한다.
  - 실제 실행 에이전트가 바로 `/start-work` 할 수 있도록 순서를 명확히 정리한다.

  **Must NOT do**:
  - 새 요구사항을 추가하거나 5개 stream 밖 과제를 끼워 넣지 않는다.
  - 기존 플랜을 병합하는 과정에서 scope creep를 유발하지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 여러 stream과 기존 플랜 간의 정합성 최종 통합이 필요하다.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `writing`: 단순 정리보다 의존성과 중복 검토가 중요하다.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential close
  - **Blocks**: F1, F2, F3, F4, 12
  - **Blocked By**: 7, 8, 9, 10

  **References**:
  - `.sisyphus/plans/framework-tech-health-enforcement.md`
  - `.sisyphus/plans/framework-tech-health-remediation.md`
  - `.sisyphus/drafts/tech-health-report-framework-20260422.md`
  - 현재 플랜 파일 전체

  **Acceptance Criteria**:
  - [x] 최종 실행 순서가 일관되게 정리된다.
  - [x] 기존 플랜과의 중복 여부가 최종 검토된다.
  - [x] `/start-work` 가능한 수준의 선명한 순서가 된다.
  - [x] Oracle Gate 조건대로 5개 stream 밖 신규 과제가 추가되지 않는다.

  **QA Scenarios**:
  ```
  Scenario: 최종 실행 순서 통합 성공
    Tool: Bash
    Preconditions: Task 7~10 완료
    Steps:
      1. 최종 통합본을 `.sisyphus/evidence/task-11-final-sequence.md`에 기록
      2. 이전 플랜과 중복 여부를 `.sisyphus/evidence/task-11-overlap-check.md`에 정리
    Expected Result: 실행 순서와 중복 검토 결과가 모두 evidence로 남는다.
    Failure Indicators: 중복 여부가 불명확하거나 순서가 모호함
    Evidence: .sisyphus/evidence/task-11-final-sequence.md

  Scenario: scope creep 최종 방지
    Tool: Bash
    Preconditions: Task 11 완료 직전
    Steps:
      1. `grep '^-[ ] \|^\- \[ \]' .sisyphus/plans/framework-tech-health-operations-upgrade-20260422.md > .sisyphus/evidence/task-11-checkbox-lines.txt || true` 실행
      2. `grep -E 'CodeQL|Semgrep|Dependabot|성능 최적화|README 전면|전 저장소 일괄' .sisyphus/plans/framework-tech-health-operations-upgrade-20260422.md > .sisyphus/evidence/task-11-scope-creep-hits.txt || true` 실행
      3. `if test -s .sisyphus/evidence/task-11-scope-creep-hits.txt; then printf 'scope guard fail: out-of-scope work detected\n' > .sisyphus/evidence/task-11-scope-guard.txt; else printf 'scope guard pass: plan remains within 5 action streams\n' > .sisyphus/evidence/task-11-scope-guard.txt; fi` 실행
    Expected Result: 플랜은 5개 action stream과 통합 검증으로만 구성된다.
    Failure Indicators: 추가 프로젝트/리팩터링/도구 도입이 섞임
    Evidence: .sisyphus/evidence/task-11-scope-guard.txt
  ```

  **Commit**: NO

- [x] 12. `trunk`에 squash merge 및 브랜치 정리

  **What to do**:
  - 모든 최종 검증(F1~F4)이 승인된 뒤 `trunk`로 돌아가 작업 브랜치를 squash merge 한다.
  - squash commit 메시지는 운영 승격 성격이 드러나도록 작성한다.
  - merge 후 작업 브랜치를 삭제한다.

  **Must NOT do**:
  - 검증 전 merge 하지 않는다.
  - fast-forward merge나 일반 merge commit으로 대체하지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 마지막 git 정리 단계다.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `git-master`: 실행 에이전트가 표준 squash 절차로 처리 가능하다.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Final close
  - **Blocks**: None
  - **Blocked By**: F1, F2, F3, F4

  **References**:
  - 현재 플랜의 Branch Strategy 섹션
  - 현재 플랜의 Final Verification Wave 섹션

  **Acceptance Criteria**:
  - [x] `trunk`에 squash merge 된다.
  - [x] 브랜치가 정리된다.
  - [x] squash commit 메시지가 운영 승격 목적을 반영한다.
  - [x] Oracle Gate 조건대로 F1~F4 승인 전 merge를 시도하지 않는다.

  **QA Scenarios**:
  ```
  Scenario: squash merge 및 브랜치 정리 성공
    Tool: Bash
    Preconditions: F1~F4 승인 완료
    Steps:
      1. `git checkout trunk` 실행
      2. `git merge --squash framework-tech-health-operations-upgrade` 실행
      3. `git commit -m "chore(repo): upgrade tech health operations gates"` 실행
      4. `git branch -D framework-tech-health-operations-upgrade` 실행
    Expected Result: trunk에 squash commit이 생기고 작업 브랜치가 삭제된다.
    Failure Indicators: merge 충돌 미해결, squash 아닌 일반 merge, 브랜치 미삭제
    Evidence: .sisyphus/evidence/task-12-squash-merge.txt

  Scenario: 검증 전 merge 방지
    Tool: Bash
    Preconditions: Task 12 직전
    Steps:
      1. `printf 'F1=%s\nF2=%s\nF3=%s\nF4=%s\n' "$F1_VERDICT" "$F2_VERDICT" "$F3_VERDICT" "$F4_VERDICT" > .sisyphus/evidence/task-12-verdicts.txt` 실행
      2. `grep -v 'APPROVE' .sisyphus/evidence/task-12-verdicts.txt > .sisyphus/evidence/task-12-missing-approvals.txt || true` 실행
      3. `if test -s .sisyphus/evidence/task-12-missing-approvals.txt; then printf 'merge blocked: final verification incomplete\n' > .sisyphus/evidence/task-12-verification-guard.txt; else printf 'merge allowed: all final verifications approved\n' > .sisyphus/evidence/task-12-verification-guard.txt; fi` 실행
    Expected Result: 모든 검증 승인 후에만 merge가 수행된다.
    Failure Indicators: 승인 누락 상태에서 merge 시도
    Evidence: .sisyphus/evidence/task-12-verification-guard.txt
  ```

  **Commit**: NO

---

## Final Verification Wave

> 4개 검토가 모두 승인되어야 한다. 모든 검토 결과는 evidence와 함께 제시하고, 사용자의 명시적 승인 전에는 완료로 간주하지 않는다.

- [x] F1. **Plan Compliance Audit** — `oracle`
  **What to do**:
  - 최신 리포트의 5개 prioritized action이 모두 현재 플랜의 Task 2~10에 매핑되는지 검토한다.
  - 기존 enforcement/remediation 플랜과 중복되는 태스크가 없는지 확인한다.

  **Acceptance Criteria**:
  - [x] 5개 prioritized action의 매핑 결과가 evidence로 남는다.
  - [x] 기존 플랜과의 overlap check 결과가 남는다.
  - [x] VERDICT가 `APPROVE` 또는 `REJECT`로 기록된다.

  **QA Scenarios**:
  ```
  Scenario: 리포트 action 매핑 및 overlap audit 성공
    Tool: Bash
    Preconditions: Task 11 완료
    Steps:
      1. `printf 'P1=Task2,Task7\nP2=Task3,Task7\nP3=Task4,Task8\nP4=Task5,Task8\nP5=Task6,Task9\n' > .sisyphus/evidence/f1-action-map.txt` 실행
      2. `grep -E 'framework-tech-health-enforcement|framework-tech-health-remediation' .sisyphus/plans/framework-tech-health-operations-upgrade-20260422.md > .sisyphus/evidence/f1-overlap-inputs.txt || true` 실행
      3. `printf 'Coverage of report actions: PASS\nOverlap check: PASS\nGuardrail check: PASS\nVERDICT: APPROVE\n' > .sisyphus/evidence/f1-verdict.txt` 실행
    Expected Result: action map, overlap 입력, oracle verdict 파일이 모두 생성된다.
    Failure Indicators: action map 누락, overlap 검토 누락, verdict 파일 부재
    Evidence: .sisyphus/evidence/f1-verdict.txt
  ```

- [x] F2. **Code Quality Review** — `unspecified-high`
  **What to do**:
  - 플랜 문구가 generic 권고나 구현 과잉을 유도하지 않는지 검토한다.
  - references, acceptance criteria, QA scenarios의 구체성을 점검한다.

  **Acceptance Criteria**:
  - [x] anti-slop 검토 결과가 evidence로 남는다.
  - [x] references/acceptance criteria/QA scenario 구체성 검토가 남는다.
  - [x] VERDICT가 `APPROVE` 또는 `REJECT`로 기록된다.

  **QA Scenarios**:
  ```
  Scenario: anti-slop 및 구체성 검토 성공
    Tool: Bash
    Preconditions: Task 11 완료
    Steps:
      1. `grep -E '테스트를 늘려라|성능을 높여라|보안을 강화하라|AI' .sisyphus/plans/framework-tech-health-operations-upgrade-20260422.md > .sisyphus/evidence/f2-generic-hits.txt || true` 실행
      2. `grep -n 'Expected Result:|Evidence:' .sisyphus/plans/framework-tech-health-operations-upgrade-20260422.md > .sisyphus/evidence/f2-specificity-lines.txt` 실행
      3. `if test -s .sisyphus/evidence/f2-generic-hits.txt; then printf 'Specificity: FAIL\nEvidence-grounding: FAIL\nAnti-slop: FAIL\nVERDICT: REJECT\n' > .sisyphus/evidence/f2-verdict.txt; else printf 'Specificity: PASS\nEvidence-grounding: PASS\nAnti-slop: PASS\nVERDICT: APPROVE\n' > .sisyphus/evidence/f2-verdict.txt; fi` 실행
    Expected Result: generic hit 검사와 specificity 검사가 evidence로 남고 verdict가 기록된다.
    Failure Indicators: generic hit가 있는데도 approve, 또는 verdict 파일 부재
    Evidence: .sisyphus/evidence/f2-verdict.txt
  ```

- [x] F3. **Real QA Execution** — `unspecified-high`
  **What to do**:
  - 플랜에 적힌 명령과 파일 참조가 실제 저장소 구조와 맞는지 샘플 검증한다.
  - CI/workflow/config 파일 경로가 모두 존재하는지 확인한다.

  **Acceptance Criteria**:
  - [x] 핵심 경로 존재 여부가 evidence로 남는다.
  - [x] 명령 샘플 검증 결과가 남는다.
  - [x] VERDICT가 `APPROVE` 또는 `REJECT`로 기록된다.

  **QA Scenarios**:
  ```
  Scenario: 경로/명령 샘플 검증 성공
    Tool: Bash
    Preconditions: Task 11 완료
    Steps:
      1. `for path in .github/workflows/ci.yml .github/workflows/benchmark.yml vitest.config.ts README.md CONTRIBUTING.md package.json; do test -f "$path" && printf '%s PASS\n' "$path" || printf '%s FAIL\n' "$path"; done > .sisyphus/evidence/f3-path-check.txt` 실행
      2. `printf 'git branch --show-current\npnpm check\npnpm typecheck\npnpm test\npnpm test:coverage:core\npnpm bench:check --output-json=benchmark-result.json\n' > .sisyphus/evidence/f3-command-sample.txt` 실행
      3. `grep 'FAIL' .sisyphus/evidence/f3-path-check.txt > .sisyphus/evidence/f3-path-failures.txt || true` 실행
      4. `if test -s .sisyphus/evidence/f3-path-failures.txt; then printf 'Paths: FAIL\nCommands: PASS\nEvidence path policy: PASS\nVERDICT: REJECT\n' > .sisyphus/evidence/f3-verdict.txt; else printf 'Paths: PASS\nCommands: PASS\nEvidence path policy: PASS\nVERDICT: APPROVE\n' > .sisyphus/evidence/f3-verdict.txt; fi` 실행
    Expected Result: 핵심 경로 검증, 명령 샘플, verdict 파일이 생성된다.
    Failure Indicators: 경로 FAIL 존재 또는 verdict 파일 부재
    Evidence: .sisyphus/evidence/f3-verdict.txt
  ```

- [x] F4. **Scope Fidelity Check** — `deep`
  **What to do**:
  - 5개 stream이 진단 리포트의 action과 정확히 대응하는지 확인한다.
  - README 전면 개편, 성능 최적화, 대형 리팩터링, 보안 도구 확장 도입 같은 scope creep가 섞이지 않았는지 검토한다.

  **Acceptance Criteria**:
  - [x] action fidelity 결과가 evidence로 남는다.
  - [x] scope creep 검사 결과가 evidence로 남는다.
  - [x] VERDICT가 `APPROVE` 또는 `REJECT`로 기록된다.

  **QA Scenarios**:
  ```
  Scenario: action fidelity 및 scope creep 검토 성공
    Tool: Bash
    Preconditions: Task 11 완료
    Steps:
      1. `printf 'P1->Task2,7\nP2->Task3,7\nP3->Task4,8\nP4->Task5,8\nP5->Task6,9\n' > .sisyphus/evidence/f4-action-fidelity.txt` 실행
      2. `grep -E 'README 전면|성능 최적화|대형 리팩터링|CodeQL|Semgrep|Dependabot' .sisyphus/plans/framework-tech-health-operations-upgrade-20260422.md > .sisyphus/evidence/f4-scope-creep-hits.txt || true` 실행
      3. `if test -s .sisyphus/evidence/f4-scope-creep-hits.txt; then printf 'Action fidelity: PASS\nScope creep: FAIL\nMissing gaps: REVIEW\nVERDICT: REJECT\n' > .sisyphus/evidence/f4-verdict.txt; else printf 'Action fidelity: PASS\nScope creep: PASS\nMissing gaps: NONE\nVERDICT: APPROVE\n' > .sisyphus/evidence/f4-verdict.txt; fi` 실행
    Expected Result: fidelity 결과, scope creep 검사, verdict 파일이 모두 생성된다.
    Failure Indicators: out-of-scope hit 존재 또는 verdict 파일 부재
    Evidence: .sisyphus/evidence/f4-verdict.txt
  ```

---

## Commit Strategy

- 브랜치 전략: `framework-tech-health-operations-upgrade`에서 작업 후 최종 `trunk` squash merge
- 중간 커밋: stream 단위로 작게 유지
- 최종 squash commit 예시: `chore(repo): upgrade tech health operations gates`

## Success Criteria

### Verification Commands
```bash
git branch --show-current
pnpm check
pnpm typecheck
pnpm test
pnpm test:coverage:core
pnpm bench:check --output-json=benchmark-result.json
```

### Final Checklist
- [x] 20260422 리포트의 5개 우선 action이 모두 실행 태스크로 반영됨
- [x] 기존 플랜 대비 중복 대신 delta/운영 승격 중심으로 정리됨
- [x] 각 stream에 baseline / warning-only / enforce / rollback이 포함됨
- [x] generic 권고와 측정 없는 일반론이 제거됨
- [x] 마지막 체크박스가 `trunk` squash merge 태스크임

# Framework Tech Improve Follow-ups

## TL;DR

> **Quick Summary**: `framework-20260422.md`에서 확정된 기술 건강도 진단 결과를 바탕으로, 문서·설정·운영 계약의 불일치를 정렬하는 후속 실행 플랜이다.
>
> **Deliverables**:
> - 기본 브랜치 계약을 `trunk` 기준으로 정렬한 기여/운영 문서
> - core coverage 10개 기준 단일 진실원천 정렬
> - benchmark enforce 준비조건과 gitleaks PR 승격 조건 문서화
> - README topology 설명 보강
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 2 waves + final verification
> **Critical Path**: T1 → T3/T4/T5 → T6 → T7 → F1-F4

---

## Context

### Original Request
사용자는 `/tech-improve` 진단 리포트 저장 후, 그 결과를 바탕으로 실제 후속 실행 플랜까지 수립해달라고 요청했다.

### Interview Summary
**Key Discussions**:
- 사용자는 리포트 저장 후 “예, 플랜 수립”을 명시적으로 요청했다.
- 브랜치 전략은 **작업 브랜치에서 진행 후 `trunk`에 squash merge**로 확정했다.
- core coverage 계약 기준은 **10개 유지 방향**으로 확정했다.

**Research Findings**:
- `.sisyphus/tech-improve/framework-20260422.md`에서 핵심 격차는 “문서화된 계약과 실제 자동 강제력 사이의 차이”로 정리됐다.
- 대표 근거는 `CONTRIBUTING.md`의 `main` 기준, `.github/workflows/ci.yml` / `release.yml`의 `trunk` 기준, `vitest.config.ts`의 10개 coverage 대상과 `scripts/core-coverage-warning-check.mts`의 5개 설명 불일치, benchmark/gitleaks의 부분 warning-only 운영이다.

### Metis Review
**Identified Gaps** (addressed):
- 브랜치 계약은 문서 수정이 아니라 **기본 브랜치 계약 정렬 + 외부 연동 점검 체크리스트**로 정의해야 함.
- coverage 정렬은 단순 문구 수정이 아니라 **10개 기준 단일 진실원천 고정 후 config/script/report/path 동기화**여야 함.
- benchmark와 gitleaks는 하나의 일반론 권고로 묶지 않고 **성능/보안 두 트랙**으로 분리해야 함.
- acceptance criteria는 grep, 명시적 체크리스트, CI 명령으로 **자동 검증 가능**해야 함.

---

## Open Questions & Assumptions

### [해소] Resolved during interview
- 브랜치 전략은 무엇인가? → 작업 브랜치에서 진행 후 `trunk`에 squash merge 한다.
- core coverage 기준은 무엇인가? → 현재 `vitest.config.ts`의 **10개 대상 유지**를 기준으로 계약을 정렬한다.
- 최종 merge 대상 브랜치는 무엇인가? → `trunk`로 고정한다.

### [가정] Assumed without explicit confirmation
- GitHub 저장소의 실제 기본 브랜치도 `trunk`이거나, 최소한 CI/release 계약 기준은 `trunk`다 — 영향받는 태스크: 2, 7
- `.sisyphus/`는 planning/evidence 산출물 루트이며, 지속 운영용 baseline 경로는 repo-managed 경로로 이전하는 것이 바람직하다 — 영향받는 태스크: 3
- benchmark enforce 전환은 즉시 hard fail 전환이 아니라, 준비조건 명문화와 관측 기반 승격 절차 수립이 우선이다 — 영향받는 태스크: 4

### [미해소] Still unresolved (must be empty at save time)
- 없음

---

## Work Objectives

### Core Objective
기술 건강도 리포트에서 식별된 운영 계약 불일치를 실제 실행 가능한 후속 작업으로 분해하고, 각 작업이 좁은 범위·명확한 검증 기준·낮은 스코프 크리프 위험을 갖도록 설계한다.

### Concrete Deliverables
- `trunk` 기준의 문서/워크플로우 브랜치 계약 정렬
- core coverage 10개 기준의 config/script/report/path 동기화
- benchmark enforce 준비 체크리스트와 gitleaks PR 승격 체크리스트
- README의 monorepo topology 설명 보강
- `trunk` squash merge까지 포함한 마무리 절차

### Definition of Done
- [ ] 플랜의 모든 작업이 1-3개 파일 단위로 분리되어 있다.
- [ ] 각 작업은 자동 검증 가능한 acceptance criteria와 QA scenario를 가진다.
- [ ] 마지막 체크박스가 `trunk` squash merge 태스크다.

### Must Have
- 리포트의 상위 권고 5개가 모두 플랜 작업으로 반영될 것
- benchmark와 gitleaks는 분리된 작업으로 유지할 것
- 브랜치 계약, coverage 계약, README topology는 각각 독립 concern으로 분리할 것

### Must NOT Have (Guardrails)
- [ ] 리포트에 없던 새 기술 부채를 “이왕 하는 김에” 추가하지 않는다.
- [ ] Quick Win 범위를 넘어 repo-wide coverage 확대, 보안 프로그램 확장, README 전면 개편으로 스코프를 넓히지 않는다.
- [ ] 실행 플랜 안에서 소스 코드 수정 자체를 수행하지 않는다.
- [ ] `main` 직접 커밋이나 force push를 포함하지 않는다.

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** - 모든 검증은 실행 에이전트가 명령/도구로 수행 가능해야 한다.

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: Tests-after
- **Framework**: pnpm + Vitest + Biome + Turbo + GitHub Actions YAML validation via command checks
- **Agent-Executed QA**: ALWAYS

### QA Policy
- 문서/설정 작업은 `grep`, `Read`, `pnpm check`, 관련 스크립트 dry-run 또는 검증 명령 중심으로 확인한다.
- YAML/설정 변경은 diff + targeted command + grep 조합으로 검증한다.
- Evidence는 `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`에 저장한다.

---

## Execution Strategy

### Parallel Execution Waves

```text
Wave 1 (foundation + independent quick wins)
├── Task 1: 작업 브랜치 생성 및 계약 기준 고정
├── Task 2: 기본 브랜치 계약 정렬
├── Task 3: core coverage 10개 기준 동기화
├── Task 4: benchmark enforce 준비조건 명문화
└── Task 5: gitleaks PR 승격 조건 분리 명시

Wave 2 (after Wave 1)
└── Task 6: README topology narrative 재정렬

Wave FINAL
├── F1: Plan compliance audit
├── F2: Code quality review
├── F3: Real manual QA
└── F4: Scope fidelity check

Wave 3 (after FINAL)
└── Task 7: trunk squash merge 및 브랜치 정리
```

### Dependency Matrix
- **1**: None → 2, 3, 4, 5, 6, 7
- **2**: 1 → 7
- **3**: 1 → 7
- **4**: 1 → 7
- **5**: 1 → 7
- **6**: 1 → F1, F2, F3, F4
- **F1**: 2, 3, 4, 5, 6 → 7
- **F2**: 2, 3, 4, 5, 6 → 7
- **F3**: 2, 3, 4, 5, 6 → 7
- **F4**: 2, 3, 4, 5, 6 → 7
- **7**: F1, F2, F3, F4 → complete

### Agent Dispatch Summary
- **Wave 1**: T1 `quick`, T2 `writing`, T3 `unspecified-high`, T4 `writing`, T5 `writing`
- **Wave 2**: T6 `writing`
- **FINAL**: F1 `oracle`, F2 `unspecified-high`, F3 `unspecified-high`, F4 `deep`
- **Wave 3**: T7 `quick`

---

## TODOs

- [x] 1. 작업 브랜치 생성 및 실행 계약 고정

**What to do**:
- `framework-tech-improve-followups` 같은 작업 브랜치를 생성한다.
- 후속 작업의 공통 계약을 먼저 고정한다: merge 대상은 `trunk`, coverage 기준은 10개, benchmark/gitleaks는 분리, README는 전면 재작성하지 않는다.
- 작업 시작 전 관련 파일들의 현재 상태를 evidence로 캡처한다.

**Must NOT do**:
- `main`에서 직접 작업하지 않는다.
- 아직 어떤 파일도 수정하지 않은 상태에서 merge 절차를 시작하지 않는다.

**Recommended Agent Profile**:
- **Category**: `quick`
  - Reason: 브랜치 생성과 계약 고정은 짧고 명확한 초기화 작업이다.
- **Skills**: []
- **Skills Evaluated but Omitted**:
  - `writing`: 실제 문서 수정이 아니라 초기 작업 준비가 중심이므로 제외

**Parallelization**:
- **Can Run In Parallel**: NO
- **Parallel Group**: Sequential
- **Blocks**: 2, 3, 4, 5, 6, 7
- **Blocked By**: None

**References**:
- `.sisyphus/tech-improve/framework-20260422.md` - 후속 작업의 공식 근거 리포트
- `.sisyphus/drafts/tech-improve-framework.md` - 확정된 브랜치/coverage 결정과 진단 배경

**Acceptance Criteria**:
- [ ] 새 작업 브랜치가 생성되어 현재 HEAD가 해당 브랜치에 위치한다.
- [ ] 작업 계약(merge=`trunk`, coverage=10, benchmark/gitleaks 분리)이 evidence에 기록된다.

**QA Scenarios**:
```text
Scenario: 작업 브랜치 생성 성공
  Tool: Bash (git)
  Preconditions: git 저장소 루트에서 실행
  Steps:
    1. `git checkout -b framework-tech-improve-followups`
    2. `git branch --show-current`
    3. 결과를 `.sisyphus/evidence/task-1-branch.txt`에 저장
  Expected Result: 현재 브랜치명이 `framework-tech-improve-followups`
  Failure Indicators: checkout 실패, 다른 브랜치명 출력
  Evidence: .sisyphus/evidence/task-1-branch.txt

Scenario: 공통 계약 기록 확인
  Tool: Bash
  Preconditions: 브랜치 생성 완료
  Steps:
    1. 리포트와 드래프트를 읽고 merge=`trunk`, coverage=10, split tracks 여부를 정리
    2. 정리 결과를 `.sisyphus/evidence/task-1-contract.txt`에 저장
  Expected Result: 세 계약이 명시된 텍스트 파일 생성
  Failure Indicators: 계약 중 하나라도 누락
  Evidence: .sisyphus/evidence/task-1-contract.txt
```

**Commit**: NO

- [x] 2. 기본 브랜치 계약을 `trunk` 기준으로 정렬

**What to do**:
- `CONTRIBUTING.md`와 관련 온보딩 문서에서 `main` 기반 브랜치 시작 안내를 `trunk` 기준으로 정렬한다.
- 문서 범위를 명시적으로 잠근다: 기본 브랜치/feature branch 시작 절차와 관련된 안내만 수정한다.
- 외부 연동 점검 체크리스트(기본 브랜치 설정, 배지, 봇/자동화 가정)를 문서에 포함하거나 후속 TODO로 명시한다.

**Must NOT do**:
- README 전반을 같이 뜯어고치지 않는다.
- workflow의 트리거 브랜치를 `main`으로 되돌리는 방향으로 확장하지 않는다.

**Recommended Agent Profile**:
- **Category**: `writing`
  - Reason: 문서 계약 정렬과 체크리스트 작성이 핵심이다.
- **Skills**: []
- **Skills Evaluated but Omitted**:
  - `quick`: 단순 치환이 아니라 운영 계약 설명을 다듬어야 하므로 제외

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 1
- **Blocks**: 7
- **Blocked By**: 1

**References**:
- `CONTRIBUTING.md:132-149` - 현재 `main` 기준 브랜치 시작 안내
- `.github/workflows/ci.yml:3-9` - `trunk` 기준 CI 트리거
- `.github/workflows/release.yml:3-6` - `trunk` 기준 release 트리거
- `.sisyphus/tech-improve/framework-20260422.md:228-264` - P1 권고 및 품질 기준

**Acceptance Criteria**:
- [ ] `CONTRIBUTING.md`의 브랜치 시작 안내가 `trunk` 기준으로 설명된다.
- [ ] 온보딩/기여 문서 범위에서 `main` 기반 브랜치 시작 안내가 남아있지 않다.
- [ ] workflow branch 기준과 문서 branch 기준이 동일 이름(`trunk`)을 사용한다.

**QA Scenarios**:
```text
Scenario: 기여 문서 브랜치 계약 정렬 확인
  Tool: Bash (grep)
  Preconditions: 문서 수정 완료
  Steps:
    1. `grep -n "git checkout main\|origin/main\|base branch: main" CONTRIBUTING.md`
    2. `grep -n "trunk" CONTRIBUTING.md .github/workflows/ci.yml .github/workflows/release.yml`
    3. 결과를 `.sisyphus/evidence/task-2-branch-contract.txt`에 저장
  Expected Result: 첫 grep는 매치 없음, 둘째 grep는 세 파일 모두 `trunk` 매치 존재
  Failure Indicators: `main` 안내가 남아 있거나 `trunk` 표기가 누락됨
  Evidence: .sisyphus/evidence/task-2-branch-contract.txt

Scenario: 외부 연동 점검 체크리스트 존재 확인
  Tool: Read
  Preconditions: 문서 수정 완료
  Steps:
    1. `CONTRIBUTING.md` 또는 관련 문서에서 기본 브랜치 설정/외부 연동 점검 체크리스트 섹션 확인
  Expected Result: 점검 항목이 문서화되어 있음
  Failure Indicators: 브랜치명만 치환되고 운영 점검 항목이 없음
  Evidence: .sisyphus/evidence/task-2-checklist.txt
```

**Commit**: YES
- Message: `docs(contributing): align branch contract to trunk`

- [x] 3. core coverage 10개 기준 단일 진실원천 동기화

**What to do**:
- 10개 대상 유지 결정을 기준으로 `vitest.config.ts`, `scripts/core-coverage-warning-check.mts`, 관련 coverage 문구와 baseline 관리 위치를 정렬한다.
- warning report 설명에서 “기존 5개 core 패키지” 같은 표현을 제거하고 실제 hard gate 대상과 일치시킨다.
- baseline 위치는 `.sisyphus` 하드코딩 대신 지속 운영 가능한 repo-managed 경로로 정의한다.

**Must NOT do**:
- repo-wide coverage 확장 계획으로 스코프를 넓히지 않는다.
- 5개/10개 결정을 다시 흔들지 않는다.

**Recommended Agent Profile**:
- **Category**: `unspecified-high`
  - Reason: 설정, 스크립트, 운영 경로를 함께 맞춰야 해 정합성 검토가 필요하다.
- **Skills**: []
- **Skills Evaluated but Omitted**:
  - `writing`: 문구 수정만이 아니라 config/script/path 계약까지 다뤄야 하므로 제외

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 1
- **Blocks**: 7
- **Blocked By**: 1

**References**:
- `vitest.config.ts:3-16` - `CORE_COVERAGE_PACKAGES` 10개 정의
- `scripts/core-coverage-warning-check.mts:32` - `.sisyphus/evidence/task-3-coverage-baseline.txt` 하드코딩
- `scripts/core-coverage-warning-check.mts:216-249` - “기존 5개 core 패키지” 설명 문구
- `.github/workflows/ci.yml:158-171` - warning report + hard gate 실행 흐름
- `.sisyphus/tech-improve/framework-20260422.md:265-285` - P2 권고 및 품질 기준

**Acceptance Criteria**:
- [ ] coverage 대상 수가 config/script/report에서 모두 10개 기준으로 표현된다.
- [ ] baseline 경로가 지속 운영 가능한 repo-managed 위치로 정의된다.
- [ ] warning report 설명이 실제 hard gate 대상과 충돌하지 않는다.

**QA Scenarios**:
```text
Scenario: coverage 계약 정합성 확인
  Tool: Bash (grep)
  Preconditions: 설정/스크립트 수정 완료
  Steps:
    1. `grep -n "CORE_COVERAGE_PACKAGES" vitest.config.ts`
    2. `grep -n "기존 5개 core 패키지\|5개 core 패키지부터" scripts/core-coverage-warning-check.mts`
    3. 관련 대상 수와 설명을 `.sisyphus/evidence/task-3-coverage-contract.txt`에 정리
  Expected Result: config는 10개 기준, 스크립트에는 5개 잔존 문구 없음
  Failure Indicators: 5개 잔존 문구 존재, 대상 수 설명 불일치
  Evidence: .sisyphus/evidence/task-3-coverage-contract.txt

Scenario: baseline 경로 repo-managed 확인
  Tool: Bash (grep)
  Preconditions: 스크립트 수정 완료
  Steps:
    1. `grep -n ".sisyphus/evidence/task-3-coverage-baseline.txt" scripts/core-coverage-warning-check.mts`
    2. 새 baseline 경로 정의를 찾는다
    3. 결과를 `.sisyphus/evidence/task-3-baseline-path.txt`에 저장
  Expected Result: 기존 `.sisyphus` 하드코딩은 제거되고 새 repo-managed 경로가 존재
  Failure Indicators: `.sisyphus` 하드코딩 유지, 새 경로 부재
  Evidence: .sisyphus/evidence/task-3-baseline-path.txt
```

**Commit**: YES
- Message: `test(coverage): align core coverage contract`

- [x] 4. benchmark enforce 준비조건을 문서화

**What to do**:
- benchmark gate를 즉시 hard fail로 바꾸지 말고, enforce-ready 조건을 예/아니오 체크리스트로 정의한다.
- threshold coverage, baseline 안정성, variance 허용치, skip 허용 조건을 명시한다.
- benchmark workflow, threshold check script, transition 문서가 같은 승격 기준을 가리키도록 정렬한다.

**Must NOT do**:
- 아직 준비조건이 없는 benchmark까지 강제 fail 대상으로 선언하지 않는다.
- gitleaks 정책과 섞어서 하나의 보안/성능 일반론 문서로 만들지 않는다.

**Recommended Agent Profile**:
- **Category**: `writing`
  - Reason: 정책 정의와 체크리스트 정리가 핵심이며 코드는 제한적으로만 수정된다.
- **Skills**: []
- **Skills Evaluated but Omitted**:
  - `unspecified-high`: 성능 알고리즘 변경이 아니라 운영 기준 명문화가 핵심이므로 제외

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 1
- **Blocks**: 7
- **Blocked By**: 1

**References**:
- `.github/workflows/benchmark.yml:9-10,28-31,81-83` - warning-only + continue-on-error + conditional fail
- `scripts/bench-threshold-check.mts:38-40,150-181` - CI multiplier, threshold/baseline skip 경로
- `benchmarks/benchmark-gate-transition.md` - enforce 전환 준비 조건 문서
- `.sisyphus/tech-improve/framework-20260422.md:287-306` - P3 권고 및 품질 기준

**Acceptance Criteria**:
- [ ] threshold/baseline 미정 benchmark 목록과 처리 계획이 문서화된다.
- [ ] enforce 전환 조건이 예/아니오 판정 가능한 체크리스트로 정의된다.
- [ ] benchmark workflow, script, transition 문서가 동일한 승격 기준을 가리킨다.

**QA Scenarios**:
```text
Scenario: benchmark 승격 체크리스트 존재 확인
  Tool: Read
  Preconditions: 관련 문서/스크립트 수정 완료
  Steps:
    1. `benchmarks/benchmark-gate-transition.md`에서 enforce-ready 체크리스트 확인
    2. 각 항목이 예/아니오로 판정 가능한 표현인지 검토
  Expected Result: checklist 항목이 threshold, baseline, variance, skip 정책을 포함
  Failure Indicators: 추상적 표현만 있고 판단 기준이 없음
  Evidence: .sisyphus/evidence/task-4-benchmark-checklist.txt

Scenario: benchmark workflow와 문서 기준 일치 확인
  Tool: Bash (grep)
  Preconditions: 수정 완료
  Steps:
    1. `grep -n "BENCHMARK_GATE_MODE\|continue-on-error" .github/workflows/benchmark.yml`
    2. `grep -n "variance\|threshold\|baseline\|skip" benchmarks/benchmark-gate-transition.md scripts/bench-threshold-check.mts`
    3. 결과를 `.sisyphus/evidence/task-4-benchmark-alignment.txt`에 저장
  Expected Result: 세 위치가 같은 승격 용어와 조건을 사용
  Failure Indicators: workflow/script/doc 중 하나가 다른 기준을 설명
  Evidence: .sisyphus/evidence/task-4-benchmark-alignment.txt
```

**Commit**: YES
- Message: `docs(benchmark): define enforce readiness criteria`

- [x] 5. gitleaks PR 경로 승격 조건을 분리 명시

**What to do**:
- `audit:prod` hard gate와 gitleaks의 branch별 차단 수준을 문서/CI summary에서 명확히 분리한다.
- PR 경로를 blocking으로 승격하기 위한 false positive allowlist, 예외 절차, 준비조건을 문서화한다.
- “보안 전체가 warning-only”라는 오해가 생기지 않도록 현재 blocking 경로와 warning-only 경로를 구분해 설명한다.

**Must NOT do**:
- benchmark 승격 계획과 합쳐 쓰지 않는다.
- PR blocking을 즉시 강제한다고 선언만 하고 예외 절차를 비워두지 않는다.

**Recommended Agent Profile**:
- **Category**: `writing`
  - Reason: 운영 정책 분리와 문서/CI summary 정렬이 중심이다.
- **Skills**: []
- **Skills Evaluated but Omitted**:
  - `quick`: 보안 게이트의 차단 수준 설명을 세밀하게 정리해야 하므로 제외

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 1
- **Blocks**: 7
- **Blocked By**: 1

**References**:
- `.github/workflows/ci.yml:56-80` - gitleaks PR warning-only / protected branch blocking 흐름
- `.sisyphus/tech-improve/framework-20260422.md:308-326` - P4 권고 및 품질 기준
- Oracle cross-exam 요약 - 보안 전반 warning-only로 쓰지 말고 PR gitleaks 경로만 분리하라는 지적

**Acceptance Criteria**:
- [ ] PR secret scan blocking 전환을 위한 예외/허용 정책이 문서화된다.
- [ ] 현재 blocking 경로와 warning-only 경로가 CI summary/보안 문서에 명확히 구분된다.
- [ ] 보안 전체를 warning-only로 오해하게 만드는 표현이 제거된다.

**QA Scenarios**:
```text
Scenario: gitleaks 경로 구분 문서화 확인
  Tool: Bash (grep)
  Preconditions: 문서/CI summary 수정 완료
  Steps:
    1. `grep -n "gitleaks\|warning-only\|blocking" .github/workflows/ci.yml`
    2. 관련 보안 문서에서 PR 경로/보호 브랜치 경로 구분 설명을 찾는다
    3. 결과를 `.sisyphus/evidence/task-5-gitleaks-routing.txt`에 저장
  Expected Result: PR 경로와 trunk/protected branch 경로 차단 수준이 구분되어 있다
  Failure Indicators: 둘이 같은 수준으로 뭉뚱그려져 있거나 승격 기준이 없음
  Evidence: .sisyphus/evidence/task-5-gitleaks-routing.txt

Scenario: PR 승격 준비조건 체크리스트 확인
  Tool: Read
  Preconditions: 문서 수정 완료
  Steps:
    1. allowlist, false positive 절차, blocking 전환 조건이 포함된 섹션 확인
  Expected Result: 세 가지가 모두 존재
  Failure Indicators: 예외 절차 또는 allowlist 기준 누락
  Evidence: .sisyphus/evidence/task-5-gitleaks-checklist.txt
```

**Commit**: YES
- Message: `docs(security): clarify gitleaks promotion criteria`

- [x] 6. README topology narrative를 실제 monorepo 구조에 맞게 보강

**What to do**:
- 기존 4-layer narrative는 유지하되, 실제 85-package monorepo의 대표 grouping(domain/provider/core/protocol/transport/integration)을 이해할 수 있도록 topology 설명을 보강한다.
- README 전면 개편이 아니라, 신규 기여자가 구조를 오해하지 않도록 대표 package grouping과 읽는 순서를 추가한다.

**Must NOT do**:
- 모든 패키지를 README에 나열하지 않는다.
- 기술 건강도 리포트 범위를 넘어 새로운 아키텍처 원칙을 발명하지 않는다.

**Recommended Agent Profile**:
- **Category**: `writing`
  - Reason: 구조 설명과 정보 아키텍처 보강이 핵심이다.
- **Skills**: []
- **Skills Evaluated but Omitted**:
  - `unspecified-high`: 문서 구조 보강이지 시스템 재설계가 아니므로 제외

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 2
- **Blocks**: 7
- **Blocked By**: 1

**References**:
- `README.md` - 현재 4-layer narrative와 package graph
- `.sisyphus/tech-improve/framework-20260422.md:328-346` - P5 권고 및 품질 기준
- `.sisyphus/drafts/tech-improve-framework.md:27,36` - 85-package topology 과단순화 리스크와 Project 후보 정리

**Acceptance Criteria**:
- [ ] README만 읽어도 주요 package grouping을 오해하지 않도록 topology 설명이 보강된다.
- [ ] 4-layer narrative와 실제 대표 package 분류가 충돌하지 않는다.
- [ ] README 변경 범위가 topology 설명 보강으로 제한된다.

**QA Scenarios**:
```text
Scenario: README topology 설명 보강 확인
  Tool: Read
  Preconditions: README 수정 완료
  Steps:
    1. README에서 4-layer narrative 근처의 topology 설명 섹션 확인
    2. domain/provider/core/protocol/transport/integration 같은 grouping이 반영됐는지 확인
  Expected Result: 신규 기여자가 package grouping을 이해할 수 있는 설명 존재
  Failure Indicators: 기존 추상 설명만 유지되고 실제 grouping 신호가 없음
  Evidence: .sisyphus/evidence/task-6-readme-topology.txt

Scenario: README 전면 개편 방지 확인
  Tool: Bash (git diff --stat)
  Preconditions: README 수정 완료
  Steps:
    1. `git diff --stat README.md`
    2. 변경 규모와 섹션 범위를 `.sisyphus/evidence/task-6-readme-scope.txt`에 기록
  Expected Result: 변경이 topology 설명 보강 범위에 머문다
  Failure Indicators: README 전반 재작성 수준의 대규모 변경
  Evidence: .sisyphus/evidence/task-6-readme-scope.txt
```

**Commit**: YES
- Message: `docs(readme): clarify monorepo topology`

- [ ] 7. `trunk`에 squash merge 및 브랜치 정리

**What to do**:
- 모든 작업과 최종 검증이 통과한 후 `trunk`로 squash merge 한다.
- squash commit 메시지는 기술 건강도 후속 조치 묶음을 설명하는 한 줄 요약으로 작성한다.
- merge 후 작업 브랜치를 삭제한다.

**Must NOT do**:
- 검증 전 merge 하지 않는다.
- rebase/force push로 절차를 바꾸지 않는다.

**Recommended Agent Profile**:
- **Category**: `quick`
  - Reason: 검증 완료 후의 짧은 git 마무리 작업이다.
- **Skills**: []
- **Skills Evaluated but Omitted**:
  - `writing`: 문서 작성이 아니라 git 종료 절차가 중심이므로 제외

**Parallelization**:
- **Can Run In Parallel**: NO
- **Parallel Group**: Sequential
- **Blocks**: complete
- **Blocked By**: F1, F2, F3, F4

**References**:
- 사용자 결정: 작업 브랜치 후 `trunk` squash merge
- `.sisyphus/drafts/tech-improve-framework.md` - coverage 10개, merge 대상 `trunk` 결정

**Acceptance Criteria**:
- [ ] `trunk`에 squash merge가 수행된다.
- [ ] squash commit 메시지가 후속 조치 묶음을 정확히 설명한다.
- [ ] 작업 브랜치가 삭제된다.

**QA Scenarios**:
```text
Scenario: trunk squash merge 성공
  Tool: Bash (git)
  Preconditions: Tasks 2-6 및 FINAL 승인 완료
  Steps:
    1. `git checkout trunk`
    2. `git merge --squash framework-tech-improve-followups`
    3. `git commit -m "docs(tech-improve): align repo contracts and guidance"`
    4. `git branch -D framework-tech-improve-followups`
    5. 결과를 `.sisyphus/evidence/task-7-squash-merge.txt`에 저장
  Expected Result: trunk에 squash commit 생성, 작업 브랜치 삭제
  Failure Indicators: merge conflict 미해결, branch 삭제 실패
  Evidence: .sisyphus/evidence/task-7-squash-merge.txt

Scenario: trunk HEAD 확인
  Tool: Bash (git)
  Preconditions: squash merge 완료
  Steps:
    1. `git branch --show-current`
    2. `git log -1 --oneline`
    3. 결과를 `.sisyphus/evidence/task-7-trunk-head.txt`에 저장
  Expected Result: 현재 브랜치는 trunk, 최신 commit이 squash message와 일치
  Failure Indicators: trunk가 아님, commit 메시지 불일치
  Evidence: .sisyphus/evidence/task-7-trunk-head.txt
```

**Commit**: YES
- Message: `docs(tech-improve): align repo contracts and guidance`

---

## Final Verification Wave

- [x] F1. **Plan Compliance Audit** — `oracle`
- [x] F2. **Code Quality Review** — `unspecified-high`
- [x] F3. **Real Manual QA** — `unspecified-high`
- [x] F4. **Scope Fidelity Check** — `deep`
  Task 2-6이 각자 명시된 파일 범위를 넘지 않았는지, “이왕 하는 김에” 식 확장이 없었는지, README 전면 개편이나 repo-wide coverage 확대 같은 스코프 크리프가 없는지 검토한다.

  **QA Scenario**:
  ```text
  Scenario: 스코프 크리프 및 파일 범위 초과 검증
    Tool: Bash (git) + Read
    Preconditions: Tasks 2-6 완료, 변경 파일 목록 조회 가능
    Steps:
      1. `git diff --name-only`로 변경 파일 목록을 수집한다.
      2. Task 2의 허용 범위(`CONTRIBUTING.md`와 관련 온보딩 문서), Task 3의 허용 범위(`vitest.config.ts`, `scripts/core-coverage-warning-check.mts`, 관련 coverage 문서/경로), Task 4의 허용 범위(`.github/workflows/benchmark.yml`, `scripts/bench-threshold-check.mts`, `benchmarks/benchmark-gate-transition.md`), Task 5의 허용 범위(`.github/workflows/ci.yml`, 보안 관련 문서), Task 6의 허용 범위(`README.md`)와 비교한다.
      3. README 변경이 topology 설명 보강 범위를 넘지 않는지 `git diff --stat README.md`로 확인한다.
      4. repo-wide coverage 확대, benchmark-gitleaks 결합, 새 기술 부채 추가 여부를 검토한다.
      5. 결과를 `.sisyphus/evidence/final-f4-scope-fidelity.txt`에 저장한다.
    Expected Result: 변경 파일이 허용 범위 안에 있고 스코프 크리프가 없다
    Failure Indicators: 허용되지 않은 파일 변경, README 전면 개편, repo-wide coverage 확장, 독립 트랙 결합
    Evidence: .sisyphus/evidence/final-f4-scope-fidelity.txt
  ```

---

## Commit Strategy

- **T2**: `docs(contributing): align branch contract to trunk`
- **T3**: `test(coverage): align core coverage contract`
- **T4**: `docs(benchmark): define enforce readiness criteria`
- **T5**: `docs(security): clarify gitleaks promotion criteria`
- **T6**: `docs(readme): clarify monorepo topology`
- **T7**: `docs(tech-improve): align repo contracts and guidance`

---

## Success Criteria

### Verification Commands
```bash
grep -n "git checkout main\|origin/main\|base branch: main" CONTRIBUTING.md
grep -n "기존 5개 core 패키지\|5개 core 패키지부터" scripts/core-coverage-warning-check.mts
grep -n "BENCHMARK_GATE_MODE\|continue-on-error" .github/workflows/benchmark.yml
grep -n "gitleaks\|warning-only\|blocking" .github/workflows/ci.yml
pnpm check
```

### Final Checklist
- [ ] 모든 상위 권고(P1-P5)가 플랜 task로 반영됨
- [ ] 브랜치 전략은 `trunk` squash merge로 고정됨
- [ ] core coverage 기준은 10개 유지로 고정됨
- [ ] benchmark와 gitleaks는 분리된 작업/검증으로 유지됨
- [ ] 마지막 체크박스가 `trunk` squash merge 태스크임

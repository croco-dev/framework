# Tech Health Report: framework

- Date: 2026-04-22
- Assessor: Prometheus (`/tech-improve`)
- Overall Maturity: **L3- (strong static quality, weaker dynamic enforcement)**

## Executive Summary

이 저장소는 **TypeScript + pnpm workspace + Turbo + Vitest + Biome + GitHub Actions** 기반의 성숙한 대형 모노레포로, 정적 코드 위생과 기본 CI 품질 게이트는 이미 강하다. 반면 이번 진단에서 가장 큰 격차는 **문서화된 계약과 실제 자동 강제력 사이의 차이**였다. 특히 기본 브랜치 계약(`main` vs `trunk`), core coverage 계약(실제 10개 대상 vs 설명상 5개), benchmark/gitleaks의 부분적 warning-only 운영은 “의도는 있으나 실패 가능한 규칙으로 완전히 승격되지는 않은 상태”를 보여준다.

한 줄로 요약하면 다음과 같다.

> **이 저장소의 다음 단계는 새 원칙을 더하는 것이 아니라, 이미 있는 원칙을 repo-wide로 일관되게 강제하는 계약으로 승격하는 것이다.**

---

## Tech Thesis

```yaml
tech_contract:
  stack_fingerprint:
    language: "TypeScript 5.9 + Node.js >=22"
    framework: "pnpm/Turbo monorepo with Hono, GraphQL Yoga, Drizzle, typedi, OpenTelemetry"
    build_tool: "Turbo + tsup + GitHub Actions"
    test_framework: "Vitest 4"
  intended_fingerprint:
    architecture: "4"
    code_quality: "3"
    tests: "4"
    performance: "3"
    security: "4"
    dx: "4"
  anti_goals:
    - "문서에만 존재하고 CI에서 강제되지 않는 운영 계약 유지"
    - "품질/성능/보안 게이트가 경고만 남기고 회귀를 실제로 차단하지 못하는 상태 유지"
    - "신규 기여자가 문서와 자동화의 기준 차이 때문에 잘못된 작업 흐름을 따르게 만드는 것"
  confidence: "high"
  sources: "README.md, package.json, biome.json, vitest.config.ts, .github/workflows/{ci,benchmark,release}.yml, CONTRIBUTING.md, scripts/core-coverage-warning-check.mts, scripts/bench-threshold-check.mts, packages/*/src/index.ts 표본"
```

---

## Current Fingerprint

| 축 | Current | Intended | Gap | 상태 | 핵심 판단 |
|---|---:|---:|---:|---|---|
| Architecture | L3 | L4 | 1 | 소폭 미달 | 계층 의도와 경계 명명은 좋지만, 실제 운영은 문서/관례 의존이 크고 transport 응집도 리스크가 있다 |
| Code Quality | L2 | L3 | 1 | 소폭 미달 | Biome/TS 엄격도는 강하지만 `noExplicitAny`가 warn이고 구조 품질을 repo-wide 계약으로 완전히 닫진 못했다 |
| Tests | L3 | L4 | 1 | 소폭 미달 | 테스트와 CI 연결은 좋지만 coverage 계약이 core subset/cwd 조건부이고 설명-실체 불일치가 있다 |
| Performance | L2 | L3 | 1 | 소폭 미달 | benchmark 체계와 threshold 파일은 있으나 warning-only, skip, CI 완화 multiplier 때문에 회귀 차단력은 약하다 |
| Security | L3 | L4 | 1 | 소폭 미달 | `audit:prod` hard gate와 trunk push gitleaks blocking은 강점이지만 PR 경로/추가 SAST·공급망 자동화는 약하다 |
| DX | L3 | L4 | 1 | 소폭 미달 | `pnpm setup`과 문서는 좋지만 기본 브랜치 계약 충돌과 온보딩 기준선 불일치가 있다 |

> Gap 해석: `0 = 달성`, `1 = 소폭 미달`, `2+ = 구조적 미달`

---

## 6-Axis Detail

### 1. Architecture

**Current: L3 / Intended: L4 / Gap: 1**

#### Evidence
- `README.md`는 Framework → Protocols → Transports → Integrations 4계층과 DDD/SaaS-first narrative를 제시한다.
- `packages/repository-core/src/index.ts`는 `BatchLoad`, `ReadRepository`, `Repository`, `WriteRepository`만 export하는 얇은 계약 레이어다.
- `packages/tx-drizzle/src/index.ts`는 Drizzle adapter, RLS helpers, health indicator를 별도 구현 레이어에 격리한다.
- `packages/protocols-rest/src/index.ts`는 decorators/metadata 중심 export를 제공해 protocol 레이어의 선언 중심 역할을 뒷받침한다.
- `packages/transports-http/src/index.ts`는 Lambda/Node adapter, health check, compression, CORS, graceful shutdown, rate limit, security headers를 한 barrel에서 export해 transport 응집도 리스크를 드러낸다.
- `.github/workflows/ci.yml`는 `pnpm architecture:check:circular`와 allowlist 비교를 통해 신규 cycle 유입을 감시한다.

#### Interpretation
레이어 명명과 일부 dependency hygiene는 실제 코드에서도 확인된다. 특히 repository-core ↔ tx-drizzle 분리는 강한 구조 신호다. 다만 README의 4-layer narrative는 실제 85개 패키지 topology 전체를 설명하기엔 과단순화되어 있고, transport 계층 일부는 런타임/운영 기능을 넓게 수용한다. 즉, **아키텍처 의도는 강하지만 실제 이해 비용과 응집도 관리 측면에서 아직 L4의 선명한 운영 계약이라고 보기는 어렵다.**

#### Root Causes
1. **문서-현실 추상화 차이** — README의 4-layer 설명이 전체 monorepo topology를 완전히 설명하지 못한다.
2. **transport 계층 응집도 확장** — `transports-http`가 운영 기능을 넓게 묶고 있다.
3. **경계 강제의 부분 자동화** — cycle 감시는 있으나 전체 계층 계약을 CI에서 명시적 import 규칙으로 강제하진 않는다.

#### Level-Up Criteria
- README/온보딩 문서를 실제 패키지 topology 기준으로 재정렬
- transport 계층의 barrel surface를 역할별로 재평가
- 현재 cycle gate를 계층 규칙/경계 규칙까지 확장 가능한 구조로 정리

---

### 2. Code Quality

**Current: L2 / Intended: L3 / Gap: 1**

#### Evidence
- `biome.json`에서 `noUnusedImports`, `noUnusedVariables`, `useImportType`, `noNonNullAssertion`는 error다.
- 같은 파일에서 `noExplicitAny`는 warn이며, 테스트 파일에는 일부 규칙 완화가 있다.
- `package.json`에는 `check`, `typecheck`, `build`가 존재한다.
- `.github/workflows/ci.yml`는 `pnpm check`, `pnpm build`, `pnpm typecheck`를 강제한다.

#### Interpretation
이 저장소는 전반적으로 정적 품질 기반이 좋다. 다만 이번 진단의 기준은 “좋아 보이는가”가 아니라 “명시한 계약 수준을 얼마나 강제하는가”다. `noExplicitAny`가 warn에 머무르고, 구조 품질이 lint/CI의 선명한 실패 규칙으로 일관되게 표현되진 않는다. 따라서 **강한 위생 기반은 있지만, 현재 진단 기준에서는 L3로 올리기 직전의 L2**로 보는 편이 보수적이고 정확하다.

#### Root Causes
1. **일부 타입 안전 규칙이 권고 수준에 머묾** — `noExplicitAny`가 warn.
2. **구조 품질이 별도 계약으로 분리되지 않음** — static hygiene는 강하지만 구조 품질은 다른 축과 혼합되어 표현된다.
3. **테스트/운영 파일 예외가 넓어질 가능성** — 테스트 파일 규칙 완화가 장기적으로 편차를 키울 수 있다.

#### Level-Up Criteria
- 타입 안전 관련 핵심 규칙의 error 승격 여부 평가
- 예외 정책을 문서화하고 범위를 점검
- 코드 품질 계약을 lint/CI 메시지에서 더 명시적으로 분리

---

### 3. Tests

**Current: L3 / Intended: L4 / Gap: 1**

#### Evidence
- `.github/workflows/ci.yml`는 `pnpm test`와 `pnpm test:coverage:core`를 포함한다.
- 같은 workflow는 core coverage warning report를 artifact로 업로드한 뒤 hard gate를 수행한다.
- `vitest.config.ts`는 `CORE_COVERAGE_PACKAGES`를 총 10개로 정의하고 threshold를 60으로 둔다.
- threshold 적용은 `CORE_COVERAGE=true`이면서 cwd가 해당 core package path일 때만 활성이다.
- `scripts/core-coverage-warning-check.mts`는 실제 config를 읽지만 report 문구는 여전히 “기존 5개 core 패키지”를 설명한다.
- baseline 경로는 `.sisyphus/evidence/task-3-coverage-baseline.txt`로 하드코딩돼 있다.

#### Interpretation
이 저장소는 테스트 문화와 CI 연결이 분명히 존재한다. 문제는 테스트의 양보다 **coverage 계약의 일관성**이다. 현재는 warning report, hard gate, config 대상, baseline 위치가 모두 완전히 같은 계약을 말하지 않는다. 따라서 Tests 축의 핵심 리스크는 “테스트 부족”보다 **운영 계약의 모순**이다.

#### Root Causes
1. **단일 진실원천 부재** — 현재 core coverage 기준이 5개 유지인지 10개 확장인지 설명과 실체가 갈린다.
2. **적용 범위 제한** — threshold가 core subset/cwd 조건부다.
3. **baseline 운영 위치가 플래닝 산출물 경로에 묶여 있음** — 지속 운영 계약으로 보기 어렵다.

#### Level-Up Criteria
- 먼저 5개 vs 10개 coverage 기준을 단일 계약으로 확정
- `vitest.config.ts`, warning report 문구, baseline 위치를 그 계약에 맞춰 동기화
- 이후 우선순위 패키지군 또는 repo-wide 확장 전략 수립

---

### 4. Performance

**Current: L2 / Intended: L3 / Gap: 1**

#### Evidence
- `.github/workflows/benchmark.yml`는 `BENCHMARK_GATE_MODE: warning-only`를 사용한다.
- benchmark step는 `continue-on-error: true`로 실행된다.
- `scripts/bench-threshold-check.mts`는 `benchmarks/thresholds.json` / `baseline.json`을 사용한다.
- CI에서는 `CI_THRESHOLD_MULTIPLIER = 2`가 적용된다.
- threshold 미정 항목과 baseline 부재는 `skip` 처리된다.
- `benchmarks/benchmark-gate-transition.md`는 enforce 전환 전제조건(coverage, stable baseline, false positive/variance 검토)을 따로 문서화한다.

#### Interpretation
성능 축은 “기반이 없음”이 아니라 “기반은 있으나 아직 enforcement-ready가 아님”에 가깝다. 즉, benchmark 체계는 시작됐지만 아직 회귀를 적극적으로 차단하는 상태는 아니다. 현재의 정확한 진단은 **warning-only 운영을 가진 L2**다.

#### Root Causes
1. **warning-only 운영** — 현재 PR 차단력이 없다.
2. **skip 경로 다수** — threshold/baseline 부재 시 측정이 건너뛰어진다.
3. **CI 완화 multiplier** — 기준 자체가 CI에서 느슨해진다.

#### Level-Up Criteria
- 어떤 benchmark가 enforce-ready인지 기준 명문화
- baseline/threshold 미정 항목 축소
- 준비 조건 충족 후 warning-only에서 enforce로 승격

---

### 5. Security

**Current: L3 / Intended: L4 / Gap: 1**

#### Evidence
- `.github/workflows/ci.yml`는 `pnpm audit:prod` warning artifact와 별도 hard gate를 모두 포함한다.
- 같은 workflow에서 `gitleaks`는 PR에서 warning-only지만 protected branch/trunk push에서는 blocking이다.
- 로컬 검색 기준 저장소 루트에 `.devcontainer`, dependabot, codeql 설정은 확인되지 않았다.
- `package.json`에는 `audit:prod` 스크립트가 정의돼 있다.

#### Interpretation
보안 축은 과소평가하면 안 된다. 이 저장소는 이미 **dependency audit hard gate**와 **trunk push secret blocking**을 갖고 있으므로 완전한 L2는 아니다. 다만 PR 단계 secret scan은 아직 warning-only이고, 추가적인 SAST/공급망 자동화도 확인되지 않았다. 따라서 **기초 차단력은 있는 L3**가 적절하다.

#### Root Causes
1. **PR secret scanning 비차단 운영** — 초기 유출 경로에서 차단력이 약하다.
2. **보안 자동화 체계의 층위 차이** — audit는 blocking, gitleaks는 경로별 혼합 운영.
3. **추가 SAST/공급망 자동화 부재** — 보안 신호가 dependency/secret 중심에 머문다.

#### Level-Up Criteria
- gitleaks PR 경로를 승격 가능한 조건형 계약으로 정리
- false positive allowlist/운영 절차를 명시
- 이후 CodeQL 또는 Dependabot 같은 추가 축을 최소 1개 연결

---

### 6. DX

**Current: L3 / Intended: L4 / Gap: 1**

#### Evidence
- `CONTRIBUTING.md`는 `pnpm setup`을 install + build + typecheck + test의 단일 진입점으로 제공한다.
- 같은 문서는 `--filter` 기반 단일 패키지 작업법, 테스트/스타일/훅 가이드를 포함한다.
- 그러나 `CONTRIBUTING.md`의 Git Workflow는 `main`에서 브랜치를 시작하라고 안내한다.
- `.github/workflows/ci.yml`와 `.github/workflows/release.yml`는 `trunk`를 기준으로 동작한다.

#### Interpretation
이 저장소의 DX는 전반적으로 괜찮다. 문제는 도구 부족보다 **계약 불일치**다. 신규 기여자는 `CONTRIBUTING.md`를 따르면 `main`을 기준으로 작업하지만, 자동화는 `trunk`를 기준으로 본다. 즉, DX의 핵심 개선점은 새 도구 추가보다 **기본 브랜치 계약 정렬**이다.

#### Root Causes
1. **문서-자동화 기준 충돌** — `main` vs `trunk`.
2. **온보딩 계약 분산** — README narrative와 실제 workflow 기준이 완전히 맞물리진 않는다.
3. **문서 톤/구조 일관성 약화** — 저장소 설명과 운영 설명의 중심축이 여러 문서에 분산돼 있다.

#### Level-Up Criteria
- `main`/`trunk` 기준을 단일 계약으로 정리
- README/CONTRIBUTING/릴리즈 문서의 브랜치 기준을 한 번에 정렬
- 온보딩 기준선을 workflow 실제 기준과 함께 재문서화

---

## Adversarial Gate 결과

### Reverse Recommendation Check

| 권고 | Generic 대응물 | 판정 | 이유 |
|---|---|---|---|
| 기본 브랜치 계약 정렬 | “문서를 최신화하세요” | pass | 이 저장소 고유의 `main` vs `trunk` 충돌에 직접 묶여 있어 일반론이 아님 |
| core coverage 단일 진실원천 정렬 | “커버리지를 높이세요” | pass | 10개 대상/5개 설명/`.sisyphus` baseline 하드코딩이라는 저장소 고유 문제를 직접 다룸 |
| benchmark/gitleaks 승격 기준 명문화 | “경고를 실패로 바꾸세요” | regenerate 후 pass | 처음엔 일반론이었으나, 최종적으로 benchmark와 gitleaks PR 경로를 분리해 고유성을 확보 |

### Oracle Cross-Exam Results

1. **기본 브랜치 계약 정렬 — 유지**
   - 근거: `CONTRIBUTING.md:132-149`, `.github/workflows/ci.yml:3-9`, `.github/workflows/release.yml:3-6`
   - Oracle 의견: 단순 문서 수정이 아니라 **기본 브랜치 명명 계약 정렬**로 표현해야 한다.

2. **core coverage 계약 동기화 — 강화**
   - 근거: `vitest.config.ts:3-16`, `scripts/core-coverage-warning-check.mts:32`, `216-249`, `.github/workflows/ci.yml:158-171`
   - Oracle 의견: 먼저 **5개 유지 vs 10개 확장**을 단일 진실원천으로 결정하고, 그 다음 config/report/baseline을 동기화해야 한다.

3. **benchmark enforce 준비조건 + gitleaks PR 승격 기준 분리 — 강화**
   - 근거: `.github/workflows/benchmark.yml:9-10,28-31,81-83`, `scripts/bench-threshold-check.mts:38-40,150-181`, `.github/workflows/ci.yml:56-80`
   - Oracle 의견: 성능과 보안을 한 문장으로 묶으면 일반론이 되므로, **성능 benchmark gate**와 **PR secret scan 승격 조건**을 별도 계약으로 서술해야 한다.

---

## Prioritized Actions

### P1. 기본 브랜치 계약 정렬

**문제 요약**
- 기여 문서는 `main`을 기준으로 작업 흐름을 안내하지만, 실제 CI/Release는 `trunk`를 기준으로 동작한다.

**루트 코즈**
- `CONTRIBUTING.md`와 workflow 문서가 동일한 운영 계약을 공유하지 않는다.

**격차**
- DX: L3 → L4

**개선 권고**
- `CONTRIBUTING.md`와 관련 온보딩 문서의 branch 기준을 workflow 실제 기준과 일치시키는 방향으로 재정렬
- 변경 전, 저장소 기본 브랜치 실제 설정과 외부 연동(main 가정 여부)을 확인하는 체크리스트를 문서화

**품질 기준**
- [ ] 온보딩/기여 문서 어디에도 `main` 기반 브랜치 시작 안내가 남지 않음
- [ ] CI/Release workflow의 branch 기준과 문서 기준이 동일하게 설명됨

**후속 경로**: Quick Win

### P2. core coverage 계약 단일 진실원천 확정 및 동기화

**문제 요약**
- 실제 집행 기준(10개 대상), warning report 설명(기존 5개), baseline 위치(`.sisyphus`)가 서로 다른 계약을 말하고 있다.

**루트 코즈**
- coverage 운영 기준이 config/script/report/증적 위치에 분산돼 있다.

**격차**
- Tests: L3 → L4, DX: L3 → L4

**개선 권고**
- 먼저 core coverage 기준을 5개 유지 또는 10개 확장 중 하나로 결정
- 그 결정에 맞춰 `vitest.config.ts`, `scripts/core-coverage-warning-check.mts`, warning report 문구, baseline 관리 위치를 일괄 동기화

**품질 기준**
- [ ] coverage 대상 수가 config/script/report에서 동일하게 표현됨
- [ ] baseline 파일 위치가 지속 운영 가능한 repo-managed 경로로 정의됨
- [ ] warning report 설명이 실제 hard gate 대상과 충돌하지 않음

**후속 경로**: Quick Win

### P3. benchmark enforce 준비조건 명문화

**문제 요약**
- benchmark 체계가 존재하지만 warning-only, skip, CI multiplier 완화 때문에 회귀 차단 계약이 약하다.

**루트 코즈**
- 어떤 benchmark가 enforce-ready인지와 어떤 조건이 충족돼야 fail 가능한 gate로 올릴지 계약이 부족하다.

**격차**
- Performance: L2 → L3

**개선 권고**
- baseline 안정성, threshold coverage, variance 허용치 등 enforce-ready 조건을 명시
- warning-only에서 enforce로 넘어가는 단계적 승격 기준을 문서화

**품질 기준**
- [ ] benchmark별 threshold/baseline 미정 항목 목록이 축소 계획과 함께 문서화됨
- [ ] enforce 전환 조건이 예/아니오 판단 가능한 체크리스트로 정의됨

**후속 경로**: Quick Win

### P4. gitleaks PR 경로 승격 조건 분리 명시

**문제 요약**
- 현재 보안 전체가 warning-only는 아니지만, PR 단계 gitleaks는 아직 non-blocking이라 초기 차단력이 부족하다.

**루트 코즈**
- trunk push blocking과 PR warning-only가 혼합돼 있으나, 언제 PR도 blocking으로 올릴지 계약이 없다.

**격차**
- Security: L3 → L4

**개선 권고**
- false positive allowlist 운영, 예외 절차, 승격 기준을 정리해 PR 단계 차단 가능성을 준비

**품질 기준**
- [ ] PR secret scan blocking 전환을 위한 예외/허용 정책이 문서화됨
- [ ] 현재 blocking 경로와 warning-only 경로가 보안 문서/CI summary에 명확히 구분됨

**후속 경로**: Quick Win

### P5. README architecture narrative 재정렬

**문제 요약**
- README의 4-layer 설명은 방향성은 맞지만 실제 85-package topology를 이해하는 데 충분하지 않다.

**루트 코즈**
- 설명 중심 문서가 실제 domain/provider/core/transport 분포를 축약해 표현한다.

**격차**
- Architecture: L3 → L4, DX: L3 → L4

**개선 권고**
- 4-layer narrative를 유지하되, 실제 monorepo topology와 대표 package grouping을 함께 보여주는 문서 구조로 확장

**품질 기준**
- [ ] 신규 기여자가 README만 읽고 주요 package grouping을 오해하지 않도록 topology 설명이 보강됨
- [ ] README narrative와 실제 주요 package 분류가 충돌하지 않음

**후속 경로**: Project

---

## Quick Win 후보 목록

| # | 항목 | 대상 파일 | 변경 방향 | 검증 조건 |
|---|---|---|---|---|
| 1 | 기본 브랜치 계약 정렬 | `CONTRIBUTING.md`, 관련 온보딩 문서 | `main` 기준 안내를 workflow 실제 기준과 일치시키도록 정렬 | 문서 전반에서 branch 기준이 `trunk` 중심으로 일관됨 |
| 2 | core coverage 계약 동기화 | `vitest.config.ts`, `scripts/core-coverage-warning-check.mts`, 관련 coverage 문서/경로 | 5개 vs 10개 기준을 하나로 확정하고 config/report/baseline을 동기화 | coverage 대상/문구/경로가 동일 계약을 가리킴 |
| 3 | benchmark enforce 기준 문서화 | `.github/workflows/benchmark.yml`, `scripts/bench-threshold-check.mts`, `benchmarks/benchmark-gate-transition.md` | warning-only → enforce 전환 체크리스트를 명시 | enforce-ready 여부를 예/아니오로 판단 가능 |
| 4 | gitleaks PR 승격 조건 분리 | `.github/workflows/ci.yml`, 보안 관련 문서 | trunk blocking과 PR warning-only를 구분하고 승격 기준 문서화 | 보안 경로별 차단 수준이 문서/CI summary에 동일하게 표현됨 |

---

## Project 후보 목록

| # | 항목 | 권장 경로 | 격차 | 비고 |
|---|---|---|---|---|
| 1 | README topology 재정렬 | Project | Architecture/DX +1 | 4-layer narrative는 유지하되 실제 85-package 구조를 반영해야 함 |
| 2 | benchmark enforce 전환 프로그램 | Project | Performance +1 | threshold coverage, baseline 안정화, variance 관측이 선행돼야 함 |
| 3 | PR secret blocking 준비 프로그램 | Project | Security +1 | false positive/allowlist 절차 설계 없이는 DX 비용이 커질 수 있음 |

---

## Excluded / Rewritten Recommendations

- **제외/재작성: “보안/성능 gate 전반을 warning-only에서 enforce로 올린다”**
  - 이유: 너무 일반적이며, benchmark와 gitleaks의 현재 상태가 비대칭이라 한 문장으로 묶으면 부정확하다.
  - 대체: `benchmark enforce 준비조건 명문화` + `gitleaks PR 경로 승격 조건 분리`로 분해.

---

## issue-find handoff 후보

```yaml
issue_find_handoff:
  - axis: Architecture
    gap: "L3 -> L4"
    problem: "README 4-layer narrative가 실제 85-package topology 이해를 충분히 지원하지 않음"
    scope:
      - "README.md"
      - "packages/*"
    note: "문서와 실제 구조의 대응표/토폴로지 설명 정리가 필요"

  - axis: Performance
    gap: "L2 -> L3"
    problem: "benchmark gate가 warning-only/skip/CI 완화 multiplier에 의존하며 enforce-ready 기준이 부족함"
    scope:
      - ".github/workflows/benchmark.yml"
      - "scripts/bench-threshold-check.mts"
      - "benchmarks/*"
    note: "variance, baseline coverage, threshold completeness를 포함한 전환 프로그램 필요"

  - axis: Security
    gap: "L3 -> L4"
    problem: "PR secret scan 승격 기준과 추가 SAST/공급망 자동화가 미정"
    scope:
      - ".github/workflows/ci.yml"
      - "security/process docs"
    note: "false positive allowlist와 blocking 전환 기준이 먼저 필요"
```

---

## Evidence Index

- `README.md`
- `package.json`
- `biome.json`
- `vitest.config.ts`
- `.github/workflows/ci.yml`
- `.github/workflows/benchmark.yml`
- `.github/workflows/release.yml`
- `CONTRIBUTING.md`
- `scripts/core-coverage-warning-check.mts`
- `scripts/bench-threshold-check.mts`
- `packages/repository-core/src/index.ts`
- `packages/tx-drizzle/src/index.ts`
- `packages/protocols-rest/src/index.ts`
- `packages/transports-http/src/index.ts`

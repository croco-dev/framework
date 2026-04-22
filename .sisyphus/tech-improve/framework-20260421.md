# Tech Health Report: framework

## Executive Summary

이 저장소는 **TypeScript 5.9.3 + Node.js 22+ + pnpm workspace + Turbo + tsup + Vitest + Biome + GitHub Actions** 기반의 대형 모노레포이며, 정적 코드 위생 측면에서는 이미 강한 기반을 갖추고 있다. 특히 **Biome + strict TypeScript + CI gate + 일관된 테스트 패턴**은 분명한 강점이다.

반면 이번 진단에서 가장 크게 드러난 약점은 **동적 품질 보증을 repo-wide로 강제하는 자동화의 부족**이다. 아키텍처 원칙은 문서화돼 있지만 CI에서 강제되지 않고, 테스트는 충분히 많지만 coverage threshold가 전체 저장소에 일관되게 적용되지 않으며, 성능·보안도 “의도와 일부 기반”은 있으나 실제 회귀 차단력과 지속 감시 수준은 아직 낮다.

따라서 이 저장소의 다음 단계는 새 원칙을 대거 도입하는 것이 아니라, **이미 있는 원칙을 자동화된 실패 가능한 규칙으로 승격하는 것**이다. 한 줄로 요약하면:

> **코드 품질은 이미 강하므로, 다음 목표는 아키텍처·테스트·성능·보안의 자동 강제력을 끌어올려 균형 잡힌 L4형 저장소로 만드는 것**이다.

---

## Repository Snapshot

- 언어: **TypeScript 5.9.3**
- 런타임: **Node.js 22+**
- 모노레포: **pnpm workspace + Turbo**
- 패키지 규모: **약 85개 패키지**
- 빌드: **tsup**
- 테스트: **Vitest 4.0.16**
- 린트/포맷: **Biome 2.3.12**
- CI/CD: **GitHub Actions**
- 주요 기술: **Hono, GraphQL Yoga, Drizzle ORM, typedi, OpenTelemetry**
- 문서상 아키텍처: **Framework → Protocols → Transports → Integrations** 4계층 + DDD/UoW/Repository 패턴

---

## Tech Fingerprint

| Axis | Current | Intended | Gap | Status | 핵심 판단 |
|------|---------|----------|-----|--------|-----------|
| Architecture | L3 | L4 | 1 | 소폭 미달 | 구조 의도는 좋지만 intra-package 순환 의존과 경계 강제 CI 부재로 실제 운영 강도는 아직 L4 미만 |
| CodeQuality | L4 | L4 | 0 | 강점 | Biome, strict TS, CI gate, `as any`/`@ts-ignore` 억제가 강력하며 현재 저장소의 선도 축 |
| Tests | L3 | L4 | 1 | 소폭 미달 | 테스트 수와 CI 통합은 양호하지만 coverage threshold가 일부 core 패키지에만 적용돼 회귀 방지력이 제한적 |
| Performance | L2 | L3 | 1 | 소폭 미달 | threshold/workflow는 있으나 실제 benchmark 실체와 실패하는 gate가 약해 회귀 차단력이 낮음 |
| Security | L2 | L3 | 1 | 소폭 미달 | `audit:prod`와 권한 패턴은 있으나 secret scanning, SAST, 공급망 모니터링이 비어 있음 |
| DX | L3 | L4 | 1 | 소폭 미달 | 문서와 툴링은 좋지만 one-command setup, env 문서화, 온보딩 검증이 부족 |

> Gap 해석: `0=달성`, `1=소폭 미달`, `2+=구조적 미달`

---

## 6-Axis Detail

### 1. Architecture

**Current: L3 / Intended: L4 / Gap: 1**

#### 근거
- 4계층 구조와 DDD/UoW/Repository 패턴이 README/AGENTS 수준에서 문서화되어 있다.
- 패키지 내부 순환 의존 **5건**이 확인되었다.
- 대표 예시:
  - `packages/problems-core/src/libs/Problem.ts` → `ProblemExtensions.ts` → `InvalidExtensionsProblem.ts`
  - `packages/events-core/src/libs/EventBus.ts` → `EventHandler.ts` → `interfaces/EventSubscribing.ts`
  - `packages/auth-core/src/libs/interfaces/AbstractRoleRegistry.ts` → `rbac/Role.ts`
  - `packages/migration-runner/src/libs/types.ts` → `MigrationStore.ts`
  - `packages/tx-drizzle/src/libs/RlsTxAdapter.ts` → 관련 types
- 대형 파일(500줄+) 문제는 광범위하진 않지만, 일부 provider 계열은 역할 응집도 리스크가 있다.
- `dependency-cruiser`, `madge --circular`, import-linter류의 **아키텍처 강제 CI**는 없다.

#### 해석
문서화된 설계 의도와 패키지 구조는 분명히 L3 이상이다. 다만 현재 구조는 “지켜지는 규칙”보다는 “권장되는 규칙”에 가깝다. 즉, 설계는 있으나 자동 강제가 부족하다.

#### 주요 문제 3개
1. **intra-package 순환 의존 5건**
2. **`protocols-*` / `transports-*` 경계가 문서 의존적이고 CI로 강제되지 않음**
3. **아키텍처 검사 자동화 부재**

#### L4 권고
- 순환 의존 제거 및 신규 유입 차단 규칙 추가
- `dependency-cruiser` 또는 `madge` 기반 CI 검사 도입
- 문서 규칙을 import 규칙/검사 규칙으로 승격

---

### 2. Code Quality

**Current: L4 / Intended: L4 / Gap: 0**

#### 근거
- `biome.json` 기반 강한 린트/포맷 규칙 존재
- `.github/workflows/ci.yml`에서 lint/CI gate가 동작한다.
- `packages/shared/utils-tsconfig/tsconfig.base.json`의 `strict: true`
- 표본 구현(`packages/framework-context/src/libs/Container.ts`, `packages/retry-core/src/libs/RetryTemplate.ts`, `packages/transports-http/src/libs/CrocoApp.ts`)에서 단일 책임과 과도한 복잡도 억제가 확인되었다.
- `as any` **0회**, `@ts-ignore` **0회**로 보고되었다.

#### 해석
이 저장소의 최강 축은 Code Quality다. 이미 충분히 강한 정적 품질 기반이 있으며, 현재 리스크들은 L4를 부정하기보다 L4 후반~L5 진입을 막는 요소에 가깝다.

#### 주요 문제 3개
1. **jscpd 기반 중복 코드 자동 검출 부재**
2. **type-coverage 측정/게이트 부재**
3. **아키텍처 린트 부재**

#### 유지·보완 권고
- Code Quality는 “전면 개선 대상”이 아니라 **강점 유지 축**으로 관리
- jscpd와 type-coverage는 필요시 후속 개선 프로젝트로 검토

---

### 3. Tests

**Current: L3 / Intended: L4 / Gap: 1**

#### 근거
- 테스트 파일 **571개**, 소스 파일 **757개**로 비율 약 **75%**
- `.skip` / `.only` 사용 없음
- `.github/workflows/ci.yml` line 46-50에서 `pnpm test` + `pnpm test:coverage:core` 실행
- `vitest.config.ts` line 17-24에서 `CORE_COVERAGE=true`일 때 **5개 core 패키지에만 60% threshold** 적용
- 모노레포 전반에 **58개 개별 `vitest.config.ts`** 존재

#### 해석
테스트가 충분히 많고 CI에 잘 연결돼 있으므로 L1/L2로 낮게 볼 필요는 없다. 하지만 “파일 수가 많다”와 “회귀를 강하게 막는다”는 다르다. 현재 저장소는 테스트 실행 체계는 좋지만, repo-wide 품질 기준 강제는 아직 약하다.

#### 주요 문제 3개
1. **coverage threshold가 전체 패키지에 미적용**
2. **mutation testing 부재**
3. **property-based / contract testing 부재**

#### L4 권고
- 전체 패키지 또는 최소한 우선순위 패키지군에 coverage threshold 확대
- 핵심 패키지 중심 mutation testing 도입 검토
- `fast-check` 등 property-based testing을 고위험 알고리즘 패키지에 시범 도입

---

### 4. Performance

**Current: L2 / Intended: L3 / Gap: 1**

#### 근거
- 근거 파일: `benchmarks/thresholds.json`, `.github/workflows/benchmark.yml`, `turbo.json`, `scripts/bench-threshold-check.mts`
- 성능 예산과 벤치마크 워크플로 흔적은 존재한다.
- 그러나 `benchmarks/`에 **실제 benchmark 테스트 파일이 없다**고 보고되었다.
- `.github/workflows/benchmark.yml`에 `continue-on-error: true`가 있어 성능 회귀가 PR 차단으로 이어지지 않는다.
- 프로파일링 자동화 및 CI artifact 저장이 없어 회귀 원인 분석이 수동적이다.

#### 해석
이 축은 가장 과대평가되기 쉬운 영역이다. 구성 파일과 threshold JSON이 있는 것은 “의도”의 증거이지, 곧바로 “회귀 방지 체계가 실제 작동 중”이라는 뜻은 아니다. 현재는 L2가 타당하다.

#### 주요 문제 3개
1. **실 benchmark 실체 부재**
2. **실패 가능한 gate 부재 (`continue-on-error`)**
3. **프로파일링/아티팩트 자동화 부재**

#### L3 권고
- 대표 시나리오 기준 benchmark 파일 추가
- benchmark workflow를 실패 가능한 gate로 전환
- 결과 artifact 저장 및 최소 회귀 분석 경로 마련

---

### 5. Security

**Current: L2 / Intended: L3 / Gap: 1**

#### 근거
- `.github/workflows/ci.yml:34` 기준 `pnpm audit:prod`가 CI에 포함되어 있다.
- `.gitignore:9-12`에 `.env` 계열 파일이 제외된다.
- `packages/auth-core/src/...`에는 `@RequirePermission`, Guard 등 권한/인가 패턴이 존재한다.
- `lefthook.yaml:5-7`에는 Biome만 있고 **시크릿 스캔이 없다**.
- CodeQL/SonarQube 같은 **SAST**, Dependabot 같은 **공급망 취약점 추적**도 확인되지 않았다.

#### 해석
직접적인 대형 취약점이 발견된 것은 아니다. 문제는 코드 결함보다 **보안 자동화 성숙도**다. 즉, 현재 보안 상태는 “문제가 없어 보이는 상태”이지 “지속적으로 탐지·차단되는 상태”는 아니다.

#### 주요 문제 3개
1. **시크릿 스캔 부재**
2. **SAST/정적 보안 스캐닝 CI 미연동**
3. **공급망 모니터링 부재**

#### L3 권고
- lefthook 또는 CI에 `gitleaks` / `detect-secrets` 중 1종 추가
- `audit:prod`를 더 강한 실패 신호로 연결
- CodeQL 또는 Dependabot 중 하나부터 최소 도입

---

### 6. DX

**Current: L3 / Intended: L4 / Gap: 1**

#### 근거
- `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, `package.json` scripts, `lefthook`, Turbo, Biome 등 기반이 잘 갖춰져 있다.
- 문서와 워크플로는 이미 좋은 편이다.
- 그러나 **단일 setup/bootstrap 명령**, `.env.example`, 환경 변수 가이드, 빌드/테스트 예상 시간 안내, 첫 실행 검증 자동화는 부족하다.

#### 해석
기존 기여자 관점 DX는 준수 이상이지만, 신규 기여자 관점에서는 진입 흐름이 여러 문서와 명령으로 분산돼 있다. 다음 단계는 도구 추가보다 “진입점 일원화”다.

#### 주요 문제 3개
1. **단일 셋업 스크립트 부재**
2. **환경 변수 문서화 / `.env.example` 부재**
3. **온보딩 자동 검증 및 예상 시간 안내 부재**

#### L4 권고
- one-command setup 제공
- `.env.example` 및 환경 변수 계약 문서화
- build/test 예상 시간 및 첫 실행 확인 절차 명시

---

## Oracle Cross-Exam Results

교차검증 결과, 이번 진단의 핵심 보정은 다음과 같다.

1. **Architecture는 L3.5보다 L3에 가깝다.**
   - 이유: 문서화는 강하지만 순환 의존 5건과 경계 강제 CI 부재가 실제 운영 강도를 낮춘다.

2. **Code Quality는 L4가 적정하다.**
   - 이유: 현재 미도입 항목은 L4 자체를 부정하기보다 L4.5+/L5를 막는 요인에 가깝다.

3. **Tests의 L3는 약간 낙관적일 수 있으나, 보수적으로 봐도 L2.5~L3 범위다.**
   - 이유: 테스트 파일 수보다 coverage threshold 범위와 회귀 방지력이 더 중요하다.

4. **Performance는 가장 과대평가되기 쉬운 축이다.**
   - 이유: threshold/workflow는 있으나 실제 benchmark와 실패하는 gate가 약하다.

5. **Security L2, DX L3 평가는 타당하다.**

### 반드시 기억할 핵심 메시지 3개
- **강점은 정적 코드 위생(Code Quality), 약점은 동적 품질 보증 자동화다.**
- **문서화된 원칙보다 CI에서 강제되는 규칙이 적다.**
- **다음 성숙도 점프는 새 원칙 추가가 아니라 기존 원칙의 repo-wide 자동화다.**

---

## Prioritized Actions

### Quick Wins

1. **아키텍처 경계 / 순환 의존 검사 CI 추가**
2. **repo-wide 최소 coverage 기준 통일 또는 우선 패키지군 확대**
3. **benchmark workflow를 실행 + 실패 가능한 상태로 전환**
4. **secret scanning + SAST 또는 supply-chain monitoring 중 최소 1종 연결**
5. **one-command setup 마련**

### Strategic Projects

1. **Architecture Enforcement Program**
   - 목표: 순환 의존 제거 + import 경계 강제 + 설계 규칙 CI 승격

2. **Quality Signal Upgrade**
   - 목표: coverage threshold 확대 + 핵심 패키지 mutation/property-based testing 도입

3. **Performance Reliability Track**
   - 목표: 실 benchmark, artifact, 회귀 차단 체계 확립

4. **Security Automation Baseline**
   - 목표: secret scanning, SAST, dependency monitoring의 최소 자동화 기준선 수립

5. **Developer Onboarding Platform**
   - 목표: setup, env, build/test expectation을 하나의 흐름으로 통합

---

## Reverse Recommendations

다음 항목은 지금 당장 추진하기보다 보류하는 편이 낫다.

1. **storage/provider 전반 공통 추상화를 먼저 도입하는 것**
   - 현재 증거는 역할 과밀이지, 전면 공통화 필요 자체를 직접 증명하지 않는다.

2. **전 저장소에 동일 coverage threshold를 한 번에 강제하는 것**
   - 패키지 성숙도 차이를 무시하면 CI 잡음만 급증할 수 있다.

3. **TS 옵션을 루트에서 한꺼번에 더 강화하는 것**
   - 대규모 정리 작업으로 번질 가능성이 높다.

4. **보안 도구를 여러 개 동시에 도입하는 것**
   - false positive 관리 비용이 빠르게 커진다.

5. **대형 성능 관측 플랫폼을 먼저 구축하는 것**
   - 지금은 benchmark 체계를 실제 작동시키는 것이 우선이다.

---

## Suggested Execution Order

후속 실행 플랜을 만든다면 하나의 거대 리팩터링보다 아래 순서의 **작은 실행 계획 묶음**이 적합하다.

1. **Boundary Hardening**
2. **Test Quality Gate**
3. **Security Automation Baseline**
4. **Contributor Onboarding**
5. **Performance Reliability Track**

---

## Final Assessment

이 저장소는 이미 “잘 정돈된 코드베이스”에 가깝다. 문제는 기반이 약해서가 아니라, **좋은 기반이 아직 모든 축에서 자동 강제력으로 연결되지 않았다는 점**이다. 따라서 next step은 대공사가 아니라, 작은 규칙들을 실패 가능한 자동화로 연결하는 일이다.

가장 실용적인 목표 상태는 다음과 같다.

- **Architecture: L4**
- **Code Quality: L4 유지**
- **Tests: L4**
- **Performance: L3**
- **Security: L3**
- **DX: L4**

즉, **Code Quality 선도형 저장소를 Enforcement 강화형 저장소로 진화시키는 것**이 이 repo에 가장 현실적인 기술 건강도 개선 전략이다.

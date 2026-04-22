# Tech Health Report: framework

## Executive Summary

이 저장소는 `pnpm + turbo + strict TypeScript + Biome + Vitest` 기반의 대형 모노레포로, 전반적인 기술 건강도는 **높은 편(L4 중심)** 이다. 특히 코드 품질 체계, 개발자 경험, 보안 기본 위생, 계층형 패키지 분리는 강하다.

다만 핵심 리스크는 체계의 부재가 아니라 **기존 체계의 비차단 운영과 부분 적용**이다. 대표적으로 순환 의존 검사는 warning-only이고, secret scan도 warning-only이며, coverage threshold는 core 5개 패키지에만 적용된다. 따라서 가장 효과적인 개선은 새 시스템 도입보다 **기존 경고 체계를 차단형 운영으로 승격**하는 것이다.

## Tech Fingerprint

| Axis | Current | Target | Gap | 근거 요약 |
|---|---|---:|---:|---|
| Architecture | L4 candidate | L4 | 0 | 4계층 구조 문서화, core/implementation 분리, 일부 경계 강제 존재. 다만 circular 검사는 warning-only |
| Code Quality | L4 candidate | L4 | 0 | strict TS, Biome, hooks, CI hard gate 강함. 다만 일부 완화 옵션과 테스트 내 `as any` 존재 |
| Tests | L3 | L4 | 1 | 테스트 분포와 CI 연동은 좋지만 coverage threshold가 core 5개 패키지에 한정 |
| Performance | L3 | L4 | 1 | baseline/threshold/bench infra 존재. 다만 benchmark gate는 warning-only |
| Security | L4 candidate | L4 | 0 | audit hard gate, env validation, timing-safe compare, rate limiting 존재. 다만 gitleaks는 warning-only |
| DX | L4 candidate | L4 | 0 | README/CONTRIBUTING/package README 풍부, `pnpm setup` 진입점 우수. 다만 roadmap drift 신호 존재 |

> 해석: 현재 수준은 다수 축에서 L4 후보로 방어 가능하지만, Architecture/Security/DX는 **조건부 L4**로 표현하는 것이 안전하다.

## 6-Axis Detail

### 1. Architecture — L4 candidate (partial enforcement)

**Strengths**
- 루트 README가 `Framework → Protocols → Transports → Integrations` 4계층 구조를 명시한다.
- `repository-core`와 `*-drizzle` 구현체 분리, `auth-core`와 `auth-drizzle` 분리 등 core vs implementation 패턴이 명확하다.
- `packages/repository-core/src`에서 `drizzle` 참조가 검색되지 않아 아키텍처 오염 금지 규칙이 실제 코드에서도 지켜진다.
- `architecture:check:circular` 명령과 `CircularDependencyProblem`이 존재한다.

**Weaknesses / Risks**
- CI의 순환 의존 검사는 `warning-only`라 신규 위반을 기계적으로 차단하지 못한다.
- 구조 원칙은 잘 문서화되어 있으나, 전면적 layer rule enforcement까지는 확인되지 않았다.

**Evidence**
- `README.md`
- `package.json`
- `.github/workflows/ci.yml`
- `packages/repository-core/README.md`
- `packages/repository-core/package.json`
- `packages/tx-drizzle/package.json`
- `packages/auth-drizzle/package.json`

### 2. Code Quality — L4 candidate

**Strengths**
- 루트 `tsconfig` 계층에서 strict TypeScript를 사용한다.
- Biome가 `useImportType`, `noNonNullAssertion` 등을 error로 강제한다.
- CI hard gate에 `check`, `build`, `typecheck`, `test`가 포함된다.
- Lefthook pre-commit/pre-push가 품질 회귀를 조기에 잡는다.

**Weaknesses / Risks**
- `noExplicitAny`는 warning이며, 실제로 7개 파일 29건의 `as any/@ts-expect-error`가 존재한다.
- 다만 대부분은 테스트 mock/타입 계약 검증에 집중되어 있어 운영 코드 오염으로 보긴 어렵다.
- `strictPropertyInitialization: false`, `noUnusedLocals/Parameters: false` 같은 완화 지점은 최상위 엄격도(L5) 근거를 약화한다.

**Evidence**
- `tsconfig.json`
- `biome.json`
- `lefthook.yaml`
- `.github/workflows/ci.yml`
- `packages/protocols-graphql/src/tests/GuardChain.spec.ts`
- `packages/protocols-graphql/src/tests/InterceptorChain.spec.ts`

### 3. Tests — L3

**Strengths**
- `packages/*/src/tests/*.spec.ts` 기준으로 테스트 파일이 100개 이상 분포한다.
- `.skip/.only` 흔적이 없어 기본 hygiene는 양호하다.
- CI에서 `pnpm test`와 `pnpm test:coverage:core`가 hard gate로 동작한다.
- 루트 `vitest.config.ts`가 표준 실행 환경과 coverage provider를 제공한다.

**Weaknesses / Risks**
- coverage threshold가 저장소 전체가 아니라 core 5개 패키지에만 적용된다.
- threshold 값도 60%로, “핵심 패키지 최소 방어선” 수준에 가깝다.
- 전 repo 차원의 coverage governance로 보기에는 근거가 부족하다.

**Evidence**
- `vitest.config.ts`
- `.github/workflows/ci.yml`
- `packages/*/src/tests/*.spec.ts` 전반

### 4. Performance — L3

**Strengths**
- `bench:check`, `bench:update`, baseline/threshold JSON, transition 문서가 존재한다.
- `transports-http`, `events-core`, `telemetry-sdk-node` 등에서 `.bench.ts` 기반 측정이 이루어진다.
- 단순 존재 여부가 아니라 use-case 기반 벤치 시나리오가 확인된다.

**Weaknesses / Risks**
- benchmark workflow는 현재 `warning-only` 모드다.
- 측정 인프라는 있지만 성능 회귀를 강제 차단하는 운영 수준으로 보기 어렵다.
- README의 성능 표현을 현재 benchmark 결과와 직접 연결해 성숙도 근거로 사용하면 과장될 수 있다.

**Evidence**
- `package.json`
- `benchmarks/baseline.json`
- `benchmarks/thresholds.json`
- `benchmarks/benchmark-gate-transition.md`
- `packages/transports-http/src/tests/CrocoApp.bench.ts`
- `packages/telemetry-sdk-node/src/tests/TelemetryRuntime.bench.ts`

### 5. Security — L4 candidate (secret scanning not yet enforced)

**Strengths**
- `pnpm audit:prod`가 CI hard gate다.
- `framework-config`가 Zod + `@t3-oss/env-core` 기반 환경변수 검증을 제공한다.
- `auth-core`의 API key hasher가 `sha256` + `timingSafeEqual`를 사용한다.
- `ratelimit-core`가 decorator/guard/store abstraction을 제공해 운영 레벨 통제를 뒷받침한다.
- 현재 수집 범위에서는 하드코딩 시크릿, `eval`, `innerHTML`, SQL injection류 즉시 L1 강등 신호를 확인하지 못했다.

**Weaknesses / Risks**
- gitleaks가 `continue-on-error: true`로 warning-only 운영이다.
- `SKIP_ENV_VALIDATION` 우회 옵션은 운영 안전장치를 약화시킬 수 있다.
- 즉, 보안 신호는 다층적이지만 secret scanning enforcement는 아직 약하다.

**Evidence**
- `.github/workflows/ci.yml`
- `packages/framework-config/src/index.ts`
- `packages/framework-config/README.md`
- `packages/auth-core/src/libs/apikey/ApiKeyHasher.ts`
- `packages/ratelimit-core/src/index.ts`

### 6. DX — L4 candidate (documentation drift present)

**Strengths**
- 루트 README, CONTRIBUTING, AGENTS, 패키지 README 72개가 존재한다.
- `pnpm setup` 단일 진입점과 package filter 기반 작업법이 잘 문서화되어 있다.
- docs sync/build/link check가 CI에 존재한다.

**Weaknesses / Risks**
- README roadmap의 `Q2/Q3/Q4 2025` 표기와 현재 저장소 현실 사이 drift 가능성이 있다.
- 루트 패키지 카탈로그/로드맵은 실제 workspace 패키지 목록과 일부 불일치할 수 있다.
- 문서 양은 충분하지만 최신성 균질성은 별도 문제다.

**Evidence**
- `README.md`
- `CONTRIBUTING.md`
- `AGENTS.md`
- `.github/workflows/ci.yml`
- `packages/*/README.md`

## Prioritized Actions

### P1. 순환 의존 검사 차단형 승격
현재 `warning-only`인 circular dependency 검사를 신규 위반 기준으로 차단 모드로 승격한다. 기존 위반이 있다면 allowlist로 고정해 증가만 막는 방식으로 전환한다.

**왜 지금 필요한가**
- 아키텍처 원칙은 강하지만, 현재 가장 큰 약점은 enforcement의 약함이다.

**Success Signal**
- mainline/PR 기준 신규 순환 의존 0건 유지
- 예외 목록이 코드화되어 무제한 확장을 막음

### P2. gitleaks를 보호 브랜치 기준 blocking으로 승격
warning-only secret scan을 차단형으로 바꾸고, false positive는 baseline/allowlist로 관리한다.

**왜 지금 필요한가**
- Security 축에서 가장 명확한 gap은 “스캔은 하지만 막지는 않는다”는 점이다.

**Success Signal**
- 보호 브랜치에서 secret scan fail/pass가 릴리즈 품질에 직접 반영
- false positive 관리 절차가 명문화됨

### P3. coverage gate를 위험 기반으로 core-adjacent 패키지까지 점진 확대
전 저장소 일괄 확대가 아니라 변경 빈도·배포 영향·장애 비용이 높은 패키지부터 threshold 적용 범위를 넓힌다.

**왜 지금 필요한가**
- Tests 축의 가장 분명한 gap은 적용 범위 편중이다.

**Success Signal**
- 분기별 threshold 적용 패키지 수 증가
- 신규 핵심 패키지에 coverage gate 적용

### P4. benchmark를 존재 증거에서 regression gate로 승격
핵심 패키지 소수 지표부터 회귀 허용치 기반 차단 게이트로 연결한다.

**왜 지금 필요한가**
- 현재는 측정 인프라가 있지만 운영 강제력이 약하다.

**Success Signal**
- 지정 benchmark 지표에 회귀 허용치 존재
- 회귀 시 PR이 명확히 실패하거나 승인 절차를 요구

### P5. README drift를 release/milestone checklist와 연결
문서를 “더 많이 쓰는” 대신, 로드맵/카탈로그/상태성 문서의 정합성을 릴리즈 운영에 연결한다.

**왜 지금 필요한가**
- DX의 약점은 문서 부족이 아니라 문서 최신성 불일치다.

**Success Signal**
- release/milestone 종료 시 문서 정합성 체크 항목 통과
- stale roadmap 항목 수 감소

## Oracle Cross-Exam Results

### Keep
- Code Quality L4 candidate
- DX L4 candidate
- Architecture L4 candidate (단, partial enforcement 단서 필요)
- Tests L3

### Guarded / Toned Down
- Security L4 candidate는 유지 가능하나 `secret scanning not yet enforced` 단서 필요
- Performance L3는 유지 가능하나 benchmark 존재와 enforcement를 혼동하지 말아야 함

### Hard Ban Filters Applied
- “테스트를 더 늘려라” 같은 일반론 배제
- “성능을 최적화하라” 같은 측정 없는 권고 배제
- “AI로 문서/테스트를 보강하자” 같은 공허한 권고 배제
- README의 마케팅성 성능 문구를 성숙도 근거로 사용하지 않음

## Quick Win Candidates

- `gitleaks`를 보호 브랜치 기준 blocking으로 전환
- circular dependency 신규 위반 0 정책 도입
- README roadmap/패키지 카탈로그 정합성 체크리스트 추가

## Project Candidates

- coverage gate의 위험 기반 단계 확대 프로젝트
- benchmark regression gate 정식 승격 프로젝트
- architecture enforcement를 warning-only에서 정책형 차단으로 전환하는 품질 거버넌스 프로젝트

## Final Assessment

이 저장소는 **기술 부채가 폭발 직전인 상태가 아니라, 이미 강한 엔지니어링 기반을 갖춘 상태**다. 따라서 개선 전략은 전면 재설계가 아니라, 현재 이미 존재하는 관리 체계를 더 강하게 enforce하고 적용 범위를 넓히는 방향이 가장 비용 대비 효과가 크다.

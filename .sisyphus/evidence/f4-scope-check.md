# F4 Scope Fidelity Check

## 기준
- 브랜치: `refactor/abc-group-issues`
- 기준 플랜: `.sisyphus/plans/abc-group-refactoring.md`
- 비교 명령:
  - `git diff trunk --stat`
  - `git diff trunk --name-only`
  - 플랜의 `Commit`/`Files` 섹션 및 F4 범위 설명 대조
  - 플랜 내 `- [ ]` 체크박스 카운트

## 변경 파일 요약
- `git diff trunk --stat` 기준 총 변경 파일: **55개**
- 제외 항목: `benchmarks/baseline.json` 1개 (지시사항에 따라 scope creep 판단에서 제외)
- 실질 검토 대상: **54개 파일**

## 범위 대조 결과

### 1) 계획된 13개 이슈 범위 내 변경
아래 패키지/파일군 변경은 플랜의 T1~T15 `Commit` 섹션 또는 F4 패키지 범위 설명과 일치했다.

- `packages/framework-context/**`
- `packages/framework-logger/**`
- `packages/protocols-rest/**`
- `packages/repository-core/**`
- `packages/dataloader-core/**`
- `packages/transports-http/**`
- `packages/audit-core/**`
- `packages/analytics-posthog/**`
- `packages/telemetry-sdk-node/**`
- `packages/integrations-posthog/**`
- `packages/cache-core/**`
- `packages/storage-core/**`
- `packages/storage-cloudflare/**`
- `packages/storage-cloudinary/**` (T8 `fix(storage-core): extract TTL to configuration (#485)`의 커밋 파일 범위에 포함)
- `packages/billing-polar/**`
- `packages/tasks-core/**`

### 2) 명시 파일 목록에는 없지만 작업 수행에 수반된 보조 변경
아래 파일들은 플랜의 top-level issue scope 밖으로 벗어난 새 작업이라기보다, 계획된 변경을 컴파일/의존성/타입 측면에서 성립시키기 위한 보조 변경으로 판단했다.

- `packages/audit-core/package.json`
- `packages/billing-polar/package.json`
- `packages/dataloader-core/package.json`
- `packages/dataloader-core/tsconfig.json`
- `packages/repository-core/tsconfig.json`
- `packages/tasks-core/package.json`
- `packages/storage-cloudinary/src/libs/types.ts`
- `packages/storage-cloudflare/src/libs/types.ts`
- `pnpm-lock.yaml`

판단 근거:
- 새 import/의존성 추가에 따른 `package.json`/`pnpm-lock.yaml` 갱신
- workspace 소스 참조 타입체크를 위한 `tsconfig.json` 보강
- TTL 설정을 provider config에서 읽기 위해 provider별 options 타입에 `ttl?: number` 추가

위 보조 변경은 **의도된 구현을 뒷받침하는 최소 변경**으로 보이며, 현재 정보만으로는 scope creep로 분류하지 않았다.

### 3) 계획 문서와의 경로 불일치 메모
- 플랜 T15는 `packages/framework-context/src/libs/problems/MiddlewareProblem.ts`를 예시 파일로 적고 있으나, 실제 변경 파일은 `packages/framework-context/src/libs/problems/MiddlewareProblems.ts`였다.
- 책임 범위 자체는 동일한 `#476` 문제 처리 계층이므로 **범위 이탈로 보지는 않음**.
- 다만 플랜의 명시 경로와 완전히 일치하지 않으므로, 후속 F1/F2 검증에서 파일명/구조 적합성은 한 번 더 확인하는 편이 안전하다.

## Scope creep 판정
- **계획 외 패키지 추가 변경: 없음**
- **benchmarks/baseline.json 제외 후, 명백한 scope creep: 없음**
- **결론: 현재 diff는 전반적으로 계획된 13개 이슈 범위 안에 머물러 있음**

## 미완료 항목 식별
플랜 파일의 `- [ ]` 체크박스는 총 **8개**였다.

### 미완료 체크박스 목록
1. `F1. Plan Compliance Audit`
2. `F2. Code Quality Review — unspecified-high`
3. `F3. Real Manual QA — unspecified-high`
4. `F4. Scope Fidelity Check — deep`
5. `P1. Pull Request 생성 및 CI 검증`
6. `pnpm test (all packages)`
7. `pnpm typecheck`
8. `pnpm check (Biome lint)`

### 해석
- 위 1~4는 최종 검증 웨이브 항목으로 아직 플랜상 미체크 상태다.
- 5~8은 PR/CI 단계의 미완료 항목이다.
- 즉, **T1~T15 구현 범위 자체에서 새로 발견된 미완료 구현 파일은 없고**, 플랜 문서 기준으로는 **최종 검증 및 PR 단계가 아직 남아 있다**.

## 최종 결론
- 변경 파일은 `benchmarks/baseline.json`을 제외하면 계획된 이슈 범위 내에 있다.
- 보조 변경 몇 건(`package.json`, `tsconfig.json`, provider types, `pnpm-lock.yaml`)은 존재하지만 현재 맥락상 불필요한 scope creep로 보이지 않는다.
- 플랜 기준 미완료 상태는 **최종 검증(F1~F4) + PR/CI(P1 및 3개 체크박스)** 이다.

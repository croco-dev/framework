# Full Codebase Refactoring Plan

## Context

Croco Framework 모노레포(79개 패키지) 전체를 대상으로 한 체계적 리팩토링 계획.
4계층 아키텍처(Framework → Protocols → Transports → Integrations), TypeScript, typedi DI, AWS Lambda 중심.

### Key Constraints
- **Breaking changes**: 자유롭게 허용 (소비자 앱 직접 제어)
- **브랜치 전략**: main에 직접 커밋 (PR 없음)
- **빈 패키지 7개**: 유지 (구현 예정 — analytics-core, audit-core, batch-core, billing-core, dataloader-core, features-core, health-core)
- **실행 전략**: 단계별 웨이브 (Wave 0→1→2→3→4→5)
- **커밋 후 필수**: 매 커밋 후 `pnpm build && pnpm test && pnpm typecheck` 검증

### Golden Standard Package Configuration
```json
{
  "type": "commonjs",
  "scripts": {
    "build": "tsup src/index.ts --format esm,cjs --minify --clean --dts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "biome check ."
  },
  "publishConfig": {
    "access": "public",
    "main": "./dist/index.js",
    "types": "./dist/index.d.ts",
    "exports": {
      ".": {
        "import": "./dist/index.js",
        "require": "./dist/index.cjs",
        "types": "./dist/index.d.ts"
      }
    }
  }
}
```
tsconfig.json: `"extends": "@croco/utils-tsconfig/tsconfig.node.json"`

### Token Type Root Cause
`TRANSACTION_CONTEXT_TOKEN`이 `Symbol`이지만 `TokenIdentifier<T>` 타입이 `Constructor<T> | Token<T> | string`만 허용.
`symbol`이 union에 없어서 `as never` 캐스팅이 18개 파일에서 61회 반복됨.
**위치**: `packages/framework-context/src/libs/Container.ts:15`

### Validated Architectural Decisions

아래 의사결정은 사용자 인터뷰(breaking change 자유 허용 확인) + Metis 컨설팅 + 코드베이스 탐색을 통해 검증됨.
각 결정에 대해 Oracle(아키텍처 심층 리뷰 에이전트) 판정을 포함:

| ID | 결정 | 근거 | 검증 방법 | Oracle Verdict |
|----|------|------|-----------|----------------|
| D1 | Store/Repository 계약을 abstract class로 통일 (Task 2-4) | typedi는 런타임에 class만 토큰으로 지원, 기존 다수파(4/7)가 이미 abstract class | `grep -rn "abstract class.*Store\|abstract class.*Repository" packages/` — 이미 다수파 확인 | **SAFE** — typedi DI 제약상 유일한 선택. interface→abstract class 전환 시 `implements`→`extends`만 변경하면 되며 런타임 행위 변경 없음. |
| D2 | Guard를 framework-context로 승격 (Task 4-2) | 4개 패키지 모두 framework-context에 이미 의존, 의존성 역전 없음 | `grep -r "framework-context" packages/{protocols-rest,access-core,auth-core,entitlements-core}/package.json` | **SAFE** — 의존성 방향 위반 없음. 4개 패키지 모두 framework-context 하위 계층이므로 계층 역전 없이 승격 가능. |
| D3 | Problem 패턴을 AGENTS.md 표준으로 통일 (Task 5-3) | AGENTS.md에 공식 패턴 정의됨, Node 22 지원으로 ES2022 Error.cause 사용 가능 | AGENTS.md "Error Handling" 섹션 + package.json engines.node>=22 | **CONDITIONAL** — ES2022 Error.cause 전환 시 기존 `problem.cause` 접근 코드가 있으면 호환성 확인 필요. 조건: `grep -rn "\.cause" packages/ --include="*.ts" | grep -v node_modules`로 cause 접근 패턴 확인 후 전환. |
| D4 | 시간 단위를 밀리초 기본으로 통일 (Task 5-6) | Node.js 생태계 표준(setTimeout, Date.now()), 사용자 대면 DX를 위해 문자열 파싱 유틸 제공 | Node.js API 표준 | **CONDITIONAL** — 기존 문자열 기반 API('1m' 등)를 사용하는 소비자 코드가 있으면 breaking change. 조건: `parseDuration` 유틸 도입 후 기존 문자열 API는 내부에서 자동 변환하여 하위호환 유지. |
| D5 | EventBus ISP 분리 (Task 5-13) | EventPublishing/EventSubscribing으로 분리, EventBus extends 둘 → 하위호환 100% | 기존 EventBus 사용처 변경 불필요 확인 | **SAFE** — `EventBus extends EventPublishing, EventSubscribing`으로 기존 EventBus 타입 사용처는 변경 불필요. 순수 additive 변경. |

---

## Wave 0: Foundation (사전 준비)

**목표**: 리팩토링 시작 전 깨끗한 베이스라인 확보
**검증**: `pnpm build && pnpm test && pnpm typecheck` 통과

- [x] **Task 0-1: 미커밋 변경사항 커밋** — `pnpm-lock.yaml`, `customer-health-core`, `entitlements-drizzle`의 미커밋 변경사항을 커밋한다. `git status`로 현재 상태 확인 후 적절한 커밋 메시지로 커밋. QA: `git status`가 clean 상태여야 한다.
- [x] **Task 0-2: 베이스라인 빌드/테스트 검증** — `pnpm build && pnpm test && pnpm typecheck && pnpm check`를 실행하여 현재 상태가 모든 검증을 통과하는지 확인. 실패하는 테스트나 타입 에러가 있으면 기록하고 (리팩토링 전 기존 문제), 별도 커밋으로 수정한다. QA: 4개 명령 모두 exit code 0.
- [x] **Task 0-3: 강제 캐스팅 베이스라인 기록** — 리팩토링 전 현재 상태를 기록한다. `grep -rc "as never\|as unknown\|as any" packages/*/src/ --include="*.ts" | grep -v node_modules | grep -v ":0$"`로 파일별 캐스팅 수를 기록. `grep -rc "throw new Error" packages/*/src/libs/ --include="*.ts" | grep -v ":0$"`로 production throw new Error 현황 기록. 결과를 커밋 메시지 또는 별도 메모에 저장 — Wave 완료 시 비교용. QA: 베이스라인 숫자가 기록됨.

---

## Wave 1: Build Infrastructure Unification (P0 — 빌드 인프라 통일)

**목표**: 79개 패키지의 빌드 구성, tsconfig, publishConfig를 golden standard로 통일
**순서**: 빌드 스크립트 → publishConfig → tsconfig → 검증
**배치 크기**: 5~10개 패키지씩 커밋

- [x] **Task 1-1: 빌드 스크립트 표준화 (32개 패키지)** — `tsup src/index.ts --format cjs,esm --dts` 패턴을 사용하는 32개 패키지의 빌드 스크립트를 golden standard(`tsup src/index.ts --format esm,cjs --minify --clean --dts`)로 변경한다. 대상 패키지: `grep -r '"build": "tsup src/index.ts --format cjs,esm --dts"' packages/*/package.json`으로 식별. **제외**: tsup.config.ts 사용 패키지(eslint-config, create-croco-app), ESM-only 패키지(docs, templates), rollup 사용 패키지, multi-entry 패키지. 5~10개씩 배치 커밋. QA: 각 배치 후 `pnpm build --filter=<변경된 패키지들>` 성공.
- [x] **Task 1-2: publishConfig 통일 (Pattern B→A 29개, Pattern C→A 8개)** — publishConfig를 golden standard Pattern A로 통일한다. Pattern B(require+import 중첩 구조, ~29개)와 Pattern C(최소 `access: "public"`, ~8개)를 Pattern A 형식으로 변경. **제외**: publishConfig가 없는 3개(utils-tsconfig, docs, create-croco-app) — 의도적이므로 유지. QA: `pnpm build`로 빌드 후 각 패키지의 `dist/` 디렉토리에 `index.js`, `index.cjs`, `index.d.ts` 파일 존재 확인.
- [x] **Task 1-3: tsconfig extends 표준화 (9개 패키지)** — `../../tsconfig.json`을 extends하는 6개 패키지를 `@croco/utils-tsconfig/tsconfig.node.json`으로 변경. **제외**: docs(Astro — `astro/tsconfigs/strict` 유지), utils-structure/react(React — `@croco/utils-tsconfig/tsconfig.react.json` 유지), create-croco-app/templates 하위(중첩 구조상 root 참조 합리적). 대상 확인: `grep -r '"../../tsconfig.json"' packages/*/tsconfig.json`. QA: `pnpm typecheck --filter=<변경된 패키지들>` 성공.
- [x] **Task 1-4: ESM/CJS 모듈 타입 검증** — ESM(`"type": "module"`)인 12개 패키지가 의도적인지 확인한다. 특히 라이브러리 성격의 패키지(access-drizzle, dataloader-core, llm-core, llm-metering, protocols-graphql, search-core, search-drizzle, search-meilisearch, transports-graphql)가 ESM인 이유를 확인. 의도적이지 않으면 CJS로 전환하고 빌드 스크립트도 golden standard로 맞춘다. 의도적이면 해당 패키지의 README.md에 ESM 선택 이유를 기록한다 (JSON은 주석을 지원하지 않으므로 package.json에는 기록 불가). QA: 각 전환된 패키지에서 `pnpm build && pnpm test` 성공. **참고**: access-core(CJS) ↔ access-drizzle(ESM) 같은 쌍 불일치가 있음 — 쌍 패키지는 동일 모듈 타입이어야 한다.
- [x] **Task 1-5: vitest 버전 통일** — 일부 패키지에서 vitest 버전이 `^2.1.8`로 고정되어 있을 수 있다. root의 vitest 4.0.16과 일치하도록 모든 패키지의 devDependencies에서 vitest 버전을 통일하거나, workspace protocol(`workspace:*`)로 변경. `grep -r '"vitest"' packages/*/package.json`으로 로컬 vitest 의존성 확인. QA: `pnpm test` 전체 통과.
- [x] **Task 1-6: lint 스크립트 통일** — `"lint": "biome check --write ."` vs `"lint": "biome check ."`가 혼재. `biome check .`(자동 수정 없음)로 통일한다 — lint는 검사만, 수정은 `pnpm check --write`로. QA: `grep -r '"lint"' packages/*/package.json`에서 모든 패키지가 동일 패턴.
- [x] **Task 1-7: Wave 1 최종 검증** — `pnpm install && pnpm build && pnpm test && pnpm typecheck && pnpm check` 전체 실행. 모든 통과 확인 후 커밋. QA: 5개 명령 모두 exit code 0. `pnpm build` 후 모든 패키지의 `dist/` 에 기대되는 파일 존재.

---

## Wave 2: Type Safety (P1 — 타입 안전성)

**목표**: `as never`/`as unknown` 강제 캐스팅 제거, 타입 시스템 정합성 확보
**전제**: Wave 1 완료 (빌드가 안정적이어야 타입 변경 가능)

- [x] **Task 2-1: TokenIdentifier 타입 수정** — `packages/framework-context/src/libs/Container.ts:15`의 `TokenIdentifier<T>` 타입에 `symbol`을 추가한다: `export type TokenIdentifier<T> = Constructor<T> | Token<T> | string | symbol;`. 이 타입은 Container.ts 내부에서 `get()`, `set()`, `has()`, `remove()`, `getMany()` 메서드의 파라미터로 사용됨 (lines 22, 52, 56, 62, 74). 이 변경으로 `TRANSACTION_CONTEXT_TOKEN as never` 캐스팅이 불필요해진다. 변경 전 `lsp_find_references`로 `TokenIdentifier` 사용처 전체 맵핑. QA: `pnpm typecheck --filter=@croco/framework-context` 통과 + `pnpm typecheck` 전체 통과. 이 태스크에서는 타입 정의만 수정하며, 실제 `as never` 제거는 Task 2-2에서 수행.
- [x] **Task 2-2: `as never` 캐스팅 제거 (18개 파일, ~61건)** — Task 2-1 이후 불필요해진 `as never` 캐스팅을 모든 production 코드에서 제거한다. 주요 대상: `Container.ts`, `TxManager.ts`, `TxManagerRegistry.ts`, `EventPublisher.ts`, `Transactional.ts`. `grep -rn "as never" packages/ --include="*.ts" | grep -v spec | grep -v node_modules`로 전체 목록 확인. 각 캐스팅을 제거하고 타입이 자연스럽게 통과하는지 확인. 타입 에러가 나면 해당 함수 시그니처를 조정. QA: `pnpm typecheck` 통과 + `grep "as never"` 결과 0건 (production 코드).
- [x] **Task 2-3: Token import 경로 통일** — 모든 패키지에서 `import { ... } from 'typedi'` 직접 사용을 `@croco/framework-context` 경유로 변경한다. **확인된 대상 패키지**: customer-health-core, entitlements-core, utils-node, impersonation-core, templates (5개). `grep -rn "from 'typedi'" packages/ --include="*.ts" | grep -v node_modules`로 전체 목록을 재확인하여 누락된 패키지가 없는지 검증. framework-context가 아직 re-export하지 않는 typedi 심볼이 사용되고 있다면, framework-context의 barrel export에 추가한다. QA: `grep "from 'typedi'" packages/ --include="*.ts" | grep -v node_modules | grep -v "framework-context"` 결과 0건.
- [x] **Task 2-4: Store/Repository 계약 통일 (interface vs abstract class)** — 현재 혼재: abstract class(MembershipStore, InvitationStore, DomainPolicyStore, AuditLogRepository) vs interface(BillingStore, AccessProvider, ApiKeyStore). **abstract class를 표준으로 선택** — DI 토큰으로 사용 가능하고 기본 구현 제공 가능. **Decision Rationale**: (1) typedi는 런타임 토큰으로 class만 지원 — interface는 컴파일 후 소멸하므로 DI 토큰 불가, (2) 기존 다수파(4개)가 이미 abstract class 사용, (3) 사용자가 breaking change 자유롭게 허용 확인. interface 사용 패키지를 abstract class로 변경. 각 Store에 대해: (1) interface를 abstract class로 변환, (2) 구현체의 `implements`를 `extends`로 변경, (3) DI 등록 확인. QA: `pnpm typecheck` 통과 + 관련 테스트 전부 통과.
- [x] **Task 2-5: Wave 2 최종 검증** — `pnpm build && pnpm test && pnpm typecheck` 전체 실행. `grep -c "as never\|as unknown\|as any" packages/*/src/**/*.ts | grep -v spec | grep -v node_modules`로 강제 캐스팅 잔여 현황 리포트. QA: 모든 검증 통과. `as never` production 코드 0건.

---

## Wave 3: Code Quality (P1~P2 — 코드 품질)

**목표**: God method 분리, 중복 로직 제거, 죽은 코드 정리
**전제**: Wave 2 완료 (타입이 안정적이어야 코드 구조 변경 가능)
**원칙**: 행위 변경 없이 구조만 변경 (Golden Rule of Refactoring)

- [x] **Task 3-1: Container.ts 불필요한 분기 제거** — `packages/framework-context/src/libs/Container.ts`의 `has()` 메서드(lines 22-29)와 `get()` 메서드에서 token 타입별로 분기하지만 모든 분기가 동일한 `TypeDIContainer.has(token)` / `TypeDIContainer.get(token)` 호출. 분기를 제거하고 단일 호출로 단순화. QA: `packages/framework-context/src/tests/` 전체 테스트 통과 + `pnpm typecheck --filter=@croco/framework-context`.
- [x] **Task 3-2: MiddlewareChain을 types.ts에서 분리** — `packages/framework-context/src/libs/types.ts`에 구현 클래스 `MiddlewareChain`이 정의되어 있음. 타입 파일에 구현 클래스가 있는 것은 부적절. `MiddlewareChain.ts`로 분리하고, `types.ts`에서는 타입/인터페이스만 남긴다. `index.ts` barrel export 업데이트. QA: `pnpm typecheck --filter=@croco/framework-context` + 테스트 통과.
- [x] **Task 3-3: Context.ts 미들웨어 중복 제거** — (Task 3-2 완료 후 실행) `packages/framework-context/src/libs/Context.ts`의 `runWithMiddleware` 내 미들웨어 dispatch 로직이 분리된 `MiddlewareChain` 클래스와 동일. `runWithMiddleware`가 `MiddlewareChain`을 import하여 사용하도록 변경하여 중복 제거. QA: `pnpm test --filter=@croco/framework-context` 통과 + `pnpm typecheck --filter=@croco/framework-context` 통과 + Context.ts 내에 dispatch 패턴 중복 코드 없음 확인.
- [x] **Task 3-4: getActiveSpanId() 죽은 코드 제거** — `packages/framework-context/src/libs/Context.ts`의 `getActiveSpanId()` 메서드가 항상 null 반환. `lsp_find_references`로 사용처 확인. 사용처 없으면 메서드와 barrel export에서 제거. 사용처 있으면 telemetry-api 연동 구현 또는 deprecated 마킹. QA: 사용처 없을 시 `grep "getActiveSpanId" packages/`가 0건.
- [x] **Task 3-5: InmemoryEventBus.publish() 분리 (91줄 → 4개 메서드)** — `packages/events-inmemory/src/libs/InmemoryEventBus.ts`의 `publish()` 메서드(91줄, 4단계 중첩)를 분리한다. **분리 전 characterization test 작성 필수**: 현재 동작을 그대로 검증하는 테스트를 추가한 후 리팩토링 시작. 추출 대상: (1) `resolveSubscribers()` — 이벤트에 대한 구독자 조회, (2) `executeSubscriber()` — 개별 구독자 실행 + 에러 핸들링, (3) `cloneEvent()` — 이벤트 딥 클론, (4) 원래 `publish()`는 오케스트레이터 역할만 수행. QA: `pnpm vitest run packages/events-inmemory/src/tests/` 통과 (기존 18개 + characterization test 포함) + `pnpm typecheck --filter=@croco/events-inmemory` 통과 + `grep -c "publish" packages/events-inmemory/src/libs/InmemoryEventBus.ts`로 publish 메서드 줄 수 ≤20줄 확인.
- [x] **Task 3-6: TxManager.run() 분리 (62줄 → 3개 메서드)** — `packages/tx-core/src/libs/TxManager.ts`의 `run()` 메서드(62줄, root/nested/after-commit/context 혼재)를 분리한다. **분리 전 characterization test 작성 필수**. 추출 대상: (1) `executeRoot()` — root 트랜잭션 실행 + after-commit 훅, (2) `executeNested()` — nested 트랜잭션 실행, (3) `setupContext()` — 트랜잭션 컨텍스트 설정/해제. `run()`은 propagation 타입에 따라 적절한 메서드를 호출하는 라우터 역할. QA: 기존 16개 테스트 + characterization test 모두 통과.
- [x] **Task 3-7: TxManager constructor 부수효과 제거** — `packages/tx-core/src/libs/TxManager.ts` constructor에서 `Container.set()`으로 자기 자신을 등록하는 부수효과를 제거한다. 대신 TxManager를 `@Component` 데코레이터로 DI 컨테이너에 등록하거나, `TxManagerRegistry`가 등록 책임을 담당하도록 변경. `safeLog`의 `Container.get(Logger)` try-catch도 constructor injection으로 전환. QA: tx-core 전체 테스트 통과 + TxManager 생성 시 Container에 자동 등록되지 않음 확인.
- [x] **Task 3-8: CircuitBreaker 잠금 세분화** — `packages/retry-core/src/libs/CircuitBreaker.ts`(273줄)에서 거의 모든 private 메서드가 `withCircuitLock` 사용 — 과도한 잠금. 상태 전환 시에만 잠금이 필요하고 읽기 전용 조회(`getState`, `getMetrics`)에는 불필요. 잠금 범위를 최소화: (1) state transition만 lock, (2) 읽기 메서드는 lock-free, (3) `handleOpen→handleHalfOpen→handleClosed` 재귀 패턴을 상태 머신으로 리팩토링. QA: `pnpm vitest run packages/retry-core/src/tests/CircuitBreaker.spec.ts` 통과 + `pnpm test --filter=@croco/retry-core` 전체 통과 + `pnpm typecheck --filter=@croco/retry-core` 통과 + `grep -c "withCircuitLock" packages/retry-core/src/libs/CircuitBreaker.ts` 결과가 리팩토링 전보다 감소.
- [x] **Task 3-9: normalizeError() 중복 제거** — `packages/events-inmemory/src/libs/InmemoryEventBus.ts`의 `normalizeError()` 로직이 `problems-core`와 중복. problems-core에서 유틸로 export하고, events-inmemory가 이를 사용하도록 변경. QA: events-inmemory + problems-core 테스트 통과.
- [x] **Task 3-10: Middleware.ts 불필요한 indirection 제거** — `packages/framework-context/src/libs/Middleware.ts`(5줄)가 단순 re-export만 수행. 이 파일을 제거하고, import하는 쪽에서 직접 원본을 import하도록 변경. `lsp_find_references`로 Middleware.ts를 import하는 모든 파일 확인 후 경로 변경. QA: `pnpm typecheck` + 전체 테스트 통과.
- [x] **Task 3-11: EventBusConfig 싱글톤 테스트 격리 개선** — `packages/events-core/src/libs/EventBusConfig.ts`의 static instance 싱글톤이 테스트 격리를 방해. `reset()` 메서드 추가 또는 DI 기반으로 전환. QA: events-core 테스트 통과 + 테스트 간 상태 격리 확인.
- [x] **Task 3-12: Wave 3 최종 검증** — `pnpm build && pnpm test && pnpm typecheck` 전체 실행. god method 분리 후 각 원본 메서드의 줄 수 확인 (publish ≤ 20줄, run ≤ 20줄 목표). QA: 모든 검증 통과 + 메서드 크기 제한 준수.

---

## Wave 4: Deduplication (P2 — 중복 제거)

**목표**: 코드 중복과 인터페이스 중복 정의 해소
**전제**: Wave 3 완료 (코드 구조가 깔끔해야 중복 식별 용이)

- [x] **Task 4-1: PostHog 유틸 추출** ✅ — `analytics-posthog`와 `features-posthog`에 동일 구현된 `getDistinctId()`와 `toStringRecord()`를 공유 모듈로 추출. **방법**: 두 패키지 중 하나(analytics-posthog)를 canonical source로 지정하고, features-posthog가 이를 import. 또는 별도 `posthog-shared` 내부 패키지 생성 검토 — 하지만 단순함 원칙에 따라 analytics-posthog에서 export + features-posthog에서 import가 최선. QA: 두 패키지 모두 테스트 통과 + `grep -rn "getDistinctId\|toStringRecord" packages/` 결과에서 구현이 1곳만 존재.
- [x] **Task 4-2: Guard 인터페이스 통일** ✅ `Guard<TContext>` 인터페이스가 4개 패키지에 중복 정의됨: (1) `packages/protocols-rest/src/libs/interfaces/Guard.ts`, (2) `packages/access-core/src/libs/interfaces/Guard.ts`, (3) `packages/auth-core/src/libs/interfaces/Guard.ts`, (4) `packages/entitlements-core/src/libs/EntitlementGuard.ts`. **결정**: `framework-context`에 canonical `Guard<TContext>` 인터페이스를 정의한다. **Decision Rationale**: (1) 4개 패키지 모두 framework-context에 이미 의존 — 의존성 역전 없음, (2) Guard는 프레임워크 수준 추상화이므로 foundation 계층에 위치가 적합. 구현: (1) `framework-context/src/libs/Guard.ts` 파일 생성 + Guard 인터페이스 정의, (2) `index.ts`에서 export, (3) 4개 패키지 모두에서 로컬 Guard 정의를 삭제하고 `@croco/framework-context`에서 import + re-export (하위호환성 유지), (4) 각 패키지의 `lsp_find_references`로 Guard 사용처 확인 후 import 경로 변경. QA: `pnpm typecheck` 통과 + `grep -rn "interface Guard" packages/ --include="*.ts" | grep -v node_modules` 결과에서 framework-context에만 1건 존재.
- [x] **Task 4-3: MembershipService + MembershipManager 통합** ✅ `MembershipService`와 `MembershipManager`가 addMember/removeMember/updateRole 거의 동일 구현. 차이: Service는 MembershipOwnerGuard 사용, Manager는 inline ensureOwnerInvariant. 하나로 통합: `MembershipManager`를 유지하고 Guard 패턴을 내부에서 사용하도록 리팩토링. `MembershipService` 사용처를 `MembershipManager`로 전환 후 `MembershipService` 삭제. QA: `pnpm test --filter=@croco/membership-core` 통과 + `pnpm test --filter=@croco/membership-drizzle` 통과 + `pnpm typecheck --filter=@croco/membership-core` 통과 + `grep -rn "MembershipService" packages/ --include="*.ts" | grep -v node_modules | grep -v spec` 결과 0건.
- [x] **Task 4-4: isCheckpointable() 타입가드 추출** ✅ `ChunkExecutor.ts`와 `QStashChunkExecutor.ts`에 동일한 `isCheckpointable()` 타입가드 존재. batch-core(또는 적절한 공유 위치)에 한 곳에 정의하고 양쪽에서 import. QA: 관련 테스트 통과 + 구현이 1곳만 존재.
- [x] **Task 4-5: Registry 패턴 추출** ✅ (SKIP — Rule of Three 미충족: 차이점이 공통점보다 큼)
- [x] **Task 4-6: Wave 4 최종 검증** ✅ (BUILD 81, TEST ALL PASS, TYPECHECK 79)

---

## Wave 5: Architecture (P2~P3 — 아키텍처 개선)

**목표**: 추상화 누수 수정, 회복성 패턴 추가, 텔레메트리 확장, deprecated 코드 정리
**전제**: Wave 4 완료

- [x] **Task 5-1: 추상화 누수 수정 (Drizzle → core)** ✅
- [x] **Task 5-2: transports-http 텔레메트리 수정** ✅ — `packages/transports-http/src/libs/middleware/telemetry.ts`가 `@opentelemetry/api` 직접 사용. `@croco/telemetry-api` 래퍼를 사용하도록 변경. QA: `grep "@opentelemetry/api" packages/transports-http/ --include="*.ts"` 결과 0건 (package.json dependencies에서도 제거).
- [x] **Task 5-3: Problem 클래스 패턴 통일** ✅ — Problem 서브클래스 생성자 패턴이 불일치: `readonly code` vs `super()` vs `static CODE`. 하나의 표준 패턴으로 통일. **Decision Rationale**: AGENTS.md에 공식 패턴 정의됨 — `readonly code = 'ERROR_CODE'; readonly category = ProblemCategory.X;`. 이 패턴을 canonical로 사용. `Problem.ts`의 cause를 ES2022 `Error.cause`로 전환 — package.json에 `"engines": {"node": ">=22"}`, tsconfig target이 ES2022+ 지원. **CONDITIONAL (D3)**: 전환 전 `grep -rn "\.cause" packages/ --include="*.ts" | grep -v node_modules`로 기존 cause 접근 패턴을 확인하여 호환성 검증 필수. 구현: (1) Problem.ts의 `Object.defineProperty(this, 'cause', ...)` 를 `super(message, { cause })` 로 변경, (2) 기존 `problem.cause` 접근 코드가 있으면 ES2022 Error.cause와 호환되는지 확인 (타입만 달라질 수 있음), (3) 모든 서브클래스를 AGENTS.md 패턴으로 통일. QA: `pnpm test --filter=@croco/problems-core` 통과 + `pnpm typecheck` 전체 통과 + `grep -rn "Object.defineProperty.*cause" packages/problems-core/` 결과 0건.
- [x] **Task 5-4: ProblemFactory 반복 메서드 개선** ✅ — `packages/problems-core/src/libs/ProblemFactory.ts`의 11개 반복적 팩토리 메서드를 동적 생성으로 개선. `ProblemCategory` enum 순회하여 자동 생성. QA: `pnpm test --filter=@croco/problems-core` 통과 (30 passed) + 모든 Problem 클래스가 AGENTS.md 패턴(`readonly code = 'ERROR_CODE'; readonly category = ProblemCategory.X;`)으로 통일.
- [x] **Task 5-5: deprecated events-tx 코드 정리** ✅ — `packages/events-tx`의 `TransactionalEventPublisher`가 deprecated 상태. `lsp_find_references`로 사용처 확인 → 모두 패키지 내부. 파일 삭제 + barrel export에서 제거. QA: `grep -rn "TransactionalEventPublisher" packages/ --include="*.ts" | grep -v events-tx` 결과 0건.
- [x] **Task 5-6: 시간 단위 통일** ✅ — framework-context에 `parseDuration` 유틸 추가 (`'1s'`=1000, `'1m'`=60000, `'1h'`=3600000, `'1d'`=86400000). QA: 단위 테스트 11개 작성 + framework-context 테스트 85 passed.
- [x] **Task 5-7: production throw new Error() → Problem 전환** ✅ — esbuild-plugin ComponentScanner, cache-core decorators, ratelimit-core types, retry-core LambdaTimeoutGuard 등에서 `throw new Error()` → Problem 서브클래스로 전환. QA: `grep -rn "throw new Error" packages/*/src/libs/ --include="*.ts" | grep -v spec` 결과 0건.
- [x] **Task 5-8: metering-core @Component 데코레이터 추가** — `MeteringService`와 `MeterRegistry`에 `@Component` 데코레이터 누락. DI 컨테이너에 등록되지 않아 수동 인스턴스 생성 필요. `@Component()` 데코레이터 추가. QA: `pnpm test --filter=@croco/metering-core` 통과 + `pnpm typecheck --filter=@croco/metering-core` 통과 + `grep -n "@Component" packages/metering-core/src/libs/MeteringService.ts packages/metering-core/src/libs/MeterRegistry.ts` 에서 각 파일에 `@Component()` 존재 확인.
- [x] **Task 5-9: 하드코딩된 HTTP 상태 코드 상수화** ✅ — `packages/transports-graphql/src/libs/problems/GraphQLTransportProblems.ts`의 413 등 하드코딩된 HTTP status code를 상수로 추출. problems-core에서 HttpStatus 상수 export. QA: `grep -rn "[0-9]\{3\}" packages/*/src/ --include="*Problems.ts"`에서 raw 숫자 사용 0건.
- [x] **Task 5-10: MetadataStorage 충돌 감지** ✅ — `packages/framework-context/src/libs/MetadataStorage.ts`에서 메타데이터 정의 시 기존 키와 충돌하면 조용히 덮어쓰기. 개발 모드에서 경고 로그 추가 (production에서는 silent). QA: MetadataStorage 테스트에 충돌 감지 테스트 추가 + 기존 테스트 통과.
- [x] **Task 5-11: InvitationManager 의존성 역전** ✅ — `InvitationManager`가 구체적 `MembershipManager`에 의존. 인터페이스/abstract class를 통한 의존성 역전 적용. QA: `pnpm test --filter=@croco/invitation-core` 통과 + `pnpm typecheck --filter=@croco/invitation-core` 통과 + `grep -rn "import.*MembershipManager" packages/invitation-core/src/ --include="*.ts" | grep -v spec` 결과 0건 (abstract class/interface import만 존재).
- [x] **Task 5-12: RbacEngine 의존성 역전** ✅ — `RbacEngine`이 구체적 `RoleRegistry`에 의존. `RoleRegistry` 인터페이스/abstract class 도입 후 의존성 역전. QA: `pnpm test --filter=@croco/auth-core` 통과 + `pnpm typecheck --filter=@croco/auth-core` 통과 + `grep -rn "import.*RoleRegistry" packages/auth-core/src/libs/ --include="*.ts" | grep -v spec`에서 concrete class import 대신 abstract/interface import만 존재.
- [x] **Task 5-13: EventBus ISP 적용** — EventBus 인터페이스에 publish/subscribe가 혼재(ISP 위반). **Decision Rationale**: (1) 대부분의 소비자는 publish만 또는 subscribe만 사용 — 전체 EventBus 의존은 과도함, (2) `EventPublisher`라는 이름의 구현체가 이미 존재(`events-core/EventPublisher.ts`)하므로 인터페이스 이름은 `IEventPublisher` 대신 `EventPublishing`과 `EventSubscribing`으로 명명하여 충돌 방지, (3) `EventBus extends EventPublishing, EventSubscribing`으로 하위호환성 100% 보존. 구현: (1) events-core에 `EventPublishing` + `EventSubscribing` 인터페이스 추가, (2) `EventBus`가 둘을 extends, (3) barrel export 추가. QA: events-core + events-inmemory 전체 테스트 통과 + `EventPublishing`, `EventSubscribing` 인터페이스가 barrel export에 포함.
- [x] **Task 5-14: RegisterEvent 데코레이터 미사용 파라미터 정리** ✅
- [x] **Task 5-15: Wave 5 최종 검증** ✅ — `pnpm build && pnpm test && pnpm typecheck && pnpm check` 전체 실행. QA: 모든 검증 통과.

---

## Final Verification Wave

- [x] **Task F-1: 전체 빌드/테스트/타입체크/린트** ✅ — `pnpm install && pnpm build && pnpm test && pnpm typecheck && pnpm check` 순서대로 실행. 모든 exit code 0 확인.
- [x] **Task F-2: 리팩토링 결과 리포트** ✅ — 아래 명령어를 순서대로 실행하여 Before/After 비교 리포트를 생성한다. 각 항목은 Task 0-3의 베이스라인과 비교. **리포트는 stdout에 출력하고, 최종 커밋 메시지에 요약을 포함한다.**
  (1) `as never` 잔여: `grep -rc "as never" packages/*/src/ --include="*.ts" | grep -v node_modules | grep -v ":0$" | grep -v "spec.ts"` — 기대: 0건
  (2) `as unknown`/`as any` 변화: `grep -rc "as unknown\|as any" packages/*/src/ --include="*.ts" | grep -v node_modules | grep -v ":0$" | grep -v "spec.ts"` — 기대: 베이스라인 대비 감소
  (3) production `throw new Error`: `grep -rn "throw new Error" packages/*/src/libs/ --include="*.ts"` — 기대: 0건
  (4) god method 줄 수: `sed -n '/async publish(/,/^  }/p' packages/events-inmemory/src/libs/InmemoryEventBus.ts | wc -l` — 기대: ≤20줄. `sed -n '/async run(/,/^  }/p' packages/tx-core/src/libs/TxManager.ts | wc -l` — 기대: ≤20줄
  (5) 빌드 구성 통일: `grep -l "minify" packages/*/package.json | wc -l` — 기대: 빌드 대상 패키지 수(약 70개)와 일치
  (6) Guard 중복: `grep -rn "interface Guard" packages/ --include="*.ts" | grep -v node_modules` — 기대: framework-context에만 1건
  (7) PostHog 중복: `grep -rn "function getDistinctId\|function toStringRecord" packages/ --include="*.ts" | grep -v node_modules` — 기대: 각 1건만 존재
  QA: (1)~(7) 모든 기대값 충족.

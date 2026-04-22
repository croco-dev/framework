# Lambda 콜드스타트 벤치마크 인프라 구축

## Context

### 목표
4개 핵심 패키지에 Vitest bench 기반 퍼포먼스 벤치마크를 추가하여 Lambda 콜드스타트 리그레션을 CI에서 자동 감지한다.

### 대상 패키지
| 패키지 | 역할 | 의존자 수 |
|--------|------|----------|
| framework-context | DI Container (register/get/validate) | 57 |
| transports-http | CrocoApp, Lambda 진입점, 라우트 컴파일 | - |
| telemetry-sdk-node | OpenTelemetry SDK 동적 초기화 | - |
| events-core | 이벤트 버스, 핸들러 등록/해소 | 25 |

### 브랜치 전략
- **브랜치**: `add-cold-start-benchmarks` (trunk에서 분기 — 이 레포의 기본 브랜치는 `trunk`)
- **PR로 머지** (target: trunk)

### 기술 결정

**도구**: Vitest bench (`*.bench.ts`) — tinybench 기반 통계적 벤치마킹
- 이유: 프로젝트가 이미 Vitest 4.0.16 사용 중, 별도 의존성 불필요
- p75/p99/mean/stddev 등 통계 자동 제공

**임계값 전략**: 2-tier
1. **절대 임계값** (hard limit): 초과 시 즉시 CI 실패 — `benchmarks/thresholds.json`
2. **베이스라인 대비** (regression): 이전 결과 대비 >20% 느려지면 CI 실패 — `benchmarks/baseline.json`

**임계값 검증 방식**: `scripts/bench-threshold-check.ts`
- Vitest의 programmatic API (`createVitest('benchmark', ...)`) 사용
- 벤치마크 실행 → 결과 수집 → 절대 임계값 체크 → 베이스라인 비교 → pass/fail 리포트
- 이유: `vitest bench --reporter=json`의 출력 형식이 불확실하므로 programmatic API가 안정적

**CI 환경 flakiness 완화**:
- p75 사용 (mean 대신) — 아웃라이어 영향 최소화
- 절대 임계값에 2x 마진 적용 (로컬 p75의 2배를 CI 임계값으로)
- 베이스라인 비교 시 20% tolerance
- warmup 충분히 (warmupIterations: 10, warmupTime: 200)

**베이스라인 관리 정책**:
- `benchmarks/baseline.json`을 git에 커밋
- 업데이트 시기: 정당한 성능 변경 시 (의도적 리팩토링 등)
- 업데이트 방법: `pnpm bench:baseline` → 커밋 → PR에 포함
- 첫 번째 실행 시 baseline 없으면 절대 임계값만 체크

### 파일 레이아웃
```
packages/
  framework-context/src/tests/Container.bench.ts
  events-core/src/tests/EventBus.bench.ts
  transports-http/src/tests/CrocoApp.bench.ts
  telemetry-sdk-node/src/tests/TelemetryRuntime.bench.ts
scripts/
  bench-threshold-check.ts
benchmarks/
  thresholds.json
  baseline.json          # 초기 생성 후 커밋
vitest.config.bench.ts   # 루트 벤치마크 전용 설정
.github/workflows/benchmark.yml
```

### Oracle 판정: **SAFE**
- **판정 근거**: Standard 티어 작업. 프로덕션 코드 변경 없음, 4개 패키지에 벤치 파일만 추가.
- **기술 결정 리스크 평가**:
  - Vitest bench: 프로젝트가 이미 Vitest 4.0.16 사용 중. bench 모드는 내장 기능. 리스크 없음
  - 2-tier 임계값: 절대값 + 베이스라인. 업계 표준 접근법. 리스크 없음
  - programmatic API: `vitest/node`의 `createVitest` — Vitest 공식 API. 리스크 낮음
  - tsx (devDependency): 스크립트 런타임용. 프로덕션 번들 영향 없음. 리스크 최소
- **아키텍처 영향**: 없음. 기존 코드/의존성 그래프 변경 없음
- **조건**: 없음 (SAFE, 무조건 진행 가능)

### Guardrails (Metis concerns 직접 반영)
1. **CI flakiness**: p75 + 2x 마진 + 20% tolerance — 정상 변동은 통과, 실제 리그레션만 감지
2. **임계값 조정**: 첫 실행 후 실제 측정값 확인하여 thresholds.json 조정 (Task 7에서 수행)
3. **첫 iteration 과도함 방지**: 절대 임계값만으로 시작, 베이스라인은 첫 실행 후 생성하므로 점진적 도입
4. **격리**: 각 bench 파일 독립 실행 가능, 전역 상태(Container, Singleton) 리셋

### Per-Iteration Setup 전략 (중요)
Vitest bench의 `bench()` 함수는 반복 실행 시 per-iteration setup을 직접 지원하지 않을 수 있다 (tinybench의 `setup` 옵션 존재 여부 미확인).

**접근법**:
1. **우선 시도**: `bench('name', fn, { setup: () => Container.reset() })` — tinybench setup 옵션
2. **fallback**: setup이 지원되지 않으면, "cold" 벤치마크는 setup을 fn 내부에 포함하고 임계값을 그에 맞게 조정
3. **"warm" 벤치마크**: describe 블록 시작 시 한 번만 setup → bench()에서 반복 측정 (상태 변경 없으므로 문제 없음)
4. **"register" 벤치마크**: 매 iteration에서 Container.reset() + register 50개를 fn 내에 포함. reset 비용은 미미하므로 수용 가능

---

## Wave 1: 인프라 설정

## Task 1: 루트 벤치마크 설정 파일 생성

### 목표
Vitest bench 실행을 위한 루트 설정 파일과 package.json 스크립트를 추가한다.

### 파일 변경

**신규: `vitest.config.bench.ts`**
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    benchmark: {
      include: ['packages/**/src/tests/*.bench.ts'],
      reporters: ['default'],
    },
  },
});
```

**수정: `package.json` (루트)**
scripts 섹션에 추가:
```json
{
  "bench": "vitest bench --config vitest.config.bench.ts",
  "bench:check": "npx tsx scripts/bench-threshold-check.ts",
  "bench:baseline": "npx tsx scripts/bench-threshold-check.ts --update-baseline"
}
```

**신규: `benchmarks/thresholds.json`**
- 초기값은 넉넉하게 설정 (Task 8에서 실제 측정 후 조정)
```json
{
  "_comment": "p75 기준 절대 임계값 (ms). CI에서는 2x 마진이 자동 적용됨",
  "Container.register × 50 components": 10,
  "Container.get singleton (cold)": 5,
  "Container.get singleton (warm)": 0.5,
  "Container.validate (50 components)": 20,
  "CrocoApp constructor": 30,
  "CrocoApp lambdaHandler (10 controllers)": 50,
  "CrocoApp full cold-start simulation": 80,
  "TelemetryRuntime.init (lambda preset)": 200,
  "lambdaPreset config creation": 2,
  "EventBusConfig.start (10 handlers)": 10,
  "EventPublisher.publish single event": 2,
  "DefaultHandlerResolver.resolve × 10": 5
}
```

### QA
- [x] `pnpm bench` 실행 시 에러 없이 vitest bench 모드 진입 확인 (bench 파일 없으므로 0 files 출력)
- [x] vitest.config.bench.ts가 기존 vitest.config.ts와 충돌하지 않는지 확인
- [x] benchmarks/ 디렉토리가 .gitignore에 포함되지 않았는지 확인 (커밋해야 함)
- [x] 기존 vitest.config.ts의 include 패턴(`src/**/*.spec.ts`, `src/**/*.test.ts`)이 `*.bench.ts`를 포함하지 않는지 확인 (확인 완료: 포함하지 않음)

---

## Task 2: 임계값 검증 스크립트 생성

### 목표
`scripts/bench-threshold-check.ts`를 작성한다. Vitest programmatic API로 벤치마크를 실행하고, 결과를 절대 임계값 + 베이스라인과 비교하여 pass/fail을 판정한다.

### 파일 변경

**신규: `scripts/bench-threshold-check.ts`**

기능 요구사항:
1. **CLI 플래그 파싱**: `--update-baseline` (베이스라인 갱신 모드)
2. **Vitest 프로그래매틱 실행**:
   - `createVitest('benchmark', ...)` 사용
   - 설정: `vitest.config.bench.ts` 참조
   - 전체 bench 파일 실행 후 결과 수집
3. **결과 수집**:
   - 각 벤치마크별 name, mean, p75, p99, hz 추출
   - vitest.state.getFiles() → tasks → result.benchmark 경로로 접근
   - **주의**: Vitest 4.x에서 bench result 구조가 다를 수 있음. 실제 구조를 console.log로 확인 후 매핑하는 방어 코드 포함
4. **절대 임계값 체크**:
   - `benchmarks/thresholds.json` 읽기
   - 각 벤치마크의 p75 값이 thresholds[name] 이하인지 확인
   - **threshold 미정 항목 처리**: thresholds.json에 해당 벤치마크 이름이 없으면 WARNING 출력 후 skip (CI 실패 아님). 이는 새 벤치마크 추가 시 threshold를 잊어도 CI가 깨지지 않도록 하는 안전장치
   - CI 환경 감지 (`process.env.CI`): CI일 때 임계값에 2x 마진 적용
5. **베이스라인 비교** (baseline.json 존재 시):
   - `benchmarks/baseline.json` 읽기
   - 각 벤치마크의 p75가 baseline[name].p75 대비 20% 이내인지 확인
   - baseline.json 없으면 이 단계 스킵 + 경고 메시지 출력
6. **--update-baseline 모드**:
   - 벤치마크 실행 후 결과를 `benchmarks/baseline.json`에 저장
   - 저장 형식: `{ [benchmarkName]: { p75, p99, mean, hz, updatedAt } }`
   - 임계값 체크 없이 저장만 수행
7. **리포트 출력**:
   ```
   ╔══════════════════════════════════════════════════════════╗
   ║ Cold-Start Benchmark Report                             ║
   ╠══════════════════════════════════════════════════════════╣
   ║ Container.register × 50      p75: 3.2ms  threshold: 10ms  ✅ ║
   ║ Container.get singleton      p75: 1.1ms  baseline: 1.0ms (+10%) ✅ ║
   ║ CrocoApp full cold-start     p75: 95ms   threshold: 80ms  ❌ ║
   ╠══════════════════════════════════════════════════════════╣
   ║ Result: 1 FAILED                                        ║
   ╚══════════════════════════════════════════════════════════╝
   ```
8. **종료 코드**: 실패 시 `process.exit(1)`, 성공 시 `process.exit(0)`

### 구현 참고
- `tsx` 런타임 사용 (**루트에 미설치 — devDependency에 추가 필요: `pnpm add -D tsx -w`**)
- 외부 라이브러리 최소화: `fs`, `path`, `vitest/node`만 사용
- programmatic API 실패 시 fallback: `vitest bench --reporter=json` CLI 실행 후 stdout 파싱

### QA
- [ ] `--update-baseline` 플래그로 실행 시 baseline.json 생성 확인
- [ ] baseline.json 없이 실행 시 절대 임계값만 체크되고 에러 없이 동작 확인
- [ ] CI 환경(CI=true)에서 2x 마진이 적용되는지 확인
- [ ] 임계값 초과 시 exit code 1 반환 확인
- [ ] 모든 벤치마크 통과 시 exit code 0 반환 확인

---

## Wave 2: 패키지별 벤치마크

## Task 3: framework-context 벤치마크 (Container.bench.ts)

### 목표
DI Container의 핵심 연산을 벤치마킹한다. 콜드스타트에서 가장 많이 호출되는 register/get/validate를 측정.

### 파일 변경

**신규: `packages/framework-context/src/tests/Container.bench.ts`**

### 벤치마크 목록

**1. `Container.register × 50 components`**
- setup: `Container.reset()`
- 50개의 테스트 클래스를 순차 등록 (`Container.register(TestClassN, 'singleton')`)
- 테스트 클래스: 벤치 파일 내에 간단한 빈 클래스 50개 생성 (데코레이터 없이 직접 register)
- options: `{ iterations: 50, warmupIterations: 10 }`

**2. `Container.get singleton (cold)`**
- setup: `Container.reset()` → `Container.register(TestService, 'singleton')`
- 측정: `Container.get(TestService)` (첫 번째 호출, 인스턴스 생성 포함)
- **주의**: 각 iteration마다 reset + register 필요 (cold를 보장하기 위해)
- options: `{ iterations: 100, warmupIterations: 5 }`

**3. `Container.get singleton (warm)`**
- setup: `Container.reset()` → register → 첫 번째 get() 호출 (warmup)
- 측정: `Container.get(TestService)` (캐시된 인스턴스 반환)
- options: `{ iterations: 200, warmupIterations: 20 }`

**4. `Container.validate (50 components)`**
- setup: `Container.reset()` → 50개 컴포넌트 등록 (일부는 의존성 포함)
- 측정: `Container.validate()`
- 의존성 포함 설정: 몇 개의 클래스는 constructor에서 다른 클래스를 주입받도록 구성
- options: `{ iterations: 50, warmupIterations: 5 }`

### 테스트 클래스 생성 방법
```typescript
// 벤치 파일 상단에 선언
class TestService1 {}
class TestService2 {}
// ... TestService50까지 (간단한 빈 클래스)

// 의존성 있는 클래스 (validate 벤치용)
class DepServiceA { constructor(public dep: TestService1) {} }
```

### 격리
- 모든 bench suite의 beforeEach에서 `Container.reset()` 호출
- bench간 상태 공유 없음

### import 경로
```typescript
import { bench, describe } from 'vitest';
import { Container } from '../libs/Container';
```

### QA
- [ ] `cd packages/framework-context && pnpm vitest bench src/tests/Container.bench.ts` 실행 성공
- [ ] 4개 벤치마크 모두 결과 출력 (p75, mean 등)
- [ ] Container.reset()이 각 iteration에서 정상 동작 확인

---

## Task 4: events-core 벤치마크 (EventBus.bench.ts)

### 목표
이벤트 시스템의 핵심 연산(핸들러 등록, 이벤트 발행, 핸들러 해소)을 벤치마킹한다.

### 파일 변경

**신규: `packages/events-core/src/tests/EventBus.bench.ts`**

### 의존성 및 셋업 패턴

**EventBus 구현체**: InMemoryEventBus는 `@croco/events-inmemory`에 있으나 events-core의 devDependency에 없으므로 **사용하지 않는다**. 대신 events-core 기존 테스트(`EventBusConfig.spec.ts`)에 있는 **MockEventBus 패턴**을 사용한다:
```typescript
class MockEventBus implements EventBus {
  subscribedEvents: EventSubscription[] = [];
  publishedEvents: DomainEvent[] = [];
  subscribe(subscription: EventSubscription) { this.subscribedEvents.push(subscription); }
  unsubscribe(subscription: EventSubscription) { /* ... */ }
  clear() { this.subscribedEvents = []; this.publishedEvents = []; }
  async publish(event: DomainEvent) { this.publishedEvents.push(event); }
}
```

**EventBusConfig 셋업 순서** (실제 API 기반):
```typescript
const config = EventBusConfig.getInstance();
const mockBus = new MockEventBus();
config.setEventBus(mockBus);       // 1. EventBus 먼저 주입
await config.start({ handlers });  // 2. 그 다음 start (handlers만, eventBus는 별도)
```

**singleton 리셋**: `EventBusConfig.setInstance(new EventBusConfig())` 또는 `(EventBusConfig as any).instance = undefined`

### 벤치마크 목록

**1. `EventBusConfig.start (10 handlers)`**
- setup: EventBusConfig singleton 리셋 → `new MockEventBus()` 생성 → `config.setEventBus(mockBus)` → 10개 mock EventHandler 클래스 준비
- 각 handler는 `@RegisterEventHandler(TestEvent)` 데코레이터로 바인딩 (events-core의 실제 API, 기존 테스트 참조: `EventBusConfig.spec.ts:198`)
- 측정: `await config.start({ handlers })` — **`start()`는 `{ handlers, resolver? }` 시그니처. eventBus는 `setEventBus()`로 사전 주입**
- options: `{ iterations: 50, warmupIterations: 5 }`

**2. `EventPublisher.publish single event`**
- setup: EventBusConfig.start() 완료 상태에서 시작
- 측정: `eventPublisher.publish(new TestDomainEvent())`
- TestDomainEvent: DomainEvent 상속하는 간단한 이벤트 클래스
- options: `{ iterations: 200, warmupIterations: 20 }`

**3. `DefaultHandlerResolver.resolve × 10`**
- **참고**: `HandlerResolver.resolve(handlerClass)`는 **단일 handlerClass → 단일 핸들러 인스턴스 반환** API. "이벤트 타입별 10개 핸들러 해소"가 아님
- setup: 10개 mock EventHandler 클래스 배열 준비 (`class TestHandler1 implements EventHandler<TestEvent> { ... }`)
- 측정: 10개 handlerClass를 순회하며 `resolver.resolve(handlerClass)` × 10회 호출
- `DefaultHandlerResolver`는 `new handlerClass()`로 인스턴스 생성하는 단순 구현
- options: `{ iterations: 200, warmupIterations: 20 }`

### 격리
- EventBusConfig singleton 리셋: `EventBusConfig.setInstance(new EventBusConfig())` (공개 API 사용)
- Container도 함께 리셋 (`Container.reset()`)
- MockEventBus는 벤치 파일 내에 직접 정의 (외부 의존성 없음)

### QA
- [ ] 벤치 파일 단독 실행 성공
- [ ] EventBusConfig singleton이 iteration 간 올바르게 리셋되는지 확인
- [ ] MockEventBus로 외부 의존성 없이 동작하는지 확인
- [ ] `start()` API가 `{ handlers }` 시그니처로 올바르게 호출되는지 확인

---

## Task 5: transports-http 벤치마크 (CrocoApp.bench.ts)

### 목표
Lambda 콜드스타트의 실제 크리티컬 패스인 CrocoApp 생성/부팅/첫 요청 처리를 벤치마킹한다.

### 파일 변경

**신규: `packages/transports-http/src/tests/CrocoApp.bench.ts`**

### 사전 준비: Mock 컨트롤러 및 DI 등록 (CrocoApp.spec.ts 패턴 참조)

CrocoApp이 동작하려면:
1. DI에 Logger, ErrorHandler, HealthCheckRegistry 등록 필요
2. boot() 실행 시 controller 클래스 필요 (`@Controller`, `@Get` 등 데코레이터 사용)

**DI 셋업 (검증된 패턴 — `CrocoApp.spec.ts`에서 발췌)**:
```typescript
import 'reflect-metadata';
import { Container } from '@croco/framework-context';
import { Logger } from '@croco/framework-logger';
import { Controller, Get, Post } from '@croco/protocols-rest';
import { ErrorHandler } from '../libs/ErrorHandler';
import { HealthCheckRegistry } from '../libs/HealthCheckRegistry';

function setupDI() {
  Container.reset();
  const logger = {
    info: () => {}, warn: () => {}, error: () => {}, debug: () => {},
  } as unknown as Logger;
  Container.set(Logger, logger);
  Container.set(ErrorHandler, new ErrorHandler(logger));
  Container.set(HealthCheckRegistry, new HealthCheckRegistry());
}
```

**Mock 컨트롤러 (10개 생성)**:
```typescript
@Controller('/bench1')
class BenchController1 {
  @Get('/') handler() { return { ok: true }; }
}
// ... BenchController2 ~ BenchController10 (동일 패턴, path만 변경)
```

### 벤치마크 목록

**1. `CrocoApp constructor`**
- setup: Container.reset() → 필수 서비스 등록
- 측정: `new CrocoApp({ controllers: [...] })`
- options: `{ iterations: 50, warmupIterations: 5 }`

**2. `CrocoApp lambdaHandler (10 controllers)`**
- **boot()는 private 메서드** — 직접 호출 불가. `lambdaHandler()`가 내부에서 boot()를 호출하므로 이를 측정 대상으로 사용
- setup: Container.reset() + 필수 서비스 등록 + new CrocoApp(config)
- 측정: `app.lambdaHandler()` — 내부에서 boot() (RouteCompiler.compile() + 라우트 등록) + handler 생성
- **주의**: boot()는 `booted` 플래그로 중복 실행 방지. 각 iteration마다 새 CrocoApp 인스턴스 필요
- options: `{ iterations: 30, warmupIterations: 3 }`

**3. `CrocoApp full cold-start simulation`**
- 가장 중요한 벤치마크: Lambda 콜드스타트 전체 경로
- setup: Container.reset() + 필수 서비스 등록
- 측정: `createApp(config)` → `app.lambdaHandler()` → 반환된 handler로 mock API Gateway v2 이벤트 처리
- mock 이벤트: 간단한 GET /bench1 요청 (API Gateway v2 형식)
- **참고**: `CrocoApp.fetch(request)` 또는 `CrocoApp.getHono()`도 public API. 필요 시 이를 활용한 추가 벤치도 가능
- options: `{ iterations: 20, warmupIterations: 3 }`

### import 경로
```typescript
import { bench, describe } from 'vitest';
import { CrocoApp, createApp } from '../libs/CrocoApp';
// 필요한 데코레이터/DI는 기존 소스에서 import 경로 확인
```

### 격리
- 매 iteration 전 Container.reset()
- 새 CrocoApp 인스턴스 생성

### QA
- [ ] 벤치 파일 단독 실행 성공
- [ ] 10개 컨트롤러가 올바르게 컴파일되는지 확인
- [ ] full cold-start가 실제 Lambda 핸들러 반환까지 측정하는지 확인
- [ ] mock API Gateway 이벤트가 올바른 형식인지 확인

---

## Task 6: telemetry-sdk-node 벤치마크 (TelemetryRuntime.bench.ts)

### 목표
OpenTelemetry SDK 동적 초기화 시간을 벤치마킹한다. dynamic import가 콜드스타트에 미치는 영향을 측정.

### 파일 변경

**신규: `packages/telemetry-sdk-node/src/tests/TelemetryRuntime.bench.ts`**

### 특수 고려사항
- TelemetryRuntime은 singleton (`getInstance()`)
- `init()` 후 다시 `init()`하면 중복 초기화 방지 로직이 있을 수 있음
- **해결**: 각 iteration에서 singleton 인스턴스를 리셋하거나, init() 없이 모듈 import 시간만 측정하는 벤치 분리

### 벤치마크 목록

**1. `TelemetryRuntime.init (lambda preset)`**
- setup: TelemetryRuntime singleton 리셋 (`(TelemetryRuntime as any).instance = undefined` 또는 내부 리셋 메서드 확인)
- 측정: `await TelemetryRuntime.getInstance().init(lambdaPreset({ serviceName: 'bench', probability: 0 }))`
- probability: 0으로 설정 (실제 트레이스 전송 방지)
- **주의**: 이 벤치마크는 async — `bench()` 안에서 await 사용 가능한지 확인 (Vitest bench는 async bench 지원)
- options: `{ iterations: 10, warmupIterations: 2 }` (dynamic import로 인해 느림)

**2. `lambdaPreset config creation`**
- setup: 없음 (순수 함수)
- 측정: `lambdaPreset({ serviceName: 'bench', probability: 0.1 })`
- options: `{ iterations: 200, warmupIterations: 20 }`

### import 경로
```typescript
import { bench, describe } from 'vitest';
import { TelemetryRuntime, lambdaPreset } from '../index';
```

### 격리
- 각 iteration에서 TelemetryRuntime singleton 상태 리셋
- `forceFlush()` 호출하여 pending spans 정리

### QA
- [ ] async bench가 vitest bench에서 올바르게 동작하는지 확인
- [ ] TelemetryRuntime singleton 리셋 확인: 벤치 파일에서 `await telemetry.shutdown()` 후 `(TelemetryRuntime as any).instance = undefined` 리셋 → 벤치 재실행 시 init() 정상 동작 확인 (에러 없음)
- [ ] OTLP 전송 차단 확인: 벤치에서 `probability: 0` 설정 → ProbabilitySampler가 AlwaysOffSampler로 동작 → span이 샘플링되지 않음 → BatchSpanProcessor에 전송할 데이터 없음 → 네트워크 에러 없이 완료. 참고: OTLP exporter 객체는 생성되지만 (default: `http://localhost:4318/v1/traces`), 실제 전송할 span이 없어 HTTP 요청 발생하지 않음. 벤치 실행 중 네트워크 에러 로그가 없으면 PASS

---

## Wave 3: CI 통합

## Task 7: 초기 베이스라인 생성

### 목표
Wave 2의 모든 벤치마크를 실행하고, 결과를 `benchmarks/baseline.json`으로 저장한다. 이 파일이 향후 리그레션 비교의 기준점이 된다.

### 실행 순서
1. `pnpm build` (벤치 대상 패키지 빌드)
2. `pnpm bench` (전체 벤치마크 실행, 결과 확인)
3. 결과 검토: 실제 측정값이 thresholds.json의 초기값과 비교하여 합리적인지 확인
4. 필요 시 `benchmarks/thresholds.json` 조정:
   - 실제 p75의 약 3-5x를 절대 임계값으로 설정 (CI 마진 포함)
   - 로컬에서 2ms이면 CI 임계값은 6-10ms
5. `pnpm bench:baseline` (baseline.json 생성)
6. baseline.json과 조정된 thresholds.json을 커밋에 포함

### QA
- [ ] baseline.json이 모든 벤치마크의 p75, p99, mean, hz를 포함하는지 확인
- [ ] `pnpm bench:check` 실행 시 모든 벤치마크가 PASS인지 확인
- [ ] thresholds.json의 값이 실제 측정값 대비 합리적인 마진을 가지는지 확인

---

## Task 8: GitHub Actions 워크플로우

### 목표
PR 및 trunk push 시 벤치마크를 자동 실행하여 리그레션을 감지하는 CI 워크플로우를 추가한다. (이 레포의 기본 브랜치는 `trunk`이며, 기존 CI도 모두 `trunk` 대상)

### 파일 변경

**신규: `.github/workflows/benchmark.yml`**

```yaml
name: Performance Benchmark

on:
  pull_request:
    branches: [trunk]
  push:
    branches: [trunk]

jobs:
  benchmark:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm build
      - name: Run benchmarks with threshold check
        run: pnpm bench:check
        env:
          CI: true
```

### 설계 결정
- **required check로 설정하지 않음**: 초기에는 informational로 시작. 안정화 후 required로 전환 가능.
- **timeout 10분**: 벤치마크 전체 실행이 충분히 가능한 시간
- **ubuntu-latest**: 일관된 CI 환경 (macOS runner 대비 비용 절감)
- **CI=true**: bench-threshold-check.ts에서 2x 마진 적용 트리거

### QA
- [ ] 워크플로우 YAML 유효성: `cat .github/workflows/benchmark.yml | python3 -c "import sys,yaml; yaml.safe_load(sys.stdin)"` 또는 `yq eval '.' .github/workflows/benchmark.yml` 로 파싱 성공 확인. GitHub Actions 필수 키(on, jobs, runs-on, steps) 존재 여부 확인
- [ ] 워크플로우 트리거 검증: `on.pull_request.branches`와 `on.push.branches`가 `[trunk]`인지 확인 (기존 CI 패턴과 일치)
- [ ] pnpm build → pnpm bench:check 순서가 올바른지 확인
- [ ] CI 환경 변수가 올바르게 전달되는지 확인

---

## Final Verification Wave

## Task 9: 전체 통합 검증

### 목표
전체 벤치마크 인프라가 올바르게 작동하는지 end-to-end 검증.

### 검증 체크리스트

**로컬 검증**:
- [ ] `pnpm bench` — 4개 패키지의 모든 벤치마크 실행, 결과 출력 확인
- [ ] `pnpm bench:check` — 절대 임계값 + 베이스라인 비교, 전체 PASS
- [ ] `pnpm bench:baseline` — baseline.json 업데이트 확인

**리그레션 감지 검증**:
- [ ] thresholds.json의 임계값을 의도적으로 낮게 조정 → `pnpm bench:check` 실행 → FAIL 확인 → 원복
- [ ] baseline.json의 p75를 의도적으로 낮게 조정 → `pnpm bench:check` 실행 → regression 감지 확인 → 원복

**기존 테스트 영향 없음 확인**:
- [ ] `pnpm test` — 기존 테스트 전체 통과 (bench 파일이 일반 테스트에 포함되지 않는지 확인)
- [ ] `pnpm typecheck` — 타입 에러 없음
- [ ] `pnpm check` — Biome 검사 통과

**CI 준비 확인**:
- [ ] 모든 변경 파일이 커밋됨
- [ ] PR 생성 → benchmark.yml 워크플로우가 트리거되는지 확인

---

## 부록: 벤치마크 상세 임계값 표 (참조용)

| 벤치마크 | 패키지 | 초기 임계값 (p75) | CI 임계값 (2x) | 비고 |
|----------|--------|------------------|----------------|------|
| Container.register × 50 | framework-context | 10ms | 20ms | 50개 클래스 순차 등록 |
| Container.get cold | framework-context | 5ms | 10ms | 첫 get, 인스턴스 생성 포함 |
| Container.get warm | framework-context | 0.5ms | 1ms | 캐시 반환 |
| Container.validate (50) | framework-context | 20ms | 40ms | 의존성 그래프 구축 |
| CrocoApp constructor | transports-http | 30ms | 60ms | Hono + DI 조회 |
| CrocoApp lambdaHandler (10 ctrl) | transports-http | 50ms | 100ms | boot() + handler 생성 |
| Full cold-start sim | transports-http | 80ms | 160ms | 전체 경로 |
| TelemetryRuntime.init | telemetry-sdk-node | 200ms | 400ms | 동적 import 포함 |
| lambdaPreset creation | telemetry-sdk-node | 2ms | 4ms | 순수 함수 |
| EventBusConfig.start (10) | events-core | 10ms | 20ms | 핸들러 등록 |
| EventPublisher.publish | events-core | 2ms | 4ms | 단일 이벤트 |
| DefaultHandlerResolver.resolve × 10 | events-core | 5ms | 10ms | 10회 resolve |

**참고**: 초기 임계값은 추정치. Task 7에서 실측 후 조정한다.

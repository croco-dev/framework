# @croco/framework-context

Croco의 기반 계층입니다. DI 컨테이너, 요청 컨텍스트, 메타데이터 저장소, 종료 훅 관리를 제공합니다.

## 설치

```bash
pnpm add @croco/framework-context reflect-metadata typedi
```

## 사용법

### 컴포넌트 등록과 조회

```typescript
import "reflect-metadata";
import { Component, Container } from "@croco/framework-context";

@Component()
class UserService {
  getName() {
    return "croco";
  }
}

const service = Container.get(UserService);
```

### 요청 컨텍스트 실행

```typescript
import { Context } from "@croco/framework-context";

const requestId = await Context.run({ requestId: "req-123" }, async () => {
  return Context.getRequestId();
});
```

### 종료 훅 등록

```typescript
import { OnShutdown, ShutdownManager } from "@croco/framework-context";

class AppLifecycle {
  @OnShutdown()
  async close(): Promise<void> {}
}

ShutdownManager.getInstance().listen();
```

`ShutdownManager`는 프로세스 singleton입니다. `getInstance()`로 암시적 기본 timeout이 생성된 뒤에는
`getInstance(timeoutMs)` 또는 `configure(timeoutMs)`로 한 번 명시적 timeout을 고정할 수 있습니다.
서로 다른 명시적 timeout을 다시 전달하면 `ShutdownConfigurationConflictProblem`이 발생합니다.
테스트나 독립 런타임에서는 `ShutdownManager.reset()`으로 기존 signal listener와 훅을 정리한 뒤 새 singleton을
생성하세요.

## API 레퍼런스

- `Container`: 의존성 등록, 조회, 초기화
- `Component`: 클래스를 singleton, request, transient scope로 등록
- `Context`: AsyncLocalStorage 기반 요청 컨텍스트 실행과 조회
- `MetadataStorage`: 데코레이터 메타데이터 저장과 조회
- `MiddlewareChain`: onion 패턴 미들웨어 실행
- `ShutdownManager`, `OnShutdown`: graceful shutdown 훅 수집과 실행
- `LOGGER_TOKEN`, `TRANSACTION_CONTEXT_TOKEN`: 공용 DI 토큰
- `CircularDependencyProblem`, `MiddlewareProblem`, `ShutdownConfigurationConflictProblem`, `ShutdownTimeoutProblem`: 기반 계층 Problem 타입

## Public compatibility sub-surfaces

`@croco/framework-context`는 하나의 패키지 엔트리포인트를 유지하지만 1.0 호환성 검토에서는 아래
sub-surface 단위로 소유자, breaking-change 정책, generated app/doctor 커버리지를 분리합니다.

`pnpm public-api:check`는 `public-api-surface.snapshot.json`의 `compatibilityGroups`와 각 export의
`compatibilityGroup`을 검사합니다. 새 public export는 source와 export name 기준으로 아래 그룹 중 하나에
명시적으로 분류되어야 하며, 기존 export가 다른 그룹으로 이동하면 public API drift로 실패합니다.

| Group                                          | Scope                                                                                                           | Breaking-change policy                                                                                                                   | Coverage                                                                                            |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| DI and dependency graph (`di`)                 | `Container`, `Component`, `Inject`, TypeDI tokens, dependency graph diagnostics, logger token, metadata storage | Rename/removal, scope semantics, diagnostic code, or dependency graph manifest changes are breaking for DI consumers and generated apps. | `public-api:check`, create-croco-app generator DI imports, `croco doctor` DI diagnostics            |
| Request and runtime context (`context`)        | `Context`, request/runtime/transaction context types, lifecycle hooks, transaction context token                | Field removals or semantic changes require migration notes and versioned compatibility review.                                           | `public-api:check`, generated app request context imports, doctor/project-map runtime context reads |
| Runtime policy (`runtime-policy`)              | Policy tables, policy targets/kinds, policy execution plans, policy capability Problems                         | Policy table shape, policy constants, diagnostic behavior, and execution-plan semantics are release-blocking compatibility changes.      | `public-api:check`, `croco runtime-policy check`, `croco project-map` policy validation             |
| Runtime capability (`runtime-capability`)      | Runtime platforms, capability matrix, capability manifests, capability diagnostics                              | Capability/platform names, manifest versions, diagnostic codes, and support matrix semantics must be additive or versioned.              | `public-api:check`, `croco runtime-policy check`, generated app smoke workspace build               |
| Runtime inspector (`runtime-inspector`)        | Inspector lifecycle, timeline records, event input/output shapes, inspector token                               | Inspector record, timeline, and event-shape changes must preserve additive compatibility or document a versioned diagnostic migration.   | `public-api:check`, generated app smoke workspace build, doctor/project-map runtime diagnostics     |
| Middleware and request pipeline (`middleware`) | `MiddlewareChain`, middleware/guard types, request pipeline graph, pipeline Problems                            | Callable shape, node/phase constants, and failure propagation changes require a documented migration path.                               | `public-api:check`, generated app request pipeline usage                                            |
| Shutdown lifecycle (`shutdown`)                | `ShutdownManager`, `OnShutdown`, shutdown hook type, shutdown Problems                                          | Hook signatures, timeout/configuration Problem behavior, and signal listener semantics are breaking without migration guidance.          | `public-api:check`, generated app smoke workspace build                                             |

## Scope

- `singleton`: 애플리케이션 전체에서 하나의 인스턴스
- `request`: `Context.run()` 범위마다 하나의 인스턴스
- `transient`: 조회할 때마다 새 인스턴스

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

## Scope

- `singleton`: 애플리케이션 전체에서 하나의 인스턴스
- `request`: `Context.run()` 범위마다 하나의 인스턴스
- `transient`: 조회할 때마다 새 인스턴스

# @croco/framework-context

Croco의 기반 계층입니다. DI 컨테이너, 요청 컨텍스트, 메타데이터 저장소, 종료 훅 관리를 제공합니다.

## 설치

```bash
pnpm add @croco/framework-context reflect-metadata typedi
```

## 사용법

### 컴포넌트 등록과 조회

```typescript
import 'reflect-metadata';
import { Component, Container } from '@croco/framework-context';

@Component()
class UserService {
  getName() {
    return 'croco';
  }
}

const service = Container.get(UserService);
```

### 요청 컨텍스트 실행

```typescript
import { Context } from '@croco/framework-context';

const requestId = await Context.run({ requestId: 'req-123' }, async () => {
  return Context.getRequestId();
});
```

### 종료 훅 등록

```typescript
import { OnShutdown, ShutdownManager } from '@croco/framework-context';

class AppLifecycle {
  @OnShutdown()
  async close(): Promise<void> {}
}

ShutdownManager.getInstance().listen();
```

## API 레퍼런스

- `Container`: 의존성 등록, 조회, 초기화
- `Component`: 클래스를 singleton, request, transient scope로 등록
- `Context`: AsyncLocalStorage 기반 요청 컨텍스트 실행과 조회
- `MetadataStorage`: 데코레이터 메타데이터 저장과 조회
- `MiddlewareChain`: onion 패턴 미들웨어 실행
- `ShutdownManager`, `OnShutdown`: graceful shutdown 훅 수집과 실행
- `LOGGER_TOKEN`, `TRANSACTION_CONTEXT_TOKEN`: 공용 DI 토큰
- `CircularDependencyProblem`, `MiddlewareProblem`, `ShutdownTimeoutProblem`: 기반 계층 Problem 타입

## Scope

- `singleton`: 애플리케이션 전체에서 하나의 인스턴스
- `request`: `Context.run()` 범위마다 하나의 인스턴스
- `transient`: 조회할 때마다 새 인스턴스

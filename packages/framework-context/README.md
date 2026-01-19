# @croco/framework-context

프레임워크 기반 계층 - 공통 Context, DI 컨테이너, 메타데이터 저장소를 제공합니다.

## 설치

```bash
pnpm add @croco/framework-context
```

## 사용법

### @Component 데코레이터

```typescript
import { Component, Container, Context } from '@croco/framework-context';

@Component() // singleton (기본)
class UserService {
  // ...
}

@Component({ scope: 'request' })
class RequestScopedService {
  // ...
}

@Component({ scope: 'transient' })
class TransientService {
  // 매번 새 인스턴스
}
```

### Context.run()

```typescript
import { Context } from '@croco/framework-context';

const result = Context.run(
  { requestId: 'req-123' },
  async () => {
    // 이 안에서 Context.get()으로 requestId 접근 가능
    const ctx = Context.get();
    return doSomething();
  }
);
```

### Container.get()

```typescript
import { Container } from '@croco/framework-context';

@Service()
class UserRepository {
  // ...
}

const repo = Container.get(UserRepository);
```

## API

### Context

| 메서드 | 설명 |
|--------|------|
| `Context.run(ctx, fn)` | 요청 컨텍스트 내에서 함수 실행 |
| `Context.get()` | 현재 컨텍스트 반환 |
| `Context.getRequestId()` | requestId 반환 |
| `Context.isActive()` | 컨텍스트 활성 여부 |

### Container

| 메서드 | 설명 |
|--------|------|
| `Container.get(token)` | 의존성 해결 |
| `Container.getMany(tokens)` | 여러 의존성 해결 |
| `Container.set(token, instance)` | 인스턴스 직접 등록 |
| `Container.reset()` | 컨테이너 초기화 |

### MetadataStorage

| 메서드 | 설명 |
|--------|------|
| `MetadataStorage.define(key, target, value)` | 메타데이터 저장 |
| `MetadataStorage.get(key, target)` | 메타데이터 조회 |
| `MetadataStorage.getAll(key)` | 모든 메타데이터 조회 |

## Scope

| Scope | 동작 |
|-------|------|
| `singleton` | 앱 전체 1개 (기본) |
| `request` | `Context.run()` 내에서 1개 |
| `transient` | 매번 새 인스턴스 |

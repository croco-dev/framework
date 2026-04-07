# @croco/events-inmemory

`@croco/events-core`의 인메모리 EventBus 구현체입니다. TypeDI 컨테이너와 통합되어 핸들러 인스턴스를 자동으로 주입하며, 백프레셔 메커니즘을 통해 동시 처리량을 제어할 수 있습니다.

## 설치

```bash
pnpm add @croco/events-inmemory @croco/events-core typedi
```

## 사용법

### 기본 사용

```ts
import 'reflect-metadata';
import { EventBusConfig, DomainEvent, EventHandler, RegisterEventHandler } from '@croco/events-core';
import { InMemoryEventBus } from '@croco/events-inmemory';
import { Service, Container } from 'typedi';

class UserCreatedEvent extends DomainEvent {
  static readonly eventName = 'UserCreated';

  constructor(public readonly userId: string) {
    super();
  }
}

@Service()
@RegisterEventHandler(UserCreatedEvent)
class UserCreatedHandler implements EventHandler<UserCreatedEvent> {
  async handle(event: UserCreatedEvent): Promise<void> {
    console.log(`User created: ${event.userId}`);
  }
}

const config = EventBusConfig.getInstance();
config.setEventBus(new InMemoryEventBus());
await config.start({ handlers: [UserCreatedHandler] });
```

### 백프레셔 설정

동시 실행 핸들러 수를 제어하여 과도한 부하를 방지합니다.

```ts
import { InMemoryEventBus } from '@croco/events-inmemory';

const eventBus = new InMemoryEventBus({
  maxConcurrency: 10,
  backpressureStrategy: 'block',
});
```

## API

### InMemoryEventBus

`EventBus` 인터페이스의 인메모리 구현체입니다.

```ts
import { InMemoryEventBus } from '@croco/events-inmemory';

const eventBus = new InMemoryEventBus({
  maxConcurrency: 10,
  backpressureStrategy: 'block',
});
```

**옵션:**

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `maxConcurrency` | `number` | `Infinity` | 동시 실행 가능한 최대 핸들러 수 |
| `backpressureStrategy` | `'drop' \| 'block' \| 'error'` | `'block'` | 동시 처리 한도 초과 시 동작 방식 |

**메서드:**

- `publish(event: TEvent): Promise<void>` - 이벤트를 발행하고 등록된 핸들러들을 실행합니다
- `subscribe(subscription: EventSubscription<TEvent>): void` - 이벤트에 핸들러를 구독합니다
- `unsubscribe(subscription: EventSubscription<TEvent>): void` - 이벤트 구독을 해제하고 실행 중인 핸들러 정보도 정리합니다
- `clear(): void` - 모든 구독과 실행 중인 핸들러를 제거합니다
- `getRunningHandlerCount(): number` - 현재 실행 중인 핸들러 수를 반환합니다
- `getRunningHandlers(): ReadonlyArray<RunningHandler>` - 현재 실행 중인 핸들러 정보를 반환합니다

### 백프레셔 전략

`backpressureStrategy` 옵션으로 한도 초과 시 동작을 제어합니다:

| 전략 | 설명 |
|------|------|
| `'block'` | 슬롯이 생길 때까지 대기 후 실행 (기본값) |
| `'drop'` | 이벤트를 무시하고 즉시 반환 |
| `'error'` | `Error`를 throw |

```ts
const eventBus = new InMemoryEventBus({
  maxConcurrency: 5,
  backpressureStrategy: 'block',
});

// 6개 이상의 핸들러가 동시 실행되면
// block: 순차적으로 실행됨
// drop: 초과 핸들러는 무시됨
// error: Backpressure exceeded 오류 발생
```

## 메모리 관리

`InMemoryEventBus`는 메모리 누수를 방지하기 위한 메커니즘을 포함합니다:

- **구독 해제 시 정리**: `unsubscribe()` 호출 시 관련 실행 중인 핸들러 정보를 정리합니다
- **clear() 메서드**: 모든 구독과 실행 중인 핸들러 정보를 완전히 제거합니다
- **핸들러 완료 후 자동 정리**: 핸들러 실행 완료 시 실행 중 목록에서 자동 제거됩니다

```ts
// 구독 해제 시 실행 중인 핸들러 정리
eventBus.unsubscribe({ eventName: 'UserCreated', handlerClass: UserCreatedHandler });

// 모든 구독 및 실행 중인 핸들러 제거
eventBus.clear();
```

## 타입 안전성

제네릭을 통해 이벤트 타입을 지정할 수 있습니다:

```ts
import type { EventBus, EventSubscription } from '@croco/events-core';

const eventBus: EventBus<UserCreatedEvent> = new InMemoryEventBus<UserCreatedEvent>();

const subscription: EventSubscription<UserCreatedEvent> = {
  eventName: 'UserCreated',
  handlerClass: UserCreatedHandler,
};

eventBus.subscribe(subscription);
```

## 특징

- **TypeDI 통합**: 핸들러 인스턴스는 TypeDI Container에서 자동으로 가져옵니다
- **병렬 처리**: 동일 이벤트에 여러 핸들러가 등록된 경우 병렬로 실행됩니다
- **에러 격리**: 하나의 핸들러가 실패해도 다른 핸들러의 실행에 영향을 주지 않습니다
- **백프레셔 제어**: `maxConcurrency`와 `backpressureStrategy`로 과부하를 방지합니다
- **메모리 누수 방지**: 구독 해제 및 clear 시 관련 데이터를 정리합니다
- **분산 추적**: OpenTelemetry를 통한 자동 Span 생성 및 전파를 지원합니다

## Peer Dependencies

- `typedi` ^0.10.0

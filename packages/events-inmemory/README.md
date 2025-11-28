# @croco/events-inmemory

`@croco/events-core`의 인메모리 EventBus 구현체입니다. TypeDI 컨테이너와 통합되어 핸들러 인스턴스를 자동으로 주입합니다.

## 설치

```bash
pnpm add @croco/events-inmemory @croco/events-core typedi
```

## 사용법

```ts
import 'reflect-metadata';
import { EventBusConfig, DomainEvent, EventHandler, RegisterEventHandler } from '@croco/events-core';
import { InMemoryEventBus } from '@croco/events-inmemory';
import { Service, Container } from 'typedi';

class UserCreatedEvent extends DomainEvent {
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

## API

### InMemoryEventBus

`EventBus` 인터페이스의 인메모리 구현체입니다.

```ts
import { InMemoryEventBus } from '@croco/events-inmemory';

const eventBus = new InMemoryEventBus();
```

**메서드:**

- `publish(event: DomainEvent): Promise<void>` - 이벤트를 발행하고 등록된 핸들러들을 실행합니다
- `subscribe(subscription: EventSubscription): void` - 이벤트에 핸들러를 구독합니다
- `unsubscribe(subscription: EventSubscription): void` - 이벤트 구독을 해제합니다
- `clear(): void` - 모든 구독을 제거합니다

## 특징

- **TypeDI 통합**: 핸들러 인스턴스는 TypeDI Container에서 자동으로 가져옵니다
- **병렬 처리**: 동일 이벤트에 여러 핸들러가 등록된 경우 `Promise.allSettled`로 병렬 실행됩니다
- **에러 격리**: 하나의 핸들러가 실패해도 다른 핸들러의 실행에 영향을 주지 않습니다

## Peer Dependencies

- `typedi` ^0.10.0


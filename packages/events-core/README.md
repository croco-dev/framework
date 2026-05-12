# @croco/events-core

Croco의 도메인 이벤트 핵심 계층입니다. 이벤트 정의, 핸들러 등록, 발행기, 직렬화, 리플레이, DLQ, 순서 보장 인터페이스를 제공합니다.

## 설치

```bash
pnpm add @croco/events-core reflect-metadata
```

## 사용법

### 이벤트와 핸들러 정의

```typescript
import "reflect-metadata";
import { DomainEvent, EventHandler, RegisterEventHandler } from "@croco/events-core";

class UserCreatedEvent extends DomainEvent {
  static eventName = "user.created";

  constructor(readonly userId: string) {
    super();
  }
}

@RegisterEventHandler(UserCreatedEvent)
class UserCreatedHandler implements EventHandler<UserCreatedEvent> {
  async handle(event: UserCreatedEvent): Promise<void> {
    void event.userId;
  }
}
```

### 이벤트 버스 구성과 발행

```typescript
import { EventBusConfig, EventPublisher } from "@croco/events-core";
import { InMemoryEventBus } from "@croco/events-inmemory";

const config = EventBusConfig.getInstance();
config.setEventBus(new InMemoryEventBus());
await config.start({ handlers: [UserCreatedHandler] });

await new EventPublisher().publish(new UserCreatedEvent("user-1"));
```

### 이벤트 직렬화

```typescript
import { DefaultEventSerializer, EventRegistry } from "@croco/events-core";

const registry = EventRegistry.fromMetadata();
const serializer = new DefaultEventSerializer(registry);
```

## API 레퍼런스

- 도메인 모델: `DomainEvent`, `AggregateRoot`, `EventField`, `getEventFields`
- 버스와 발행: `EventBus`, `EventBusConfig`, `EventPublisher`, `EventSubscriptionIndex`
- 등록과 탐색: `RegisterEventHandler`, `EventRegistry`, `RegisterEvent`, `DefaultHandlerResolver`
- 직렬화: `DefaultEventSerializer`, `SerializedEvent`, `EventSerializer`
- 확장 인터페이스: `DeadLetterQueue`, `EventReplay`, `EventStore`, `EventOrdering`, `OrderedEventHandler`
- 기본 정책: `DEFAULT_DEAD_LETTER_POLICY`
- Problem 타입: `EventBusNotSetProblem`, `UnknownEventTypeProblem`, `EventDefinitionProblem`, `DuplicateEventNameProblem`

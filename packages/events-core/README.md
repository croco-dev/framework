# @croco/events-core

Croco의 도메인 이벤트 핵심 계층입니다. 이벤트 정의, 핸들러 등록, 발행기, 직렬화, DLQ 인터페이스를 제공합니다.

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

### DLQ 구현

`DeadLetterQueue`와 `RetryableEventHandler`는 저장소·핸들러 정책 계약입니다. 첫 번째 공식 구현은
`@croco/events-inmemory`의 `InMemoryDeadLetterQueue`이며, 단일 프로세스 실행과 테스트에서 사용할 수 있습니다.
영속 저장소 어댑터는 같은 `eventId`와 `handlerId` 조합을 중복 저장하지 않고 `dequeue` 시 원자적으로 항목을
claim해야 합니다.

### 기존 ordering/replay 타입에서 마이그레이션

런타임에서 소비되지 않던 `EventOrdering`, `EventReplay`, `EventStore` 인터페이스와 관련 설정·결과 타입은
제거되었습니다. Croco에는 이 계약을 대체하는 ordering 또는 replay 런타임이 없으므로 drop-in 마이그레이션 경로도
없습니다. 해당 기능이 필요한 어댑터는 자체 패키지에서 계약과 실행 동작을 함께 정의하고 검증해야 합니다.

## API 레퍼런스

- 도메인 모델: `DomainEvent`, `AggregateRoot`, `EventField`, `getEventFields`
- 버스와 발행: `EventBus`, `EventBusConfig`, `EventPublisher`, `EventSubscriptionIndex`
- 등록과 탐색: `RegisterEventHandler`, `EventRegistry`, `RegisterEvent`, `DefaultHandlerResolver`
- 직렬화: `DefaultEventSerializer`, `SerializedEvent`, `EventSerializer`
- DLQ 계약: `DeadLetterQueue`, `DeadLetterItem`, `DeadLetterPolicy`, `RetryableEventHandler`
- 기본 정책: `DEFAULT_DEAD_LETTER_POLICY`
- Problem 타입: `EventBusNotSetProblem`, `UnknownEventTypeProblem`, `EventDefinitionProblem`, `DuplicateEventNameProblem`

# @croco/events-core

events-core는 도메인 이벤트 기반 아키텍처를 위한 핵심 추상화 라이브러리입니다. 이벤트 발행/구독, DLQ(Dead Letter Queue), Replay, 순서 보장 등의 기능을 제공하는 인터페이스를 정의합니다.

## 설치

```bash
pnpm add @croco/events-core
```

## 핵심 개념

- **DomainEvent**: 모든 도메인 이벤트의 기본 클래스
- **EventBus**: 이벤트 발행/구독을 위한 인터페이스
- **EventHandler**: 이벤트를 처리하는 핸들러 인터페이스
- **DLQ (Dead Letter Queue)**: 처리 실패한 이벤트를 관리하는 인터페이스
- **EventReplay**: 과거 이벤트를 재생성하고 재처리하는 인터페이스
- **EventOrdering**: 같은 파티션 키를 가진 이벤트의 순서를 보장하는 인터페이스

## API

### DomainEvent

모든 도메인 이벤트가 상속해야 하는 기본 추상 클래스입니다.

```typescript
import { DomainEvent } from '@croco/events-core';

class UserCreatedEvent extends DomainEvent {
  static eventName = 'UserCreated';

  constructor(
    public readonly userId: string,
    public readonly email: string
  ) {
    super();
  }
}
```

### EventHandler

이벤트를 처리하는 핸들러 인터페이스입니다.

```typescript
import { EventHandler, RegisterEventHandler } from '@croco/events-core';

@RegisterEventHandler(UserCreatedEvent)
class UserCreatedHandler implements EventHandler<UserCreatedEvent> {
  async handle(event: UserCreatedEvent): Promise<void> {
    console.log(`User created: ${event.userId} (${event.email})`);
  }
}
```

### EventBus

이벤트를 발행하고 구독하는 버스 인터페이스입니다. 제네릭을 통해 타입 안전성을 제공합니다.

```typescript
import type { EventBus, EventSubscription } from '@croco/events-core';

// 구독
const subscription: EventSubscription<UserCreatedEvent> = {
  eventName: 'UserCreated',
  handlerClass: UserCreatedHandler,
  handler: new UserCreatedHandler(),
};

eventBus.subscribe(subscription);

// 발행
await eventBus.publish(new UserCreatedEvent('user-123', 'user@example.com'));
```

### EventSubscriptionIndex

이벤트 이름 패턴 매칭을 최적화하는 인덱스입니다. Trie + Map 기반으로 O(1) 정확 매칭과 O(n) 와일드카드 매칭을 지원합니다.

```typescript
import { EventSubscriptionIndex } from '@croco/events-core';

const index = new EventSubscriptionIndex<EventHandler>();

// 구독 등록
index.add('user.created', handler);
index.add('user.*', wildcardHandler);
index.add('order.*', orderHandler);

// 매칭
const handlers = index.match('user.created');
// -> user.created 정확 매칭 + user.* 와일드카드 매칭 핸들러
```

### DeadLetterQueue (DLQ)

처리 실패한 이벤트를 관리하는 인터페이스입니다.

```typescript
import type { DeadLetterQueue, DeadLetterItem, DeadLetterPolicy } from '@croco/events-core';

// DLQ 정책 설정
const policy: DeadLetterPolicy = {
  maxRetries: 3,
  retryDelayMs: 1000,
  backoffMultiplier: 2,
  maxRetryDelayMs: 30000,
  retentionDays: 7,
};

// DLQ 인터페이스 구현체 사용
const dlq: DeadLetterQueue = /* 구현체 주입 */;

// 실패한 이벤트 저장
await dlq.enqueue({
  event: failedEvent,
  reason: 'Handler timeout',
  failedAt: new Date(),
  retryCount: 3,
  lastError: 'Timeout after 30s',
});

// DLQ에서 이벤트 조회
const items = await dlq.dequeue(10);

// 재처리 후 제거
await dlq.remove(itemId);
```

### EventReplay

과거 이벤트를 재생성하고 재처리하는 인터페이스입니다.

```typescript
import type { EventReplay, ReplayOptions, ReplayResult } from '@croco/events-core';

const replay: EventReplay = /* 구현체 주입 */;

// 특정 시간 범위의 이벤트 리플레이
const options: ReplayOptions = {
  from: new Date('2024-01-01'),
  to: new Date('2024-01-31'),
  eventTypes: ['UserCreated', 'OrderPlaced'],
  mode: 'accurate',
  batchSize: 100,
  onProgress: (processed, total) => {
    console.log(`Progress: ${processed}/${total}`);
  },
};

const result: ReplayResult = await replay.replay(options);
console.log(`Processed: ${result.processedCount}, Failed: ${result.failedCount}`);

// 스냅샷 생성
const snapshot = await replay.createSnapshot({ version: 'v1' });

// 스냅샷으로 복원
await replay.restoreSnapshot(snapshot.snapshotId);
```

### EventOrdering

같은 파티션 키를 가진 이벤트의 순서를 보장하는 인터페이스입니다.

```typescript
import type {
  EventOrdering,
  OrderedEventHandler,
  OrderedEventContext,
} from '@croco/events-core';

// 순서 보장 핸들러
class OrderEventHandler implements OrderedEventHandler<OrderEvent> {
  async handle(event: OrderEvent, context: OrderedEventContext): Promise<void> {
    console.log(`Partition: ${context.partitionKey}, Sequence: ${context.sequence}`);
    // 같은 파티션 키의 이벤트는 순서대로 처리됨
  }

  getPartitionKey(event: OrderEvent): string {
    return event.orderId; // orderId별로 순서 보장
  }
}

// 순서 보장 발행
const ordering: EventOrdering = /* 구현체 주입 */;
await ordering.publishOrdered(event, event.orderId);

// 파티션 상태 조회
const status = await ordering.getPartitionStatus('order-123');
console.log(`Pending: ${status?.pendingCount}, Processing: ${status?.processingCount}`);
```

### EventPublisher

설정된 EventBus를 통해 이벤트를 발행하는 헬퍼 클래스입니다.

```typescript
import { EventPublisher } from '@croco/events-core';

const publisher = new EventPublisher();

// 즉시 발행
await publisher.publishNow(new UserCreatedEvent('user-123', 'user@example.com'));

// 트랜잭션 커밋 후 발행
publisher.publishAfterCommit(new UserCreatedEvent('user-123', 'user@example.com'));

// 다건 발행
await publisher.publishMany([event1, event2, event3]);
```

### EventRegistry

이벤트 타입 레지스트리입니다. 역직렬화를 위해 이벤트 클래스를 등록하고 조회합니다.

```typescript
import { EventRegistry, RegisterEvent } from '@croco/events-core';

@RegisterEvent()
class UserCreatedEvent extends DomainEvent {
  static eventName = 'UserCreated';
  // ...
}

// 레지스트리에서 이벤트 클래스 조회
const registry = EventRegistry.fromMetadata();
const EventClass = registry.get('UserCreated');
```

### EventSerializer

이벤트 직렬화/역직렬화를 위한 인터페이스입니다.

```typescript
import { DefaultEventSerializer } from '@croco/events-core';

const serializer = new DefaultEventSerializer(registry);

// 직렬화
const serialized = await serializer.serialize(event);

// 역직렬화
const event = await serializer.deserialize(serialized);
```

## 인터페이스 목록

| 인터페이스 | 설명 |
|-----------|------|
| `EventBus<TEvent>` | 이벤트 발행/구독 인터페이스 |
| `EventPublishing<TEvent>` | 이벤트 발행 인터페이스 |
| `EventSubscribing<TEvent>` | 이벤트 구독 인터페이스 |
| `EventHandler<TEvent>` | 이벤트 핸들러 인터페이스 |
| `DeadLetterQueue` | 죽은 편지 큐 인터페이스 |
| `EventReplay` | 이벤트 리플레이 인터페이스 |
| `EventStore` | 이벤트 저장소 인터페이스 |
| `EventOrdering` | 순서 보장 이벤트 버스 인터페이스 |
| `OrderedEventHandler` | 순서 보장 핸들러 인터페이스 |
| `HandlerResolver` | 핸들러 해결 인터페이스 |
| `EventSerializer` | 이벤트 직렬화 인터페이스 |

## 타입 안전성

모든 인터페이스는 제네릭을 통해 타입 안전성을 제공합니다.

```typescript
// EventBus에 특정 이벤트 타입 지정
interface UserEventBus extends EventBus<UserCreatedEvent> {}

// Handler에 특정 이벤트 타입 지정
class UserHandler implements EventHandler<UserCreatedEvent> {
  async handle(event: UserCreatedEvent): Promise<void> {
    // event는 UserCreatedEvent 타입으로 추론됨
  }
}

// Subscription에 특정 이벤트 타입 지정
const subscription: EventSubscription<UserCreatedEvent> = {
  eventName: 'UserCreated',
  handlerClass: UserCreatedHandler,
  handler: new UserCreatedHandler(),
};
```

## 참고사항

- 이 패키지는 **인터페이스만 제공**합니다. 실제 구현체는 `events-inmemory`, `events-kafka`, `events-sqs` 등의 패키지에서 제공됩니다.
- DLQ, Replay, Ordering 인터페이스는 구현체에서 선택적으로 구현할 수 있습니다.
- 모든 인터페이스는 TSDoc으로 문서화되어 있습니다.

## 전체 예제

```typescript
import 'reflect-metadata';
import {
  DomainEvent,
  AggregateRoot,
  EventHandler,
  RegisterEventHandler,
  EventBusConfig,
  EventPublisher,
} from '@croco/events-core';
import { InMemoryEventBus } from '@croco/events-inmemory';

class OrderPlacedEvent extends DomainEvent {
  static eventName = 'OrderPlaced';
  constructor(
    public readonly orderId: string,
    public readonly amount: number
  ) {
    super();
  }
}

@RegisterEventHandler(OrderPlacedEvent)
class OrderPlacedHandler implements EventHandler<OrderPlacedEvent> {
  async handle(event: OrderPlacedEvent): Promise<void> {
    console.log(`Order ${event.orderId} placed for $${event.amount}`);
  }
}

const config = EventBusConfig.getInstance();
config.setEventBus(new InMemoryEventBus());
await config.start({ handlers: [OrderPlacedHandler] });

const publisher = new EventPublisher();
await publisher.publish(new OrderPlacedEvent('order-1', 100));
```

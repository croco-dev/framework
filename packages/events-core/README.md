# @croco/events-core

도메인 이벤트 기반 아키텍처를 위한 핵심 추상화 라이브러리입니다.

## 설치

```bash
pnpm add @croco/events-core
```

## API

### DomainEvent

도메인 이벤트의 기본 추상 클래스입니다.

```ts
import { DomainEvent } from '@croco/events-core';

class UserCreatedEvent extends DomainEvent {
  constructor(public readonly userId: string) {
    super();
  }
}
```

### AggregateRoot

도메인 이벤트를 발행할 수 있는 Aggregate Root 추상 클래스입니다.

```ts
import { AggregateRoot, DomainEvent } from '@croco/events-core';

class User extends AggregateRoot {
  create(id: string) {
    this.addDomainEvent(new UserCreatedEvent(id));
  }
}

const user = new User();
user.create('user-123');

const events = user.getDomainEvents();
user.clearDomainEvents();
```

### EventHandler

이벤트를 처리하는 핸들러 인터페이스와 데코레이터입니다.

```ts
import { EventHandler, RegisterEventHandler, DomainEvent } from '@croco/events-core';

@RegisterEventHandler(UserCreatedEvent)
class UserCreatedHandler implements EventHandler<UserCreatedEvent> {
  async handle(event: UserCreatedEvent): Promise<void> {
    console.log(`User created: ${event.userId}`);
  }
}
```

### EventBus

이벤트를 발행하고 구독하는 버스 인터페이스입니다.

```ts
interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe(subscription: EventSubscription): void;
  unsubscribe(subscription: EventSubscription): void;
  clear(): void;
}
```

### EventBusConfig

EventBus 싱글톤 설정 및 핸들러 등록을 관리합니다.

```ts
import { EventBusConfig } from '@croco/events-core';
import { InMemoryEventBus } from '@croco/events-inmemory';

const config = EventBusConfig.getInstance();
config.setEventBus(new InMemoryEventBus());

await config.start({ handlers: [UserCreatedHandler] });
```

### EventPublisher

설정된 EventBus를 통해 이벤트를 발행하는 헬퍼 클래스입니다.

```ts
import { EventPublisher } from '@croco/events-core';

const publisher = new EventPublisher();

await publisher.publish(new UserCreatedEvent('user-123'));
await publisher.publishMany([event1, event2]);
```

## 전체 예제

```ts
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


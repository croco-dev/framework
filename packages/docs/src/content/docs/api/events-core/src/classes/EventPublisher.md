---
editUrl: false
next: false
prev: false
title: "EventPublisher"
---

현재 EventBus 설정을 사용해 이벤트를 즉시 발행하거나 커밋 후 발행으로 예약합니다.

## Constructors

### Constructor

> **new EventPublisher**(`config`): `EventPublisher`

#### Parameters

##### config

[`EventBusConfig`](/api/events-core/src/classes/eventbusconfig/)

#### Returns

`EventPublisher`

## Methods

### publishAfterCommit()

> **publishAfterCommit**(`event`, `onPublished?`): `void`

#### Parameters

##### event

[`DomainEvent`](/api/events-core/src/classes/domainevent/)

##### onPublished?

() => `void`

#### Returns

`void`

---

### publishMany()

> **publishMany**(`events`): `Promise`\<`PublishResult`\<[`DomainEvent`](/api/events-core/src/classes/domainevent/)\>[]\>

#### Parameters

##### events

[`DomainEvent`](/api/events-core/src/classes/domainevent/)[]

#### Returns

`Promise`\<`PublishResult`\<[`DomainEvent`](/api/events-core/src/classes/domainevent/)\>[]\>

---

### publishManyParallel()

> **publishManyParallel**(`events`): `Promise`\<`PublishResult`\<[`DomainEvent`](/api/events-core/src/classes/domainevent/)\>[]\>

#### Parameters

##### events

[`DomainEvent`](/api/events-core/src/classes/domainevent/)[]

#### Returns

`Promise`\<`PublishResult`\<[`DomainEvent`](/api/events-core/src/classes/domainevent/)\>[]\>

---

### publishNow()

> **publishNow**(`event`): `Promise`\<`void`\>

#### Parameters

##### event

[`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Returns

`Promise`\<`void`\>

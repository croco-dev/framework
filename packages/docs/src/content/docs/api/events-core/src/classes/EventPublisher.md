---
editUrl: false
next: false
prev: false
title: "EventPublisher"
---

Defined in: [packages/events-core/src/libs/EventPublisher.ts:18](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/EventPublisher.ts#L18)

현재 EventBus 설정을 사용해 이벤트를 즉시 발행하거나 커밋 후 발행으로 예약합니다.

## Constructors

### Constructor

> **new EventPublisher**(`config`): `EventPublisher`

Defined in: [packages/events-core/src/libs/EventPublisher.ts:19](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/EventPublisher.ts#L19)

#### Parameters

##### config

[`EventBusConfig`](/api/events-core/src/classes/eventbusconfig/)

#### Returns

`EventPublisher`

## Methods

### ~~publish()~~

> **publish**(`event`): `Promise`\<`void`\>

Defined in: [packages/events-core/src/libs/EventPublisher.ts:54](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/EventPublisher.ts#L54)

:::caution[Deprecated]
Use publishNow() for immediate publication or publishAfterCommit() for explicit after-commit scheduling.
:::

#### Parameters

##### event

[`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Returns

`Promise`\<`void`\>

***

### publishAfterCommit()

> **publishAfterCommit**(`event`): `void`

Defined in: [packages/events-core/src/libs/EventPublisher.ts:42](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/EventPublisher.ts#L42)

#### Parameters

##### event

[`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Returns

`void`

***

### publishMany()

> **publishMany**(`events`): `Promise`\<`PublishResult`\<[`DomainEvent`](/api/events-core/src/classes/domainevent/)\>[]\>

Defined in: [packages/events-core/src/libs/EventPublisher.ts:63](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/EventPublisher.ts#L63)

#### Parameters

##### events

[`DomainEvent`](/api/events-core/src/classes/domainevent/)[]

#### Returns

`Promise`\<`PublishResult`\<[`DomainEvent`](/api/events-core/src/classes/domainevent/)\>[]\>

***

### publishManyParallel()

> **publishManyParallel**(`events`): `Promise`\<`PublishResult`\<[`DomainEvent`](/api/events-core/src/classes/domainevent/)\>[]\>

Defined in: [packages/events-core/src/libs/EventPublisher.ts:76](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/EventPublisher.ts#L76)

#### Parameters

##### events

[`DomainEvent`](/api/events-core/src/classes/domainevent/)[]

#### Returns

`Promise`\<`PublishResult`\<[`DomainEvent`](/api/events-core/src/classes/domainevent/)\>[]\>

***

### publishNow()

> **publishNow**(`event`): `Promise`\<`void`\>

Defined in: [packages/events-core/src/libs/EventPublisher.ts:38](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/EventPublisher.ts#L38)

#### Parameters

##### event

[`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Returns

`Promise`\<`void`\>

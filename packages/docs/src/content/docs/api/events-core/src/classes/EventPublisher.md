---
editUrl: false
next: false
prev: false
title: "EventPublisher"
---

Defined in: [packages/events-core/src/libs/EventPublisher.ts:15](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/events-core/src/libs/EventPublisher.ts#L15)

구성된 EventBus를 통해 단건/다건 이벤트를 발행하는 헬퍼입니다.

## Constructors

### Constructor

> **new EventPublisher**(`config`): `EventPublisher`

Defined in: [packages/events-core/src/libs/EventPublisher.ts:16](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/events-core/src/libs/EventPublisher.ts#L16)

#### Parameters

##### config

[`EventBusConfig`](/api/events-core/src/classes/eventbusconfig/)

#### Returns

`EventPublisher`

## Methods

### ~~publish()~~

> **publish**(`event`): `Promise`\<`void`\>

Defined in: [packages/events-core/src/libs/EventPublisher.ts:51](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/events-core/src/libs/EventPublisher.ts#L51)

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

Defined in: [packages/events-core/src/libs/EventPublisher.ts:39](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/events-core/src/libs/EventPublisher.ts#L39)

#### Parameters

##### event

[`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Returns

`void`

***

### publishMany()

> **publishMany**(`events`): `Promise`\<`PublishResult`\<[`DomainEvent`](/api/events-core/src/classes/domainevent/)\>[]\>

Defined in: [packages/events-core/src/libs/EventPublisher.ts:60](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/events-core/src/libs/EventPublisher.ts#L60)

#### Parameters

##### events

[`DomainEvent`](/api/events-core/src/classes/domainevent/)[]

#### Returns

`Promise`\<`PublishResult`\<[`DomainEvent`](/api/events-core/src/classes/domainevent/)\>[]\>

***

### publishManyParallel()

> **publishManyParallel**(`events`): `Promise`\<`PublishResult`\<[`DomainEvent`](/api/events-core/src/classes/domainevent/)\>[]\>

Defined in: [packages/events-core/src/libs/EventPublisher.ts:73](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/events-core/src/libs/EventPublisher.ts#L73)

#### Parameters

##### events

[`DomainEvent`](/api/events-core/src/classes/domainevent/)[]

#### Returns

`Promise`\<`PublishResult`\<[`DomainEvent`](/api/events-core/src/classes/domainevent/)\>[]\>

***

### publishNow()

> **publishNow**(`event`): `Promise`\<`void`\>

Defined in: [packages/events-core/src/libs/EventPublisher.ts:35](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/events-core/src/libs/EventPublisher.ts#L35)

#### Parameters

##### event

[`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Returns

`Promise`\<`void`\>

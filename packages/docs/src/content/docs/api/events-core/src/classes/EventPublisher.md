---
editUrl: false
next: false
prev: false
title: "EventPublisher"
---

Defined in: [packages/events-core/src/libs/EventPublisher.ts:12](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/events-core/src/libs/EventPublisher.ts#L12)

구성된 EventBus를 통해 단건/다건 이벤트를 발행하는 헬퍼입니다.

## Constructors

### Constructor

> **new EventPublisher**(`config`): `EventPublisher`

Defined in: [packages/events-core/src/libs/EventPublisher.ts:13](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/events-core/src/libs/EventPublisher.ts#L13)

#### Parameters

##### config

[`EventBusConfig`](/api/events-core/src/classes/eventbusconfig/)

#### Returns

`EventPublisher`

## Methods

### publish()

> **publish**(`event`): `Promise`\<`void`\>

Defined in: [packages/events-core/src/libs/EventPublisher.ts:32](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/events-core/src/libs/EventPublisher.ts#L32)

#### Parameters

##### event

[`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Returns

`Promise`\<`void`\>

***

### publishMany()

> **publishMany**(`events`): `Promise`\<`PublishResult`\<[`DomainEvent`](/api/events-core/src/classes/domainevent/)\>[]\>

Defined in: [packages/events-core/src/libs/EventPublisher.ts:41](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/events-core/src/libs/EventPublisher.ts#L41)

#### Parameters

##### events

[`DomainEvent`](/api/events-core/src/classes/domainevent/)[]

#### Returns

`Promise`\<`PublishResult`\<[`DomainEvent`](/api/events-core/src/classes/domainevent/)\>[]\>

***

### publishManyParallel()

> **publishManyParallel**(`events`): `Promise`\<`PublishResult`\<[`DomainEvent`](/api/events-core/src/classes/domainevent/)\>[]\>

Defined in: [packages/events-core/src/libs/EventPublisher.ts:54](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/events-core/src/libs/EventPublisher.ts#L54)

#### Parameters

##### events

[`DomainEvent`](/api/events-core/src/classes/domainevent/)[]

#### Returns

`Promise`\<`PublishResult`\<[`DomainEvent`](/api/events-core/src/classes/domainevent/)\>[]\>

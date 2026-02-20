---
editUrl: false
next: false
prev: false
title: "EventPublisher"
---

Defined in: [packages/events-core/src/libs/EventPublisher.ts:4](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/events-core/src/libs/EventPublisher.ts#L4)

## Constructors

### Constructor

> **new EventPublisher**(): `EventPublisher`

#### Returns

`EventPublisher`

## Methods

### publish()

> **publish**(`event`): `Promise`\<`void`\>

Defined in: [packages/events-core/src/libs/EventPublisher.ts:9](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/events-core/src/libs/EventPublisher.ts#L9)

#### Parameters

##### event

[`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Returns

`Promise`\<`void`\>

***

### publishMany()

> **publishMany**(`events`): `Promise`\<`void`\>

Defined in: [packages/events-core/src/libs/EventPublisher.ts:13](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/events-core/src/libs/EventPublisher.ts#L13)

#### Parameters

##### events

[`DomainEvent`](/api/events-core/src/classes/domainevent/)[]

#### Returns

`Promise`\<`void`\>

***

### publishManyParallel()

> **publishManyParallel**(`events`): `Promise`\<`void`\>

Defined in: [packages/events-core/src/libs/EventPublisher.ts:19](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/events-core/src/libs/EventPublisher.ts#L19)

#### Parameters

##### events

[`DomainEvent`](/api/events-core/src/classes/domainevent/)[]

#### Returns

`Promise`\<`void`\>

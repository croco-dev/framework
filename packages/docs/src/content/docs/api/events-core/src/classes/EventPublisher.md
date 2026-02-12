---
editUrl: false
next: false
prev: false
title: "EventPublisher"
---

Defined in: [packages/events-core/src/libs/EventPublisher.ts:4](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/events-core/src/libs/EventPublisher.ts#L4)

## Constructors

### Constructor

> **new EventPublisher**(): `EventPublisher`

#### Returns

`EventPublisher`

## Methods

### publish()

> **publish**(`event`): `Promise`\<`void`\>

Defined in: [packages/events-core/src/libs/EventPublisher.ts:9](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/events-core/src/libs/EventPublisher.ts#L9)

#### Parameters

##### event

[`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Returns

`Promise`\<`void`\>

***

### publishMany()

> **publishMany**(`events`): `Promise`\<`void`\>

Defined in: [packages/events-core/src/libs/EventPublisher.ts:13](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/events-core/src/libs/EventPublisher.ts#L13)

#### Parameters

##### events

[`DomainEvent`](/api/events-core/src/classes/domainevent/)[]

#### Returns

`Promise`\<`void`\>

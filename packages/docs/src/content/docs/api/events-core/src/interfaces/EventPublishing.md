---
editUrl: false
next: false
prev: false
title: "EventPublishing"
---

Defined in: [packages/events-core/src/libs/interfaces/EventPublishing.ts:7](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventPublishing.ts#L7)

이벤트 발행 인터페이스입니다.
이벤트 버스에서 이벤트를 발행하는 기능만 제공합니다.

## Extended by

- [`EventBus`](/api/events-core/src/interfaces/eventbus/)

## Type Parameters

### TEvent

`TEvent` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/) = [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Methods

### publish()

> **publish**(`event`): `Promise`\<`void`\>

Defined in: [packages/events-core/src/libs/interfaces/EventPublishing.ts:8](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventPublishing.ts#L8)

#### Parameters

##### event

`TEvent`

#### Returns

`Promise`\<`void`\>

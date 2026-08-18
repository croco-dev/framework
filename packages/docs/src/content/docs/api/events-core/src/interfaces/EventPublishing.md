---
editUrl: false
next: false
prev: false
title: "EventPublishing"
---

이벤트 발행 인터페이스입니다.
이벤트 버스에서 이벤트를 발행하는 기능만 제공합니다.

## Extended by

- [`EventBus`](/api/events-core/src/interfaces/eventbus/)

## Type Parameters

### TEvent

`TEvent` _extends_ [`DomainEvent`](/api/events-core/src/classes/domainevent/) = [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Methods

### publish()

> **publish**(`event`): `Promise`\<`void`\>

#### Parameters

##### event

`TEvent`

#### Returns

`Promise`\<`void`\>

---
editUrl: false
next: false
prev: false
title: "EventPublishing"
---

Defined in: [packages/events-core/src/libs/interfaces/EventPublishing.ts:7](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/events-core/src/libs/interfaces/EventPublishing.ts#L7)

이벤트 발행 인터페이스입니다.
이벤트 버스에서 이벤트를 발행하는 기능만 제공합니다.

## Extended by

- [`EventBus`](/api/events-core/src/interfaces/eventbus/)

## Methods

### publish()

> **publish**(`event`): `Promise`\<`void`\>

Defined in: [packages/events-core/src/libs/interfaces/EventPublishing.ts:8](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/events-core/src/libs/interfaces/EventPublishing.ts#L8)

#### Parameters

##### event

[`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Returns

`Promise`\<`void`\>

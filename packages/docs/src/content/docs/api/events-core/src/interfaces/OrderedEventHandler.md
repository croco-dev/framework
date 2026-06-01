---
editUrl: false
next: false
prev: false
title: "OrderedEventHandler"
---

순서 보장 이벤트 핸들러 인터페이스입니다.
순서가 보장된 이벤트 처리를 위한 추가 메서드를 제공합니다.

## Type Parameters

### TEvent

`TEvent` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/) = [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Methods

### getPartitionKey()

> **getPartitionKey**(`event`): `string`

파티션 키를 추출합니다.

#### Parameters

##### event

`TEvent`

이벤트

#### Returns

`string`

파티션 키

***

### handle()

> **handle**(`event`, `context`): `Promise`\<`void`\>

이벤트를 처리합니다.

#### Parameters

##### event

`TEvent`

처리할 이벤트

##### context

[`OrderedEventContext`](/api/events-core/src/type-aliases/orderedeventcontext/)

순서 컨텍스트

#### Returns

`Promise`\<`void`\>

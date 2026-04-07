---
editUrl: false
next: false
prev: false
title: "OrderedEventHandler"
---

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:125](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventOrdering.ts#L125)

순서 보장 이벤트 핸들러 인터페이스입니다.
순서가 보장된 이벤트 처리를 위한 추가 메서드를 제공합니다.

## Type Parameters

### TEvent

`TEvent` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/) = [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Methods

### getPartitionKey()

> **getPartitionKey**(`event`): `string`

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:138](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventOrdering.ts#L138)

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

Defined in: [packages/events-core/src/libs/interfaces/EventOrdering.ts:131](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventOrdering.ts#L131)

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

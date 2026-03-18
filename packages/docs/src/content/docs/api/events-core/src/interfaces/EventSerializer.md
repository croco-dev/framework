---
editUrl: false
next: false
prev: false
title: "EventSerializer"
---

Defined in: [packages/events-core/src/libs/EventSerializer.ts:32](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/events-core/src/libs/EventSerializer.ts#L32)

이벤트 직렬화 인터페이스

## Methods

### deserialize()

> **deserialize**\<`T`\>(`data`): `T`

Defined in: [packages/events-core/src/libs/EventSerializer.ts:34](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/events-core/src/libs/EventSerializer.ts#L34)

#### Type Parameters

##### T

`T` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Parameters

##### data

[`SerializedEvent`](/api/events-core/src/interfaces/serializedevent/)

#### Returns

`T`

***

### serialize()

> **serialize**\<`T`\>(`event`): [`SerializedEvent`](/api/events-core/src/interfaces/serializedevent/)

Defined in: [packages/events-core/src/libs/EventSerializer.ts:33](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/events-core/src/libs/EventSerializer.ts#L33)

#### Type Parameters

##### T

`T` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Parameters

##### event

`T`

#### Returns

[`SerializedEvent`](/api/events-core/src/interfaces/serializedevent/)

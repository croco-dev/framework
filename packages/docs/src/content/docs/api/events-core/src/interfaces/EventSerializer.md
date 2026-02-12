---
editUrl: false
next: false
prev: false
title: "EventSerializer"
---

Defined in: [packages/events-core/src/libs/EventSerializer.ts:18](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/events-core/src/libs/EventSerializer.ts#L18)

이벤트 직렬화 인터페이스

## Methods

### deserialize()

> **deserialize**\<`T`\>(`data`): `T`

Defined in: [packages/events-core/src/libs/EventSerializer.ts:20](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/events-core/src/libs/EventSerializer.ts#L20)

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

Defined in: [packages/events-core/src/libs/EventSerializer.ts:19](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/events-core/src/libs/EventSerializer.ts#L19)

#### Type Parameters

##### T

`T` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Parameters

##### event

`T`

#### Returns

[`SerializedEvent`](/api/events-core/src/interfaces/serializedevent/)

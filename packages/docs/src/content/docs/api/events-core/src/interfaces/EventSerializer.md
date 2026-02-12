---
editUrl: false
next: false
prev: false
title: "EventSerializer"
---

Defined in: [packages/events-core/src/libs/EventSerializer.ts:18](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/events-core/src/libs/EventSerializer.ts#L18)

이벤트 직렬화 인터페이스

## Methods

### deserialize()

> **deserialize**\<`T`\>(`data`): `T`

Defined in: [packages/events-core/src/libs/EventSerializer.ts:20](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/events-core/src/libs/EventSerializer.ts#L20)

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

Defined in: [packages/events-core/src/libs/EventSerializer.ts:19](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/events-core/src/libs/EventSerializer.ts#L19)

#### Type Parameters

##### T

`T` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Parameters

##### event

`T`

#### Returns

[`SerializedEvent`](/api/events-core/src/interfaces/serializedevent/)

---
editUrl: false
next: false
prev: false
title: "DefaultEventSerializer"
---

Defined in: [packages/events-core/src/libs/EventSerializer.ts:26](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/events-core/src/libs/EventSerializer.ts#L26)

기본 이벤트 직렬화 구현체

## Implements

- [`EventSerializer`](/api/events-core/src/interfaces/eventserializer/)

## Constructors

### Constructor

> **new DefaultEventSerializer**(`registry?`): `DefaultEventSerializer`

Defined in: [packages/events-core/src/libs/EventSerializer.ts:27](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/events-core/src/libs/EventSerializer.ts#L27)

#### Parameters

##### registry?

[`EventRegistry`](/api/events-core/src/classes/eventregistry/) = `globalEventRegistry`

#### Returns

`DefaultEventSerializer`

## Methods

### deserialize()

> **deserialize**\<`T`\>(`data`): `T`

Defined in: [packages/events-core/src/libs/EventSerializer.ts:39](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/events-core/src/libs/EventSerializer.ts#L39)

#### Type Parameters

##### T

`T` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Parameters

##### data

[`SerializedEvent`](/api/events-core/src/interfaces/serializedevent/)

#### Returns

`T`

#### Implementation of

[`EventSerializer`](/api/events-core/src/interfaces/eventserializer/).[`deserialize`](/api/events-core/src/interfaces/eventserializer/#deserialize)

***

### serialize()

> **serialize**\<`T`\>(`event`): [`SerializedEvent`](/api/events-core/src/interfaces/serializedevent/)

Defined in: [packages/events-core/src/libs/EventSerializer.ts:29](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/events-core/src/libs/EventSerializer.ts#L29)

#### Type Parameters

##### T

`T` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Parameters

##### event

`T`

#### Returns

[`SerializedEvent`](/api/events-core/src/interfaces/serializedevent/)

#### Implementation of

[`EventSerializer`](/api/events-core/src/interfaces/eventserializer/).[`serialize`](/api/events-core/src/interfaces/eventserializer/#serialize)

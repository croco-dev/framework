---
editUrl: false
next: false
prev: false
title: "DefaultEventSerializer"
---

기본 이벤트 직렬화 구현체

## Implements

- [`EventSerializer`](/api/events-core/src/interfaces/eventserializer/)

## Constructors

### Constructor

> **new DefaultEventSerializer**(`registry?`): `DefaultEventSerializer`

#### Parameters

##### registry?

[`EventRegistry`](/api/events-core/src/classes/eventregistry/) = `...`

#### Returns

`DefaultEventSerializer`

## Methods

### deserialize()

> **deserialize**\<`T`\>(`data`): `T`

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

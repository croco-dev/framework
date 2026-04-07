---
editUrl: false
next: false
prev: false
title: "DefaultEventSerializer"
---

Defined in: [packages/events-core/src/libs/EventSerializer.ts:40](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/EventSerializer.ts#L40)

기본 이벤트 직렬화 구현체

## Implements

- [`EventSerializer`](/api/events-core/src/interfaces/eventserializer/)

## Constructors

### Constructor

> **new DefaultEventSerializer**(`registry?`): `DefaultEventSerializer`

Defined in: [packages/events-core/src/libs/EventSerializer.ts:41](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/EventSerializer.ts#L41)

#### Parameters

##### registry?

[`EventRegistry`](/api/events-core/src/classes/eventregistry/) = `...`

#### Returns

`DefaultEventSerializer`

## Methods

### deserialize()

> **deserialize**\<`T`\>(`data`): `T`

Defined in: [packages/events-core/src/libs/EventSerializer.ts:53](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/EventSerializer.ts#L53)

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

Defined in: [packages/events-core/src/libs/EventSerializer.ts:43](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/EventSerializer.ts#L43)

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

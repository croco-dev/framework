---
editUrl: false
next: false
prev: false
title: "DefaultEventSerializer"
---

Defined in: [packages/events-core/src/libs/EventSerializer.ts:36](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/events-core/src/libs/EventSerializer.ts#L36)

기본 이벤트 직렬화 구현체

## Implements

- [`EventSerializer`](/api/events-core/src/interfaces/eventserializer/)

## Constructors

### Constructor

> **new DefaultEventSerializer**(`registry?`): `DefaultEventSerializer`

Defined in: [packages/events-core/src/libs/EventSerializer.ts:37](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/events-core/src/libs/EventSerializer.ts#L37)

#### Parameters

##### registry?

[`EventRegistry`](/api/events-core/src/classes/eventregistry/) = `globalEventRegistry`

#### Returns

`DefaultEventSerializer`

## Methods

### deserialize()

> **deserialize**\<`T`\>(`data`): `T`

Defined in: [packages/events-core/src/libs/EventSerializer.ts:49](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/events-core/src/libs/EventSerializer.ts#L49)

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

Defined in: [packages/events-core/src/libs/EventSerializer.ts:39](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/events-core/src/libs/EventSerializer.ts#L39)

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

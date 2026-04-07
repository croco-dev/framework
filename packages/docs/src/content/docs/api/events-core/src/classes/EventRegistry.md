---
editUrl: false
next: false
prev: false
title: "EventRegistry"
---

Defined in: [packages/events-core/src/libs/EventRegistry.ts:17](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/EventRegistry.ts#L17)

이벤트 타입 레지스트리
역직렬화를 위해 이벤트 클래스를 등록하고 조회합니다.

## Constructors

### Constructor

> **new EventRegistry**(): `EventRegistry`

#### Returns

`EventRegistry`

## Methods

### clear()

> **clear**(): `void`

Defined in: [packages/events-core/src/libs/EventRegistry.ts:69](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/EventRegistry.ts#L69)

레지스트리를 초기화합니다.

#### Returns

`void`

***

### get()

> **get**\<`T`\>(`eventType`): `EventClass`\<`T`\> \| `undefined`

Defined in: [packages/events-core/src/libs/EventRegistry.ts:45](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/EventRegistry.ts#L45)

이벤트 타입 이름으로 등록된 클래스를 조회합니다.

#### Type Parameters

##### T

`T` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Parameters

##### eventType

`string`

이벤트 타입 이름 (클래스 이름)

#### Returns

`EventClass`\<`T`\> \| `undefined`

등록된 이벤트 클래스 또는 undefined

***

### getRegisteredTypes()

> **getRegisteredTypes**(): `string`[]

Defined in: [packages/events-core/src/libs/EventRegistry.ts:62](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/EventRegistry.ts#L62)

등록된 모든 이벤트 타입 이름을 반환합니다.

#### Returns

`string`[]

이벤트 타입 이름 배열

***

### has()

> **has**(`eventType`): `boolean`

Defined in: [packages/events-core/src/libs/EventRegistry.ts:54](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/EventRegistry.ts#L54)

이벤트 타입이 등록되어 있는지 확인합니다.

#### Parameters

##### eventType

`string`

이벤트 타입 이름 (클래스 이름)

#### Returns

`boolean`

등록 여부

***

### register()

> **register**\<`T`\>(`eventClass`): `this`

Defined in: [packages/events-core/src/libs/EventRegistry.ts:25](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/EventRegistry.ts#L25)

이벤트 클래스를 등록합니다.

#### Type Parameters

##### T

`T` *extends* [`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Parameters

##### eventClass

`EventClass`\<`T`\>

등록할 이벤트 클래스

#### Returns

`this`

체이닝을 위해 this 반환

***

### fromMetadata()

> `static` **fromMetadata**(`eventClasses?`): `EventRegistry`

Defined in: [packages/events-core/src/libs/EventRegistry.ts:36](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/EventRegistry.ts#L36)

#### Parameters

##### eventClasses?

`EventClass`\<[`DomainEvent`](/api/events-core/src/classes/domainevent/)\>[] = `...`

#### Returns

`EventRegistry`

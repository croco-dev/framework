---
editUrl: false
next: false
prev: false
title: "Container"
---

Defined in: [packages/framework-context/src/libs/Container.ts:28](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/Container.ts#L28)

Croco 컴포넌트의 등록, 조회, 지연 생성, 요청 스코프 해석을 담당하는 DI 컨테이너입니다.

## Constructors

### Constructor

> **new Container**(): `Container`

#### Returns

`Container`

## Methods

### get()

> `static` **get**\<`T`\>(`token`): `T`

Defined in: [packages/framework-context/src/libs/Container.ts:33](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/Container.ts#L33)

#### Type Parameters

##### T

`T`

#### Parameters

##### token

`TokenIdentifier`\<`T`\>

#### Returns

`T`

***

### getComponentMetadata()

> `static` **getComponentMetadata**(`target`): [`ComponentMetadata`](/api/framework-context/src/interfaces/componentmetadata/) \| `undefined`

Defined in: [packages/framework-context/src/libs/Container.ts:208](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/Container.ts#L208)

#### Parameters

##### target

[`Constructor`](/api/framework-context/src/type-aliases/constructor/)

#### Returns

[`ComponentMetadata`](/api/framework-context/src/interfaces/componentmetadata/) \| `undefined`

***

### getMany()

> `static` **getMany**\<`T`\>(`tokens`): `T`[]

Defined in: [packages/framework-context/src/libs/Container.ts:65](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/Container.ts#L65)

#### Type Parameters

##### T

`T`

#### Parameters

##### tokens

`TokenIdentifier`\<`T`\>[]

#### Returns

`T`[]

***

### getOptional()

> `static` **getOptional**\<`T`\>(`token`): `T` \| `undefined`

Defined in: [packages/framework-context/src/libs/Container.ts:69](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/Container.ts#L69)

#### Type Parameters

##### T

`T`

#### Parameters

##### token

`TokenIdentifier`\<`T`\>

#### Returns

`T` \| `undefined`

***

### has()

> `static` **has**\<`T`\>(`token`): `boolean`

Defined in: [packages/framework-context/src/libs/Container.ts:88](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/Container.ts#L88)

#### Type Parameters

##### T

`T`

#### Parameters

##### token

`TokenIdentifier`\<`T`\>

#### Returns

`boolean`

***

### register()

> `static` **register**\<`T`\>(`token`, `scope`): `void`

Defined in: [packages/framework-context/src/libs/Container.ts:126](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/Container.ts#L126)

#### Type Parameters

##### T

`T`

#### Parameters

##### token

[`Constructor`](/api/framework-context/src/type-aliases/constructor/)\<`T`\>

##### scope

[`Scope`](/api/framework-context/src/type-aliases/scope/)

#### Returns

`void`

***

### registerAsync()

> `static` **registerAsync**\<`T`\>(`token`, `factory`): `Promise`\<`T`\>

Defined in: [packages/framework-context/src/libs/Container.ts:131](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/Container.ts#L131)

#### Type Parameters

##### T

`T`

#### Parameters

##### token

`TokenIdentifier`\<`T`\>

##### factory

() => `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>

***

### registerLazy()

> `static` **registerLazy**\<`T`\>(`token`, `factory`): `void`

Defined in: [packages/framework-context/src/libs/Container.ts:136](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/Container.ts#L136)

#### Type Parameters

##### T

`T`

#### Parameters

##### token

`TokenIdentifier`\<`T`\>

##### factory

() => `T`

#### Returns

`void`

***

### remove()

> `static` **remove**\<`T`\>(`token`): `void`

Defined in: [packages/framework-context/src/libs/Container.ts:92](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/Container.ts#L92)

#### Type Parameters

##### T

`T`

#### Parameters

##### token

`TokenIdentifier`\<`T`\>

#### Returns

`void`

***

### reset()

> `static` **reset**(): `void`

Defined in: [packages/framework-context/src/libs/Container.ts:98](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/Container.ts#L98)

#### Returns

`void`

***

### set()

> `static` **set**\<`T`\>(`token`, `instance`): `T`

Defined in: [packages/framework-context/src/libs/Container.ts:81](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/Container.ts#L81)

#### Type Parameters

##### T

`T`

#### Parameters

##### token

`TokenIdentifier`\<`T`\>

##### instance

`T`

#### Returns

`T`

***

### validate()

> `static` **validate**(): `void`

Defined in: [packages/framework-context/src/libs/Container.ts:105](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/Container.ts#L105)

#### Returns

`void`

---
editUrl: false
next: false
prev: false
title: "Container"
---

Defined in: [packages/framework-context/src/libs/Container.ts:9](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/framework-context/src/libs/Container.ts#L9)

## Constructors

### Constructor

> **new Container**(): `Container`

#### Returns

`Container`

## Methods

### get()

> `static` **get**\<`T`\>(`token`): `T`

Defined in: [packages/framework-context/src/libs/Container.ts:10](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/framework-context/src/libs/Container.ts#L10)

#### Type Parameters

##### T

`T`

#### Parameters

##### token

[`Constructor`](/api/framework-context/src/type-aliases/constructor/)\<`T`\>

#### Returns

`T`

***

### getMany()

> `static` **getMany**\<`T`\>(`tokens`): `T`[]

Defined in: [packages/framework-context/src/libs/Container.ts:32](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/framework-context/src/libs/Container.ts#L32)

#### Type Parameters

##### T

`T`

#### Parameters

##### tokens

[`Constructor`](/api/framework-context/src/type-aliases/constructor/)\<`T`\>[]

#### Returns

`T`[]

***

### register()

> `static` **register**\<`T`\>(`token`, `scope`): `void`

Defined in: [packages/framework-context/src/libs/Container.ts:49](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/framework-context/src/libs/Container.ts#L49)

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

### remove()

> `static` **remove**(`token`): `void`

Defined in: [packages/framework-context/src/libs/Container.ts:41](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/framework-context/src/libs/Container.ts#L41)

#### Parameters

##### token

[`Constructor`](/api/framework-context/src/type-aliases/constructor/)

#### Returns

`void`

***

### reset()

> `static` **reset**(): `void`

Defined in: [packages/framework-context/src/libs/Container.ts:45](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/framework-context/src/libs/Container.ts#L45)

#### Returns

`void`

***

### set()

> `static` **set**\<`T`\>(`token`, `instance`): `T`

Defined in: [packages/framework-context/src/libs/Container.ts:36](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/framework-context/src/libs/Container.ts#L36)

#### Type Parameters

##### T

`T`

#### Parameters

##### token

[`Constructor`](/api/framework-context/src/type-aliases/constructor/)\<`T`\>

##### instance

`T`

#### Returns

`T`

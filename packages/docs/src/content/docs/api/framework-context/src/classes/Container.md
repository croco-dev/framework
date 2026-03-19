---
editUrl: false
next: false
prev: false
title: "Container"
---

Defined in: [packages/framework-context/src/libs/Container.ts:19](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/framework-context/src/libs/Container.ts#L19)

컴포넌트 scope에 맞춰 의존성을 조회하고 관리하는 DI 컨테이너 클래스입니다.

## Param

`Container.get(token)` 호출 시 조회할 생성자 토큰입니다.

## Example

```typescript
import { Component, Container } from '@croco/framework-context';

@Component()
class UserService {}

const service = Container.get(UserService);
```

## Constructors

### Constructor

> **new Container**(): `Container`

#### Returns

`Container`

## Methods

### get()

> `static` **get**\<`T`\>(`token`): `T`

Defined in: [packages/framework-context/src/libs/Container.ts:22](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/framework-context/src/libs/Container.ts#L22)

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

Defined in: [packages/framework-context/src/libs/Container.ts:166](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/framework-context/src/libs/Container.ts#L166)

#### Parameters

##### target

[`Constructor`](/api/framework-context/src/type-aliases/constructor/)

#### Returns

[`ComponentMetadata`](/api/framework-context/src/interfaces/componentmetadata/) \| `undefined`

***

### getMany()

> `static` **getMany**\<`T`\>(`tokens`): `T`[]

Defined in: [packages/framework-context/src/libs/Container.ts:48](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/framework-context/src/libs/Container.ts#L48)

#### Type Parameters

##### T

`T`

#### Parameters

##### tokens

`TokenIdentifier`\<`T`\>[]

#### Returns

`T`[]

***

### has()

> `static` **has**\<`T`\>(`token`): `boolean`

Defined in: [packages/framework-context/src/libs/Container.ts:58](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/framework-context/src/libs/Container.ts#L58)

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

Defined in: [packages/framework-context/src/libs/Container.ts:94](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/framework-context/src/libs/Container.ts#L94)

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

> `static` **remove**\<`T`\>(`token`): `void`

Defined in: [packages/framework-context/src/libs/Container.ts:62](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/framework-context/src/libs/Container.ts#L62)

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

Defined in: [packages/framework-context/src/libs/Container.ts:68](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/framework-context/src/libs/Container.ts#L68)

#### Returns

`void`

***

### set()

> `static` **set**\<`T`\>(`token`, `instance`): `T`

Defined in: [packages/framework-context/src/libs/Container.ts:52](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/framework-context/src/libs/Container.ts#L52)

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

Defined in: [packages/framework-context/src/libs/Container.ts:73](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/framework-context/src/libs/Container.ts#L73)

#### Returns

`void`

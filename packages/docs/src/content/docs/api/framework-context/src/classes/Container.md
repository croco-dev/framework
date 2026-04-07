---
editUrl: false
next: false
prev: false
title: "Container"
---

Defined in: [packages/framework-context/src/libs/Container.ts:25](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/framework-context/src/libs/Container.ts#L25)

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

Defined in: [packages/framework-context/src/libs/Container.ts:30](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/framework-context/src/libs/Container.ts#L30)

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

Defined in: [packages/framework-context/src/libs/Container.ts:205](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/framework-context/src/libs/Container.ts#L205)

#### Parameters

##### target

[`Constructor`](/api/framework-context/src/type-aliases/constructor/)

#### Returns

[`ComponentMetadata`](/api/framework-context/src/interfaces/componentmetadata/) \| `undefined`

***

### getMany()

> `static` **getMany**\<`T`\>(`tokens`): `T`[]

Defined in: [packages/framework-context/src/libs/Container.ts:62](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/framework-context/src/libs/Container.ts#L62)

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

Defined in: [packages/framework-context/src/libs/Container.ts:66](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/framework-context/src/libs/Container.ts#L66)

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

Defined in: [packages/framework-context/src/libs/Container.ts:85](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/framework-context/src/libs/Container.ts#L85)

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

Defined in: [packages/framework-context/src/libs/Container.ts:123](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/framework-context/src/libs/Container.ts#L123)

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

Defined in: [packages/framework-context/src/libs/Container.ts:128](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/framework-context/src/libs/Container.ts#L128)

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

Defined in: [packages/framework-context/src/libs/Container.ts:133](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/framework-context/src/libs/Container.ts#L133)

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

Defined in: [packages/framework-context/src/libs/Container.ts:89](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/framework-context/src/libs/Container.ts#L89)

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

Defined in: [packages/framework-context/src/libs/Container.ts:95](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/framework-context/src/libs/Container.ts#L95)

#### Returns

`void`

***

### set()

> `static` **set**\<`T`\>(`token`, `instance`): `T`

Defined in: [packages/framework-context/src/libs/Container.ts:78](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/framework-context/src/libs/Container.ts#L78)

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

Defined in: [packages/framework-context/src/libs/Container.ts:102](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/framework-context/src/libs/Container.ts#L102)

#### Returns

`void`

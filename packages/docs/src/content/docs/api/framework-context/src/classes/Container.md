---
editUrl: false
next: false
prev: false
title: "Container"
---

Defined in: [packages/framework-context/src/libs/Container.ts:9](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/framework-context/src/libs/Container.ts#L9)

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

Defined in: [packages/framework-context/src/libs/Container.ts:12](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/framework-context/src/libs/Container.ts#L12)

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

Defined in: [packages/framework-context/src/libs/Container.ts:34](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/framework-context/src/libs/Container.ts#L34)

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

Defined in: [packages/framework-context/src/libs/Container.ts:73](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/framework-context/src/libs/Container.ts#L73)

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

Defined in: [packages/framework-context/src/libs/Container.ts:43](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/framework-context/src/libs/Container.ts#L43)

#### Type Parameters

##### T

`T`

#### Parameters

##### token

[`Constructor`](/api/framework-context/src/type-aliases/constructor/)\<`T`\>

#### Returns

`void`

***

### reset()

> `static` **reset**(): `void`

Defined in: [packages/framework-context/src/libs/Container.ts:47](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/framework-context/src/libs/Container.ts#L47)

#### Returns

`void`

***

### set()

> `static` **set**\<`T`\>(`token`, `instance`): `T`

Defined in: [packages/framework-context/src/libs/Container.ts:38](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/framework-context/src/libs/Container.ts#L38)

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

***

### validate()

> `static` **validate**(): `void`

Defined in: [packages/framework-context/src/libs/Container.ts:52](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/framework-context/src/libs/Container.ts#L52)

#### Returns

`void`

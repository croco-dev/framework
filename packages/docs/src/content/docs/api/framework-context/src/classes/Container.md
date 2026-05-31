---
editUrl: false
next: false
prev: false
title: "Container"
---

Croco 컴포넌트의 등록, 조회, 지연 생성, 요청 스코프 해석을 담당하는 DI 컨테이너입니다.

## Constructors

### Constructor

> **new Container**(): `Container`

#### Returns

`Container`

## Methods

### get()

> `static` **get**\<`T`\>(`token`): `T`

#### Type Parameters

##### T

`T`

#### Parameters

##### token

`TokenIdentifier`\<`T`\>

#### Returns

`T`

---

### getComponentMetadata()

> `static` **getComponentMetadata**(`target`): [`ComponentMetadata`](/api/framework-context/src/interfaces/componentmetadata/)

#### Parameters

##### target

[`Constructor`](/api/framework-context/src/type-aliases/constructor/)

#### Returns

[`ComponentMetadata`](/api/framework-context/src/interfaces/componentmetadata/)

---

### getDiagnosticsSnapshot()

> `static` **getDiagnosticsSnapshot**(): `object`

#### Returns

`object`

##### isInitialized

> **isInitialized**: `boolean`

##### registeredServiceCount

> **registeredServiceCount**: `number`

##### scopes

> **scopes**: `string`[]

---

### getMany()

> `static` **getMany**\<`T`\>(`tokens`): `T`[]

#### Type Parameters

##### T

`T`

#### Parameters

##### tokens

`TokenIdentifier`\<`T`\>[]

#### Returns

`T`[]

---

### getOptional()

> `static` **getOptional**\<`T`\>(`token`): `T`

#### Type Parameters

##### T

`T`

#### Parameters

##### token

`TokenIdentifier`\<`T`\>

#### Returns

`T`

---

### has()

> `static` **has**\<`T`\>(`token`): `boolean`

#### Type Parameters

##### T

`T`

#### Parameters

##### token

`TokenIdentifier`\<`T`\>

#### Returns

`boolean`

---

### register()

> `static` **register**\<`T`\>(`token`, `scope`): `void`

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

---

### registerAsync()

> `static` **registerAsync**\<`T`\>(`token`, `factory`): `Promise`\<`T`\>

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

---

### registerLazy()

> `static` **registerLazy**\<`T`\>(`token`, `factory`): `void`

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

---

### remove()

> `static` **remove**\<`T`\>(`token`): `void`

#### Type Parameters

##### T

`T`

#### Parameters

##### token

`TokenIdentifier`\<`T`\>

#### Returns

`void`

---

### reset()

> `static` **reset**(): `void`

#### Returns

`void`

---

### set()

> `static` **set**\<`T`\>(`token`, `instance`): `T`

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

---

### validate()

> `static` **validate**(): `void`

#### Returns

`void`

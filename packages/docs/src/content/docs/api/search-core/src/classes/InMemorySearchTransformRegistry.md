---
editUrl: false
next: false
prev: false
title: "InMemorySearchTransformRegistry"
---

검색 변환 어댑터 레지스트리와 기본 인메모리 구현체입니다.

## Extends

- [`SearchTransformRegistry`](/api/search-core/src/classes/searchtransformregistry/)

## Constructors

### Constructor

> **new InMemorySearchTransformRegistry**(): `InMemorySearchTransformRegistry`

#### Returns

`InMemorySearchTransformRegistry`

#### Inherited from

[`SearchTransformRegistry`](/api/search-core/src/classes/searchtransformregistry/).[`constructor`](/api/search-core/src/classes/searchtransformregistry/#constructor)

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<[`SearchTransformRegistry`](/api/search-core/src/classes/searchtransformregistry/)\>

#### Inherited from

[`SearchTransformRegistry`](/api/search-core/src/classes/searchtransformregistry/).[`token`](/api/search-core/src/classes/searchtransformregistry/#token)

## Methods

### apply()

> **apply**\<`TOptions`\>(`ref`, `input`, `options?`): `string`

#### Type Parameters

##### TOptions

`TOptions`

#### Parameters

##### ref

[`SearchTransformRef`](/api/search-core/src/type-aliases/searchtransformref/)\<`TOptions`\>

##### input

`string`

##### options?

`TOptions`

#### Returns

`string`

#### Overrides

[`SearchTransformRegistry`](/api/search-core/src/classes/searchtransformregistry/).[`apply`](/api/search-core/src/classes/searchtransformregistry/#apply)

---

### get()

> **get**\<`TOptions`\>(`ref`): [`SearchTransformAdapter`](/api/search-core/src/classes/searchtransformadapter/)\<`TOptions`\> \| `undefined`

#### Type Parameters

##### TOptions

`TOptions`

#### Parameters

##### ref

[`SearchTransformRef`](/api/search-core/src/type-aliases/searchtransformref/)\<`TOptions`\>

#### Returns

[`SearchTransformAdapter`](/api/search-core/src/classes/searchtransformadapter/)\<`TOptions`\> \| `undefined`

#### Overrides

[`SearchTransformRegistry`](/api/search-core/src/classes/searchtransformregistry/).[`get`](/api/search-core/src/classes/searchtransformregistry/#get)

---

### register()

> **register**\<`TOptions`\>(`adapter`): [`SearchTransformRef`](/api/search-core/src/type-aliases/searchtransformref/)\<`TOptions`\>

#### Type Parameters

##### TOptions

`TOptions`

#### Parameters

##### adapter

[`SearchTransformAdapter`](/api/search-core/src/classes/searchtransformadapter/)\<`TOptions`\>

#### Returns

[`SearchTransformRef`](/api/search-core/src/type-aliases/searchtransformref/)\<`TOptions`\>

#### Overrides

[`SearchTransformRegistry`](/api/search-core/src/classes/searchtransformregistry/).[`register`](/api/search-core/src/classes/searchtransformregistry/#register)

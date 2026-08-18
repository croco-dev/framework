---
editUrl: false
next: false
prev: false
title: "SearchTransformRegistry"
---

검색 변환 어댑터 레지스트리와 기본 인메모리 구현체입니다.

## Extended by

- [`InMemorySearchTransformRegistry`](/api/search-core/src/classes/inmemorysearchtransformregistry/)

## Constructors

### Constructor

> **new SearchTransformRegistry**(): `SearchTransformRegistry`

#### Returns

`SearchTransformRegistry`

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<`SearchTransformRegistry`\>

## Methods

### apply()

> `abstract` **apply**\<`TOptions`\>(`ref`, `input`, `options?`): `string`

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

---

### get()

> `abstract` **get**\<`TOptions`\>(`ref`): [`SearchTransformAdapter`](/api/search-core/src/interfaces/searchtransformadapter/)\<`TOptions`\> \| `undefined`

#### Type Parameters

##### TOptions

`TOptions`

#### Parameters

##### ref

[`SearchTransformRef`](/api/search-core/src/type-aliases/searchtransformref/)\<`TOptions`\>

#### Returns

[`SearchTransformAdapter`](/api/search-core/src/interfaces/searchtransformadapter/)\<`TOptions`\> \| `undefined`

---

### register()

> `abstract` **register**\<`TOptions`\>(`adapter`): `void`

#### Type Parameters

##### TOptions

`TOptions`

#### Parameters

##### adapter

[`SearchTransformAdapter`](/api/search-core/src/interfaces/searchtransformadapter/)\<`TOptions`\>

#### Returns

`void`

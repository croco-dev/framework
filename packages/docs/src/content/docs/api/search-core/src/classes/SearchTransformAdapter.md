---
editUrl: false
next: false
prev: false
title: "SearchTransformAdapter"
---

## Type Parameters

### TOptions

`TOptions` = `unknown`

## Constructors

### Constructor

> **new SearchTransformAdapter**\<`TOptions`\>(): `SearchTransformAdapter`\<`TOptions`\>

#### Returns

`SearchTransformAdapter`\<`TOptions`\>

## Properties

### \[SEARCH_TRANSFORM_OPTIONS\]

> `readonly` **\[SEARCH_TRANSFORM_OPTIONS\]**: (`options`) => `TOptions`

#### Parameters

##### options

`TOptions`

#### Returns

`TOptions`

---

### defaultSuffix

> `abstract` `readonly` **defaultSuffix**: `string`

---

### id

> `abstract` `readonly` **id**: `string`

---

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<`SearchTransformAdapter`\<`unknown`\>\>

## Methods

### transform()

> `abstract` **transform**(`input`, `options`): `string`

#### Parameters

##### input

`string`

##### options

`TOptions`

#### Returns

`string`

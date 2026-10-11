---
editUrl: false
next: false
prev: false
title: "c"
---

> `const` **c**: `object`

## Type Declaration

### boolean

> **boolean**: (`metadata`) => `object`

#### Parameters

##### metadata?

`Metadata` = `{}`

#### Returns

`object`

##### description?

> `readonly` `optional` **description?**: `string`

##### sensitivity?

> `readonly` `optional` **sensitivity?**: `"public"` \| `"internal"` \| `"sensitive"`

##### type

> **type**: `"boolean"`

### currencyCode

> **currencyCode**: (`metadata`) => `object`

#### Parameters

##### metadata?

`Metadata` = `{}`

#### Returns

`object`

##### description?

> `readonly` `optional` **description?**: `string`

##### sensitivity?

> `readonly` `optional` **sensitivity?**: `"public"` \| `"internal"` \| `"sensitive"`

##### type

> **type**: `"currency"`

### date

> **date**: (`options`, `metadata`) => `object`

#### Parameters

##### options

###### zone

`string`

##### metadata?

`Metadata` = `{}`

#### Returns

`object`

##### description?

> `readonly` `optional` **description?**: `string`

##### sensitivity?

> `readonly` `optional` **sensitivity?**: `"public"` \| `"internal"` \| `"sensitive"`

##### type

> **type**: `"date"`

##### zone

> `readonly` **zone**: `string`

### decimal

> **decimal**: (`options`, `metadata`) => `object`

#### Parameters

##### options

###### precision

`number`

###### scale

`number`

##### metadata?

`Metadata` = `{}`

#### Returns

`object`

##### description?

> `readonly` `optional` **description?**: `string`

##### precision

> `readonly` **precision**: `number`

##### scale

> `readonly` **scale**: `number`

##### sensitivity?

> `readonly` `optional` **sensitivity?**: `"public"` \| `"internal"` \| `"sensitive"`

##### type

> **type**: `"decimal"`

### id

> **id**: (`metadata`) => `object`

#### Parameters

##### metadata?

`Metadata` = `{}`

#### Returns

`object`

##### description?

> `readonly` `optional` **description?**: `string`

##### sensitivity?

> `readonly` `optional` **sensitivity?**: `"public"` \| `"internal"` \| `"sensitive"`

##### type

> **type**: `"id"`

### instant

> **instant**: (`options`, `metadata`) => `object`

#### Parameters

##### options

###### precision

`"second"` \| `"millisecond"` \| `"microsecond"`

##### metadata?

`Metadata` = `{}`

#### Returns

`object`

##### description?

> `readonly` `optional` **description?**: `string`

##### precision

> `readonly` **precision**: `"second"` \| `"millisecond"` \| `"microsecond"`

##### sensitivity?

> `readonly` `optional` **sensitivity?**: `"public"` \| `"internal"` \| `"sensitive"`

##### type

> **type**: `"instant"`

### int64

> **int64**: (`options`, `metadata`) => `object`

#### Parameters

##### options?

`Bounds` = `{}`

##### metadata?

`Metadata` = `{}`

#### Returns

`object`

##### description?

> `readonly` `optional` **description?**: `string`

##### max?

> `optional` **max?**: `string`

##### min?

> `optional` **min?**: `string`

##### sensitivity?

> `readonly` `optional` **sensitivity?**: `"public"` \| `"internal"` \| `"sensitive"`

##### type

> **type**: `"int64"`

### moneyMinor

> **moneyMinor**: \<`Currency`\>(`options`, `metadata`) => `object`

#### Type Parameters

##### Currency

`Currency` _extends_ `string`

#### Parameters

##### options

`Bounds` & `object`

##### metadata?

`Metadata` = `{}`

#### Returns

`object`

##### currency

> **currency**: `Currency` = `options.currency`

##### description?

> `readonly` `optional` **description?**: `string`

##### max?

> `optional` **max?**: `string`

##### min?

> `optional` **min?**: `string`

##### sensitivity?

> `readonly` `optional` **sensitivity?**: `"public"` \| `"internal"` \| `"sensitive"`

##### type

> **type**: `"money"`

### nullable

> **nullable**: \<`C`\>(`column`) => `C` & `object`

#### Type Parameters

##### C

`C` _extends_ [`Column`](/api/warehouse-core/src/type-aliases/column/)

#### Parameters

##### column

`C`

#### Returns

`C` & `object`

### string

> **string**: (`metadata`) => `object`

#### Parameters

##### metadata?

`Metadata` = `{}`

#### Returns

`object`

##### description?

> `readonly` `optional` **description?**: `string`

##### sensitivity?

> `readonly` `optional` **sensitivity?**: `"public"` \| `"internal"` \| `"sensitive"`

##### type

> **type**: `"string"`

### subjectId

> **subjectId**: (`subject`, `metadata`) => `object`

#### Parameters

##### subject

`string`

##### metadata?

`Metadata` = `{}`

#### Returns

`object`

##### description?

> `readonly` `optional` **description?**: `string`

##### sensitivity?

> `readonly` `optional` **sensitivity?**: `"public"` \| `"internal"` \| `"sensitive"`

##### subject

> **subject**: `string`

##### type

> **type**: `"subject"`

---
editUrl: false
next: false
prev: false
title: "PolicyFieldDescriptor"
---

> **PolicyFieldDescriptor**\<`TValue`\> = `object`

A field descriptor is code-declared and is the only supported admin edit boundary.

## Type Parameters

### TValue

`TValue`

## Properties

### description?

> `readonly` `optional` **description?**: `string`

---

### id

> `readonly` **id**: `string`

---

### input

> `readonly` **input**: [`PolicyFieldInput`](/api/features-core/src/type-aliases/policyfieldinput/)

---

### label

> `readonly` **label**: `string`

---

### max?

> `readonly` `optional` **max?**: `number`

---

### min?

> `readonly` `optional` **min?**: `number`

---

### options?

> `readonly` `optional` **options?**: readonly `object`[]

---

### read

> `readonly` **read**: (`value`) => `unknown`

#### Parameters

##### value

`TValue`

#### Returns

`unknown`

---

### sensitive?

> `readonly` `optional` **sensitive?**: `boolean`

---

### write

> `readonly` **write**: (`value`, `next`) => `TValue`

#### Parameters

##### value

`TValue`

##### next

`unknown`

#### Returns

`TValue`

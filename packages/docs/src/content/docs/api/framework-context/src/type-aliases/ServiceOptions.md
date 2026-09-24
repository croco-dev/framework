---
editUrl: false
next: false
prev: false
title: "ServiceOptions"
---

> **ServiceOptions**\<`T`\> = `object`

## Type Parameters

### T

`T`

## Properties

### factory?

> `readonly` `optional` **factory?**: () => `T`

#### Returns

`T`

---

### global?

> `readonly` `optional` **global?**: `boolean`

---

### id

> `readonly` **id**: [`ServiceIdentifier`](/api/framework-context/src/type-aliases/serviceidentifier/)\<`T`\>

---

### multiple?

> `readonly` `optional` **multiple?**: `boolean`

---

### scope?

> `readonly` `optional` **scope?**: [`ServiceMetadata`](/api/framework-context/src/type-aliases/servicemetadata/)\<`T`\>\[`"scope"`\]

---

### type?

> `readonly` `optional` **type?**: [`Constructable`](/api/framework-context/src/type-aliases/constructable/)\<`unknown`\>

---

### value?

> `readonly` `optional` **value?**: `T`

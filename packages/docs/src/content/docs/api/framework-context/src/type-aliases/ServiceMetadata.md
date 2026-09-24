---
editUrl: false
next: false
prev: false
title: "ServiceMetadata"
---

> **ServiceMetadata**\<`T`\> = `object`

## Type Parameters

### T

`T` = `unknown`

## Properties

### factory?

> `optional` **factory?**: () => `T`

#### Returns

`T`

---

### id

> **id**: [`ServiceIdentifier`](/api/framework-context/src/type-aliases/serviceidentifier/)\<`T`\>

---

### multiple

> **multiple**: `boolean`

---

### scope

> **scope**: `"singleton"` \| `"container"` \| `"transient"`

---

### type?

> `optional` **type?**: [`Constructable`](/api/framework-context/src/type-aliases/constructable/)\<`T`\>

---

### value

> **value**: `T` \| _typeof_ `EMPTY_VALUE`

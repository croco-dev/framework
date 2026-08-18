---
editUrl: false
next: false
prev: false
title: "CacheWarmupEntry"
---

> **CacheWarmupEntry**\<`K`, `V`\> = `object`

Preloaded cache entry.

## Type Parameters

### K

`K` _extends_ `string`

### V

`V`

## Properties

### key

> **key**: `K`

---

### ttlMs?

> `optional` **ttlMs?**: `number`

Finite, non-negative lifetime in milliseconds. Zero expires immediately.

---

### value

> **value**: `V`

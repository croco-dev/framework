---
editUrl: false
next: false
prev: false
title: "CacheGetOrSetOptions"
---

> **CacheGetOrSetOptions** = `object`

Options for cache-backed loading.

## Properties

### preserveInvalidatedValue?

> `optional` **preserveInvalidatedValue?**: `boolean`

Return the original load result to existing callers after invalidation; never repopulate the cache.

---

### ttlMs?

> `optional` **ttlMs?**: `number`

Finite, non-negative lifetime in milliseconds. Zero expires immediately.

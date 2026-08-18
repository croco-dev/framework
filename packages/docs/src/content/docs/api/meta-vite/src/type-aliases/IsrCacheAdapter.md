---
editUrl: false
next: false
prev: false
title: "IsrCacheAdapter"
---

> **IsrCacheAdapter** = `object`

ISR cache adapter contract.
Wraps `@croco/cache-core` CacheStore for TTL-only ISR use.
v1: exact-key + TTL-only getOrSet semantics.

## Properties

### getOrSet

> **getOrSet**: \<`V`\>(`key`, `factory`, `options?`) => `Promise`\<`V`\>

#### Type Parameters

##### V

`V`

#### Parameters

##### key

`string`

##### factory

() => `Promise`\<`V`\>

##### options?

###### ttlMs?

`number`

#### Returns

`Promise`\<`V`\>

---

### invalidate

> **invalidate**: (`key`) => `Promise`\<`void`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

---
editUrl: false
next: false
prev: false
title: "PersonalizedFragmentStore"
---

> **PersonalizedFragmentStore** = `object`

Personalized fragment cache.

Data/fragment caching is separated from final Response caching:
public and variant fragments share immutable bytes through an existing
CacheStore-backed adapter, private loaders resolve request-local values
that never enter the shared store, and composed personalized responses
are always returned bypass without being stored.

## Properties

### get?

> `optional` **get?**: \<`V`\>(`key`) => `Promise`\<`V` \| `undefined`\>

Optional direct read used only for bounded stale-if-error recovery.

#### Type Parameters

##### V

`V`

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`V` \| `undefined`\>

---

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

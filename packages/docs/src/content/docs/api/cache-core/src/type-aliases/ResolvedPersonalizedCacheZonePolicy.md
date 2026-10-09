---
editUrl: false
next: false
prev: false
title: "ResolvedPersonalizedCacheZonePolicy"
---

> **ResolvedPersonalizedCacheZonePolicy** = `object`

## Properties

### bypassReason?

> `readonly` `optional` **bypassReason?**: `string`

---

### bypassSharedCache

> `readonly` **bypassSharedCache**: `boolean`

True when zone state must bypass shared caches for this request.

---

### dependencies

> `readonly` **dependencies**: readonly [`PersonalizedCacheDependency`](/api/cache-core/src/type-aliases/personalizedcachedependency/)[]

---

### dimensions

> `readonly` **dimensions**: `Readonly`\<`Record`\<`string`, `string`\>\>

---

### freshness

> `readonly` **freshness**: [`PersonalizedCacheFreshnessPolicy`](/api/cache-core/src/type-aliases/personalizedcachefreshnesspolicy/)

---

### revision

> `readonly` **revision**: `string`

---

### zone

> `readonly` **zone**: [`PersonalizedCacheZone`](/api/cache-core/src/type-aliases/personalizedcachezone/)

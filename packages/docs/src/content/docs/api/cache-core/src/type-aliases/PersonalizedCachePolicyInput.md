---
editUrl: false
next: false
prev: false
title: "PersonalizedCachePolicyInput"
---

> **PersonalizedCachePolicyInput** = `object`

## Properties

### freshness?

> `readonly` `optional` **freshness?**: [`PersonalizedCacheFreshnessPolicy`](/api/cache-core/src/type-aliases/personalizedcachefreshnesspolicy/)

---

### revision

> `readonly` **revision**: `string`

Revision covering content, policy, and deploy inputs shared by zones.

---

### scope

> `readonly` **scope**: [`PersonalizedCacheDimensionScope`](/api/cache-core/src/type-aliases/personalizedcachedimensionscope/)

---

### zones

> `readonly` **zones**: readonly [`PersonalizedCacheZonePolicyInput`](/api/cache-core/src/type-aliases/personalizedcachezonepolicyinput/)[]

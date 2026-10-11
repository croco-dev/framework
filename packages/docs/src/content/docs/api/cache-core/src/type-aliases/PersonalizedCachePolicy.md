---
editUrl: false
next: false
prev: false
title: "PersonalizedCachePolicy"
---

> **PersonalizedCachePolicy** = `object`

## Properties

### freshness

> `readonly` **freshness**: [`PersonalizedCacheFreshnessPolicy`](/api/cache-core/src/type-aliases/personalizedcachefreshnesspolicy/)

---

### revision

> `readonly` **revision**: `string`

---

### scope

> `readonly` **scope**: [`PersonalizedCacheDimensionScope`](/api/cache-core/src/type-aliases/personalizedcachedimensionscope/)

---

### zones

> `readonly` **zones**: `Readonly`\<`Record`\<`"public"`, [`ResolvedPersonalizedCacheZonePolicy`](/api/cache-core/src/type-aliases/resolvedpersonalizedcachezonepolicy/)\>\> & `Readonly`\<`Partial`\<`Record`\<`"variant"` \| `"private"`, [`ResolvedPersonalizedCacheZonePolicy`](/api/cache-core/src/type-aliases/resolvedpersonalizedcachezonepolicy/)\>\>\>

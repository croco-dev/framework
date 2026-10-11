---
editUrl: false
next: false
prev: false
title: "PersonalizedCacheZonePolicyInput"
---

> **PersonalizedCacheZonePolicyInput** = `object`

## Properties

### dependencies?

> `readonly` `optional` **dependencies?**: readonly [`PersonalizedCacheDependency`](/api/cache-core/src/type-aliases/personalizedcachedependency/)[]

Explicit dependency declarations evaluated for freshness.

---

### dimensions?

> `readonly` `optional` **dimensions?**: `Readonly`\<`Record`\<`string`, `string`\>\>

Region-local dimensions that actually change the rendered result.

---

### freshness?

> `readonly` `optional` **freshness?**: [`PersonalizedCacheFreshnessPolicy`](/api/cache-core/src/type-aliases/personalizedcachefreshnesspolicy/)

---

### maxDimensions?

> `readonly` `optional` **maxDimensions?**: `number`

Maximum accepted dimension cardinality before explicit private/bypass.

---

### revision?

> `readonly` `optional` **revision?**: `string`

Revision covering content, policy, and deploy inputs.

---

### variant?

> `readonly` `optional` **variant?**: `string`

Trusted server-resolved experiment variant, never a raw client header.

---

### zone

> `readonly` **zone**: [`PersonalizedCacheZone`](/api/cache-core/src/type-aliases/personalizedcachezone/)

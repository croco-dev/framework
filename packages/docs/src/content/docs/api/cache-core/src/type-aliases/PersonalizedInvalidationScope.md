---
editUrl: false
next: false
prev: false
title: "PersonalizedInvalidationScope"
---

> **PersonalizedInvalidationScope** = `object`

Invalidation strategy note: personalized caches use revision keys
(`content/policy/deploy` revisions embedded in each fragment key) rather
than a shared tag index. Reason: InMemoryCacheStore-backed ISR adapters
advertise `tag: false` (see `createCacheStoreInvalidationAdapter`), so
claiming tag invalidation would report success without effect. Revision
rotation makes stale entries unreachable, while explicit
`invalidatePersonalizedFragment` handles content updates and policy pauses
with exact-key deletes. Successful `invalidateTag` must never be faked:
use `createCacheStoreInvalidationAdapter` capabilities as the source of
truth and treat tag operations as unsupported for these stores.

## Properties

### resource

> `readonly` **resource**: `string`

---

### revision

> `readonly` **revision**: `string`

---

### scope

> `readonly` **scope**: [`PersonalizedCacheDimensionScope`](/api/cache-core/src/type-aliases/personalizedcachedimensionscope/)

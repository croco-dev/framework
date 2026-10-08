---
editUrl: false
next: false
prev: false
title: "PersonalizedFragmentInspectEvent"
---

> **PersonalizedFragmentInspectEvent** = `object`

## Properties

### dependencyCount

> `readonly` **dependencyCount**: `number`

---

### dependencyNames

> `readonly` **dependencyNames**: readonly `string`[]

Dependency names only; revisions stay hashed in the key.

---

### dimensionCount

> `readonly` **dimensionCount**: `number`

---

### dimensionNames

> `readonly` **dimensionNames**: readonly `string`[]

Allow-listed dimension names only; values stay hashed in the key.

---

### invalidationRef

> `readonly` **invalidationRef**: `string`

Exact invalidation reference: hash of the stored fragment key.

---

### keyHash

> `readonly` **keyHash**: `string`

SHA-256 hash of the cache key; raw keys never leave this module.

---

### outcome

> `readonly` **outcome**: `"hit"` \| `"miss"` \| `"bypass"`

---

### reason

> `readonly` **reason**: `string`

---

### representation

> `readonly` **representation**: `"html"` \| `"flight"`

---

### revision

> `readonly` **revision**: `string`

---

### ttlMs

> `readonly` **ttlMs**: `number`

Fresh lifetime of the zone policy; expiry = cachedAt + ttlMs.

---

### zone

> `readonly` **zone**: [`PersonalizedCacheZone`](/api/cache-core/src/type-aliases/personalizedcachezone/)

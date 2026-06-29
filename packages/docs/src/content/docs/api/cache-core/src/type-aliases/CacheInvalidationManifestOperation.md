---
editUrl: false
next: false
prev: false
title: "CacheInvalidationManifestOperation"
---

> **CacheInvalidationManifestOperation** = \{ `id`: `string`; `key`: `string`; `kind`: `"key"`; \} \| \{ `id`: `string`; `kind`: `"pattern"`; `pattern`: [`CachePattern`](/api/cache-core/src/type-aliases/cachepattern/); \} \| \{ `id`: `string`; `kind`: `"tag"`; `tag`: `string`; \}

---
editUrl: false
next: false
prev: false
title: "createIsrHandler"
---

> **createIsrHandler**(`options`): (`path`) => `Promise`\<\{ `html`: `string`; `source`: `"cache"` \| `"render"`; \}\>

Create an ISR handler that wraps a render function with CacheStore-backed caching.
v1: exact-key TTL-only, no pattern invalidation or durable storage.

## Parameters

### options

#### cache

[`IsrCacheAdapter`](/api/meta-vite/src/type-aliases/isrcacheadapter/)

#### render

(`path`) => `Promise`\<\{ `cacheTags?`: `string`[]; `html`: `string`; \}\>

## Returns

(`path`) => `Promise`\<\{ `html`: `string`; `source`: `"cache"` \| `"render"`; \}\>

---
editUrl: false
next: false
prev: false
title: "IsrMiddlewareOptions"
---

> **IsrMiddlewareOptions** = `object`

InMemoryCacheStore-based ISR is non-durable and intended for local, development,
or single-process deployments only.

## Properties

### cache

> `readonly` **cache**: [`IsrCacheStore`](/api/meta-vite/src/type-aliases/isrcachestore/)

***

### render

> `readonly` **render**: (`request`) => `Promise`\<`Response`\>

#### Parameters

##### request

`Request`

#### Returns

`Promise`\<`Response`\>

***

### ttlMs

> `readonly` **ttlMs**: `number`

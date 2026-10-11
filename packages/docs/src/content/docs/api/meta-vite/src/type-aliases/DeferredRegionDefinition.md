---
editUrl: false
next: false
prev: false
title: "DeferredRegionDefinition"
---

> **DeferredRegionDefinition** = `object`

Deferred (non-critical) region declared by a page route.
Regions render behind a Suspense boundary after the critical shell flushes.
Loaders run with the request AbortSignal so client disconnect, region
timeout, or overall deadline cancels upstream work.

## Properties

### id

> `readonly` **id**: `string`

---

### loader

> `readonly` **loader**: [`DeferredRegionLoader`](/api/meta-vite/src/type-aliases/deferredregionloader/)

---

### timeoutMs?

> `readonly` `optional` **timeoutMs?**: `number`

Per-region timeout in milliseconds. Defaults to the render deadline.

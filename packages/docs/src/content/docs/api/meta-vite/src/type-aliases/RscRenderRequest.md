---
editUrl: false
next: false
prev: false
title: "RscRenderRequest"
---

> **RscRenderRequest** = `object`

One render the host asks a build for.

## Properties

### context?

> `readonly` `optional` **context?**: [`RuntimeContext`](/api/meta-vite/src/type-aliases/runtimecontext/)

Plain data only: anything else is refused before the render starts.

---

### request

> `readonly` **request**: `Request`

The page request; URL, method and headers reach the server component, the body does not.

---

### route

> `readonly` **route**: `string`

Path of the route the host matched.

---

### signal

> `readonly` **signal**: `AbortSignal`

Stops the render in the build's worker when it aborts.

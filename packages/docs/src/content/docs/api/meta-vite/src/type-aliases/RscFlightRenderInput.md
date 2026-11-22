---
editUrl: false
next: false
prev: false
title: "RscFlightRenderInput"
---

> **RscFlightRenderInput** = `object`

## Properties

### context?

> `readonly` `optional` **context?**: [`RuntimeContext`](/api/meta-vite/src/type-aliases/runtimecontext/)

The context the host resolved for this request. It crosses into the
build's worker thread, so it holds plain data only.

---

### request

> `readonly` **request**: `Request`

---

### route

> `readonly` **route**: `string`

Path of the route the host matched; the entry renders that route only.

---

### signal

> `readonly` **signal**: `AbortSignal`

Aborts the Flight render when the caller disconnects.

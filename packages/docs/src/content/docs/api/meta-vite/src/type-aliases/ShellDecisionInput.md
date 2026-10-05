---
editUrl: false
next: false
prev: false
title: "ShellDecisionInput"
---

> **ShellDecisionInput** = `object`

## Properties

### context?

> `readonly` `optional` **context?**: [`ShellRuntimeContext`](/api/meta-vite/src/type-aliases/shellruntimecontext/)

---

### request

> `readonly` **request**: `Request`

---

### signal

> `readonly` **signal**: `AbortSignal`

AbortSignal for the request; shell resolution races the render deadline.

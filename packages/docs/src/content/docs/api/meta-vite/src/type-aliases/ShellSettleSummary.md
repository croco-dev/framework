---
editUrl: false
next: false
prev: false
title: "ShellSettleSummary"
---

> **ShellSettleSummary** = `object`

## Properties

### abortReason?

> `readonly` `optional` **abortReason?**: `"deadline"` \| `"client-abort"` \| `"max-buffered-bytes"` \| `"render-error"`

Why the stream ended early; absent on the normal completion path.

---

### bytes

> `readonly` **bytes**: `number`

---

### clientAborted

> `readonly` **clientAborted**: `boolean`

---

### delivery

> `readonly` **delivery**: `"stream"` \| `"buffered"`

---

### platform

> `readonly` **platform**: [`ShellRuntimePlatform`](/api/meta-vite/src/type-aliases/shellruntimeplatform/) \| `"unknown"`

---

### regionsCancelled

> `readonly` **regionsCancelled**: `number`

---

### regionsDurationMs?

> `readonly` `optional` **regionsDurationMs?**: `number`

Time from the first region start to the final settlement, when measured.

---

### regionsFailed

> `readonly` **regionsFailed**: `number`

---

### regionsSettled

> `readonly` **regionsSettled**: `number`

---

### shellCommitted

> `readonly` **shellCommitted**: `boolean`

---

### timedOut

> `readonly` **timedOut**: `boolean`

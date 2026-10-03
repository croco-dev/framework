---
editUrl: false
next: false
prev: false
title: "JourneyActionIntent"
---

> **JourneyActionIntent** = `object`

## Properties

### attemptIdentity

> **attemptIdentity**: `string`

---

### checks

> **checks**: [`JourneyCheckSnapshot`](/api/lifecycle-core/src/type-aliases/journeychecksnapshot/)

---

### episodeId

> **episodeId**: `string`

---

### executionReference

> **executionReference**: `string`

---

### idempotencyKey

> **idempotencyKey**: `string`

---

### nodeId

> **nodeId**: `string`

---

### problemCode?

> `optional` **problemCode?**: [`JourneyDispatchProblemCode`](/api/lifecycle-core/src/type-aliases/journeydispatchproblemcode/)

---

### status

> **status**: `"admitted"` \| `"accepted"` \| `"rejected"` \| `"indeterminate"`

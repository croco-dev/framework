---
editUrl: false
next: false
prev: false
title: "JourneyDryRunStep"
---

> **JourneyDryRunStep** = `object`

## Properties

### checks

> **checks**: [`JourneyFacts`](/api/lifecycle-core/src/type-aliases/journeyfacts/)

---

### conditionResult?

> `optional` **conditionResult?**: `boolean` \| `"unknown"`

---

### deadlineAt?

> `optional` **deadlineAt?**: `string`

---

### deadlineReason?

> `optional` **deadlineReason?**: `"blocked-unknown-deadline"`

---

### evaluatedAt

> **evaluatedAt**: `string`

---

### kind

> **kind**: [`JourneyNode`](/api/lifecycle-core/src/type-aliases/journeynode/)\[`"kind"`\]

---

### nodeId

> **nodeId**: `string`

---

### outcome

> **outcome**: `"wait"` \| `"matched"` \| `"no-match"` \| `"proposed"` \| `"suppressed"` \| `"deferred"` \| `"completed"`

---

### projectedAt

> **projectedAt**: `string`

---

### reason

> **reason**: `string`

---

### wakeAt?

> `optional` **wakeAt?**: `string`

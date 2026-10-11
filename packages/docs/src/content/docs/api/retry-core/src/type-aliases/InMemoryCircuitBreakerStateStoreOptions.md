---
editUrl: false
next: false
prev: false
title: "InMemoryCircuitBreakerStateStoreOptions"
---

> **InMemoryCircuitBreakerStateStoreOptions** = `object`

## Properties

### idleTtlMs?

> `optional` **idleTtlMs?**: `number`

---

### maxEntries?

> `optional` **maxEntries?**: `number`

---

### now?

> `optional` **now?**: () => `number`

Millisecond clock for idle expiry (default: Date.now).

#### Returns

`number`

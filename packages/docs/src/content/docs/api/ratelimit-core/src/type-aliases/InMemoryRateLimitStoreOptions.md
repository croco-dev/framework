---
editUrl: false
next: false
prev: false
title: "InMemoryRateLimitStoreOptions"
---

> **InMemoryRateLimitStoreOptions** = `object`

## Properties

### now?

> `readonly` `optional` **now?**: () => `number`

#### Returns

`number`

***

### pruneIntervalMs?

> `readonly` `optional` **pruneIntervalMs?**: `number`

***

### random?

> `readonly` `optional` **random?**: () => `number`

#### Returns

`number`

***

### scheduler?

> `readonly` `optional` **scheduler?**: [`RateLimitPruneScheduler`](/api/ratelimit-core/src/interfaces/ratelimitprunescheduler/)

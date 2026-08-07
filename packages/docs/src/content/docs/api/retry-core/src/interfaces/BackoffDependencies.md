---
editUrl: false
next: false
prev: false
title: "BackoffDependencies"
---

Dependency injection for testability.

## Properties

### random?

> `optional` **random?**: () => `number`

Random function (default: Math.random)

#### Returns

`number`

---

### sleep?

> `optional` **sleep?**: (`ms`, `signal?`) => `Promise`\<`void`\>

Sleep function (default: setTimeout-based)

#### Parameters

##### ms

`number`

##### signal?

`AbortSignal`

#### Returns

`Promise`\<`void`\>

---

### sleepSupportsAbortSignal?

> `optional` **sleepSupportsAbortSignal?**: `boolean`

Whether an injected sleep function guarantees cancellation when its signal aborts.

---
editUrl: false
next: false
prev: false
title: "ExecutionManagerOptions"
---

## Properties

### clock?

> `optional` **clock?**: () => `Date`

#### Returns

`Date`

***

### continuationLeaseDurationMs?

> `optional` **continuationLeaseDurationMs?**: `number`

Continuation ownership duration in milliseconds.

Must be an integer from MIN_CONTINUATION_LEASE_DURATION_MS through
MAX_CONTINUATION_LEASE_DURATION_MS.

***

### initialContinuationToken?

> `optional` **initialContinuationToken?**: `string`

***

### tokenGenerator?

> `optional` **tokenGenerator?**: () => `string`

#### Returns

`string`

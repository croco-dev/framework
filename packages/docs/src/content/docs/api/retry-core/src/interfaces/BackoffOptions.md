---
editUrl: false
next: false
prev: false
title: "BackoffOptions"
---

Configuration for backoff behavior.

## Properties

### delay?

> `optional` **delay**: `number`

Initial delay in milliseconds (default: 1000)

***

### jitter?

> `optional` **jitter**: `boolean`

Enable Full Jitter randomization (default: true)

***

### maxDelay?

> `optional` **maxDelay**: `number`

Maximum delay cap in milliseconds (default: 30000)

***

### multiplier?

> `optional` **multiplier**: `number`

Multiplier for exponential backoff (default: 2)

---
editUrl: false
next: false
prev: false
title: "BackoffOptions"
---

Configuration for backoff behavior.

## Properties

### delay?

> `optional` **delay?**: `number`

Non-negative integer milliseconds up to 2,147,483,647 (default: 1000).

***

### jitter?

> `optional` **jitter?**: `boolean`

Enable Full Jitter randomization (default: true)

***

### maxDelay?

> `optional` **maxDelay?**: `number`

Positive integer milliseconds up to 2,147,483,647 (default: 30000).

***

### multiplier?

> `optional` **multiplier?**: `number`

Positive finite multiplier (default: 2).

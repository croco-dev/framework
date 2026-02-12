---
editUrl: false
next: false
prev: false
title: "BackoffOptions"
---

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:4](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/retry-core/src/libs/BackoffPolicy.ts#L4)

Configuration for backoff behavior.

## Properties

### delay?

> `optional` **delay**: `number`

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:6](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/retry-core/src/libs/BackoffPolicy.ts#L6)

Initial delay in milliseconds (default: 1000)

***

### jitter?

> `optional` **jitter**: `boolean`

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:15](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/retry-core/src/libs/BackoffPolicy.ts#L15)

Enable Full Jitter randomization (default: true)

***

### maxDelay?

> `optional` **maxDelay**: `number`

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:12](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/retry-core/src/libs/BackoffPolicy.ts#L12)

Maximum delay cap in milliseconds (default: 30000)

***

### multiplier?

> `optional` **multiplier**: `number`

Defined in: [packages/retry-core/src/libs/BackoffPolicy.ts:9](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/retry-core/src/libs/BackoffPolicy.ts#L9)

Multiplier for exponential backoff (default: 2)

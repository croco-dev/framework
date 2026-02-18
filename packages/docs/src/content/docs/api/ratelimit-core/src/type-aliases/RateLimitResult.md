---
editUrl: false
next: false
prev: false
title: "RateLimitResult"
---

> **RateLimitResult** = `object`

Defined in: [packages/ratelimit-core/src/libs/types.ts:18](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/ratelimit-core/src/libs/types.ts#L18)

Result of a rate limit check

## Properties

### limit

> **limit**: `number`

Defined in: [packages/ratelimit-core/src/libs/types.ts:22](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/ratelimit-core/src/libs/types.ts#L22)

Maximum requests allowed in the window

***

### remaining

> **remaining**: `number`

Defined in: [packages/ratelimit-core/src/libs/types.ts:24](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/ratelimit-core/src/libs/types.ts#L24)

Remaining requests in current window

***

### resetAtMs

> **resetAtMs**: `number`

Defined in: [packages/ratelimit-core/src/libs/types.ts:26](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/ratelimit-core/src/libs/types.ts#L26)

Unix epoch ms when the window resets

***

### success

> **success**: `boolean`

Defined in: [packages/ratelimit-core/src/libs/types.ts:20](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/ratelimit-core/src/libs/types.ts#L20)

Whether the request is allowed

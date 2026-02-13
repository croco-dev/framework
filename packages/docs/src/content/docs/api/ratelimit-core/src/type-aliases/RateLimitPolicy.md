---
editUrl: false
next: false
prev: false
title: "RateLimitPolicy"
---

> **RateLimitPolicy** = `object`

Defined in: [packages/ratelimit-core/src/libs/types.ts:4](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/ratelimit-core/src/libs/types.ts#L4)

Rate limit policy configuration

## Properties

### algorithm?

> `optional` **algorithm**: `"sliding"`

Defined in: [packages/ratelimit-core/src/libs/types.ts:12](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/ratelimit-core/src/libs/types.ts#L12)

Algorithm type (reserved for future use)

***

### limit

> **limit**: `number`

Defined in: [packages/ratelimit-core/src/libs/types.ts:8](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/ratelimit-core/src/libs/types.ts#L8)

Maximum number of requests allowed

***

### name

> **name**: `string`

Defined in: [packages/ratelimit-core/src/libs/types.ts:6](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/ratelimit-core/src/libs/types.ts#L6)

Policy identifier (used as key segment)

***

### windowMs

> **windowMs**: `number`

Defined in: [packages/ratelimit-core/src/libs/types.ts:10](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/ratelimit-core/src/libs/types.ts#L10)

Time window in milliseconds

---
editUrl: false
next: false
prev: false
title: "InMemoryRateLimitStore"
---

Defined in: [packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts:15](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts#L15)

In-memory rate limit store for testing and development.
Uses sliding window algorithm.
NOT suitable for production multi-instance deployments.

## Extends

- [`RateLimitStore`](/api/ratelimit-core/src/classes/ratelimitstore/)

## Constructors

### Constructor

> **new InMemoryRateLimitStore**(): `InMemoryRateLimitStore`

#### Returns

`InMemoryRateLimitStore`

#### Inherited from

[`RateLimitStore`](/api/ratelimit-core/src/classes/ratelimitstore/).[`constructor`](/api/ratelimit-core/src/classes/ratelimitstore/#constructor)

## Methods

### check()

> **check**(`key`, `policy`): `Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

Defined in: [packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts:18](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts#L18)

Check and increment the rate limit counter for a key.

#### Parameters

##### key

`string`

Unique identifier for the rate limit bucket

##### policy

[`RateLimitPolicy`](/api/ratelimit-core/src/type-aliases/ratelimitpolicy/)

Rate limit policy to apply

#### Returns

`Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

Rate limit result with success status and metadata

#### Overrides

[`RateLimitStore`](/api/ratelimit-core/src/classes/ratelimitstore/).[`check`](/api/ratelimit-core/src/classes/ratelimitstore/#check)

***

### pruneExpired()

> **pruneExpired**(): `Promise`\<`number`\>

Defined in: [packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts:56](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts#L56)

#### Returns

`Promise`\<`number`\>

#### Overrides

[`RateLimitStore`](/api/ratelimit-core/src/classes/ratelimitstore/).[`pruneExpired`](/api/ratelimit-core/src/classes/ratelimitstore/#pruneexpired)

***

### reset()

> **reset**(): `void`

Defined in: [packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts:52](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts#L52)

Clear all buckets (for testing)

#### Returns

`void`

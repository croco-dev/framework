---
editUrl: false
next: false
prev: false
title: "InMemoryRateLimitStore"
---

Defined in: [packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts:15](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts#L15)

In-memory rate limit store for testing and development.
Uses sliding window algorithm.
NOT suitable for production multi-instance deployments.

## Implements

- [`RateLimitStore`](/api/ratelimit-core/src/interfaces/ratelimitstore/)

## Constructors

### Constructor

> **new InMemoryRateLimitStore**(): `InMemoryRateLimitStore`

#### Returns

`InMemoryRateLimitStore`

## Methods

### check()

> **check**(`key`, `policy`): `Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

Defined in: [packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts:18](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts#L18)

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

#### Implementation of

[`RateLimitStore`](/api/ratelimit-core/src/interfaces/ratelimitstore/).[`check`](/api/ratelimit-core/src/interfaces/ratelimitstore/#check)

***

### pruneExpired()

> **pruneExpired**(): `Promise`\<`number`\>

Defined in: [packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts:56](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts#L56)

#### Returns

`Promise`\<`number`\>

#### Implementation of

[`RateLimitStore`](/api/ratelimit-core/src/interfaces/ratelimitstore/).[`pruneExpired`](/api/ratelimit-core/src/interfaces/ratelimitstore/#pruneexpired)

***

### reset()

> **reset**(): `void`

Defined in: [packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts:52](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts#L52)

Clear all buckets (for testing)

#### Returns

`void`

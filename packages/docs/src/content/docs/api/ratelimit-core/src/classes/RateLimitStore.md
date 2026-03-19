---
editUrl: false
next: false
prev: false
title: "RateLimitStore"
---

Defined in: [packages/ratelimit-core/src/libs/RateLimitStore.ts:7](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/RateLimitStore.ts#L7)

Abstract storage for rate limiting.
Implementations: InMemoryRateLimitStore, UpstashRateLimitStore

## Extended by

- [`InMemoryRateLimitStore`](/api/ratelimit-core/src/classes/inmemoryratelimitstore/)

## Constructors

### Constructor

> **new RateLimitStore**(): `RateLimitStore`

#### Returns

`RateLimitStore`

## Methods

### check()

> `abstract` **check**(`key`, `policy`): `Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

Defined in: [packages/ratelimit-core/src/libs/RateLimitStore.ts:14](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/RateLimitStore.ts#L14)

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

***

### pruneExpired()

> `abstract` **pruneExpired**(): `Promise`\<`number`\>

Defined in: [packages/ratelimit-core/src/libs/RateLimitStore.ts:16](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/ratelimit-core/src/libs/RateLimitStore.ts#L16)

#### Returns

`Promise`\<`number`\>

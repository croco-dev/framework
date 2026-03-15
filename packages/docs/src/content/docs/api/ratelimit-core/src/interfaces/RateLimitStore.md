---
editUrl: false
next: false
prev: false
title: "RateLimitStore"
---

Defined in: [packages/ratelimit-core/src/libs/RateLimitStore.ts:7](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/ratelimit-core/src/libs/RateLimitStore.ts#L7)

Abstract storage interface for rate limiting.
Implementations: InMemoryRateLimitStore, UpstashRateLimitStore

## Methods

### check()

> **check**(`key`, `policy`): `Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

Defined in: [packages/ratelimit-core/src/libs/RateLimitStore.ts:14](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/ratelimit-core/src/libs/RateLimitStore.ts#L14)

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

### pruneExpired()?

> `optional` **pruneExpired**(): `Promise`\<`number`\>

Defined in: [packages/ratelimit-core/src/libs/RateLimitStore.ts:16](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/ratelimit-core/src/libs/RateLimitStore.ts#L16)

#### Returns

`Promise`\<`number`\>

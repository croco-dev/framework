---
editUrl: false
next: false
prev: false
title: "RateLimitStore"
---

Defined in: [packages/ratelimit-core/src/libs/RateLimitStore.ts:7](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/ratelimit-core/src/libs/RateLimitStore.ts#L7)

Abstract storage interface for rate limiting.
Implementations: InMemoryRateLimitStore, UpstashRateLimitStore

## Methods

### check()

> **check**(`key`, `policy`): `Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

Defined in: [packages/ratelimit-core/src/libs/RateLimitStore.ts:14](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/ratelimit-core/src/libs/RateLimitStore.ts#L14)

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

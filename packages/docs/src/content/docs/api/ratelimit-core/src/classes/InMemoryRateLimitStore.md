---
editUrl: false
next: false
prev: false
title: "InMemoryRateLimitStore"
---

Defined in: [packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts:14](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts#L14)

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

Defined in: [packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts:17](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts#L17)

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

### reset()

> **reset**(): `void`

Defined in: [packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts:51](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts#L51)

Clear all buckets (for testing)

#### Returns

`void`

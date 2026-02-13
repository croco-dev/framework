---
editUrl: false
next: false
prev: false
title: "RateLimiter"
---

Defined in: [packages/ratelimit-core/src/libs/RateLimiter.ts:9](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/ratelimit-core/src/libs/RateLimiter.ts#L9)

Core rate limiter service.
Orchestrates key building, store access, and error handling.

## Constructors

### Constructor

> **new RateLimiter**(`store`, `keyBuilder`, `options?`): `RateLimiter`

Defined in: [packages/ratelimit-core/src/libs/RateLimiter.ts:15](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/ratelimit-core/src/libs/RateLimiter.ts#L15)

#### Parameters

##### store

[`RateLimitStore`](/api/ratelimit-core/src/interfaces/ratelimitstore/)

##### keyBuilder

[`RateLimitKeyBuilder`](/api/ratelimit-core/src/classes/ratelimitkeybuilder/)

##### options?

`Omit`\<[`RateLimiterOptions`](/api/ratelimit-core/src/type-aliases/ratelimiteroptions/), `"keySegments"`\> = `{}`

#### Returns

`RateLimiter`

## Methods

### check()

> **check**(`context`, `policy`): `Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

Defined in: [packages/ratelimit-core/src/libs/RateLimiter.ts:32](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/ratelimit-core/src/libs/RateLimiter.ts#L32)

Check rate limit for the given context and policy.

#### Parameters

##### context

[`KeyContext`](/api/ratelimit-core/src/type-aliases/keycontext/)

Request context containing key segments

##### policy

[`RateLimitPolicy`](/api/ratelimit-core/src/type-aliases/ratelimitpolicy/)

Rate limit policy to apply

#### Returns

`Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

Rate limit result

***

### checkWithKey()

> **checkWithKey**(`key`, `policy`): `Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

Defined in: [packages/ratelimit-core/src/libs/RateLimiter.ts:48](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/ratelimit-core/src/libs/RateLimiter.ts#L48)

Check rate limit with a pre-built key (for middleware use).

#### Parameters

##### key

`string`

Pre-built rate limit key

##### policy

[`RateLimitPolicy`](/api/ratelimit-core/src/type-aliases/ratelimitpolicy/)

Rate limit policy to apply

#### Returns

`Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

Rate limit result

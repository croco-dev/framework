---
editUrl: false
next: false
prev: false
title: "RateLimiter"
---

레이트 리밋 정책 생성 함수와 핵심 RateLimiter 클래스입니다.

## Type Parameters

### TContext

`TContext` = [`KeyContext`](/api/ratelimit-core/src/type-aliases/keycontext/)

## Constructors

### Constructor

> **new RateLimiter**\<`TContext`\>(`store`, `keyBuilder`, `options?`): `RateLimiter`\<`TContext`\>

#### Parameters

##### store

[`RateLimitStore`](/api/ratelimit-core/src/classes/ratelimitstore/)

##### keyBuilder

[`RateLimiterKeyBuilder`](/api/ratelimit-core/src/type-aliases/ratelimiterkeybuilder/)\<`TContext`\> | [`RateLimitKeyBuilder`](/api/ratelimit-core/src/classes/ratelimitkeybuilder/)

##### options?

###### failOpen?

`boolean`

###### onStoreError?

(`error`) => `void`

#### Returns

`RateLimiter`\<`TContext`\>

## Methods

### check()

> **check**(`context`, `policy`): `Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

#### Parameters

##### context

`TContext`

##### policy

[`RateLimitPolicy`](/api/ratelimit-core/src/type-aliases/ratelimitpolicy/)

#### Returns

`Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

***

### checkWithKey()

> **checkWithKey**(`key`, `policy`): `Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

#### Parameters

##### key

`string`

##### policy

[`RateLimitPolicy`](/api/ratelimit-core/src/type-aliases/ratelimitpolicy/)

#### Returns

`Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

***

### getStats()

> **getStats**(`key?`): `Promise`\<[`RateLimitStats`](/api/ratelimit-core/src/type-aliases/ratelimitstats/)\>

#### Parameters

##### key?

`string`

#### Returns

`Promise`\<[`RateLimitStats`](/api/ratelimit-core/src/type-aliases/ratelimitstats/)\>

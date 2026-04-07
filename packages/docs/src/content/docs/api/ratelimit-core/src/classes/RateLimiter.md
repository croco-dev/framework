---
editUrl: false
next: false
prev: false
title: "RateLimiter"
---

Defined in: [packages/ratelimit-core/src/libs/RateLimiter.ts:14](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/RateLimiter.ts#L14)

## Type Parameters

### TContext

`TContext` = [`KeyContext`](/api/ratelimit-core/src/type-aliases/keycontext/)

## Constructors

### Constructor

> **new RateLimiter**\<`TContext`\>(`store`, `keyBuilder`, `options?`): `RateLimiter`\<`TContext`\>

Defined in: [packages/ratelimit-core/src/libs/RateLimiter.ts:20](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/RateLimiter.ts#L20)

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

Defined in: [packages/ratelimit-core/src/libs/RateLimiter.ts:36](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/RateLimiter.ts#L36)

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

Defined in: [packages/ratelimit-core/src/libs/RateLimiter.ts:47](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/RateLimiter.ts#L47)

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

Defined in: [packages/ratelimit-core/src/libs/RateLimiter.ts:56](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/RateLimiter.ts#L56)

#### Parameters

##### key?

`string`

#### Returns

`Promise`\<[`RateLimitStats`](/api/ratelimit-core/src/type-aliases/ratelimitstats/)\>

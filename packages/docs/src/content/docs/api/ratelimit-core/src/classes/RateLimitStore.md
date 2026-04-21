---
editUrl: false
next: false
prev: false
title: "RateLimitStore"
---

Defined in: [packages/ratelimit-core/src/libs/RateLimitStore.ts:30](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/RateLimitStore.ts#L30)

분산 저장소와 알고리즘별 저장소 추상 계약입니다.

## Extended by

- [`DistributedRateLimitStore`](/api/ratelimit-core/src/classes/distributedratelimitstore/)

## Constructors

### Constructor

> **new RateLimitStore**(): `RateLimitStore`

#### Returns

`RateLimitStore`

## Methods

### check()

> `abstract` **check**(`key`, `policy`): `Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

Defined in: [packages/ratelimit-core/src/libs/RateLimitStore.ts:31](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/RateLimitStore.ts#L31)

#### Parameters

##### key

`string`

##### policy

[`RateLimitPolicy`](/api/ratelimit-core/src/type-aliases/ratelimitpolicy/)

#### Returns

`Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

***

### getStats()

> `abstract` **getStats**(`key?`): `Promise`\<[`RateLimitStats`](/api/ratelimit-core/src/type-aliases/ratelimitstats/)\>

Defined in: [packages/ratelimit-core/src/libs/RateLimitStore.ts:32](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/RateLimitStore.ts#L32)

#### Parameters

##### key?

`string`

#### Returns

`Promise`\<[`RateLimitStats`](/api/ratelimit-core/src/type-aliases/ratelimitstats/)\>

***

### pruneExpired()

> `abstract` **pruneExpired**(): `Promise`\<`number`\>

Defined in: [packages/ratelimit-core/src/libs/RateLimitStore.ts:33](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/RateLimitStore.ts#L33)

#### Returns

`Promise`\<`number`\>

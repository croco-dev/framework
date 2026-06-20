---
editUrl: false
next: false
prev: false
title: "RateLimitStore"
---

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

#### Parameters

##### key?

`string`

#### Returns

`Promise`\<[`RateLimitStats`](/api/ratelimit-core/src/type-aliases/ratelimitstats/)\>

***

### pruneExpired()

> `abstract` **pruneExpired**(): `Promise`\<`number`\>

#### Returns

`Promise`\<`number`\>

***

### refund()

> **refund**(`_key`, `_policy`, `_receipt?`): `Promise`\<[`RateLimitRefundResult`](/api/ratelimit-core/src/type-aliases/ratelimitrefundresult/)\>

#### Parameters

##### \_key

`string`

##### \_policy

[`RateLimitPolicy`](/api/ratelimit-core/src/type-aliases/ratelimitpolicy/)

##### \_receipt?

[`RateLimitRefundReceipt`](/api/ratelimit-core/src/type-aliases/ratelimitrefundreceipt/)

#### Returns

`Promise`\<[`RateLimitRefundResult`](/api/ratelimit-core/src/type-aliases/ratelimitrefundresult/)\>

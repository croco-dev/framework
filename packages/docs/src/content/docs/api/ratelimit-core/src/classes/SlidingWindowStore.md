---
editUrl: false
next: false
prev: false
title: "SlidingWindowStore"
---

분산 저장소와 알고리즘별 저장소 추상 계약입니다.

## Extends

- [`DistributedRateLimitStore`](/api/ratelimit-core/src/classes/distributedratelimitstore/)

## Extended by

- [`SlidingWindowInMemoryStore`](/api/ratelimit-core/src/classes/slidingwindowinmemorystore/)
- [`UpstashSlidingWindowStore`](/api/ratelimit-upstash/src/classes/upstashslidingwindowstore/)

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

#### Inherited from

[`DistributedRateLimitStore`](/api/ratelimit-core/src/classes/distributedratelimitstore/).[`check`](/api/ratelimit-core/src/classes/distributedratelimitstore/#check)

***

### checkSlidingWindow()

> **checkSlidingWindow**(`key`, `policy`): `Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

#### Parameters

##### key

`string`

##### policy

[`SlidingWindowPolicy`](/api/ratelimit-core/src/type-aliases/slidingwindowpolicy/)

#### Returns

`Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

***

### expire()

> `abstract` **expire**(`key`, `ttlMs`): `Promise`\<`void`\>

#### Parameters

##### key

`string`

##### ttlMs

`number`

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`DistributedRateLimitStore`](/api/ratelimit-core/src/classes/distributedratelimitstore/).[`expire`](/api/ratelimit-core/src/classes/distributedratelimitstore/#expire)

***

### getCount()

> `abstract` **getCount**(`key`): `Promise`\<`number`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`number`\>

#### Inherited from

[`DistributedRateLimitStore`](/api/ratelimit-core/src/classes/distributedratelimitstore/).[`getCount`](/api/ratelimit-core/src/classes/distributedratelimitstore/#getcount)

***

### getStats()

> `abstract` **getStats**(`key?`): `Promise`\<[`RateLimitStats`](/api/ratelimit-core/src/type-aliases/ratelimitstats/)\>

#### Parameters

##### key?

`string`

#### Returns

`Promise`\<[`RateLimitStats`](/api/ratelimit-core/src/type-aliases/ratelimitstats/)\>

#### Inherited from

[`DistributedRateLimitStore`](/api/ratelimit-core/src/classes/distributedratelimitstore/).[`getStats`](/api/ratelimit-core/src/classes/distributedratelimitstore/#getstats)

***

### increment()

> `abstract` **increment**(`key`, `amount?`): `Promise`\<`number`\>

#### Parameters

##### key

`string`

##### amount?

`number`

#### Returns

`Promise`\<`number`\>

#### Inherited from

[`DistributedRateLimitStore`](/api/ratelimit-core/src/classes/distributedratelimitstore/).[`increment`](/api/ratelimit-core/src/classes/distributedratelimitstore/#increment)

***

### pruneExpired()

> `abstract` **pruneExpired**(): `Promise`\<`number`\>

#### Returns

`Promise`\<`number`\>

#### Inherited from

[`DistributedRateLimitStore`](/api/ratelimit-core/src/classes/distributedratelimitstore/).[`pruneExpired`](/api/ratelimit-core/src/classes/distributedratelimitstore/#pruneexpired)

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

#### Overrides

[`DistributedRateLimitStore`](/api/ratelimit-core/src/classes/distributedratelimitstore/).[`refund`](/api/ratelimit-core/src/classes/distributedratelimitstore/#refund)

***

### reset()

> `abstract` **reset**(`key`): `Promise`\<`void`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`DistributedRateLimitStore`](/api/ratelimit-core/src/classes/distributedratelimitstore/).[`reset`](/api/ratelimit-core/src/classes/distributedratelimitstore/#reset)

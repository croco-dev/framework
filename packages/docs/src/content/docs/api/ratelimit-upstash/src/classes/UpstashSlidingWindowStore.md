---
editUrl: false
next: false
prev: false
title: "UpstashSlidingWindowStore"
---

Upstash Redis와 Lua 스크립트로 슬라이딩 윈도우 제한을 수행하는 저장소입니다.

## Extends

- [`SlidingWindowStore`](/api/ratelimit-core/src/classes/slidingwindowstore/)

## Constructors

### Constructor

> **new UpstashSlidingWindowStore**(`options`): `UpstashSlidingWindowStore`

#### Parameters

##### options

[`UpstashRateLimitStoreOptions`](/api/ratelimit-upstash/src/type-aliases/upstashratelimitstoreoptions/)

#### Returns

`UpstashSlidingWindowStore`

#### Overrides

`SlidingWindowStore.constructor`

## Methods

### check()

> **check**(`key`, `policy`): `Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

#### Parameters

##### key

`string`

##### policy

[`RateLimitPolicy`](/api/ratelimit-core/src/type-aliases/ratelimitpolicy/)

#### Returns

`Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

#### Overrides

[`SlidingWindowStore`](/api/ratelimit-core/src/classes/slidingwindowstore/).[`check`](/api/ratelimit-core/src/classes/slidingwindowstore/#check)

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

#### Overrides

[`SlidingWindowStore`](/api/ratelimit-core/src/classes/slidingwindowstore/).[`checkSlidingWindow`](/api/ratelimit-core/src/classes/slidingwindowstore/#checkslidingwindow)

***

### expire()

> **expire**(`key`, `ttlMs`): `Promise`\<`void`\>

#### Parameters

##### key

`string`

##### ttlMs

`number`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`SlidingWindowStore`](/api/ratelimit-core/src/classes/slidingwindowstore/).[`expire`](/api/ratelimit-core/src/classes/slidingwindowstore/#expire)

***

### getCount()

> **getCount**(`key`): `Promise`\<`number`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`number`\>

#### Overrides

[`SlidingWindowStore`](/api/ratelimit-core/src/classes/slidingwindowstore/).[`getCount`](/api/ratelimit-core/src/classes/slidingwindowstore/#getcount)

***

### getStats()

> **getStats**(): `Promise`\<[`RateLimitStats`](/api/ratelimit-core/src/type-aliases/ratelimitstats/)\>

#### Returns

`Promise`\<[`RateLimitStats`](/api/ratelimit-core/src/type-aliases/ratelimitstats/)\>

#### Overrides

[`SlidingWindowStore`](/api/ratelimit-core/src/classes/slidingwindowstore/).[`getStats`](/api/ratelimit-core/src/classes/slidingwindowstore/#getstats)

***

### increment()

> **increment**(`key`, `amount?`): `Promise`\<`number`\>

#### Parameters

##### key

`string`

##### amount?

`number` = `1`

#### Returns

`Promise`\<`number`\>

#### Overrides

[`SlidingWindowStore`](/api/ratelimit-core/src/classes/slidingwindowstore/).[`increment`](/api/ratelimit-core/src/classes/slidingwindowstore/#increment)

***

### pruneExpired()

> **pruneExpired**(): `Promise`\<`number`\>

#### Returns

`Promise`\<`number`\>

#### Overrides

[`SlidingWindowStore`](/api/ratelimit-core/src/classes/slidingwindowstore/).[`pruneExpired`](/api/ratelimit-core/src/classes/slidingwindowstore/#pruneexpired)

***

### refund()

> **refund**(`key`, `policy`, `receipt?`): `Promise`\<[`RateLimitRefundResult`](/api/ratelimit-core/src/type-aliases/ratelimitrefundresult/)\>

#### Parameters

##### key

`string`

##### policy

[`RateLimitPolicy`](/api/ratelimit-core/src/type-aliases/ratelimitpolicy/)

##### receipt?

[`RateLimitRefundReceipt`](/api/ratelimit-core/src/type-aliases/ratelimitrefundreceipt/)

#### Returns

`Promise`\<[`RateLimitRefundResult`](/api/ratelimit-core/src/type-aliases/ratelimitrefundresult/)\>

#### Overrides

[`SlidingWindowStore`](/api/ratelimit-core/src/classes/slidingwindowstore/).[`refund`](/api/ratelimit-core/src/classes/slidingwindowstore/#refund)

***

### reset()

> **reset**(`key`): `Promise`\<`void`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`SlidingWindowStore`](/api/ratelimit-core/src/classes/slidingwindowstore/).[`reset`](/api/ratelimit-core/src/classes/slidingwindowstore/#reset)

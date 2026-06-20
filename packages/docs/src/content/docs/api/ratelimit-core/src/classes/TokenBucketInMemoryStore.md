---
editUrl: false
next: false
prev: false
title: "TokenBucketInMemoryStore"
---

메모리 기반 레이트 리밋 저장소 구현체들입니다.

## Extends

- [`TokenBucketStore`](/api/ratelimit-core/src/classes/tokenbucketstore/)

## Constructors

### Constructor

> **new TokenBucketInMemoryStore**(`options?`): `TokenBucketInMemoryStore`

#### Parameters

##### options?

[`InMemoryRateLimitStoreOptions`](/api/ratelimit-core/src/type-aliases/inmemoryratelimitstoreoptions/) = `{}`

#### Returns

`TokenBucketInMemoryStore`

#### Overrides

[`TokenBucketStore`](/api/ratelimit-core/src/classes/tokenbucketstore/).[`constructor`](/api/ratelimit-core/src/classes/tokenbucketstore/#constructor)

## Methods

### check()

> **check**(`key`, `policy`): `Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

#### Parameters

##### key

`string`

##### policy

[`TokenBucketPolicy`](/api/ratelimit-core/src/type-aliases/tokenbucketpolicy/)

#### Returns

`Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

#### Overrides

[`TokenBucketStore`](/api/ratelimit-core/src/classes/tokenbucketstore/).[`check`](/api/ratelimit-core/src/classes/tokenbucketstore/#check)

***

### checkTokenBucket()

> **checkTokenBucket**(`key`, `policy`): `Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

#### Parameters

##### key

`string`

##### policy

[`TokenBucketPolicy`](/api/ratelimit-core/src/type-aliases/tokenbucketpolicy/)

#### Returns

`Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

#### Inherited from

[`TokenBucketStore`](/api/ratelimit-core/src/classes/tokenbucketstore/).[`checkTokenBucket`](/api/ratelimit-core/src/classes/tokenbucketstore/#checktokenbucket)

***

### close()

> **close**(): `void`

#### Returns

`void`

***

### destroy()

> **destroy**(): `void`

#### Returns

`void`

***

### expire()

> **expire**(`key`, `_ttlMs`): `Promise`\<`void`\>

#### Parameters

##### key

`string`

##### \_ttlMs

`number`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`TokenBucketStore`](/api/ratelimit-core/src/classes/tokenbucketstore/).[`expire`](/api/ratelimit-core/src/classes/tokenbucketstore/#expire)

***

### getCount()

> **getCount**(): `Promise`\<`number`\>

#### Returns

`Promise`\<`number`\>

#### Overrides

[`TokenBucketStore`](/api/ratelimit-core/src/classes/tokenbucketstore/).[`getCount`](/api/ratelimit-core/src/classes/tokenbucketstore/#getcount)

***

### getStats()

> **getStats**(): `Promise`\<\{ `allowed`: `number`; `denied`: `number`; `total`: `number`; \}\>

#### Returns

`Promise`\<\{ `allowed`: `number`; `denied`: `number`; `total`: `number`; \}\>

#### Overrides

[`TokenBucketStore`](/api/ratelimit-core/src/classes/tokenbucketstore/).[`getStats`](/api/ratelimit-core/src/classes/tokenbucketstore/#getstats)

***

### increment()

> **increment**(): `Promise`\<`number`\>

#### Returns

`Promise`\<`number`\>

#### Overrides

[`TokenBucketStore`](/api/ratelimit-core/src/classes/tokenbucketstore/).[`increment`](/api/ratelimit-core/src/classes/tokenbucketstore/#increment)

***

### pruneExpired()

> **pruneExpired**(): `Promise`\<`number`\>

#### Returns

`Promise`\<`number`\>

#### Overrides

[`TokenBucketStore`](/api/ratelimit-core/src/classes/tokenbucketstore/).[`pruneExpired`](/api/ratelimit-core/src/classes/tokenbucketstore/#pruneexpired)

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

[`TokenBucketStore`](/api/ratelimit-core/src/classes/tokenbucketstore/).[`refund`](/api/ratelimit-core/src/classes/tokenbucketstore/#refund)

***

### reset()

> **reset**(`key`): `Promise`\<`void`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`TokenBucketStore`](/api/ratelimit-core/src/classes/tokenbucketstore/).[`reset`](/api/ratelimit-core/src/classes/tokenbucketstore/#reset)

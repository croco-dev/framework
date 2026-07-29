---
editUrl: false
next: false
prev: false
title: "UpstashTokenBucketStore"
---

Upstash Redis와 Lua 스크립트로 토큰 버킷 제한을 수행하는 저장소입니다.

## Extends

- [`TokenBucketStore`](/api/ratelimit-core/src/classes/tokenbucketstore/)

## Constructors

### Constructor

> **new UpstashTokenBucketStore**(`options`): `UpstashTokenBucketStore`

#### Parameters

##### options

[`UpstashRateLimitStoreOptions`](/api/ratelimit-upstash/src/type-aliases/upstashratelimitstoreoptions/)

#### Returns

`UpstashTokenBucketStore`

#### Overrides

[`TokenBucketStore`](/api/ratelimit-core/src/classes/tokenbucketstore/).[`constructor`](/api/ratelimit-core/src/classes/tokenbucketstore/#constructor)

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

[`TokenBucketStore`](/api/ratelimit-core/src/classes/tokenbucketstore/).[`check`](/api/ratelimit-core/src/classes/tokenbucketstore/#check)

---

### checkTokenBucket()

> **checkTokenBucket**(`key`, `policy`): `Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

#### Parameters

##### key

`string`

##### policy

[`TokenBucketPolicy`](/api/ratelimit-core/src/type-aliases/tokenbucketpolicy/)

#### Returns

`Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

#### Overrides

[`TokenBucketStore`](/api/ratelimit-core/src/classes/tokenbucketstore/).[`checkTokenBucket`](/api/ratelimit-core/src/classes/tokenbucketstore/#checktokenbucket)

---

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

[`TokenBucketStore`](/api/ratelimit-core/src/classes/tokenbucketstore/).[`expire`](/api/ratelimit-core/src/classes/tokenbucketstore/#expire)

---

### getCount()

> **getCount**(`key`): `Promise`\<`number`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`number`\>

#### Overrides

[`TokenBucketStore`](/api/ratelimit-core/src/classes/tokenbucketstore/).[`getCount`](/api/ratelimit-core/src/classes/tokenbucketstore/#getcount)

---

### getStats()

> **getStats**(): `Promise`\<[`RateLimitStats`](/api/ratelimit-core/src/type-aliases/ratelimitstats/)\>

#### Returns

`Promise`\<[`RateLimitStats`](/api/ratelimit-core/src/type-aliases/ratelimitstats/)\>

#### Overrides

[`TokenBucketStore`](/api/ratelimit-core/src/classes/tokenbucketstore/).[`getStats`](/api/ratelimit-core/src/classes/tokenbucketstore/#getstats)

---

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

[`TokenBucketStore`](/api/ratelimit-core/src/classes/tokenbucketstore/).[`increment`](/api/ratelimit-core/src/classes/tokenbucketstore/#increment)

---

### pruneExpired()

> **pruneExpired**(): `Promise`\<`number`\>

#### Returns

`Promise`\<`number`\>

#### Overrides

[`TokenBucketStore`](/api/ratelimit-core/src/classes/tokenbucketstore/).[`pruneExpired`](/api/ratelimit-core/src/classes/tokenbucketstore/#pruneexpired)

---

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

---

### reset()

> **reset**(`key`): `Promise`\<`void`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`TokenBucketStore`](/api/ratelimit-core/src/classes/tokenbucketstore/).[`reset`](/api/ratelimit-core/src/classes/tokenbucketstore/#reset)

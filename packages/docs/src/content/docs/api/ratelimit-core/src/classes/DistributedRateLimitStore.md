---
editUrl: false
next: false
prev: false
title: "DistributedRateLimitStore"
---

분산 저장소와 알고리즘별 저장소 추상 계약입니다.

## Extends

- [`RateLimitStore`](/api/ratelimit-core/src/classes/ratelimitstore/)

## Extended by

- [`FixedWindowStore`](/api/ratelimit-core/src/classes/fixedwindowstore/)
- [`SlidingWindowStore`](/api/ratelimit-core/src/classes/slidingwindowstore/)
- [`TokenBucketStore`](/api/ratelimit-core/src/classes/tokenbucketstore/)

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

[`RateLimitStore`](/api/ratelimit-core/src/classes/ratelimitstore/).[`check`](/api/ratelimit-core/src/classes/ratelimitstore/#check)

---

### expire()

> `abstract` **expire**(`key`, `ttlMs`): `Promise`\<`void`\>

#### Parameters

##### key

`string`

##### ttlMs

`number`

#### Returns

`Promise`\<`void`\>

---

### getCount()

> `abstract` **getCount**(`key`): `Promise`\<`number`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`number`\>

---

### getStats()

> `abstract` **getStats**(`key?`): `Promise`\<[`RateLimitStats`](/api/ratelimit-core/src/type-aliases/ratelimitstats/)\>

#### Parameters

##### key?

`string`

#### Returns

`Promise`\<[`RateLimitStats`](/api/ratelimit-core/src/type-aliases/ratelimitstats/)\>

#### Inherited from

[`RateLimitStore`](/api/ratelimit-core/src/classes/ratelimitstore/).[`getStats`](/api/ratelimit-core/src/classes/ratelimitstore/#getstats)

---

### increment()

> `abstract` **increment**(`key`, `amount?`): `Promise`\<`number`\>

#### Parameters

##### key

`string`

##### amount?

`number`

#### Returns

`Promise`\<`number`\>

---

### pruneExpired()

> `abstract` **pruneExpired**(): `Promise`\<`number`\>

#### Returns

`Promise`\<`number`\>

#### Inherited from

[`RateLimitStore`](/api/ratelimit-core/src/classes/ratelimitstore/).[`pruneExpired`](/api/ratelimit-core/src/classes/ratelimitstore/#pruneexpired)

---

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

#### Inherited from

[`RateLimitStore`](/api/ratelimit-core/src/classes/ratelimitstore/).[`refund`](/api/ratelimit-core/src/classes/ratelimitstore/#refund)

---

### reset()

> `abstract` **reset**(`key`): `Promise`\<`void`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

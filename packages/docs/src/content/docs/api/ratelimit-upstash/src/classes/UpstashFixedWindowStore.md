---
editUrl: false
next: false
prev: false
title: "UpstashFixedWindowStore"
---

Upstash Redis와 Lua 스크립트로 고정 윈도우 제한을 수행하는 저장소입니다.

## Extends

- [`FixedWindowStore`](/api/ratelimit-core/src/classes/fixedwindowstore/)

## Constructors

### Constructor

> **new UpstashFixedWindowStore**(`options`): `UpstashFixedWindowStore`

#### Parameters

##### options

[`UpstashRateLimitStoreOptions`](/api/ratelimit-upstash/src/type-aliases/upstashratelimitstoreoptions/)

#### Returns

`UpstashFixedWindowStore`

#### Overrides

`FixedWindowStore.constructor`

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

[`FixedWindowStore`](/api/ratelimit-core/src/classes/fixedwindowstore/).[`check`](/api/ratelimit-core/src/classes/fixedwindowstore/#check)

---

### checkFixedWindow()

> **checkFixedWindow**(`key`, `policy`): `Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

#### Parameters

##### key

`string`

##### policy

[`FixedWindowPolicy`](/api/ratelimit-core/src/type-aliases/fixedwindowpolicy/)

#### Returns

`Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

#### Inherited from

[`FixedWindowStore`](/api/ratelimit-core/src/classes/fixedwindowstore/).[`checkFixedWindow`](/api/ratelimit-core/src/classes/fixedwindowstore/#checkfixedwindow)

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

[`FixedWindowStore`](/api/ratelimit-core/src/classes/fixedwindowstore/).[`expire`](/api/ratelimit-core/src/classes/fixedwindowstore/#expire)

---

### getCount()

> **getCount**(`key`): `Promise`\<`number`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`number`\>

#### Overrides

[`FixedWindowStore`](/api/ratelimit-core/src/classes/fixedwindowstore/).[`getCount`](/api/ratelimit-core/src/classes/fixedwindowstore/#getcount)

---

### getStats()

> **getStats**(): `Promise`\<[`RateLimitStats`](/api/ratelimit-core/src/type-aliases/ratelimitstats/)\>

#### Returns

`Promise`\<[`RateLimitStats`](/api/ratelimit-core/src/type-aliases/ratelimitstats/)\>

#### Overrides

[`FixedWindowStore`](/api/ratelimit-core/src/classes/fixedwindowstore/).[`getStats`](/api/ratelimit-core/src/classes/fixedwindowstore/#getstats)

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

[`FixedWindowStore`](/api/ratelimit-core/src/classes/fixedwindowstore/).[`increment`](/api/ratelimit-core/src/classes/fixedwindowstore/#increment)

---

### pruneExpired()

> **pruneExpired**(): `Promise`\<`number`\>

#### Returns

`Promise`\<`number`\>

#### Overrides

[`FixedWindowStore`](/api/ratelimit-core/src/classes/fixedwindowstore/).[`pruneExpired`](/api/ratelimit-core/src/classes/fixedwindowstore/#pruneexpired)

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

[`FixedWindowStore`](/api/ratelimit-core/src/classes/fixedwindowstore/).[`refund`](/api/ratelimit-core/src/classes/fixedwindowstore/#refund)

---

### reset()

> **reset**(`key`): `Promise`\<`void`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`FixedWindowStore`](/api/ratelimit-core/src/classes/fixedwindowstore/).[`reset`](/api/ratelimit-core/src/classes/fixedwindowstore/#reset)

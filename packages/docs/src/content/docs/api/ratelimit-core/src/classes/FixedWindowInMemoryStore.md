---
editUrl: false
next: false
prev: false
title: "FixedWindowInMemoryStore"
---

메모리 기반 레이트 리밋 저장소 구현체들입니다.

## Extends

- [`FixedWindowStore`](/api/ratelimit-core/src/classes/fixedwindowstore/)

## Constructors

### Constructor

> **new FixedWindowInMemoryStore**(`options?`): `FixedWindowInMemoryStore`

#### Parameters

##### options?

[`InMemoryRateLimitStoreOptions`](/api/ratelimit-core/src/type-aliases/inmemoryratelimitstoreoptions/) = `{}`

#### Returns

`FixedWindowInMemoryStore`

#### Overrides

`FixedWindowStore.constructor`

## Methods

### check()

> **check**(`key`, `policy`): `Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

#### Parameters

##### key

`string`

##### policy

[`FixedWindowPolicy`](/api/ratelimit-core/src/type-aliases/fixedwindowpolicy/)

#### Returns

`Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

#### Overrides

[`FixedWindowStore`](/api/ratelimit-core/src/classes/fixedwindowstore/).[`check`](/api/ratelimit-core/src/classes/fixedwindowstore/#check)

***

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

> **expire**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Overrides

[`FixedWindowStore`](/api/ratelimit-core/src/classes/fixedwindowstore/).[`expire`](/api/ratelimit-core/src/classes/fixedwindowstore/#expire)

***

### getCount()

> **getCount**(`key`): `Promise`\<`number`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`number`\>

#### Overrides

[`FixedWindowStore`](/api/ratelimit-core/src/classes/fixedwindowstore/).[`getCount`](/api/ratelimit-core/src/classes/fixedwindowstore/#getcount)

***

### getStats()

> **getStats**(): `Promise`\<\{ `allowed`: `number`; `denied`: `number`; `total`: `number`; \}\>

#### Returns

`Promise`\<\{ `allowed`: `number`; `denied`: `number`; `total`: `number`; \}\>

#### Overrides

[`FixedWindowStore`](/api/ratelimit-core/src/classes/fixedwindowstore/).[`getStats`](/api/ratelimit-core/src/classes/fixedwindowstore/#getstats)

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

[`FixedWindowStore`](/api/ratelimit-core/src/classes/fixedwindowstore/).[`increment`](/api/ratelimit-core/src/classes/fixedwindowstore/#increment)

***

### pruneExpired()

> **pruneExpired**(): `Promise`\<`number`\>

#### Returns

`Promise`\<`number`\>

#### Overrides

[`FixedWindowStore`](/api/ratelimit-core/src/classes/fixedwindowstore/).[`pruneExpired`](/api/ratelimit-core/src/classes/fixedwindowstore/#pruneexpired)

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

[`FixedWindowStore`](/api/ratelimit-core/src/classes/fixedwindowstore/).[`refund`](/api/ratelimit-core/src/classes/fixedwindowstore/#refund)

***

### reset()

> **reset**(`key`): `Promise`\<`void`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`FixedWindowStore`](/api/ratelimit-core/src/classes/fixedwindowstore/).[`reset`](/api/ratelimit-core/src/classes/fixedwindowstore/#reset)

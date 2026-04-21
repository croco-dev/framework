---
editUrl: false
next: false
prev: false
title: "FixedWindowInMemoryStore"
---

Defined in: [packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts:4](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts#L4)

메모리 기반 레이트 리밋 저장소 구현체들입니다.

## Extends

- [`FixedWindowStore`](/api/ratelimit-core/src/classes/fixedwindowstore/)

## Constructors

### Constructor

> **new FixedWindowInMemoryStore**(): `FixedWindowInMemoryStore`

#### Returns

`FixedWindowInMemoryStore`

#### Inherited from

[`FixedWindowStore`](/api/ratelimit-core/src/classes/fixedwindowstore/).[`constructor`](/api/ratelimit-core/src/classes/fixedwindowstore/#constructor)

## Methods

### check()

> **check**(`key`, `policy`): `Promise`\<\{ `limit`: `number`; `remaining`: `number`; `resetAtMs`: `number`; `success`: `boolean`; \}\>

Defined in: [packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts:8](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts#L8)

#### Parameters

##### key

`string`

##### policy

[`FixedWindowPolicy`](/api/ratelimit-core/src/type-aliases/fixedwindowpolicy/)

#### Returns

`Promise`\<\{ `limit`: `number`; `remaining`: `number`; `resetAtMs`: `number`; `success`: `boolean`; \}\>

#### Overrides

[`FixedWindowStore`](/api/ratelimit-core/src/classes/fixedwindowstore/).[`check`](/api/ratelimit-core/src/classes/fixedwindowstore/#check)

***

### checkFixedWindow()

> **checkFixedWindow**(`key`, `policy`): `Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

Defined in: [packages/ratelimit-core/src/libs/RateLimitStore.ts:47](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/RateLimitStore.ts#L47)

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

### expire()

> **expire**(): `Promise`\<`void`\>

Defined in: [packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts:68](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts#L68)

#### Returns

`Promise`\<`void`\>

#### Overrides

[`FixedWindowStore`](/api/ratelimit-core/src/classes/fixedwindowstore/).[`expire`](/api/ratelimit-core/src/classes/fixedwindowstore/#expire)

***

### getCount()

> **getCount**(`key`): `Promise`\<`number`\>

Defined in: [packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts:60](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts#L60)

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

Defined in: [packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts:87](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts#L87)

#### Returns

`Promise`\<\{ `allowed`: `number`; `denied`: `number`; `total`: `number`; \}\>

#### Overrides

[`FixedWindowStore`](/api/ratelimit-core/src/classes/fixedwindowstore/).[`getStats`](/api/ratelimit-core/src/classes/fixedwindowstore/#getstats)

***

### increment()

> **increment**(`key`, `amount?`): `Promise`\<`number`\>

Defined in: [packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts:51](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts#L51)

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

Defined in: [packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts:72](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts#L72)

#### Returns

`Promise`\<`number`\>

#### Overrides

[`FixedWindowStore`](/api/ratelimit-core/src/classes/fixedwindowstore/).[`pruneExpired`](/api/ratelimit-core/src/classes/fixedwindowstore/#pruneexpired)

***

### reset()

> **reset**(`key`): `Promise`\<`void`\>

Defined in: [packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts:64](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts#L64)

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`FixedWindowStore`](/api/ratelimit-core/src/classes/fixedwindowstore/).[`reset`](/api/ratelimit-core/src/classes/fixedwindowstore/#reset)

---
editUrl: false
next: false
prev: false
title: "SlidingWindowInMemoryStore"
---

Defined in: [packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts:92](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts#L92)

메모리 기반 레이트 리밋 저장소 구현체들입니다.

## Extends

- [`SlidingWindowStore`](/api/ratelimit-core/src/classes/slidingwindowstore/)

## Constructors

### Constructor

> **new SlidingWindowInMemoryStore**(): `SlidingWindowInMemoryStore`

#### Returns

`SlidingWindowInMemoryStore`

#### Inherited from

[`SlidingWindowStore`](/api/ratelimit-core/src/classes/slidingwindowstore/).[`constructor`](/api/ratelimit-core/src/classes/slidingwindowstore/#constructor)

## Methods

### check()

> **check**(`key`, `policy`): `Promise`\<\{ `limit`: `number`; `remaining`: `number`; `resetAtMs`: `number`; `success`: `boolean`; \}\>

Defined in: [packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts:96](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts#L96)

#### Parameters

##### key

`string`

##### policy

[`SlidingWindowPolicy`](/api/ratelimit-core/src/type-aliases/slidingwindowpolicy/)

#### Returns

`Promise`\<\{ `limit`: `number`; `remaining`: `number`; `resetAtMs`: `number`; `success`: `boolean`; \}\>

#### Overrides

[`SlidingWindowStore`](/api/ratelimit-core/src/classes/slidingwindowstore/).[`check`](/api/ratelimit-core/src/classes/slidingwindowstore/#check)

***

### checkSlidingWindow()

> **checkSlidingWindow**(`key`, `policy`): `Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

Defined in: [packages/ratelimit-core/src/libs/RateLimitStore.ts:80](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/RateLimitStore.ts#L80)

#### Parameters

##### key

`string`

##### policy

[`SlidingWindowPolicy`](/api/ratelimit-core/src/type-aliases/slidingwindowpolicy/)

#### Returns

`Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

#### Inherited from

[`SlidingWindowStore`](/api/ratelimit-core/src/classes/slidingwindowstore/).[`checkSlidingWindow`](/api/ratelimit-core/src/classes/slidingwindowstore/#checkslidingwindow)

***

### expire()

> **expire**(): `Promise`\<`void`\>

Defined in: [packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts:160](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts#L160)

#### Returns

`Promise`\<`void`\>

#### Overrides

[`SlidingWindowStore`](/api/ratelimit-core/src/classes/slidingwindowstore/).[`expire`](/api/ratelimit-core/src/classes/slidingwindowstore/#expire)

***

### getCount()

> **getCount**(): `Promise`\<`number`\>

Defined in: [packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts:148](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts#L148)

#### Returns

`Promise`\<`number`\>

#### Overrides

[`SlidingWindowStore`](/api/ratelimit-core/src/classes/slidingwindowstore/).[`getCount`](/api/ratelimit-core/src/classes/slidingwindowstore/#getcount)

***

### getStats()

> **getStats**(): `Promise`\<\{ `allowed`: `number`; `denied`: `number`; `total`: `number`; \}\>

Defined in: [packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts:185](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts#L185)

#### Returns

`Promise`\<\{ `allowed`: `number`; `denied`: `number`; `total`: `number`; \}\>

#### Overrides

[`SlidingWindowStore`](/api/ratelimit-core/src/classes/slidingwindowstore/).[`getStats`](/api/ratelimit-core/src/classes/slidingwindowstore/#getstats)

***

### increment()

> **increment**(): `Promise`\<`number`\>

Defined in: [packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts:144](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts#L144)

#### Returns

`Promise`\<`number`\>

#### Overrides

[`SlidingWindowStore`](/api/ratelimit-core/src/classes/slidingwindowstore/).[`increment`](/api/ratelimit-core/src/classes/slidingwindowstore/#increment)

***

### pruneExpired()

> **pruneExpired**(): `Promise`\<`number`\>

Defined in: [packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts:164](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts#L164)

#### Returns

`Promise`\<`number`\>

#### Overrides

[`SlidingWindowStore`](/api/ratelimit-core/src/classes/slidingwindowstore/).[`pruneExpired`](/api/ratelimit-core/src/classes/slidingwindowstore/#pruneexpired)

***

### reset()

> **reset**(`key?`): `Promise`\<`void`\>

Defined in: [packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts:152](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts#L152)

#### Parameters

##### key?

`string`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`SlidingWindowStore`](/api/ratelimit-core/src/classes/slidingwindowstore/).[`reset`](/api/ratelimit-core/src/classes/slidingwindowstore/#reset)

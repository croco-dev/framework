---
editUrl: false
next: false
prev: false
title: "SlidingWindowInMemoryStore"
---

메모리 기반 레이트 리밋 저장소 구현체들입니다.

## Extends

- [`SlidingWindowStore`](/api/ratelimit-core/src/classes/slidingwindowstore/)

## Constructors

### Constructor

> **new SlidingWindowInMemoryStore**(`options?`): `SlidingWindowInMemoryStore`

#### Parameters

##### options?

[`InMemoryRateLimitStoreOptions`](/api/ratelimit-core/src/type-aliases/inmemoryratelimitstoreoptions/) = `{}`

#### Returns

`SlidingWindowInMemoryStore`

#### Overrides

[`SlidingWindowStore`](/api/ratelimit-core/src/classes/slidingwindowstore/).[`constructor`](/api/ratelimit-core/src/classes/slidingwindowstore/#constructor)

## Methods

### check()

> **check**(`key`, `policy`): `Promise`\<\{ `limit`: `number`; `remaining`: `number`; `resetAtMs`: `number`; `success`: `boolean`; \}\>

#### Parameters

##### key

`string`

##### policy

[`SlidingWindowPolicy`](/api/ratelimit-core/src/type-aliases/slidingwindowpolicy/)

#### Returns

`Promise`\<\{ `limit`: `number`; `remaining`: `number`; `resetAtMs`: `number`; `success`: `boolean`; \}\>

#### Overrides

[`SlidingWindowStore`](/api/ratelimit-core/src/classes/slidingwindowstore/).[`check`](/api/ratelimit-core/src/classes/slidingwindowstore/#check)

---

### checkSlidingWindow()

> **checkSlidingWindow**(`key`, `policy`): `Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

#### Parameters

##### key

`string`

##### policy

[`SlidingWindowPolicy`](/api/ratelimit-core/src/type-aliases/slidingwindowpolicy/)

#### Returns

`Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

#### Inherited from

[`SlidingWindowStore`](/api/ratelimit-core/src/classes/slidingwindowstore/).[`checkSlidingWindow`](/api/ratelimit-core/src/classes/slidingwindowstore/#checkslidingwindow)

---

### close()

> **close**(): `void`

#### Returns

`void`

---

### destroy()

> **destroy**(): `void`

#### Returns

`void`

---

### expire()

> **expire**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Overrides

[`SlidingWindowStore`](/api/ratelimit-core/src/classes/slidingwindowstore/).[`expire`](/api/ratelimit-core/src/classes/slidingwindowstore/#expire)

---

### getCount()

> **getCount**(): `Promise`\<`number`\>

#### Returns

`Promise`\<`number`\>

#### Overrides

[`SlidingWindowStore`](/api/ratelimit-core/src/classes/slidingwindowstore/).[`getCount`](/api/ratelimit-core/src/classes/slidingwindowstore/#getcount)

---

### getStats()

> **getStats**(): `Promise`\<\{ `allowed`: `number`; `denied`: `number`; `total`: `number`; \}\>

#### Returns

`Promise`\<\{ `allowed`: `number`; `denied`: `number`; `total`: `number`; \}\>

#### Overrides

[`SlidingWindowStore`](/api/ratelimit-core/src/classes/slidingwindowstore/).[`getStats`](/api/ratelimit-core/src/classes/slidingwindowstore/#getstats)

---

### increment()

> **increment**(): `Promise`\<`number`\>

#### Returns

`Promise`\<`number`\>

#### Overrides

[`SlidingWindowStore`](/api/ratelimit-core/src/classes/slidingwindowstore/).[`increment`](/api/ratelimit-core/src/classes/slidingwindowstore/#increment)

---

### pruneExpired()

> **pruneExpired**(): `Promise`\<`number`\>

#### Returns

`Promise`\<`number`\>

#### Overrides

[`SlidingWindowStore`](/api/ratelimit-core/src/classes/slidingwindowstore/).[`pruneExpired`](/api/ratelimit-core/src/classes/slidingwindowstore/#pruneexpired)

---

### reset()

> **reset**(`key?`): `Promise`\<`void`\>

#### Parameters

##### key?

`string`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`SlidingWindowStore`](/api/ratelimit-core/src/classes/slidingwindowstore/).[`reset`](/api/ratelimit-core/src/classes/slidingwindowstore/#reset)

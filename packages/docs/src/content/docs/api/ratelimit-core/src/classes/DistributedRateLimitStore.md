---
editUrl: false
next: false
prev: false
title: "DistributedRateLimitStore"
---

Defined in: [packages/ratelimit-core/src/libs/RateLimitStore.ts:36](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/RateLimitStore.ts#L36)

분산 저장소와 알고리즘별 저장소 추상 계약입니다.

## Extends

- [`RateLimitStore`](/api/ratelimit-core/src/classes/ratelimitstore/)

## Extended by

- [`FixedWindowStore`](/api/ratelimit-core/src/classes/fixedwindowstore/)
- [`SlidingWindowStore`](/api/ratelimit-core/src/classes/slidingwindowstore/)
- [`TokenBucketStore`](/api/ratelimit-core/src/classes/tokenbucketstore/)

## Constructors

### Constructor

> **new DistributedRateLimitStore**(): `DistributedRateLimitStore`

#### Returns

`DistributedRateLimitStore`

#### Inherited from

[`RateLimitStore`](/api/ratelimit-core/src/classes/ratelimitstore/).[`constructor`](/api/ratelimit-core/src/classes/ratelimitstore/#constructor)

## Methods

### check()

> `abstract` **check**(`key`, `policy`): `Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

Defined in: [packages/ratelimit-core/src/libs/RateLimitStore.ts:31](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/RateLimitStore.ts#L31)

#### Parameters

##### key

`string`

##### policy

[`RateLimitPolicy`](/api/ratelimit-core/src/type-aliases/ratelimitpolicy/)

#### Returns

`Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

#### Inherited from

[`RateLimitStore`](/api/ratelimit-core/src/classes/ratelimitstore/).[`check`](/api/ratelimit-core/src/classes/ratelimitstore/#check)

***

### expire()

> `abstract` **expire**(`key`, `ttlMs`): `Promise`\<`void`\>

Defined in: [packages/ratelimit-core/src/libs/RateLimitStore.ts:40](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/RateLimitStore.ts#L40)

#### Parameters

##### key

`string`

##### ttlMs

`number`

#### Returns

`Promise`\<`void`\>

***

### getCount()

> `abstract` **getCount**(`key`): `Promise`\<`number`\>

Defined in: [packages/ratelimit-core/src/libs/RateLimitStore.ts:38](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/RateLimitStore.ts#L38)

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`number`\>

***

### getStats()

> `abstract` **getStats**(`key?`): `Promise`\<[`RateLimitStats`](/api/ratelimit-core/src/type-aliases/ratelimitstats/)\>

Defined in: [packages/ratelimit-core/src/libs/RateLimitStore.ts:32](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/RateLimitStore.ts#L32)

#### Parameters

##### key?

`string`

#### Returns

`Promise`\<[`RateLimitStats`](/api/ratelimit-core/src/type-aliases/ratelimitstats/)\>

#### Inherited from

[`RateLimitStore`](/api/ratelimit-core/src/classes/ratelimitstore/).[`getStats`](/api/ratelimit-core/src/classes/ratelimitstore/#getstats)

***

### increment()

> `abstract` **increment**(`key`, `amount?`): `Promise`\<`number`\>

Defined in: [packages/ratelimit-core/src/libs/RateLimitStore.ts:37](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/RateLimitStore.ts#L37)

#### Parameters

##### key

`string`

##### amount?

`number`

#### Returns

`Promise`\<`number`\>

***

### pruneExpired()

> `abstract` **pruneExpired**(): `Promise`\<`number`\>

Defined in: [packages/ratelimit-core/src/libs/RateLimitStore.ts:33](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/RateLimitStore.ts#L33)

#### Returns

`Promise`\<`number`\>

#### Inherited from

[`RateLimitStore`](/api/ratelimit-core/src/classes/ratelimitstore/).[`pruneExpired`](/api/ratelimit-core/src/classes/ratelimitstore/#pruneexpired)

***

### reset()

> `abstract` **reset**(`key`): `Promise`\<`void`\>

Defined in: [packages/ratelimit-core/src/libs/RateLimitStore.ts:39](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/ratelimit-core/src/libs/RateLimitStore.ts#L39)

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

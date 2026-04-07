---
editUrl: false
next: false
prev: false
title: "SlidingWindowStore"
---

Defined in: [packages/ratelimit-core/src/libs/RateLimitStore.ts:75](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/RateLimitStore.ts#L75)

## Extends

- [`DistributedRateLimitStore`](/api/ratelimit-core/src/classes/distributedratelimitstore/)

## Extended by

- [`SlidingWindowInMemoryStore`](/api/ratelimit-core/src/classes/slidingwindowinmemorystore/)

## Constructors

### Constructor

> **new SlidingWindowStore**(): `SlidingWindowStore`

#### Returns

`SlidingWindowStore`

#### Inherited from

[`DistributedRateLimitStore`](/api/ratelimit-core/src/classes/distributedratelimitstore/).[`constructor`](/api/ratelimit-core/src/classes/distributedratelimitstore/#constructor)

## Methods

### check()

> `abstract` **check**(`key`, `policy`): `Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

Defined in: [packages/ratelimit-core/src/libs/RateLimitStore.ts:31](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/RateLimitStore.ts#L31)

#### Parameters

##### key

`string`

##### policy

[`RateLimitPolicy`](/api/ratelimit-core/src/type-aliases/ratelimitpolicy/)

#### Returns

`Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

#### Inherited from

[`DistributedRateLimitStore`](/api/ratelimit-core/src/classes/distributedratelimitstore/).[`check`](/api/ratelimit-core/src/classes/distributedratelimitstore/#check)

***

### checkSlidingWindow()

> **checkSlidingWindow**(`key`, `policy`): `Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

Defined in: [packages/ratelimit-core/src/libs/RateLimitStore.ts:80](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/RateLimitStore.ts#L80)

#### Parameters

##### key

`string`

##### policy

[`SlidingWindowPolicy`](/api/ratelimit-core/src/type-aliases/slidingwindowpolicy/)

#### Returns

`Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

***

### expire()

> `abstract` **expire**(`key`, `ttlMs`): `Promise`\<`void`\>

Defined in: [packages/ratelimit-core/src/libs/RateLimitStore.ts:40](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/RateLimitStore.ts#L40)

#### Parameters

##### key

`string`

##### ttlMs

`number`

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`DistributedRateLimitStore`](/api/ratelimit-core/src/classes/distributedratelimitstore/).[`expire`](/api/ratelimit-core/src/classes/distributedratelimitstore/#expire)

***

### getCount()

> `abstract` **getCount**(`key`): `Promise`\<`number`\>

Defined in: [packages/ratelimit-core/src/libs/RateLimitStore.ts:38](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/RateLimitStore.ts#L38)

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`number`\>

#### Inherited from

[`DistributedRateLimitStore`](/api/ratelimit-core/src/classes/distributedratelimitstore/).[`getCount`](/api/ratelimit-core/src/classes/distributedratelimitstore/#getcount)

***

### getStats()

> `abstract` **getStats**(`key?`): `Promise`\<[`RateLimitStats`](/api/ratelimit-core/src/type-aliases/ratelimitstats/)\>

Defined in: [packages/ratelimit-core/src/libs/RateLimitStore.ts:32](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/RateLimitStore.ts#L32)

#### Parameters

##### key?

`string`

#### Returns

`Promise`\<[`RateLimitStats`](/api/ratelimit-core/src/type-aliases/ratelimitstats/)\>

#### Inherited from

[`DistributedRateLimitStore`](/api/ratelimit-core/src/classes/distributedratelimitstore/).[`getStats`](/api/ratelimit-core/src/classes/distributedratelimitstore/#getstats)

***

### increment()

> `abstract` **increment**(`key`, `amount?`): `Promise`\<`number`\>

Defined in: [packages/ratelimit-core/src/libs/RateLimitStore.ts:37](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/RateLimitStore.ts#L37)

#### Parameters

##### key

`string`

##### amount?

`number`

#### Returns

`Promise`\<`number`\>

#### Inherited from

[`DistributedRateLimitStore`](/api/ratelimit-core/src/classes/distributedratelimitstore/).[`increment`](/api/ratelimit-core/src/classes/distributedratelimitstore/#increment)

***

### pruneExpired()

> `abstract` **pruneExpired**(): `Promise`\<`number`\>

Defined in: [packages/ratelimit-core/src/libs/RateLimitStore.ts:33](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/RateLimitStore.ts#L33)

#### Returns

`Promise`\<`number`\>

#### Inherited from

[`DistributedRateLimitStore`](/api/ratelimit-core/src/classes/distributedratelimitstore/).[`pruneExpired`](/api/ratelimit-core/src/classes/distributedratelimitstore/#pruneexpired)

***

### reset()

> `abstract` **reset**(`key`): `Promise`\<`void`\>

Defined in: [packages/ratelimit-core/src/libs/RateLimitStore.ts:39](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/RateLimitStore.ts#L39)

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`DistributedRateLimitStore`](/api/ratelimit-core/src/classes/distributedratelimitstore/).[`reset`](/api/ratelimit-core/src/classes/distributedratelimitstore/#reset)

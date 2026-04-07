---
editUrl: false
next: false
prev: false
title: "TokenBucketInMemoryStore"
---

Defined in: [packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts:190](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts#L190)

## Extends

- [`TokenBucketStore`](/api/ratelimit-core/src/classes/tokenbucketstore/)

## Constructors

### Constructor

> **new TokenBucketInMemoryStore**(): `TokenBucketInMemoryStore`

#### Returns

`TokenBucketInMemoryStore`

#### Inherited from

[`TokenBucketStore`](/api/ratelimit-core/src/classes/tokenbucketstore/).[`constructor`](/api/ratelimit-core/src/classes/tokenbucketstore/#constructor)

## Methods

### check()

> **check**(`key`, `policy`): `Promise`\<\{ `limit`: `number`; `remaining`: `number`; `resetAtMs`: `number`; `success`: `boolean`; \}\>

Defined in: [packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts:194](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts#L194)

#### Parameters

##### key

`string`

##### policy

[`TokenBucketPolicy`](/api/ratelimit-core/src/type-aliases/tokenbucketpolicy/)

#### Returns

`Promise`\<\{ `limit`: `number`; `remaining`: `number`; `resetAtMs`: `number`; `success`: `boolean`; \}\>

#### Overrides

[`TokenBucketStore`](/api/ratelimit-core/src/classes/tokenbucketstore/).[`check`](/api/ratelimit-core/src/classes/tokenbucketstore/#check)

***

### checkTokenBucket()

> **checkTokenBucket**(`key`, `policy`): `Promise`\<[`RateLimitResult`](/api/ratelimit-core/src/type-aliases/ratelimitresult/)\>

Defined in: [packages/ratelimit-core/src/libs/RateLimitStore.ts:110](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/RateLimitStore.ts#L110)

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

### expire()

> **expire**(): `Promise`\<`void`\>

Defined in: [packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts:235](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts#L235)

#### Returns

`Promise`\<`void`\>

#### Overrides

[`TokenBucketStore`](/api/ratelimit-core/src/classes/tokenbucketstore/).[`expire`](/api/ratelimit-core/src/classes/tokenbucketstore/#expire)

***

### getCount()

> **getCount**(): `Promise`\<`number`\>

Defined in: [packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts:227](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts#L227)

#### Returns

`Promise`\<`number`\>

#### Overrides

[`TokenBucketStore`](/api/ratelimit-core/src/classes/tokenbucketstore/).[`getCount`](/api/ratelimit-core/src/classes/tokenbucketstore/#getcount)

***

### getStats()

> **getStats**(): `Promise`\<\{ `allowed`: `number`; `denied`: `number`; `total`: `number`; \}\>

Defined in: [packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts:244](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts#L244)

#### Returns

`Promise`\<\{ `allowed`: `number`; `denied`: `number`; `total`: `number`; \}\>

#### Overrides

[`TokenBucketStore`](/api/ratelimit-core/src/classes/tokenbucketstore/).[`getStats`](/api/ratelimit-core/src/classes/tokenbucketstore/#getstats)

***

### increment()

> **increment**(): `Promise`\<`number`\>

Defined in: [packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts:223](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts#L223)

#### Returns

`Promise`\<`number`\>

#### Overrides

[`TokenBucketStore`](/api/ratelimit-core/src/classes/tokenbucketstore/).[`increment`](/api/ratelimit-core/src/classes/tokenbucketstore/#increment)

***

### pruneExpired()

> **pruneExpired**(): `Promise`\<`number`\>

Defined in: [packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts:239](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts#L239)

#### Returns

`Promise`\<`number`\>

#### Overrides

[`TokenBucketStore`](/api/ratelimit-core/src/classes/tokenbucketstore/).[`pruneExpired`](/api/ratelimit-core/src/classes/tokenbucketstore/#pruneexpired)

***

### reset()

> **reset**(): `Promise`\<`void`\>

Defined in: [packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts:231](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/ratelimit-core/src/libs/InMemoryRateLimitStore.ts#L231)

#### Returns

`Promise`\<`void`\>

#### Overrides

[`TokenBucketStore`](/api/ratelimit-core/src/classes/tokenbucketstore/).[`reset`](/api/ratelimit-core/src/classes/tokenbucketstore/#reset)

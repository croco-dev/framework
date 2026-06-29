---
editUrl: false
next: false
prev: false
title: "DistributedCacheStore"
---

Backward-compatible cache store base class.

## Extends

- [`CacheStore`](/api/cache-core/src/classes/cachestore/)\<`K`, `V`\>

## Type Parameters

### K

`K` *extends* `string` = `string`

### V

`V` = `unknown`

## Constructors

### Constructor

> **new DistributedCacheStore**\<`K`, `V`\>(): `DistributedCacheStore`\<`K`, `V`\>

#### Returns

`DistributedCacheStore`\<`K`, `V`\>

#### Inherited from

[`CacheStore`](/api/cache-core/src/classes/cachestore/).[`constructor`](/api/cache-core/src/classes/cachestore/#constructor)

## Methods

### acquireLock()

> `abstract` **acquireLock**(`key`, `ttlMs`): `Promise`\<[`DistributedCacheLock`](/api/cache-core/src/type-aliases/distributedcachelock/) \| `undefined`\>

#### Parameters

##### key

`K`

##### ttlMs

`number`

#### Returns

`Promise`\<[`DistributedCacheLock`](/api/cache-core/src/type-aliases/distributedcachelock/) \| `undefined`\>

***

### clear()

> `abstract` **clear**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`CacheStore`](/api/cache-core/src/classes/cachestore/).[`clear`](/api/cache-core/src/classes/cachestore/#clear)

***

### delete()

> `abstract` **delete**(`key`): `Promise`\<`void`\>

#### Parameters

##### key

`K`

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`CacheStore`](/api/cache-core/src/classes/cachestore/).[`delete`](/api/cache-core/src/classes/cachestore/#delete)

***

### get()

> `abstract` **get**(`key`): `Promise`\<`V` \| `undefined`\>

#### Parameters

##### key

`K`

#### Returns

`Promise`\<`V` \| `undefined`\>

#### Inherited from

[`CacheStore`](/api/cache-core/src/classes/cachestore/).[`get`](/api/cache-core/src/classes/cachestore/#get)

***

### getOrSet()

> `abstract` **getOrSet**(`key`, `loader`, `options?`): `Promise`\<`V` \| `undefined`\>

#### Parameters

##### key

`K`

##### loader

() => `Promise`\<`V` \| `undefined`\>

##### options?

[`CacheGetOrSetOptions`](/api/cache-core/src/type-aliases/cachegetorsetoptions/)

#### Returns

`Promise`\<`V` \| `undefined`\>

#### Inherited from

[`CacheStore`](/api/cache-core/src/classes/cachestore/).[`getOrSet`](/api/cache-core/src/classes/cachestore/#getorset)

***

### getStats()

> `abstract` **getStats**(): [`CacheStats`](/api/cache-core/src/type-aliases/cachestats/)

#### Returns

[`CacheStats`](/api/cache-core/src/type-aliases/cachestats/)

#### Inherited from

[`CacheStore`](/api/cache-core/src/classes/cachestore/).[`getStats`](/api/cache-core/src/classes/cachestore/#getstats)

***

### has()

> `abstract` **has**(`key`): `Promise`\<`boolean`\>

#### Parameters

##### key

`K`

#### Returns

`Promise`\<`boolean`\>

#### Inherited from

[`CacheStore`](/api/cache-core/src/classes/cachestore/).[`has`](/api/cache-core/src/classes/cachestore/#has)

***

### invalidatePattern()

> `abstract` **invalidatePattern**(`pattern`): `Promise`\<`number`\>

#### Parameters

##### pattern

`string`

#### Returns

`Promise`\<`number`\>

#### Inherited from

[`CacheStore`](/api/cache-core/src/classes/cachestore/).[`invalidatePattern`](/api/cache-core/src/classes/cachestore/#invalidatepattern)

***

### pruneExpired()

> `abstract` **pruneExpired**(): `Promise`\<`number`\>

#### Returns

`Promise`\<`number`\>

#### Inherited from

[`CacheStore`](/api/cache-core/src/classes/cachestore/).[`pruneExpired`](/api/cache-core/src/classes/cachestore/#pruneexpired)

***

### publishInvalidation()

> `abstract` **publishInvalidation**(`pattern`): `Promise`\<`void`\>

#### Parameters

##### pattern

`string`

#### Returns

`Promise`\<`void`\>

***

### set()

> `abstract` **set**(`key`, `value`, `ttlMs?`): `Promise`\<`void`\>

#### Parameters

##### key

`K`

##### value

`V`

##### ttlMs?

`number`

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`CacheStore`](/api/cache-core/src/classes/cachestore/).[`set`](/api/cache-core/src/classes/cachestore/#set)

***

### warmup()

> `abstract` **warmup**(`entries`): `Promise`\<`void`\>

#### Parameters

##### entries

readonly [`CacheWarmupEntry`](/api/cache-core/src/type-aliases/cachewarmupentry/)\<`K`, `V`\>[]

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`CacheStore`](/api/cache-core/src/classes/cachestore/).[`warmup`](/api/cache-core/src/classes/cachestore/#warmup)

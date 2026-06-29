---
editUrl: false
next: false
prev: false
title: "CacheStore"
---

Backward-compatible cache store base class.

## Extends

- [`Cache`](/api/cache-core/src/classes/cache/)\<`K`, `V`\>

## Extended by

- [`DistributedCacheStore`](/api/cache-core/src/classes/distributedcachestore/)
- [`InMemoryCacheStore`](/api/cache-core/src/classes/inmemorycachestore/)

## Type Parameters

### K

`K` *extends* `string` = `string`

### V

`V` = `unknown`

## Constructors

### Constructor

> **new CacheStore**\<`K`, `V`\>(): `CacheStore`\<`K`, `V`\>

#### Returns

`CacheStore`\<`K`, `V`\>

#### Inherited from

[`Cache`](/api/cache-core/src/classes/cache/).[`constructor`](/api/cache-core/src/classes/cache/#constructor)

## Methods

### clear()

> `abstract` **clear**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`Cache`](/api/cache-core/src/classes/cache/).[`clear`](/api/cache-core/src/classes/cache/#clear)

***

### delete()

> `abstract` **delete**(`key`): `Promise`\<`void`\>

#### Parameters

##### key

`K`

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`Cache`](/api/cache-core/src/classes/cache/).[`delete`](/api/cache-core/src/classes/cache/#delete)

***

### get()

> `abstract` **get**(`key`): `Promise`\<`V` \| `undefined`\>

#### Parameters

##### key

`K`

#### Returns

`Promise`\<`V` \| `undefined`\>

#### Inherited from

[`Cache`](/api/cache-core/src/classes/cache/).[`get`](/api/cache-core/src/classes/cache/#get)

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

[`Cache`](/api/cache-core/src/classes/cache/).[`getOrSet`](/api/cache-core/src/classes/cache/#getorset)

***

### getStats()

> `abstract` **getStats**(): [`CacheStats`](/api/cache-core/src/type-aliases/cachestats/)

#### Returns

[`CacheStats`](/api/cache-core/src/type-aliases/cachestats/)

#### Inherited from

[`Cache`](/api/cache-core/src/classes/cache/).[`getStats`](/api/cache-core/src/classes/cache/#getstats)

***

### has()

> `abstract` **has**(`key`): `Promise`\<`boolean`\>

#### Parameters

##### key

`K`

#### Returns

`Promise`\<`boolean`\>

#### Inherited from

[`Cache`](/api/cache-core/src/classes/cache/).[`has`](/api/cache-core/src/classes/cache/#has)

***

### invalidatePattern()

> `abstract` **invalidatePattern**(`pattern`): `Promise`\<`number`\>

#### Parameters

##### pattern

`string`

#### Returns

`Promise`\<`number`\>

#### Inherited from

[`Cache`](/api/cache-core/src/classes/cache/).[`invalidatePattern`](/api/cache-core/src/classes/cache/#invalidatepattern)

***

### pruneExpired()

> `abstract` **pruneExpired**(): `Promise`\<`number`\>

#### Returns

`Promise`\<`number`\>

#### Inherited from

[`Cache`](/api/cache-core/src/classes/cache/).[`pruneExpired`](/api/cache-core/src/classes/cache/#pruneexpired)

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

[`Cache`](/api/cache-core/src/classes/cache/).[`set`](/api/cache-core/src/classes/cache/#set)

***

### warmup()

> `abstract` **warmup**(`entries`): `Promise`\<`void`\>

#### Parameters

##### entries

readonly [`CacheWarmupEntry`](/api/cache-core/src/type-aliases/cachewarmupentry/)\<`K`, `V`\>[]

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`Cache`](/api/cache-core/src/classes/cache/).[`warmup`](/api/cache-core/src/classes/cache/#warmup)

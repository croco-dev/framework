---
editUrl: false
next: false
prev: false
title: "InMemoryCacheStore"
---

Backward-compatible cache store base class.

## Extends

- [`CacheStore`](/api/cache-core/src/classes/cachestore/)\<`string`, `V`\>

## Type Parameters

### V

`V` = `unknown`

## Constructors

### Constructor

> **new InMemoryCacheStore**\<`V`\>(`options?`, `logger?`): `InMemoryCacheStore`\<`V`\>

#### Parameters

##### options?

[`InMemoryCacheStoreOptions`](/api/cache-core/src/type-aliases/inmemorycachestoreoptions/) = `...`

##### logger?

[`ILogger`](/api/framework-context/src/interfaces/ilogger/)

#### Returns

`InMemoryCacheStore`\<`V`\>

#### Overrides

[`CacheStore`](/api/cache-core/src/classes/cachestore/).[`constructor`](/api/cache-core/src/classes/cachestore/#constructor)

## Methods

### clear()

> **clear**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Overrides

[`CacheStore`](/api/cache-core/src/classes/cachestore/).[`clear`](/api/cache-core/src/classes/cachestore/#clear)

***

### close()

> **close**(): `void`

#### Returns

`void`

***

### delete()

> **delete**(`key`): `Promise`\<`void`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`CacheStore`](/api/cache-core/src/classes/cachestore/).[`delete`](/api/cache-core/src/classes/cachestore/#delete)

***

### get()

> **get**(`key`): `Promise`\<`V` \| `undefined`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`V` \| `undefined`\>

#### Overrides

[`CacheStore`](/api/cache-core/src/classes/cachestore/).[`get`](/api/cache-core/src/classes/cachestore/#get)

***

### getOrSet()

> **getOrSet**(`key`, `loader`, `options?`): `Promise`\<`V` \| `undefined`\>

#### Parameters

##### key

`string`

##### loader

() => `Promise`\<`V` \| `undefined`\>

##### options?

[`CacheGetOrSetOptions`](/api/cache-core/src/type-aliases/cachegetorsetoptions/) = `{}`

#### Returns

`Promise`\<`V` \| `undefined`\>

#### Overrides

[`CacheStore`](/api/cache-core/src/classes/cachestore/).[`getOrSet`](/api/cache-core/src/classes/cachestore/#getorset)

***

### getStats()

> **getStats**(): [`CacheStats`](/api/cache-core/src/type-aliases/cachestats/)

#### Returns

[`CacheStats`](/api/cache-core/src/type-aliases/cachestats/)

#### Overrides

[`CacheStore`](/api/cache-core/src/classes/cachestore/).[`getStats`](/api/cache-core/src/classes/cachestore/#getstats)

***

### has()

> **has**(`key`): `Promise`\<`boolean`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`boolean`\>

#### Overrides

[`CacheStore`](/api/cache-core/src/classes/cachestore/).[`has`](/api/cache-core/src/classes/cachestore/#has)

***

### invalidatePattern()

> **invalidatePattern**(`pattern`): `Promise`\<`number`\>

#### Parameters

##### pattern

`string`

#### Returns

`Promise`\<`number`\>

#### Overrides

[`CacheStore`](/api/cache-core/src/classes/cachestore/).[`invalidatePattern`](/api/cache-core/src/classes/cachestore/#invalidatepattern)

***

### pruneExpired()

> **pruneExpired**(): `Promise`\<`number`\>

#### Returns

`Promise`\<`number`\>

#### Overrides

[`CacheStore`](/api/cache-core/src/classes/cachestore/).[`pruneExpired`](/api/cache-core/src/classes/cachestore/#pruneexpired)

***

### set()

> **set**(`key`, `value`, `ttlMs?`): `Promise`\<`void`\>

#### Parameters

##### key

`string`

##### value

`V`

##### ttlMs?

`number`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`CacheStore`](/api/cache-core/src/classes/cachestore/).[`set`](/api/cache-core/src/classes/cachestore/#set)

***

### warmup()

> **warmup**(`entries`): `Promise`\<`void`\>

#### Parameters

##### entries

readonly [`CacheWarmupEntry`](/api/cache-core/src/type-aliases/cachewarmupentry/)\<`string`, `V`\>[]

#### Returns

`Promise`\<`void`\>

#### Overrides

[`CacheStore`](/api/cache-core/src/classes/cachestore/).[`warmup`](/api/cache-core/src/classes/cachestore/#warmup)

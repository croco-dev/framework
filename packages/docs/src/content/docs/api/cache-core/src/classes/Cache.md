---
editUrl: false
next: false
prev: false
title: "Cache"
---

Generic cache contract.

## Extended by

- [`CacheStore`](/api/cache-core/src/classes/cachestore/)

## Type Parameters

### K

`K` *extends* `string` = `string`

### V

`V` = `unknown`

## Constructors

### Constructor

> **new Cache**\<`K`, `V`\>(): `Cache`\<`K`, `V`\>

#### Returns

`Cache`\<`K`, `V`\>

## Methods

### clear()

> `abstract` **clear**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### delete()

> `abstract` **delete**(`key`): `Promise`\<`void`\>

#### Parameters

##### key

`K`

#### Returns

`Promise`\<`void`\>

***

### get()

> `abstract` **get**(`key`): `Promise`\<`V` \| `undefined`\>

#### Parameters

##### key

`K`

#### Returns

`Promise`\<`V` \| `undefined`\>

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

***

### getStats()

> `abstract` **getStats**(): [`CacheStats`](/api/cache-core/src/type-aliases/cachestats/)

#### Returns

[`CacheStats`](/api/cache-core/src/type-aliases/cachestats/)

***

### has()

> `abstract` **has**(`key`): `Promise`\<`boolean`\>

#### Parameters

##### key

`K`

#### Returns

`Promise`\<`boolean`\>

***

### invalidatePattern()

> `abstract` **invalidatePattern**(`pattern`): `Promise`\<`number`\>

#### Parameters

##### pattern

`string`

#### Returns

`Promise`\<`number`\>

***

### pruneExpired()

> `abstract` **pruneExpired**(): `Promise`\<`number`\>

#### Returns

`Promise`\<`number`\>

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

***

### warmup()

> `abstract` **warmup**(`entries`): `Promise`\<`void`\>

#### Parameters

##### entries

readonly [`CacheWarmupEntry`](/api/cache-core/src/type-aliases/cachewarmupentry/)\<`K`, `V`\>[]

#### Returns

`Promise`\<`void`\>

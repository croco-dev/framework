---
editUrl: false
next: false
prev: false
title: "CacheInvalidationAdapter"
---

> **CacheInvalidationAdapter** = `object`

## Properties

### capabilities

> `readonly` **capabilities**: [`CacheInvalidationAdapterCapabilities`](/api/cache-core/src/type-aliases/cacheinvalidationadaptercapabilities/)

***

### invalidateKey?

> `readonly` `optional` **invalidateKey?**: (`key`) => `Promise`\<[`CacheInvalidationAdapterOperationResult`](/api/cache-core/src/type-aliases/cacheinvalidationadapteroperationresult/) \| `void`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<[`CacheInvalidationAdapterOperationResult`](/api/cache-core/src/type-aliases/cacheinvalidationadapteroperationresult/) \| `void`\>

***

### invalidatePattern?

> `readonly` `optional` **invalidatePattern?**: (`pattern`) => `Promise`\<[`CacheInvalidationAdapterOperationResult`](/api/cache-core/src/type-aliases/cacheinvalidationadapteroperationresult/) \| `void`\>

#### Parameters

##### pattern

[`CachePattern`](/api/cache-core/src/type-aliases/cachepattern/)

#### Returns

`Promise`\<[`CacheInvalidationAdapterOperationResult`](/api/cache-core/src/type-aliases/cacheinvalidationadapteroperationresult/) \| `void`\>

***

### invalidateTag?

> `readonly` `optional` **invalidateTag?**: (`tag`) => `Promise`\<[`CacheInvalidationAdapterOperationResult`](/api/cache-core/src/type-aliases/cacheinvalidationadapteroperationresult/) \| `void`\>

#### Parameters

##### tag

`string`

#### Returns

`Promise`\<[`CacheInvalidationAdapterOperationResult`](/api/cache-core/src/type-aliases/cacheinvalidationadapteroperationresult/) \| `void`\>

***

### name?

> `readonly` `optional` **name?**: `string`

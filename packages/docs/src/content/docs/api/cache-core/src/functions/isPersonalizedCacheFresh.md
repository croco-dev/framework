---
editUrl: false
next: false
prev: false
title: "isPersonalizedCacheFresh"
---

> **isPersonalizedCacheFresh**(`input`, `freshness`): `object`

## Parameters

### input

#### cachedAtMs

`number`

#### dependencies

readonly [`PersonalizedCacheDependency`](/api/cache-core/src/type-aliases/personalizedcachedependency/)[]

#### domain?

`string`

#### expectedDependencies

readonly [`PersonalizedCacheDependency`](/api/cache-core/src/type-aliases/personalizedcachedependency/)[]

#### expectedRevision

`string`

#### nowMs

`number`

#### revision

`string`

### freshness

[`PersonalizedCacheFreshnessPolicy`](/api/cache-core/src/type-aliases/personalizedcachefreshnesspolicy/)

## Returns

`object`

### fresh

> `readonly` **fresh**: `boolean`

### reason

> `readonly` **reason**: `string`

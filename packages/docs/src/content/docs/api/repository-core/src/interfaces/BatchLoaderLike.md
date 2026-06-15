---
editUrl: false
next: false
prev: false
title: "BatchLoaderLike"
---

Batch loader interface for loading multiple values in a single batch.

## Type Parameters

### K

`K`

The key type

### V

`V`

The value type

## Methods

### load()

> **load**(`key`): `Promise`\<`V`\>

Load a single value by key.

#### Parameters

##### key

`K`

The key to load

#### Returns

`Promise`\<`V`\>

The value if found, null otherwise

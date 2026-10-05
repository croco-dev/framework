---
editUrl: false
next: false
prev: false
title: "BatchLoaderFactoryOptions"
---

> **BatchLoaderFactoryOptions**\<`K`, `V`\> = `object`

Options for creating a batch loader.

## Type Parameters

### K

`K`

The key type

### V

`V`

The value type

## Properties

### batchFn

> **batchFn**: (`keys`) => `Promise`\<`ReadonlyArray`\<`V` \| `Error` \| `null`\>\>

The batch function that loads multiple keys at once.

#### Parameters

##### keys

`ReadonlyArray`\<`K`\>

The keys to load

#### Returns

`Promise`\<`ReadonlyArray`\<`V` \| `Error` \| `null`\>\>

Array of values (may contain nulls or Errors for partial failures)

---

### name

> **name**: `string`

The name of the loader (used for caching and debugging).

Within one request, every `create()` call with the same name retrieves the
loader built by the first call, regardless of the `batchFn` passed later.
Direct callers must therefore pass the same `batchFn` for a shared name, or
use a unique name (or scope, where supported) per batch function. Passing a
different `batchFn` under an already-used name does not fail: the first
loader keeps serving its own data.

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

Within one request, every `create()` call with the same name shares one
request loader, but installation timing and `batchFn` selection depend
on the implementation. `BatchLoaderFactory` installs the loader when the
wrapper whose `load()` (or `loadMany()`/`clear()`/`clearAll()`/`prime()`)
first touches the request cache runs, and the other wrapper delegates to
that loader from then on. A different `batchFn` passed by another
same-name call is therefore ignored once a loader is installed. Callers
using `BatchLoaderFactory` must pass the same `batchFn` for a shared
name, or use a unique name (or scope, where supported) per batch
function. Sharing a name across different `batchFn`s does not fail:
the installed loader keeps serving its own data.

---
editUrl: false
next: false
prev: false
title: "BatchLoaderOptions"
---

> **BatchLoaderOptions**\<`K`, `V`\> = `object`

Configuration options for creating a batch loader.

## Description

Defines the configuration for a batch loader including the batch function,
caching behavior, and scoping options.

## Example

```typescript
const options: BatchLoaderOptions<string, User> = {
  name: 'users',
  batchFn: async (ids) => await fetchUsers(ids),
  maxBatchSize: 100,
  cache: true,
  scope: 'tenant-123',
};
```

## Type Parameters

### K

`K`

The type of keys

### V

`V`

The type of loaded values

## Properties

### batchFn

> **batchFn**: [`BatchFn`](/api/dataloader-core/src/type-aliases/batchfn/)\<`K`, `V`\>

Function that batches multiple keys into a single load operation

***

### cache?

> `optional` **cache**: `boolean`

Optional flag to enable/disable result caching (default: true)

***

### maxBatchSize?

> `optional` **maxBatchSize**: `number`

Optional maximum number of items per batch (default: Infinity)

***

### name

> **name**: `string`

Unique identifier for caching the loader in request context

***

### resolveScope()?

> `optional` **resolveScope**: () => `string` \| `null` \| `undefined`

Optional function for dynamic scope resolution (e.g., transaction ID)

#### Returns

`string` \| `null` \| `undefined`

***

### scope?

> `optional` **scope**: `string`

Optional static scope for cache isolation (e.g., tenant ID)

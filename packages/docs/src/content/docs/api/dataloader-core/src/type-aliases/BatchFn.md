---
editUrl: false
next: false
prev: false
title: "BatchFn"
---

> **BatchFn**\<`K`, `V`\> = (`keys`) => `Promise`\<`ReadonlyArray`\<`V` \| `Error` \| `null`\>\>

Configuration options for creating a batch loader.

## Type Parameters

### K

`K`

The type of keys

### V

`V`

The type of loaded values

## Parameters

### keys

`ReadonlyArray`\<`K`\>

## Returns

`Promise`\<`ReadonlyArray`\<`V` \| `Error` \| `null`\>\>

## Description

Defines the configuration for a batch loader including the batch function,
caching behavior, and scoping options.

## Example

```typescript
const options: BatchLoaderOptions<string, User> = {
  name: "users",
  batchFn: async (ids) => await fetchUsers(ids),
  maxBatchSize: 100,
  cache: true,
  scope: "tenant-123",
};
```

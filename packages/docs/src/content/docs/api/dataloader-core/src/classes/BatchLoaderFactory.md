---
editUrl: false
next: false
prev: false
title: "BatchLoaderFactory"
---

Creates a request-scoped batch loader.

The returned loader automatically batches individual load calls into a single batch
request, and caches results per request context. This is especially useful for
resolving the N+1 query problem in GraphQL or other data-fetching scenarios.

## Description

The loader is scoped to the current request context using AsyncLocalStorage.
Within a request, multiple load calls are automatically batched, and results
are cached to avoid redundant batch requests.

## Template

**K**

The type of keys (e.g., string ID, composite key)

## Template

**V**

The type of loaded values

## Param

**options**

Configuration options for the batch loader

## Param

**options.name**

Unique name for caching the loader instance in request context

## Param

**options.batchFn**

Function that loads data for multiple keys at once

## Param

**options.maxBatchSize**

Maximum items per batch; must be a positive safe integer or Infinity
(default: Infinity)

## Param

**options.cache**

Whether to cache results (default: true)

## Param

**options.scope**

Static scope for cache isolation (e.g., tenantId)

## Param

**options.resolveScope**

Dynamic scope function for transaction-aware caching

## Examples

```typescript
// Basic usage with database IDs
const loader = createBatchLoader<User, string>({
  name: 'users',
  batchFn: async (ids) => {
    const users = await db.users.findByIds(ids);
    return ids.map(id => users.get(id) ?? null);
  },
});

const user = await loader.load('user-123');
```

```typescript
// With transaction-aware scoping
const orderLoader = createBatchLoader<Order, string>({
  name: 'orders',
  batchFn: async (ids) => await fetchOrders(ids),
  resolveScope: () => TransactionContext.get()?.id,
});
```

## Implements

- [`IBatchLoaderFactory`](/api/repository-core/src/interfaces/ibatchloaderfactory/)

## Constructors

### Constructor

> **new BatchLoaderFactory**(): `BatchLoaderFactory`

#### Returns

`BatchLoaderFactory`

## Methods

### create()

> **create**\<`K`, `V`\>(`options`): [`BatchLoaderLike`](/api/repository-core/src/interfaces/batchloaderlike/)\<`K`, `V`\>

Create or retrieve a context-scoped batch loader.

#### Type Parameters

##### K

`K`

##### V

`V`

#### Parameters

##### options

[`BatchLoaderFactoryOptions`](/api/repository-core/src/type-aliases/batchloaderfactoryoptions/)\<`K`, `V`\>

The loader options

#### Returns

[`BatchLoaderLike`](/api/repository-core/src/interfaces/batchloaderlike/)\<`K`, `V`\>

A batch loader instance

#### Implementation of

[`IBatchLoaderFactory`](/api/repository-core/src/interfaces/ibatchloaderfactory/).[`create`](/api/repository-core/src/interfaces/ibatchloaderfactory/#create)

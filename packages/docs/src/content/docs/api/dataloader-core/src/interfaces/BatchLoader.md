---
editUrl: false
next: false
prev: false
title: "BatchLoader"
---

Configuration options for creating a batch loader.

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

## Type Parameters

### K

`K`

The type of keys

### V

`V`

The type of loaded values

## Methods

### clear()

> **clear**(`key`): `void`

#### Parameters

##### key

`K`

#### Returns

`void`

---

### clearAll()

> **clearAll**(): `void`

#### Returns

`void`

---

### load()

> **load**(`key`): `Promise`\<`V` \| `null`\>

#### Parameters

##### key

`K`

#### Returns

`Promise`\<`V` \| `null`\>

---

### loadMany()

> **loadMany**(`keys`): `Promise`\<(`Error` \| `V` \| `null`)[]\>

#### Parameters

##### keys

`K`[]

#### Returns

`Promise`\<(`Error` \| `V` \| `null`)[]\>

---

### prime()

> **prime**(`key`, `value`): `void`

#### Parameters

##### key

`K`

##### value

`Error` \| `V`

#### Returns

`void`

---
editUrl: false
next: false
prev: false
title: "ReadRepository"
---

Read-only repository contract for querying entities.

## Example

```typescript
interface User {
  id: string;
  name: string;
}

class UserRepository implements ReadRepository<User, string> {
  async findById(id: string): Promise<User | null> {
    // Fetch from database
  }

  async findByIds(ids: readonly string[]): Promise<ReadonlyArray<User>> {
    // Batch fetch
  }
}
```

## Extended by

- [`Repository`](/api/repository-core/src/interfaces/repository/)

## Type Parameters

### T

`T`

The entity type this repository manages

### ID

`ID`

The ID type (e.g., string, number, or a custom ID class)

## Methods

### findById()

> **findById**(`id`): `Promise`\<`T` \| `null`\>

Find a single entity by its ID.

#### Parameters

##### id

`ID`

The entity ID

#### Returns

`Promise`\<`T` \| `null`\>

The entity if found, null otherwise

***

### findByIds()

> **findByIds**(`ids`): `Promise`\<readonly `T`[]\>

Find multiple entities by their IDs.

#### Parameters

##### ids

readonly `ID`[]

Array of entity IDs

#### Returns

`Promise`\<readonly `T`[]\>

Array of entities (may be empty or contain nulls)

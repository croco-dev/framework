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

  async findByIds(
    ids: readonly string[],
  ): Promise<ReadonlyArray<KeyedRepositoryResult<string, User>>> {
    const users = await this.fetchUsers(ids);
    return users.map((user) => ({ key: user.id, value: user }));
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

---

### findByIds()

> **findByIds**(`ids`): `Promise`\<readonly [`KeyedRepositoryResult`](/api/repository-core/src/type-aliases/keyedrepositoryresult/)\<`ID`, `T`\>[]\>

Find multiple entities by their IDs.

#### Parameters

##### ids

readonly `ID`[]

Array of entity IDs

#### Returns

`Promise`\<readonly [`KeyedRepositoryResult`](/api/repository-core/src/type-aliases/keyedrepositoryresult/)\<`ID`, `T`\>[]\>

Keyed results for found entities. Missing IDs are omitted, entries may be returned in
any order, and every requested ID may appear at most once.

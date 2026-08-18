---
editUrl: false
next: false
prev: false
title: "Repository"
---

Unified repository contract that combines read and write capabilities.

## Example

```typescript
interface User {
  id: string;
  name: string;
}

class UserRepository implements Repository<User, string> {
  // Read operations
  async findById(id: string): Promise<User | null> {
    /-* ... *-/;
  }
  async findByIds(
    ids: readonly string[],
  ): Promise<ReadonlyArray<KeyedRepositoryResult<string, User>>> {
    /-* ... *-/;
  }

  // Write operations
  async save(entity: User): Promise<User> {
    /-* ... *-/;
  }
  async deleteById(id: string): Promise<void> {
    /-* ... *-/;
  }
}
```

## Extends

- [`ReadRepository`](/api/repository-core/src/interfaces/readrepository/)\<`T`, `ID`\>.[`WriteRepository`](/api/repository-core/src/interfaces/writerepository/)\<`T`, `ID`\>

## Type Parameters

### T

`T`

The entity type this repository manages

### ID

`ID`

The ID type (e.g., string, number, or a custom ID class)

## Methods

### deleteById()

> **deleteById**(`id`): `Promise`\<`void`\>

Delete an entity by its ID.

#### Parameters

##### id

`ID`

The ID of the entity to delete

#### Returns

`Promise`\<`void`\>

#### Inherited from

[`WriteRepository`](/api/repository-core/src/interfaces/writerepository/).[`deleteById`](/api/repository-core/src/interfaces/writerepository/#deletebyid)

---

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

#### Inherited from

[`ReadRepository`](/api/repository-core/src/interfaces/readrepository/).[`findById`](/api/repository-core/src/interfaces/readrepository/#findbyid)

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

#### Inherited from

[`ReadRepository`](/api/repository-core/src/interfaces/readrepository/).[`findByIds`](/api/repository-core/src/interfaces/readrepository/#findbyids)

---

### save()

> **save**(`entity`): `Promise`\<`T`\>

Save an entity (insert or update).

#### Parameters

##### entity

`T`

The entity to save

#### Returns

`Promise`\<`T`\>

The saved entity (possibly with generated fields like ID)

#### Inherited from

[`WriteRepository`](/api/repository-core/src/interfaces/writerepository/).[`save`](/api/repository-core/src/interfaces/writerepository/#save)

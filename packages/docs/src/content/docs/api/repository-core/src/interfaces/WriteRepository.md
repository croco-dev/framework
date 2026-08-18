---
editUrl: false
next: false
prev: false
title: "WriteRepository"
---

Write-only repository contract for persisting and deleting entities.

## Example

```typescript
interface User {
  id: string;
  name: string;
}

class UserRepository implements WriteRepository<User, string> {
  async save(entity: User): Promise<User> {
    // Insert or update
  }

  async deleteById(id: string): Promise<void> {
    // Delete from database
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

### deleteById()

> **deleteById**(`id`): `Promise`\<`void`\>

Delete an entity by its ID.

#### Parameters

##### id

`ID`

The ID of the entity to delete

#### Returns

`Promise`\<`void`\>

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

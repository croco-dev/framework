# @croco/repository-core

TypeScript-safe repository pattern interfaces for Croco Framework.

## Overview

This package provides type-safe repository interfaces for data access layers. It follows the Repository pattern from Domain-Driven Design (DDD), separating data access logic from business logic.

## Installation

```bash
pnpm add @croco/repository-core
```

## Core Interfaces

### Repository<T, ID>

Unified repository interface combining read and write operations.

```typescript typecheck
import type { KeyedRepositoryResult, Repository } from "@croco/repository-core";

interface User {
  id: string;
  name: string;
  email: string;
}

class UserRepository implements Repository<User, string> {
  private readonly users = new Map<string, User>();

  // Read operations
  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async findByIds(
    ids: readonly string[],
  ): Promise<ReadonlyArray<KeyedRepositoryResult<string, User>>> {
    return [...new Set(ids)].flatMap((id) => {
      const user = this.users.get(id);
      return user ? [{ key: id, value: user }] : [];
    });
  }

  // Write operations
  async save(entity: User): Promise<User> {
    this.users.set(entity.id, entity);
    return entity;
  }

  async deleteById(id: string): Promise<void> {
    this.users.delete(id);
  }
}
```

`findByIds` returns `KeyedRepositoryResult<ID, T>` entries: `{ key: requestedId, value: entity }`.
The key lets `@BatchLoad` match results to requested IDs even when a data source returns them out of order.
Omit missing IDs and return each requested ID at most once.

### ReadRepository<T, ID>

Read-only operations for querying entities.

```typescript typecheck
import type { KeyedRepositoryResult, ReadRepository } from "@croco/repository-core";

interface User {
  id: string;
  name: string;
  email: string;
}

class UserQueryService implements ReadRepository<User, string> {
  constructor(private readonly users: ReadonlyMap<string, User>) {}

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async findByIds(
    ids: readonly string[],
  ): Promise<ReadonlyArray<KeyedRepositoryResult<string, User>>> {
    return [...new Set(ids)].flatMap((id) => {
      const user = this.users.get(id);
      return user ? [{ key: id, value: user }] : [];
    });
  }
}
```

### WriteRepository<T, ID>

Write-only operations for persisting entities.

```typescript
import type { WriteRepository } from "@croco/repository-core";

class UserCommandService implements WriteRepository<User, string> {
  async save(entity: User): Promise<User> {
    /* ... */
  }
  async deleteById(id: string): Promise<void> {
    /* ... */
  }
}
```

## Batch Loading

The `@BatchLoad` decorator automatically batches multiple `findById` calls into a single `findByIds` call, preventing N+1 queries.
Install `@croco/dataloader-core` and `@croco/framework-context` alongside `@croco/repository-core` for this example.

```typescript typecheck
import { registerBatchLoaderFactory } from "@croco/dataloader-core";
import { Context } from "@croco/framework-context";
import { BatchLoad, type KeyedRepositoryResult, type ReadRepository } from "@croco/repository-core";

interface User {
  id: string;
  name: string;
}

// 1. Register the batch loader factory
registerBatchLoaderFactory();

// 2. Apply the decorator to repository methods
class UserRepository implements ReadRepository<User, string> {
  constructor(private readonly users: ReadonlyMap<string, User>) {}

  @BatchLoad({ by: "id" })
  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async findByIds(
    ids: readonly string[],
  ): Promise<ReadonlyArray<KeyedRepositoryResult<string, User>>> {
    return [...new Set(ids)].flatMap((id) => {
      const user = this.users.get(id);
      return user ? [{ key: id, value: user }] : [];
    });
  }
}

// 3. Load within one request context
async function loadUsers() {
  return Context.run({ requestId: "example" }, async () => {
    const userRepository = new UserRepository(
      new Map([
        ["1", { id: "1", name: "Ada" }],
        ["2", { id: "2", name: "Lin" }],
      ]),
    );
    const [user1, user2, user3] = await Promise.all([
      userRepository.findById("1"),
      userRepository.findById("2"),
      userRepository.findById("1"),
    ]);
    return [user1, user2, user3];
  });
}

// findByIds runs once with ['1', '2']; the second lookup of '1' is cached.
void loadUsers();
```

### Batch Load Options

```typescript
interface BatchLoadOptions {
  /**
   * The field name to use as the key for mapping results.
   * Required to ensure the order of results matches the order of keys.
   */
  by: string;

  /**
   * The name of the DataLoader.
   * Defaults to `${ClassName}:${methodName}` if not provided.
   */
  name?: string;

  /**
   * Resolves the identity of the repository, tenant, data source, or transaction boundary that
   * may safely share one request-scoped loader. Defaults to the repository instance.
   */
  scope?: (repository: object) => string | number | bigint | boolean | symbol | object;
}
```

By default, two repository instances never share a loader, even when they have the same class. To
share batching and cached values across instances, return the same safe scope identity explicitly:

```typescript
const dataSourceScope = Symbol("primary-data-source");

class UserRepository {
  @BatchLoad<UserRepository>({
    by: "id",
    scope: () => dataSourceScope,
  })
  async findById(id: string): Promise<User | null> {
    // ...
  }
}
```

Transaction-aware repositories should resolve the active transaction on every invocation so a
repository that changes transactions cannot reuse an earlier loader:

```typescript
class TransactionalUserRepository {
  activeTransaction: object;

  @BatchLoad<TransactionalUserRepository>({
    by: "id",
    scope: (repository) => repository.activeTransaction,
  })
  async findById(id: string): Promise<User | null> {
    // ...
  }
}
```

Equal primitive scope values intentionally share. Prefer an object or symbol when the scope must
use reference identity. An explicit `name` is a strict alias: reusing it with another decorated
method or resolved scope in the same request throws `BatchLoaderScopeCollisionProblem` instead of
silently reading from the wrong backing store.

## Type Safety

All interfaces are fully typed with generics:

- **T**: The entity type (e.g., `User`, `Order`)
- **ID**: The ID type (e.g., `string`, `number`, or custom ID class)

```typescript
// String IDs (common)
class UserRepository implements Repository<User, string> {}

// Number IDs
class PostRepository implements Repository<Post, number> {}

// Custom ID class
class UserId {
  constructor(public value: string) {}
}
class TenantRepository implements Repository<Tenant, UserId> {}
```

## Immutability

Repository methods return immutable types:

- `findByIds` returns `ReadonlyArray<KeyedRepositoryResult<ID, T>>`
- This prevents accidental mutation of the result list while preserving each entity's requested ID

## Dependency Injection

Use with Croco's DI container:

```typescript
import { Component } from "@croco/framework-context";
import type { Repository } from "@croco/repository-core";

@Component()
class OrderService {
  constructor(private readonly orderRepository: Repository<Order, string>) {}

  async getOrder(id: string): Promise<Order | null> {
    return this.orderRepository.findById(id);
  }
}
```

## Architecture Notes

### Interface Layer

This package is an **interface layer** only. It does NOT contain:

- Database-specific implementations (Drizzle, Prisma, TypeORM)
- ORM-specific types or imports
- Concrete data access logic

### Implementation Pattern

Implementations should be in separate packages:

- `@croco/repository-drizzle` - Drizzle ORM implementation
- `@croco/repository-prisma` - Prisma implementation
- `@croco/repository-typeorm` - TypeORM implementation

Example implementation structure:

```typescript
// packages/repository-drizzle/src/AbstractDrizzleRepository.ts
import type { Repository } from "@croco/repository-core";

export abstract class AbstractDrizzleRepository<T, ID> implements Repository<T, ID> {
  // Drizzle-specific implementation
}
```

## Testing

```bash
# Run tests
pnpm test --filter=@croco/repository-core

# Run with coverage
pnpm test --filter=@croco/repository-core --coverage
```

## License

Apache-2.0

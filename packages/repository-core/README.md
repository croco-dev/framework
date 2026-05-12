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

```typescript
import type { Repository } from "@croco/repository-core";

interface User {
  id: string;
  name: string;
  email: string;
}

class UserRepository implements Repository<User, string> {
  // Read operations
  async findById(id: string): Promise<User | null> {
    // Fetch from database
  }

  async findByIds(ids: readonly string[]): Promise<ReadonlyArray<User>> {
    // Batch fetch
  }

  // Write operations
  async save(entity: User): Promise<User> {
    // Insert or update
  }

  async deleteById(id: string): Promise<void> {
    // Delete from database
  }
}
```

### ReadRepository<T, ID>

Read-only operations for querying entities.

```typescript
import type { ReadRepository } from "@croco/repository-core";

class UserQueryService implements ReadRepository<User, string> {
  async findById(id: string): Promise<User | null> {
    /* ... */
  }
  async findByIds(ids: readonly string[]): Promise<ReadonlyArray<User>> {
    /* ... */
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

```typescript
import { BatchLoad } from "@croco/repository-core";
import { BATCH_LOADER_FACTORY_TOKEN, IBatchLoaderFactory } from "@croco/repository-core";
import { Container } from "@croco/framework-context";

// 1. Register the batch loader factory
Container.set(BATCH_LOADER_FACTORY_TOKEN, myBatchLoaderFactory);

// 2. Apply the decorator to repository methods
class UserRepository {
  @BatchLoad({ by: "id" })
  async findById(id: string): Promise<User | null> {
    // Single record fetch
  }

  async findByIds(ids: readonly string[]): Promise<ReadonlyArray<User>> {
    // Batch fetch - called automatically when multiple findByIds are triggered
  }
}

// 3. Usage - automatically batched
const user1 = await userRepository.findById("1");
const user2 = await userRepository.findById("2");
const user3 = await userRepository.findById("1"); // Cached, no query

// Result: Only 1 batch query for ['1', '2'] instead of 3 separate queries
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
}
```

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

- `findByIds` returns `ReadonlyArray<T>` (not `T[]`)
- This prevents accidental mutation of cached entities

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

MIT

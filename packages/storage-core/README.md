# @croco/storage-core

Storage provider contracts and local storage implementation.

`@croco/storage-core` defines object storage and image-provider interfaces, common
storage Problems, and an in-memory provider for tests and local development. Concrete
cloud providers depend on these stable contracts.

## Public API

- `StorageProvider` and `ImageProvider` contracts.
- `BaseStorageProvider` - base class for provider implementations.
- `InMemoryStorageProvider` - test and local-development implementation.
- Storage Problems for invalid keys, missing files, upload failures, and delete
  failures.

## Usage

```typescript
import { InMemoryStorageProvider } from "@croco/storage-core";

const storage = new InMemoryStorageProvider();
await storage.put("avatars/user-1.png", new Uint8Array());
const object = await storage.get("avatars/user-1.png");
```

## Verification

```bash
pnpm --filter @croco/storage-core test
pnpm --filter @croco/storage-core typecheck
```

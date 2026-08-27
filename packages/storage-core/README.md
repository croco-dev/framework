# @croco/storage-core

Storage provider contracts and local storage implementation.

`@croco/storage-core` defines object storage and image-provider interfaces, common
storage Problems, and an in-memory provider for tests and local development. Concrete
cloud providers depend on these stable contracts.

## Public API

- `StorageProvider` and `ImageProvider` contracts.
- `StorageBody` and `StorageStream` - runtime-neutral byte and Web Stream contracts.
- `storageStreamFromBytes`, `readStorageStream`, and `readStorageBody` - portable conversions.
- `BaseStorageProvider` - base class for provider implementations.
- `InMemoryStorageProvider` - test and local-development implementation.
- `validateSignedUrlExpiry` and `MAX_SIGNED_URL_EXPIRY_SECONDS` - the shared signed-URL lifetime
  contract.
- Storage Problems for invalid keys, invalid signed-URL expiry, missing files, upload failures, and
  delete failures.

## Usage

```typescript
import { InMemoryStorageProvider } from "@croco/storage-core";

const storage = new InMemoryStorageProvider();
await storage.put("avatars/user-1.png", new Uint8Array());
const object = await storage.get("avatars/user-1.png");
```

`get()` explicitly buffers an object into `Uint8Array`. Use `getStream()` for large objects so the
provider can preserve its native streaming path.

## Node stream interop

The default entrypoint does not reference Node declarations. Node applications can opt into the
separate `@croco/storage-core/node` entrypoint when they need `node:stream` conversion:

```typescript
import { createReadStream } from "node:fs";
import { nodeReadableToStorageStream, storageStreamToNodeReadable } from "@croco/storage-core/node";

await storage.put("uploads/video.mp4", nodeReadableToStorageStream(createReadStream("video.mp4")));
const download = storageStreamToNodeReadable(await storage.getStream("uploads/video.mp4"));
```

Node `Buffer` values remain valid buffered bodies because `Buffer` extends `Uint8Array`.

## Signed URL expiry

`SignedUrlOptions.expiresIn` is always expressed in seconds. Every provider accepts only positive
safe integers from `1` through `604800` (seven days), inclusive. Invalid values fail before
provider-specific signing with `STORAGE_INVALID_SIGNED_URL_EXPIRY`.

## Verification

```bash
pnpm --filter @croco/storage-core test
pnpm --filter @croco/storage-core typecheck
```

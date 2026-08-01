# @croco/protocols-trpc

tRPC router generation for Croco route contracts.

`@croco/protocols-trpc` adapts Croco protocol-core route contracts into a tRPC router.
It keeps tRPC integration at the protocol boundary while preserving Croco route schema
and Problem contracts.

## Public API

- `createTrpcRouter` - creates a tRPC router from Croco route contract definitions.

## Usage

```typescript
import { createTrpcRouter } from "@croco/protocols-trpc";

const router = createTrpcRouter(routes);
```

## Route inputs

Body-only controller methods keep their existing tRPC input shape. When a controller declares
`@Param`, `@Query`, or `@Header` in addition to (or instead of) `@Body`, pass an envelope whose
keys name each declared input location:

```typescript
await caller.users.update({
  path: { id: "user-1" },
  query: { includeAudit: true },
  headers: { "x-tenant-id": "tenant-1" },
  body: { name: "Ada" },
});
```

The location schemas run before the controller method. `@Ctx()` receives the tRPC procedure
context and is not client input.

## Verification

```bash
pnpm --filter @croco/protocols-trpc test
pnpm --filter @croco/protocols-trpc typecheck
```

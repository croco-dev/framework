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

## Verification

```bash
pnpm --filter @croco/protocols-trpc test
pnpm --filter @croco/protocols-trpc typecheck
```

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

Every procedure runs inside an isolated Croco request context. Registered controllers and
lifecycle providers are resolved from the Croco container inside that boundary, so constructor
injection and request-scoped components work for concurrent calls. The adapter propagates
`requestId`, `tenantId`, `user`, `impersonation`, trace fields, runtime metadata, and runtime-inspector metadata
from the tRPC context. It also reads `x-request-id` and `traceparent` from `request` or `req`
headers when those fields are not provided directly.

Applications with a different tRPC context shape can map it explicitly:

```typescript
const router = createTrpcRouter(routes, {
  createRequestContext: (context) => ({
    requestId: context.correlationId as string,
    tenantId: context.accountId as string,
  }),
});
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

The location schemas run before the controller method. `@Ctx()` and `@Raw()` both receive the
unmodified tRPC procedure context and are not client input. For HTTP adapters, include the raw
request or other transport envelope fields in `createContext` when a controller needs them.

`@UsePipes` runs class pipes before method pipes on each body, path, query, or header argument,
inside the interceptor-wrapped handler and the Croco request DI boundary. Async transformations
are awaited; pipe failures reach the existing Problem/filter pipeline. Pipes receive REST
argument metadata (`body`, `param`, `query`, or `header`, plus the parameter name when declared).
Context and authentication arguments are preserved.

tRPC validates its input schema before running these pipes. HTTP runs route pipes before
parameter-level validation pipes, while contract-bound path/query schemas are parsed before
route pipes. A tRPC pipe therefore receives schema-parsed input and cannot repair input that
the tRPC schema rejects. The existing body-only and location-envelope shapes are preserved.

## Verification

```bash
pnpm --filter @croco/protocols-trpc test
pnpm --filter @croco/protocols-trpc typecheck
```

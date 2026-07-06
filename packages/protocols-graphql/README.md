# @croco/protocols-graphql

Code-first GraphQL protocol primitives for Croco.

`@croco/protocols-graphql` provides resolver decorators, metadata readers, guards,
interceptors, and GraphQL Problem mapping for Croco GraphQL schemas. It owns protocol
metadata while transports decide how schemas are executed.

## Public API

- GraphQL decorators such as `GraphQLResolver`, `Query`, `Mutation`, `Field`, and
  `ObjectType`.
- Metadata readers for registered resolvers.
- Guard and interceptor contracts plus default guard/interceptor helpers.
- GraphQL Problem mapping utilities.
- Versioned GraphQL contract snapshots and diffs for deterministic SDL and Croco
  resolver metadata review.

## Usage

```typescript
import { GraphQLResolver, Query } from "@croco/protocols-graphql";

@GraphQLResolver()
class HealthResolver {
  @Query(() => String)
  health(): string {
    return "ok";
  }
}
```

## Problem Error Extensions

`problemToGraphQLError()` maps a Croco `Problem` into a GraphQL error with
`extensions.code`, `extensions.status`, `extensions.title`, `extensions.type`, and
the fields already present on `problem.extensions`.

Unlike the HTTP transport, this protocol helper does not build an RFC 7807 response
body or derive `requestId` / `traceId` from request context. A resolver or transport
that wants correlation metadata in GraphQL errors should add safe `requestId` and
`traceId` extension values before conversion. It should also avoid placing
operator-only data or reserved Problem fields such as `code`, `status`, `title`, or
`type` in `problem.extensions`; the helper forwards extensions without applying the
HTTP Problem Details redaction and field-protection policy.

## Contract Snapshots

Use `createGraphQLContractSnapshot()` after schema compilation to persist the stable
SDL plus Croco-specific resolver metadata:

```typescript
import {
  createGraphQLContractSnapshot,
  diffGraphQLContractSnapshots,
  stringifyGraphQLContractSnapshot,
} from "@croco/protocols-graphql";

const snapshot = createGraphQLContractSnapshot(schema, { resolvers: [HealthResolver] });
const diff = diffGraphQLContractSnapshots(baselineSnapshot, snapshot);
```

Snapshots use `croco.graphql-contract.snapshot.v1` and include root operations,
resolver DI scope, method roles, guards, interceptors, and declared
`GraphQLProblemResponse` mappings. Diffs classify GraphQL schema breaking changes
with `graphql`'s schema comparison utilities and treat resolver metadata changes as
breaking contract drift.

## Verification

```bash
pnpm --filter @croco/protocols-graphql test
pnpm --filter @croco/protocols-graphql typecheck
```

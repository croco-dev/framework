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

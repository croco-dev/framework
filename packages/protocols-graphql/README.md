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

## Verification

```bash
pnpm --filter @croco/protocols-graphql test
pnpm --filter @croco/protocols-graphql typecheck
```

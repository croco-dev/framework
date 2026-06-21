# @croco/transports-graphql

GraphQL schema compilation and server transport for Croco.

`@croco/transports-graphql` compiles code-first GraphQL resolver metadata into an
executable schema and serves it through GraphQL Yoga. It keeps the server runtime
separate from protocol-level resolver contracts.

## Public API

- `SchemaCompiler` - builds GraphQL schemas from resolver metadata.
- `GraphQLServer` - initializes and serves the GraphQL Yoga runtime.
- GraphQL transport Problems for missing schema, missing resolvers, initialization, and
  request-body failures.
- Server and schema compilation option types.

## Usage

```typescript
import { GraphQLServer, SchemaCompiler } from "@croco/transports-graphql";

const schema = await new SchemaCompiler().compile({ resolvers: [HealthResolver] });
const server = new GraphQLServer({ schema });
```

## Verification

```bash
pnpm --filter @croco/transports-graphql test
pnpm --filter @croco/transports-graphql typecheck
```

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

## Failure Semantics

Resolver and context failures that are Croco `Problem` instances are converted through
the GraphQL protocol serializer before Yoga returns the GraphQL `errors` envelope. The
transport applies the same code-first, category-fallback redaction policy as HTTP:
public and safe-message Problems retain safe detail and allowlisted extensions, while
operator-only Problems return an opaque message with no Problem extensions.

Wrapped `GraphQLError` values use the same conversion when `originalError` is a Croco
`Problem`, retaining the GraphQL resolver path. Non-Problem errors continue through
Yoga's default masking behavior. User-provided Yoga plugins remain active. Runtime
errors do not expose `requestId`, `traceId`, telemetry, or `redactionPolicy` fields.
Yoga's server-side logger applies the same redaction to Croco Problems. Operators still
need deployment-specific secret handling for non-Problem failures.

## Verification

```bash
pnpm --filter @croco/transports-graphql test
pnpm --filter @croco/transports-graphql typecheck
```

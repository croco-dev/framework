# @croco/openapi-spec

OpenAPI emission for Croco route contracts.

`@croco/openapi-spec` turns Croco contract graphs into OpenAPI artifacts. It shares the
same schema descriptor boundary used by RPC code generation so unsupported schemas are
reported as explicit diagnostics instead of partially generated output.

## Public API

- `emitOpenAPI` - emits OpenAPI output from route metadata.
- `emitOpenAPIFromContractGraph` - emits OpenAPI output from a contract graph.
- `EmitOpenAPIOptions` and `ProblemResponseConfig` - generator configuration types.

## Usage

```typescript
import { emitOpenAPIFromContractGraph } from "@croco/openapi-spec";

const document = emitOpenAPIFromContractGraph(graph, {
  title: "Service API",
  version: "1.0.0",
});
```

Array query parameters are emitted with OpenAPI `style: form` and `explode: true`, matching
repeated query-key transport semantics. Array header parameters use `style: simple` and
`explode: false`, matching comma-delimited HTTP header values.

Contract-bound query and path parameters resolve their OpenAPI type and requiredness from
the named field of the contract's input object. Object-level refinements cannot be
represented as OpenAPI parameters, so only the field schema is emitted while runtime
validation keeps the full refined schema.

REST routes with guards include an `x-croco-guards` operation extension. It lists each
guard's name and attachment scope (`controller` or `route`) in execution order, including
inherited guards. Configure OpenAPI security schemes separately.
Custom coverage callers that supply observed fields or fingerprints must include guard
evidence for guarded routes. Earlier observations still validate for routes without guards.

## Verification

```bash
pnpm --filter @croco/openapi-spec test
pnpm --filter @croco/openapi-spec typecheck
```

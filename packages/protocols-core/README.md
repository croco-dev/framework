# @croco/protocols-core

Protocol-neutral route contract graph utilities.

`@croco/protocols-core` discovers controllers, extracts route intermediate
representations, snapshots route contracts, describes schema support, and verifies
consumer coverage. It is the shared build-time contract layer consumed by REST,
OpenAPI, RPC, and generated-client tooling.

## Public API

- Contract graph builders, diagnostics, snapshots, diffs, and consumer coverage helpers.
- `ContractGraphV1`, a JSON-safe REST route snapshot schema with `version: "croco.contract-graph.v1"`.
- Route schema helpers such as `defineRouteSchema`.
- Schema descriptor utilities for JSON-safe Zod support and diagnostics.
- Controller discovery and route IR extraction helpers.

## Authorized business operations

`defineOperation` declares a domain input schema, output projection schema, explicit
authorization and an optional input policy. `createOperation` binds a typed function
handler. Calling `invoke(input, serverContext)` and dispatching an explicitly bound
REST request use the same authorization → input validation → policy → handler → output
projection path. Authorization completes before an adapter reads its input source.
Authorization and policy callbacks complete without returning a value, or throw a
`Problem`; boolean results fail closed.

```typescript typecheck
import { ProblemFactory } from "@croco/problems-core";
import { createOperation, defineOperation } from "@croco/protocols-core";
import { z } from "zod";

type VerifiedContext = { tenantId: string; canPurchase: boolean };

const checkout = createOperation(
  defineOperation({
    id: "checkout.start",
    kind: "command",
    input: z.object({ productId: z.string().min(1) }),
    output: z.object({ productId: z.string(), tenantId: z.string() }),
    authorize(context: VerifiedContext) {
      if (!context.canPurchase) throw ProblemFactory.forbidden("checkout/denied");
    },
  }),
  (input, context) => ({ productId: input.productId, tenantId: context.tenantId }),
);

await checkout.invoke(
  { productId: "product_27" },
  { tenantId: "tenant_verified", canPurchase: true },
);
```

Schema input and parsed handler input remain distinct, as do handler output and
projected output. Input failures use `protocols-core/operation-input-invalid` (422);
invalid output uses `protocols-core/operation-output-invalid` (500) without embedding
the returned value. Input is never merged into authority. The server caller owns
credential verification and supplies context separately; do not construct it by
copying arbitrary request headers or domain input. A function operation is not
automatically public on any protocol.

This is the function/REST stage of #2842. Decorated-class operation discovery,
generated operation clients and native tRPC/GraphQL operation bindings are not
implemented by this API yet. Existing decorated controllers and native GraphQL
resolvers remain supported. Transaction, idempotency, cancellation and after-commit
behavior remain owned by the existing application/handler policies; this stage does
not introduce another transaction or execution engine.

## ContractGraph v1

`ContractGraphV1` is the stable JSON-safe snapshot shape for REST contract consumers such as
OpenAPI, RPC generation, docs, and drift checks:

```typescript
type ContractGraphV1 = {
  version: "croco.contract-graph.v1";
  routes: Array<{
    id: string;
    protocol: "rest";
    method: string;
    path: string;
    source: { path: string; line?: number; column?: number } | null;
    inputSchemas: {
      body: ContractSchemaSnapshot | null;
      path: ContractSchemaSnapshot | null;
      query: ContractSchemaSnapshot | null;
      headers: ContractSchemaSnapshot | null;
    };
    successStatus?: number;
    outputSchema: ContractSchemaSnapshot | null;
    problems: ContractGraphSnapshotProblemResponse[];
    policies: ContractGraphV1PolicyRef[];
    runtime: ContractGraphV1RuntimeRequirement[];
    di: ContractGraphV1DiRef[];
  }>;
  diagnostics: ContractDiagnostic[];
};
```

Use `createContractGraphV1(graph)` and `stringifyContractGraphV1(snapshot)` when a deterministic
JSON artifact is required. Weak or unsupported schemas stay visible as `diagnostics` instead of
being silently downgraded.

Generated snapshot and V1 routes include the effective `successStatus`: the declared 2xx status,
or 200 with a response schema and 204 without one. Persisted v1 artifacts may omit this field;
`parseContractGraphSnapshot` fills the same schema-based default, and semantic diff treats an
omitted status as equivalent to that explicit default. A changed effective status produces the
breaking diagnostic `contract-success-status-changed`. The schema-based default describes the
declared contract; handlers returning an undeclared body still follow the transport response policy.

## Usage

```typescript
import {
  assertContractGraphHasNoErrors,
  buildContractGraph,
  createContractGraphV1,
} from "@croco/protocols-core";

const graph = buildContractGraph([UserController]);
assertContractGraphHasNoErrors(graph);
const snapshot = createContractGraphV1(graph);
```

## Verification

```bash
pnpm --filter @croco/protocols-core test
pnpm --filter @croco/protocols-core typecheck
```

### Numeric and array snapshot constraints

Contract snapshots preserve Zod numeric `min`/`max` (including exclusive `gt`/`lt` bounds)
with `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, and `integer`.
Array `min`/`max`/`length` checks use `minItems`/`maxItems`. Repeated numeric checks retain the
strongest bound, and exact array lengths intersect with minimum/maximum checks.

Request compatibility permits constraint relaxation; response compatibility permits constraint
narrowing. The comparison recurses through object fields, records, transparent wrappers and array elements.
Union compatibility matches each source branch to a compatible target branch in the relevant direction.
Arrays with contradictory cardinalities have no values; zero-only arrays have no reachable element contract.
Numeric comparisons use finite representable JSON numbers, including adjacent float64 values and
integer-only high-magnitude ranges. Historical snapshots that omit constraints are treated as unconstrained: previously discarded checks cannot
be recovered, so regenerate a baseline from its original schema to compare those checks accurately.

Non-finite numeric bounds, numeric `multipleOf`, and non-integer or negative array cardinalities
produce `contract-schema-json-unsafe` diagnostics instead of silently dropping the constraint.
Numeric `finite` needs no extra snapshot field because JSON numbers are finite. Arbitrary refinement
functions remain outside static compatibility inference.

The operation executor does not create a process-global registry. Definitions are
snapshotted when bound; each invocation uses its own explicit server context.

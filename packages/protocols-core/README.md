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

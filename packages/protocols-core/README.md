# @croco/protocols-core

Protocol-neutral route contract graph utilities.

`@croco/protocols-core` discovers controllers, extracts route intermediate
representations, snapshots route contracts, describes schema support, and verifies
consumer coverage. It is the shared build-time contract layer consumed by REST,
OpenAPI, RPC, and generated-client tooling.

## Public API

- Contract graph builders, diagnostics, snapshots, diffs, and consumer coverage helpers.
- Monetization nodes, edges, structural diagnostics, and opt-in provider preflight contracts.
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
    outputSchema: ContractSchemaSnapshot | null;
    problems: ContractGraphSnapshotProblemResponse[];
    policies: ContractGraphV1PolicyRef[];
    runtime: ContractGraphV1RuntimeRequirement[];
    di: ContractGraphV1DiRef[];
  }>;
  diagnostics: ContractDiagnostic[];
  monetization?: ContractMonetizationGraph;
};
```

Use `createContractGraphV1(graph)` and `stringifyContractGraphV1(snapshot)` when a deterministic
JSON artifact is required. Weak or unsupported schemas stay visible as `diagnostics` instead of
being silently downgraded.

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

## Monetization verification

Declare monetization inputs in code and export them from a module included by the controller glob.
`@croco/rpc-codegen` merges those declarations into the canonical ContractGraph used by
`croco contracts check`; no second manifest is generated.

Operation-to-meter discovery requires a `@croco/metering-core` release that publishes
`@Metered` metadata through `Symbol.for("croco:metering:metered")`. Keep the protocols,
metering, and RPC codegen changesets from this feature on compatible workspace releases so an
older decorator cannot be mistaken for an operation without metering metadata.

```typescript
import { defineContractMonetization } from "@croco/protocols-core";

export const monetization = defineContractMonetization({
  meters: [apiCalls],
  planVersions: [{ plan: proPlanVersion, billedMeters: [apiCalls] }],
  entitlementSets: [proEntitlements],
  providers: [billingProviderProfile],
  providerMappings: [
    {
      provider: "billing-provider",
      planVersionRef: proPlanVersion.ref,
      productId: "product-pro",
      priceIds: ["price-pro-monthly"],
      meterBindings: [{ meter: apiCalls, externalMeterId: "provider-api-calls" }],
    },
  ],
});
```

Structural verification is deterministic, credential-free, and reports its source as
`credential-free-structural`. It rejects unbound billable meters, mismatched immutable plan and
entitlement versions, missing provider usage capabilities, missing provider mappings, and rating
mode conflicts. Every monetization diagnostic includes evidence references and a recovery action;
the human formatter and JSON snapshot use the same diagnostic record.

Remote mapping drift checks remain opt-in and cannot run during ordinary graph construction:

```typescript
import { runContractMonetizationProviderPreflight } from "@croco/protocols-core";

const monetizationGraph = graph.monetization;
if (monetizationGraph) {
  await runContractMonetizationProviderPreflight(monetizationGraph, {
    provider: "billing-provider",
    inspect: async ({ graph, signal }) => inspectRemoteMappings(graph, { signal }),
  });
}
```

Provider adapters return `remote-provider-preflight` evidence separately from structural graph
diagnostics. Applications decide when credentials and network access are permitted.

## Verification

```bash
pnpm --filter @croco/protocols-core test
pnpm --filter @croco/protocols-core typecheck
```

# @croco/protocols-core

Protocol-neutral route contract graph utilities.

`@croco/protocols-core` discovers controllers, extracts route intermediate
representations, snapshots route contracts, describes schema support, and verifies
consumer coverage. It is the shared build-time contract layer consumed by REST,
OpenAPI, RPC, and generated-client tooling.

## Public API

- Contract graph builders, diagnostics, snapshots, diffs, and consumer coverage helpers.
- Route schema helpers such as `defineRouteSchema`.
- Schema descriptor utilities for JSON-safe Zod support and diagnostics.
- Controller discovery and route IR extraction helpers.

## Usage

```typescript
import { assertContractGraphHasNoErrors, buildContractGraph } from "@croco/protocols-core";

const graph = buildContractGraph({ controllers: [UserController] });
assertContractGraphHasNoErrors(graph);
```

## Verification

```bash
pnpm --filter @croco/protocols-core test
pnpm --filter @croco/protocols-core typecheck
```

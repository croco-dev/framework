# @croco/rpc-codegen

Generated RPC clients for Croco route contracts.

`@croco/rpc-codegen` reads route metadata or contract graphs and emits typed RPC client
files. Generated clients preserve request, response, Problem, query-key, and optional
React Query contracts without hand-maintained glue code.

## Public API

- `generateClientFiles` - emits client files from route definitions.
- `generateClientFilesFromContractGraph` - emits client files from a contract graph.
- `loadContractGraph` and `loadRoutes` - load generator inputs.
- Generator option and Problem-runtime types.

## Usage

```typescript
import { generateClientFilesFromContractGraph } from "@croco/rpc-codegen";

await generateClientFilesFromContractGraph(graph, {
  outputDir: "./src/generated/rpc",
});
```

## Verification

```bash
pnpm --filter @croco/rpc-codegen test
pnpm --filter @croco/rpc-codegen typecheck
```

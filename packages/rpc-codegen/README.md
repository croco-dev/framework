# @croco/rpc-codegen

Generated RPC clients for Croco route contracts.

`@croco/rpc-codegen` reads route metadata or contract graphs and emits typed RPC client
files. Generated clients preserve request, response, Problem, query-key, and optional
React Query contracts without hand-maintained glue code.

## Public API

- `generateClientFiles` - emits client files from route definitions.
- `generateClientFilesFromContractGraph` - emits client files from a contract graph.
- `createFrontendActionManifestFromRoutes` and `createFrontendActionManifestFromContractGraph` -
  emit the shared frontend action manifest for generated REST RPC routes.
- `loadContractGraph` and `loadRoutes` - load generator inputs.
- Generator option and Problem-runtime types.

## Usage

```typescript
import { generateClientFilesFromContractGraph } from "@croco/rpc-codegen";

await generateClientFilesFromContractGraph(graph, "./src/generated/rpc", {
  frontendActionManifestPath: "./src/generated/frontend-action-manifest.json",
});
```

Each successful generation records its owned output paths and created directories in
`.croco-rpc-codegen.json`. Later generations remove only stale paths recorded by that manifest,
including newly empty generated directories, and preserve every unrelated file under the output
directory. Generation validates the complete client contract and ownership manifest before it
changes the previous output.

The manifest is a stable `croco.frontend-action-manifest.v1` artifact. It lets humans, CI, and
LLM tooling inspect which generated client actions exist, which REST contract each one calls, the
generated input/output type references, declared Problems, access metadata, entitlements, and
mutation invalidation hints.

CLI usage:

```bash
croco-rpc-codegen \
  --controllers "src/controllers/**/*.ts" \
  --out src/generated/rpc \
  --frontend-action-manifest src/generated/frontend-action-manifest.json
```

CI drift gate:

```bash
croco-rpc-codegen \
  --controllers "src/controllers/**/*.ts" \
  --frontend-action-manifest src/generated/frontend-action-manifest.json \
  --frontend-action-manifest-check
```

Generated clients accept an optional `RpcClientRequestOptions` argument. Browser apps can pass a
provider-neutral telemetry bridge from `@croco/telemetry-api` to attach correlation headers and
record request lifecycle events without replacing `fetch`.

```typescript
import { createFrontendTelemetryBridge } from "@croco/telemetry-api";
import { userClient } from "./generated/rpc";

const telemetry = createFrontendTelemetryBridge({
  sink: {
    record: (event) => {
      console.debug(event.kind, event.routeId, event.durationMs);
    },
  },
});

const result = await userClient.getUserResult(
  { path: { id: "user-1" } },
  { telemetry, correlationId: telemetry.correlationId },
);
```

Generated query arrays are serialized as repeated query keys. Generated header arrays accept
readonly arrays and serialize them as comma-separated header values, matching Croco HTTP runtime
validation and OpenAPI parameter serialization.

The generated runtime records `rpc.request.*` events for start, retry attempts, success, declared
Problems, external failures, and cancellations. Non-GET routes also emit `rpc.mutation.*` lifecycle
events. Event payloads are limited to route metadata, status, latency, correlation ids, and stable
Problem metadata; request bodies, query values, raw headers, response bodies, credentials, and
Problem `detail`/`instance` fields are intentionally not emitted.

Generated React Query hooks and mutation factories expose the same path through `options.rpc`:

```typescript
useGetUser({ path: { id: "user-1" } }, { rpc: { telemetry } });
useCreateUser({ rpc: { telemetry } });
```

## Verification

```bash
pnpm --filter @croco/rpc-codegen test
pnpm --filter @croco/rpc-codegen typecheck
```

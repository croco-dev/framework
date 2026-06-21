# @croco/preset-cloudflare

Cloudflare Workers preset for Croco builds.

`@croco/preset-cloudflare` provides a preset and fetch-handler helpers for running Croco
applications on Cloudflare Workers. It keeps worker-specific entrypoints and runtime
context outside the framework core.

## Public API

- `createCloudflarePreset` - creates the Workers build preset.
- `createWorkerFetchHandler` and `createRawHonoWorkerFetchHandler` - adapt app handlers
  to Workers fetch events.
- Worker fetch and runtime context types.

## Usage

```typescript
import { createCloudflarePreset } from "@croco/preset-cloudflare";

export default createCloudflarePreset({
  entry: "./src/fetch.ts",
});
```

## Verification

```bash
pnpm --filter @croco/preset-cloudflare test
pnpm --filter @croco/preset-cloudflare typecheck
```

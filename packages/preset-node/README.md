# @croco/preset-node

Node.js server preset for Croco builds.

`@croco/preset-node` defines the Node server build preset and entry adapter for
long-running Croco HTTP applications. It keeps Node server startup details isolated from
framework and protocol packages.

## Public API

- `createNodeServerPreset` - creates the Node build preset.
- `createNodeEntry` - builds the Node server entry handler.
- `NodeEntryCloseTimeoutProblem` - reports an invalid `close(timeoutMs)` value.
- `NodeEntryLifecycleProblem` - reports a stable lifecycle conflict when an entry is started after closing begins.
- Node entry option and handler types.

`NodeEntry.start()` shares concurrent startup work and is idempotent after the server starts.
`NodeEntry.close(timeoutMs?)` waits for active startup, shares concurrent shutdown work, and permanently closes
the entry. It rejects after 30 seconds by default if the Node server does not finish closing. Create a new entry
instead of calling `start()` after closing begins.

## Usage

```typescript
import { createNodeServerPreset } from "@croco/preset-node";

export default createNodeServerPreset();
```

## Verification

```bash
pnpm --filter @croco/preset-node test
pnpm --filter @croco/preset-node typecheck
```

# @croco/preset-node

Node.js server preset for Croco builds.

`@croco/preset-node` defines the Node server build preset and entry adapter for
long-running Croco HTTP applications. It keeps Node server startup details isolated from
framework and protocol packages.

## Public API

- `createNodeServerPreset` - creates the Node build preset.
- `createNodeEntry` - builds the Node server entry handler.
- Node entry option and handler types.

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

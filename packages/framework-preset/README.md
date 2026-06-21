# @croco/framework-preset

Typed preset contract for Croco build and runtime adapters.

`@croco/framework-preset` defines the shared preset shape used by environment-specific
packages. Presets declare their entrypoint, output format, and optional lifecycle hooks
without binding core framework code to a specific runtime.

## Public API

- `defineCrocoPreset` - creates an immutable preset object.
- `CrocoPreset`, `CrocoPresetConfig`, and `HookMap` - preset contract types.

## Usage

```typescript
import { defineCrocoPreset } from "@croco/framework-preset";

export const workerPreset = defineCrocoPreset({
  name: "worker",
  entry: "./fetch.js",
  output: {
    dir: "dist",
    format: "esm",
  },
});
```

## Verification

```bash
pnpm --filter @croco/framework-preset test
pnpm --filter @croco/framework-preset typecheck
```

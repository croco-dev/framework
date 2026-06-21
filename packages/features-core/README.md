# @croco/features-core

Feature flag abstraction for Croco applications.

`@croco/features-core` exposes the stable `FeatureManager` contract for boolean
feature checks and multivariate flag evaluation. Applications depend on this package
while concrete providers integrate with LaunchDarkly, PostHog, configuration stores, or
custom rollout logic.

## Public API

- `FeatureManager` - abstract manager for `isEnabled` and `getVariant`.

## Usage

```typescript
import { FeatureManager } from "@croco/features-core";

class StaticFeatureManager extends FeatureManager {
  async isEnabled(key: string): Promise<boolean> {
    return key === "new-dashboard";
  }

  async getVariant(): Promise<string> {
    return "control";
  }
}
```

## Verification

```bash
pnpm --filter @croco/features-core test
pnpm --filter @croco/features-core typecheck
```

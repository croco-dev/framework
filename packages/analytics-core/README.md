# @croco/analytics-core

Core analytics abstraction for Croco applications.

`@croco/analytics-core` defines `AnalyticsManager`, the framework-level contract for
capturing product events, identifying users, and associating users with groups or tenants.
Concrete providers, such as PostHog or custom warehouse integrations, implement this
contract while application services depend on the stable core API.

## Public API

- `AnalyticsManager` - abstract manager for `capture`, `identify`, and `group`
  operations.

## Usage

```typescript
import { AnalyticsManager } from "@croco/analytics-core";

class ProductAnalytics extends AnalyticsManager {
  capture(event: string, properties?: Record<string, unknown>): void {
    // Send the event to the provider implementation.
  }

  identify(distinctId: string, properties?: Record<string, unknown>): void {
    // Bind user traits to a provider profile.
  }

  group(groupType: string, groupKey: string, properties?: Record<string, unknown>): void {
    // Bind the user to a tenant, organization, or account group.
  }
}
```

## Verification

```bash
pnpm --filter @croco/analytics-core test
pnpm --filter @croco/analytics-core typecheck
```

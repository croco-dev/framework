# @croco/integrations-posthog

PostHog integration primitives for Croco applications.

`@croco/integrations-posthog` provides a typed PostHog client wrapper and configuration
Problem for applications or provider packages that need to send analytics events to
PostHog through the Croco integration layer.

## Public API

- `PostHogClient` - initializes and wraps the PostHog Node client.
- `PostHogConfig` - configuration type for API key and host settings.
- `PostHogConfigProblem` - stable Problem for missing or invalid PostHog config.

## Usage

```typescript
import { PostHogClient } from "@croco/integrations-posthog";

const posthog = new PostHogClient({
  apiKey: process.env.POSTHOG_API_KEY,
  host: process.env.POSTHOG_HOST,
});
```

## Verification

```bash
pnpm --filter @croco/integrations-posthog test
pnpm --filter @croco/integrations-posthog typecheck
```

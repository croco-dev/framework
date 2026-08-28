# @croco/integrations-posthog

PostHog integration primitives for Croco applications.

`@croco/integrations-posthog` provides a typed PostHog client wrapper and configuration
Problem for applications or provider packages that need to send analytics events to
PostHog through the Croco integration layer.

## Public API

- `PostHogClient` - initializes and wraps the PostHog Node client.
- `PostHogConfig` - configuration type for API key and host settings.
- `POSTHOG_CONFIG_TOKEN` - typed DI token for PostHog configuration.
- `registerPostHogConfig` - validates and registers configuration before client resolution.
- `validatePostHogConfig` - validates partial configuration and resolves its HTTP(S) host without
  mutating the container.
- `PostHogConfigProblem` - stable Problem for missing or invalid PostHog config.

## Dependency injection

Register configuration during application startup before resolving `PostHogClient` or a component
that depends on it. The API key must be non-empty and the host must be an HTTP(S) URL.

```typescript
import { Container } from "@croco/framework-context";
import { PostHogClient, registerPostHogConfig } from "@croco/integrations-posthog";

registerPostHogConfig({
  apiKey: process.env.POSTHOG_API_KEY ?? "",
  host: process.env.POSTHOG_HOST,
});

const posthog = Container.get(PostHogClient);
```

Missing registration fails with the stable `framework-context/di-resolution-failed` diagnostic.
Invalid registered values fail with `integrations-posthog/missing-config` before the container is
mutated.

## Direct construction

Direct construction remains supported and applies the same configuration validation.

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

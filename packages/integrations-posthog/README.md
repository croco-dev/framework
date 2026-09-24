# @croco/integrations-posthog

PostHog integration primitives for Croco applications.

`@croco/integrations-posthog` provides a typed PostHog client wrapper and configuration
Problem for applications or provider packages that need to send analytics events to
PostHog through the Croco integration layer.

## Public API

- `PostHogClient` - initializes and wraps the PostHog Node client with separate flush and shutdown lifecycle operations.
- `PostHogConfig` - configuration type for API key and host settings.
- `POSTHOG_CONFIG_TOKEN` - typed DI token for PostHog configuration.
- `createPostHogConfig` - validates and freezes configuration for explicit application providers.
- `validatePostHogConfig` - validates partial configuration and resolves its HTTP(S) host without
  mutating the container.
- `PostHogConfigProblem` - stable Problem for missing or invalid PostHog config.

## Dependency injection

Create configuration at the application composition root. The API key must be non-empty and the host
must be an HTTP(S) URL. Configuration creation and package imports do not register global providers.

```typescript
import { createApplicationRuntime, defineCrocoModule } from "@croco/framework-module";
import {
  POSTHOG_CONFIG_TOKEN,
  PostHogClient,
  createPostHogConfig,
} from "@croco/integrations-posthog";

const config = createPostHogConfig({
  apiKey: process.env.POSTHOG_API_KEY ?? "",
  host: process.env.POSTHOG_HOST,
});

const posthog = new PostHogClient(config);
const runtime = createApplicationRuntime({
  modules: [
    defineCrocoModule({
      name: "posthog",
      providers: [
        { provide: POSTHOG_CONFIG_TOKEN, useValue: config },
        { provide: PostHogClient, useValue: posthog },
      ],
      exports: [PostHogClient],
      shutdown: () => posthog.shutdown(),
    }),
  ],
});
await runtime.initialize();
// Compose this module into the application and inject PostHogClient into consumers.
// At application shutdown:
await runtime.dispose();
```

For generated DI, declare `POSTHOG_CONFIG_TOKEN` as a module provider in the compiler configuration
and pass the generated graph to the application runtime. `createPostHogConfig` replaces the removed
global `registerPostHogConfig` API; pass its return value through an explicit module `useValue` provider.
Invalid values fail with `integrations-posthog/missing-config` before application initialization.

## Direct construction

Direct construction remains supported and applies the same configuration validation.

```typescript
import { PostHogClient } from "@croco/integrations-posthog";

const posthog = new PostHogClient({
  apiKey: process.env.POSTHOG_API_KEY ?? "",
  host: process.env.POSTHOG_HOST,
});
```

## Lifecycle

Use `flush()` to send queued events while keeping the client reusable. Call `shutdown()` once when the
process is exiting and the client will not be used again.

```typescript
await posthog.flush();

// Process shutdown only
await posthog.shutdown();
```

## Verification

```bash
pnpm --filter @croco/integrations-posthog test
pnpm --filter @croco/integrations-posthog typecheck
```

# @croco/preset-lambda

AWS Lambda preset for Croco builds.

`@croco/preset-lambda` defines the Lambda build preset and handler adapter types used
to run Croco applications as Lambda functions. It composes with HTTP transport support
without adding Lambda assumptions to core packages.

## Public API

- `createLambdaPreset` - creates the Lambda build preset.
- `createLambdaHandler` - adapts an application handler to Lambda events and accepts transport
  `LambdaHandlerOptions`, including the invocation-end `flush` boundary.
- Lambda event, context, handler, options, and response types.

## Usage

```typescript
import { createLambdaPreset } from "@croco/preset-lambda";

export default createLambdaPreset();
```

Connect `TelemetryRuntime.forceFlush()` through the handler options so queued telemetry is exported
before the Lambda invocation returns. A rejected `flush` callback rejects the handler instead of
hiding an observability failure behind a successful response.

```typescript
import { createLambdaHandler } from "@croco/preset-lambda";
import { TelemetryForceFlushUnsupportedProblem, TelemetryRuntime } from "@croco/telemetry-sdk-node";

const telemetry = TelemetryRuntime.getInstance();

export const handler = createLambdaHandler(app, {
  flush: async () => {
    const result = await telemetry.forceFlush();
    if (result.outcome === "failed") {
      throw result.error;
    }
    if (result.outcome === "unsupported") {
      throw new TelemetryForceFlushUnsupportedProblem();
    }
  },
});
```

See [`@croco/transports-http`](../transports-http/README.md#앱-생성과-lambda-핸들러-노출) for the
complete telemetry initialization and flush pattern.

## Verification

```bash
pnpm --filter @croco/preset-lambda test
pnpm --filter @croco/preset-lambda typecheck
```

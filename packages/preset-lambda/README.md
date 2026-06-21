# @croco/preset-lambda

AWS Lambda preset for Croco builds.

`@croco/preset-lambda` defines the Lambda build preset and handler adapter types used
to run Croco applications as Lambda functions. It composes with HTTP transport support
without adding Lambda assumptions to core packages.

## Public API

- `createLambdaPreset` - creates the Lambda build preset.
- `createLambdaHandler` - adapts an application handler to Lambda events.
- Lambda event, context, handler, and response types.

## Usage

```typescript
import { createLambdaPreset } from "@croco/preset-lambda";

export default createLambdaPreset();
```

## Verification

```bash
pnpm --filter @croco/preset-lambda test
pnpm --filter @croco/preset-lambda typecheck
```

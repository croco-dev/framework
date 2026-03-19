---
editUrl: false
next: false
prev: false
title: "setLambdaContext"
---

> **setLambdaContext**(`context`): `void`

Defined in: [packages/retry-core/src/libs/LambdaTimeoutGuard.ts:34](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/retry-core/src/libs/LambdaTimeoutGuard.ts#L34)

Set the Lambda context for timeout checking.
Call this at the start of your Lambda handler.

## Parameters

### context

[`LambdaContext`](/api/retry-core/src/interfaces/lambdacontext/) | `null`

## Returns

`void`

## Example

```typescript
export const handler = async (event, context) => {
  setLambdaContext(context);
  // ... your code
};
```

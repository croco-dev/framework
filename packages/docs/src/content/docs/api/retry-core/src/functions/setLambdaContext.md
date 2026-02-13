---
editUrl: false
next: false
prev: false
title: "setLambdaContext"
---

> **setLambdaContext**(`context`): `void`

Defined in: [packages/retry-core/src/libs/LambdaTimeoutGuard.ts:26](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/retry-core/src/libs/LambdaTimeoutGuard.ts#L26)

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

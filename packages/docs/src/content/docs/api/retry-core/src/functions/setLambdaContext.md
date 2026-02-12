---
editUrl: false
next: false
prev: false
title: "setLambdaContext"
---

> **setLambdaContext**(`context`): `void`

Defined in: [packages/retry-core/src/libs/LambdaTimeoutGuard.ts:26](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/retry-core/src/libs/LambdaTimeoutGuard.ts#L26)

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

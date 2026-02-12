---
editUrl: false
next: false
prev: false
title: "Retryable"
---

> **Retryable**(`options?`): `MethodDecorator`

Defined in: [packages/retry-core/src/libs/Retryable.ts:41](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/retry-core/src/libs/Retryable.ts#L41)

Retry decorator for methods.

## Parameters

### options?

[`RetryableOptions`](/api/retry-core/src/interfaces/retryableoptions/) = `{}`

## Returns

`MethodDecorator`

## Example

```typescript
class Service {
  @Retryable({ maxAttempts: 3, backoff: { delay: 1000 } })
  async fetchData(): Promise<Data> {
    return await this.api.get('/data');
  }
}
```

---
editUrl: false
next: false
prev: false
title: "Retryable"
---

> **Retryable**(`options?`): `MethodDecorator`

Defined in: [packages/retry-core/src/libs/Retryable.ts:74](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/retry-core/src/libs/Retryable.ts#L74)

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

---
editUrl: false
next: false
prev: false
title: "Retryable"
---

> **Retryable**(`options?`): `MethodDecorator`

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

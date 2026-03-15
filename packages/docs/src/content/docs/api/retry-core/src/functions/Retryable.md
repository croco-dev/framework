---
editUrl: false
next: false
prev: false
title: "Retryable"
---

> **Retryable**(`options?`): `MethodDecorator`

Defined in: [packages/retry-core/src/libs/Retryable.ts:74](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/retry-core/src/libs/Retryable.ts#L74)

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

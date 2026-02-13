---
editUrl: false
next: false
prev: false
title: "Recover"
---

> **Recover**(`exceptionType?`): `MethodDecorator`

Defined in: [packages/retry-core/src/libs/Recover.ts:34](https://github.com/croco-dev/shared/blob/f4909b56644431401bcba1824d0465856b7783c7/packages/retry-core/src/libs/Recover.ts#L34)

Decorator to mark a method as a recovery handler.

The recovery method receives the error as first argument,
followed by the original method arguments.

## Parameters

### exceptionType?

(...`args`) => `Error`

## Returns

`MethodDecorator`

## Example

```typescript
class Service {
  @Retryable({ maxAttempts: 3 })
  async fetchData(): Promise<Data> {
    return await this.api.get('/data');
  }

  @Recover(ApiError)
  async handleApiError(error: ApiError): Promise<Data> {
    return this.cache.get('data');
  }
}
```

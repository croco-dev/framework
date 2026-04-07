---
editUrl: false
next: false
prev: false
title: "Recover"
---

> **Recover**(`exceptionType?`): `MethodDecorator`

Defined in: [packages/retry-core/src/libs/Recover.ts:36](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/retry-core/src/libs/Recover.ts#L36)

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

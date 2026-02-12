---
editUrl: false
next: false
prev: false
title: "Metered"
---

> **Metered**(`options`): `MethodDecorator`

Defined in: [packages/metering-core/src/libs/decorators/Metered.ts:64](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/metering-core/src/libs/decorators/Metered.ts#L64)

## Parameters

### options

[`MeteredOptions`](/api/metering-core/src/type-aliases/meteredoptions/)

## Returns

`MethodDecorator`

## Metered

메서드 데코레이터

## Description

메서드 호출 시 자동으로 Usage를 기록합니다.
메서드 실행 후 MeteringService.record()를 호출합니다.

## Example

```typescript
class ApiService {
  @Metered({ meterId: 'api_calls' })
  async handleRequest(req: Request): Promise<Response> {
    // ...
  }

  @Metered({
    meterId: 'data_transfer',
    valueExtractor: (args, result) => (result as { size: number }).size,
  })
  async transferData(data: Buffer): Promise<{ size: number }> {
    // ...
  }
}
```

---
editUrl: false
next: false
prev: false
title: "Meter"
---

> **Meter**(`options`): `ClassDecorator`

Defined in: [packages/metering-core/src/libs/decorators/Meter.ts:35](https://github.com/croco-dev/shared/blob/bb21af4df68d72ef2fe52956bb5c72347d9133c7/packages/metering-core/src/libs/decorators/Meter.ts#L35)

## Parameters

### options

[`MeterOptions`](/api/metering-core/src/type-aliases/meteroptions/)

## Returns

`ClassDecorator`

## Meter

클래스 데코레이터

## Description

클래스에 Meter 정의를 메타데이터로 저장합니다.
앱 시작 시 MeterRegistry에 자동 등록될 수 있습니다.

## Example

```typescript
@Meter({ meterId: 'api_calls', type: 'COUNT', quota: 1000 })
class ApiController {
  // ...
}
```

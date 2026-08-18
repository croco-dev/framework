---
editUrl: false
next: false
prev: false
title: "Metered"
---

Metered 메서드 데코레이터와 서비스 바인딩 헬퍼입니다.

## Description

메서드 호출 시 자동으로 사용량을 기록하는 데코레이터와 서비스 관리 기능을 제공합니다.

## Example

```typescript
// 데코레이터 사용
class ApiService {
  @Metered({ meterId: "api_calls" })
  async handleRequest(req: Request): Promise<Response> {
    return { status: 200 };
  }

  // 커스텀 value 추출
  @Metered({
    meterId: "data_transfer",
    valueExtractor: (args, result) => result.size,
  })
  async uploadFile(file: Buffer): Promise<{ size: number }> {
    return { size: file.length };
  }
}

// 서비스 설정
setMeteringService(meteringService);
const service = getMeteringService();
```

## Call Signature

> **Metered**\<`Meter`\>(`options`): `MethodDecorator`

### Type Parameters

#### Meter

`Meter` _extends_ [`CountMeterRef`](/api/metering-core/src/type-aliases/countmeterref/)

### Parameters

#### options

[`MeteredRefOptions`](/api/metering-core/src/type-aliases/meteredrefoptions/)\<`Meter`\>

### Returns

`MethodDecorator`

### Metered

메서드 데코레이터

### Description

메서드 호출 시 자동으로 Usage를 기록합니다.
메서드 실행 후 MeteringService.record()를 호출합니다.
billing-required meter의 기록 실패는 원본 메서드가 완료된 뒤 전파되므로, 재시도 시 비즈니스 로직이
반복될 수 있습니다. billing-required meter를 사용하는 구현은 자체 재시도 안전장치를 두고 원본
비즈니스 로직의 멱등성을 보장해야 합니다.

### Example

```typescript
const apiCalls = defineMeter({
  key: "api.calls",
  aggregation: "COUNT",
  unit: "request",
  dimensions: {
    region: dimension.enum(["us", "eu"]),
  },
  billing: "required",
});

class ApiService {
  @Metered({
    meter: apiCalls,
    eventIdExtractor: ([request]) => (request as { eventId: string }).eventId,
    dimensionsExtractor: ([request]) => ({
      region: (request as { region: "us" | "eu" }).region,
    }),
  })
  async listUsers(request: { eventId: string; region: "us" | "eu" }): Promise<void> {
    // ...
  }

  @Metered({ meterId: "api_calls" })
  async handleRequest(req: Request): Promise<Response> {
    // ...
  }

  @Metered({
    meterId: "data_transfer",
    valueExtractor: (args, result) => (result as { size: number }).size,
  })
  async transferData(data: Buffer): Promise<{ size: number }> {
    // ...
  }
}
```

## Call Signature

> **Metered**(`options`): `MethodDecorator`

### Parameters

#### options

[`MeteredOptions`](/api/metering-core/src/type-aliases/meteredoptions/)

### Returns

`MethodDecorator`

### Metered

메서드 데코레이터

### Description

메서드 호출 시 자동으로 Usage를 기록합니다.
메서드 실행 후 MeteringService.record()를 호출합니다.
billing-required meter의 기록 실패는 원본 메서드가 완료된 뒤 전파되므로, 재시도 시 비즈니스 로직이
반복될 수 있습니다. billing-required meter를 사용하는 구현은 자체 재시도 안전장치를 두고 원본
비즈니스 로직의 멱등성을 보장해야 합니다.

### Example

```typescript
const apiCalls = defineMeter({
  key: "api.calls",
  aggregation: "COUNT",
  unit: "request",
  dimensions: {
    region: dimension.enum(["us", "eu"]),
  },
  billing: "required",
});

class ApiService {
  @Metered({
    meter: apiCalls,
    eventIdExtractor: ([request]) => (request as { eventId: string }).eventId,
    dimensionsExtractor: ([request]) => ({
      region: (request as { region: "us" | "eu" }).region,
    }),
  })
  async listUsers(request: { eventId: string; region: "us" | "eu" }): Promise<void> {
    // ...
  }

  @Metered({ meterId: "api_calls" })
  async handleRequest(req: Request): Promise<Response> {
    // ...
  }

  @Metered({
    meterId: "data_transfer",
    valueExtractor: (args, result) => (result as { size: number }).size,
  })
  async transferData(data: Buffer): Promise<{ size: number }> {
    // ...
  }
}
```

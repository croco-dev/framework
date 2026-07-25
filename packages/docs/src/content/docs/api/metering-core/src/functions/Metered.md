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

> **Metered**\<`TMeter`\>(`options`): `MethodDecorator`

### Type Parameters

#### TMeter

`TMeter` _extends_ [`MeterRef`](/api/metering-core/src/type-aliases/meterref/)

### Parameters

#### options

[`TypedMeteredOptions`](/api/metering-core/src/type-aliases/typedmeteredoptions/)\<`TMeter`\>

### Returns

`MethodDecorator`

### Metered

메서드 데코레이터

### Description

메서드 호출 시 자동으로 Usage를 기록합니다.
메서드 실행 후 MeteringService.record()를 호출합니다.

### Example

```typescript
class ApiService {
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

[`LegacyMeteredOptions`](/api/metering-core/src/type-aliases/legacymeteredoptions/)

### Returns

`MethodDecorator`

### Metered

메서드 데코레이터

### Description

메서드 호출 시 자동으로 Usage를 기록합니다.
메서드 실행 후 MeteringService.record()를 호출합니다.

### Example

```typescript
class ApiService {
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

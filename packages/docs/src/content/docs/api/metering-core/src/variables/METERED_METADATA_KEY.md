---
editUrl: false
next: false
prev: false
title: "METERED_METADATA_KEY"
---

> `const` **METERED\_METADATA\_KEY**: *typeof* `METERED_METADATA_KEY`

Defined in: [packages/metering-core/src/libs/decorators/Metered.ts:7](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/metering-core/src/libs/decorators/Metered.ts#L7)

Metered 메서드 데코레이터와 서비스 바인딩 헬퍼입니다.

## Description

메서드 호출 시 자동으로 사용량을 기록하는 데코레이터와 서비스 관리 기능을 제공합니다.

## Example

```typescript
// 데코레이터 사용
class ApiService {
  @Metered({ meterId: 'api_calls' })
  async handleRequest(req: Request): Promise<Response> {
    return { status: 200 };
  }

  // 커스텀 value 추출
  @Metered({
    meterId: 'data_transfer',
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

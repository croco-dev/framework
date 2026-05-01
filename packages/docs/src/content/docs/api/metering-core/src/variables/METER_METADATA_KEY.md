---
editUrl: false
next: false
prev: false
title: "METER_METADATA_KEY"
---

> `const` **METER\_METADATA\_KEY**: *typeof* `METER_METADATA_KEY`

Meter 클래스 데코레이터와 메타데이터 조회 헬퍼입니다.

## Description

클래스에 Meter 정의를 추가하고 메타데이터를 조회하는 기능을 제공합니다.

## Example

```typescript
// 데코레이터로 Meter 정의
@Meter({
  meterId: 'api_calls',
  type: 'COUNT',
  quota: 10000,
})
class ApiController {
  @Metered({ meterId: 'api_calls' })
  async handleRequest() {
    // 자동으로 사용량 기록
  }
}

// 메타데이터 조회
const metadata = getMeterMetadata(ApiController);
```

---
editUrl: false
next: false
prev: false
title: "RequestContext"
---

Defined in: [packages/framework-context/src/libs/types.ts:20](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/types.ts#L20)

요청 단위로 전달되는 공통 컨텍스트 타입입니다.

## Example

```typescript
import type { RequestContext } from '@croco/framework-context';

const ctx: RequestContext = {
  requestId: 'req-123',
  tenantId: 'tenant-a',
};
```

## Properties

### requestId

> **requestId**: `string`

Defined in: [packages/framework-context/src/libs/types.ts:21](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/types.ts#L21)

요청 고유 식별자입니다.

***

### tenantId?

> `optional` **tenantId**: `string`

Defined in: [packages/framework-context/src/libs/types.ts:23](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/types.ts#L23)

멀티 테넌트 식별자입니다.

***

### traceId?

> `optional` **traceId**: `string`

Defined in: [packages/framework-context/src/libs/types.ts:24](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/types.ts#L24)

분산 추적 식별자입니다.

***

### user?

> `optional` **user**: `UserContext`

Defined in: [packages/framework-context/src/libs/types.ts:22](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/types.ts#L22)

현재 사용자 정보입니다.

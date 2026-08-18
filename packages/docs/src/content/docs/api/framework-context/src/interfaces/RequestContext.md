---
editUrl: false
next: false
prev: false
title: "RequestContext"
---

요청 단위로 전달되는 공통 컨텍스트 타입입니다.

## Example

```typescript
import type { RequestContext } from "@croco/framework-context";

const ctx: RequestContext = {
  requestId: "req-123",
  tenantId: "tenant-a",
};
```

## Properties

### inspectionId?

> `optional` **inspectionId?**: `string`

---

### requestId

> **requestId**: `string`

요청 고유 식별자입니다.

---

### runtime?

> `optional` **runtime?**: [`RuntimeContext`](/api/framework-context/src/interfaces/runtimecontext/)

---

### runtimeInspector?

> `optional` **runtimeInspector?**: [`RuntimeInspectorRecorder`](/api/framework-context/src/interfaces/runtimeinspectorrecorder/)

---

### spanId?

> `optional` **spanId?**: `string`

---

### tenantId?

> `optional` **tenantId?**: `string`

멀티 테넌트 식별자입니다.

---

### traceFlags?

> `optional` **traceFlags?**: `string` \| `number`

---

### traceId?

> `optional` **traceId?**: `string`

분산 추적 식별자입니다.

---

### user?

> `optional` **user?**: `UserContext`

현재 사용자 정보입니다.

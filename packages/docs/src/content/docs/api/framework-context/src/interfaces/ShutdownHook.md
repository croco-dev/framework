---
editUrl: false
next: false
prev: false
title: "ShutdownHook"
---

graceful shutdown 단계에서 호출되는 훅 인터페이스 타입입니다.

## Example

```typescript
import type { ShutdownHook } from "@croco/framework-context";

const hook: ShutdownHook = {
  onShutdown: async () => {},
};
```

## Methods

### onShutdown()

> **onShutdown**(`signal?`): `Promise`\<`void`\>

종료 시 실행되는 비동기 정리 함수입니다.

#### Parameters

##### signal?

`AbortSignal`

#### Returns

`Promise`\<`void`\>

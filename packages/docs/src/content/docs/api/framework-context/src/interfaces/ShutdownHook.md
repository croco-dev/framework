---
editUrl: false
next: false
prev: false
title: "ShutdownHook"
---

Defined in: [packages/framework-context/src/libs/types.ts:37](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/types.ts#L37)

graceful shutdown 단계에서 호출되는 훅 인터페이스 타입입니다.

## Example

```typescript
import type { ShutdownHook } from '@croco/framework-context';

const hook: ShutdownHook = {
  onShutdown: async () => {},
};
```

## Methods

### onShutdown()

> **onShutdown**(`signal?`): `Promise`\<`void`\>

Defined in: [packages/framework-context/src/libs/types.ts:38](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/framework-context/src/libs/types.ts#L38)

종료 시 실행되는 비동기 정리 함수입니다.

#### Parameters

##### signal?

`AbortSignal`

#### Returns

`Promise`\<`void`\>

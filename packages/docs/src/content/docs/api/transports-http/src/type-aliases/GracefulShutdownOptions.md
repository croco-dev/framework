---
editUrl: false
next: false
prev: false
title: "GracefulShutdownOptions"
---

> **GracefulShutdownOptions** = `object`

graceful shutdown 상태를 관리하는 미들웨어와 제어 함수입니다.

## Properties

### eventBusDrainTimeoutMs?

> `optional` **eventBusDrainTimeoutMs?**: `number`

---

### isLambdaEnvironment?

> `optional` **isLambdaEnvironment?**: `boolean`

---

### logger?

> `optional` **logger?**: [`ILogger`](/api/framework-context/src/interfaces/ilogger/)

---

### onShutdown?

> `optional` **onShutdown?**: (`signal`) => `void` \| `Promise`\<`void`\>

#### Parameters

##### signal

`AbortSignal`

#### Returns

`void` \| `Promise`\<`void`\>

---

### signals?

> `optional` **signals?**: `NodeJS.Signals`[]

---

### timeoutMs?

> `optional` **timeoutMs?**: `number`

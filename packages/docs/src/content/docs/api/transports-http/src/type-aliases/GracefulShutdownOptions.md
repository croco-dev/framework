---
editUrl: false
next: false
prev: false
title: "GracefulShutdownOptions"
---

> **GracefulShutdownOptions** = `object`

Defined in: [packages/transports-http/src/libs/middleware/GracefulShutdownMiddleware.ts:4](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/middleware/GracefulShutdownMiddleware.ts#L4)

graceful shutdown 상태를 관리하는 미들웨어와 제어 함수입니다.

## Properties

### eventBusDrainTimeoutMs?

> `optional` **eventBusDrainTimeoutMs**: `number`

Defined in: [packages/transports-http/src/libs/middleware/GracefulShutdownMiddleware.ts:9](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/middleware/GracefulShutdownMiddleware.ts#L9)

***

### isLambdaEnvironment?

> `optional` **isLambdaEnvironment**: `boolean`

Defined in: [packages/transports-http/src/libs/middleware/GracefulShutdownMiddleware.ts:10](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/middleware/GracefulShutdownMiddleware.ts#L10)

***

### logger?

> `optional` **logger**: [`ILogger`](/api/framework-context/src/interfaces/ilogger/)

Defined in: [packages/transports-http/src/libs/middleware/GracefulShutdownMiddleware.ts:8](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/middleware/GracefulShutdownMiddleware.ts#L8)

***

### onShutdown()?

> `optional` **onShutdown**: () => `void` \| `Promise`\<`void`\>

Defined in: [packages/transports-http/src/libs/middleware/GracefulShutdownMiddleware.ts:6](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/middleware/GracefulShutdownMiddleware.ts#L6)

#### Returns

`void` \| `Promise`\<`void`\>

***

### signals?

> `optional` **signals**: `NodeJS.Signals`[]

Defined in: [packages/transports-http/src/libs/middleware/GracefulShutdownMiddleware.ts:7](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/middleware/GracefulShutdownMiddleware.ts#L7)

***

### timeoutMs?

> `optional` **timeoutMs**: `number`

Defined in: [packages/transports-http/src/libs/middleware/GracefulShutdownMiddleware.ts:5](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/middleware/GracefulShutdownMiddleware.ts#L5)

---
editUrl: false
next: false
prev: false
title: "GracefulShutdownOptions"
---

> **GracefulShutdownOptions** = `object`

Defined in: [packages/transports-http/src/libs/middleware/GracefulShutdownMiddleware.ts:3](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/transports-http/src/libs/middleware/GracefulShutdownMiddleware.ts#L3)

## Properties

### onShutdown()?

> `optional` **onShutdown**: () => `void` \| `Promise`\<`void`\>

Defined in: [packages/transports-http/src/libs/middleware/GracefulShutdownMiddleware.ts:5](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/transports-http/src/libs/middleware/GracefulShutdownMiddleware.ts#L5)

#### Returns

`void` \| `Promise`\<`void`\>

***

### signals?

> `optional` **signals**: `NodeJS.Signals`[]

Defined in: [packages/transports-http/src/libs/middleware/GracefulShutdownMiddleware.ts:6](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/transports-http/src/libs/middleware/GracefulShutdownMiddleware.ts#L6)

***

### timeoutMs?

> `optional` **timeoutMs**: `number`

Defined in: [packages/transports-http/src/libs/middleware/GracefulShutdownMiddleware.ts:4](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/transports-http/src/libs/middleware/GracefulShutdownMiddleware.ts#L4)

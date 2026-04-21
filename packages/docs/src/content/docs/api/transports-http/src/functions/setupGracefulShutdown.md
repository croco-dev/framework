---
editUrl: false
next: false
prev: false
title: "setupGracefulShutdown"
---

> **setupGracefulShutdown**(`options?`): () => `Promise`\<`void`\>

Defined in: [packages/transports-http/src/libs/middleware/GracefulShutdownMiddleware.ts:90](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/middleware/GracefulShutdownMiddleware.ts#L90)

원하는 시점에 graceful shutdown 절차를 실행할 함수를 생성합니다.

## Parameters

### options?

[`GracefulShutdownOptions`](/api/transports-http/src/type-aliases/gracefulshutdownoptions/) = `{}`

## Returns

> (): `Promise`\<`void`\>

### Returns

`Promise`\<`void`\>

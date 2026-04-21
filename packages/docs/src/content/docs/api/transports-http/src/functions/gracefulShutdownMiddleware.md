---
editUrl: false
next: false
prev: false
title: "gracefulShutdownMiddleware"
---

> **gracefulShutdownMiddleware**(`options?`): [`MiddlewareFunction`](/api/transports-http/src/type-aliases/middlewarefunction/)

Defined in: [packages/transports-http/src/libs/middleware/GracefulShutdownMiddleware.ts:46](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/middleware/GracefulShutdownMiddleware.ts#L46)

shutdown 상태에서 새 요청을 차단하고 활성 요청 완료를 기다리는 미들웨어입니다.

## Parameters

### options?

[`GracefulShutdownOptions`](/api/transports-http/src/type-aliases/gracefulshutdownoptions/) = `{}`

## Returns

[`MiddlewareFunction`](/api/transports-http/src/type-aliases/middlewarefunction/)

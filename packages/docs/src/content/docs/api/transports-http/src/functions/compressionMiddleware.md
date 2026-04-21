---
editUrl: false
next: false
prev: false
title: "compressionMiddleware"
---

> **compressionMiddleware**(`options?`): [`MiddlewareFunction`](/api/transports-http/src/type-aliases/middlewarefunction/)

Defined in: [packages/transports-http/src/libs/middleware/CompressionMiddleware.ts:18](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/transports-http/src/libs/middleware/CompressionMiddleware.ts#L18)

응답 크기와 Accept-Encoding 헤더를 기준으로 압축을 적용하는 미들웨어입니다.

## Parameters

### options?

[`CompressionOptions`](/api/transports-http/src/type-aliases/compressionoptions/) = `{}`

## Returns

[`MiddlewareFunction`](/api/transports-http/src/type-aliases/middlewarefunction/)

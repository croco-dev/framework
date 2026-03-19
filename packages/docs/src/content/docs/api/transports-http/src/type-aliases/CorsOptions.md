---
editUrl: false
next: false
prev: false
title: "CorsOptions"
---

> **CorsOptions** = `object`

Defined in: [packages/transports-http/src/libs/middleware/CorsMiddleware.ts:3](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/middleware/CorsMiddleware.ts#L3)

CORS 미들웨어 및 옵션 타입입니다.

## Properties

### allowedHeaders?

> `optional` **allowedHeaders**: `string`[]

Defined in: [packages/transports-http/src/libs/middleware/CorsMiddleware.ts:9](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/middleware/CorsMiddleware.ts#L9)

Allowed request headers

***

### credentials?

> `optional` **credentials**: `boolean`

Defined in: [packages/transports-http/src/libs/middleware/CorsMiddleware.ts:11](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/middleware/CorsMiddleware.ts#L11)

Whether to include credentials. Default: false

***

### maxAge?

> `optional` **maxAge**: `number`

Defined in: [packages/transports-http/src/libs/middleware/CorsMiddleware.ts:13](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/middleware/CorsMiddleware.ts#L13)

Preflight cache duration in seconds. Default: 86400 (24 hours)

***

### methods?

> `optional` **methods**: `string`[]

Defined in: [packages/transports-http/src/libs/middleware/CorsMiddleware.ts:7](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/middleware/CorsMiddleware.ts#L7)

Allowed HTTP methods. Default: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']

***

### origins

> **origins**: `string`[]

Defined in: [packages/transports-http/src/libs/middleware/CorsMiddleware.ts:5](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/transports-http/src/libs/middleware/CorsMiddleware.ts#L5)

Allowed origins (allowlist)

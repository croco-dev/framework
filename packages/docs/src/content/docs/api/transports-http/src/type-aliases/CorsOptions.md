---
editUrl: false
next: false
prev: false
title: "CorsOptions"
---

> **CorsOptions** = `object`

Defined in: [packages/transports-http/src/libs/middleware/CorsMiddleware.ts:3](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/transports-http/src/libs/middleware/CorsMiddleware.ts#L3)

## Properties

### allowedHeaders?

> `optional` **allowedHeaders**: `string`[]

Defined in: [packages/transports-http/src/libs/middleware/CorsMiddleware.ts:9](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/transports-http/src/libs/middleware/CorsMiddleware.ts#L9)

Allowed request headers

***

### credentials?

> `optional` **credentials**: `boolean`

Defined in: [packages/transports-http/src/libs/middleware/CorsMiddleware.ts:11](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/transports-http/src/libs/middleware/CorsMiddleware.ts#L11)

Whether to include credentials. Default: false

***

### maxAge?

> `optional` **maxAge**: `number`

Defined in: [packages/transports-http/src/libs/middleware/CorsMiddleware.ts:13](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/transports-http/src/libs/middleware/CorsMiddleware.ts#L13)

Preflight cache duration in seconds. Default: 86400 (24 hours)

***

### methods?

> `optional` **methods**: `string`[]

Defined in: [packages/transports-http/src/libs/middleware/CorsMiddleware.ts:7](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/transports-http/src/libs/middleware/CorsMiddleware.ts#L7)

Allowed HTTP methods. Default: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']

***

### origins

> **origins**: `string`[]

Defined in: [packages/transports-http/src/libs/middleware/CorsMiddleware.ts:5](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/transports-http/src/libs/middleware/CorsMiddleware.ts#L5)

Allowed origins (allowlist)
